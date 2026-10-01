import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client-local';
import {
  aMinimo,
  desdeMinimo,
  minimoATexto,
  tasaAEscalada,
  porcentajeAPuntosBasicos,
  aplicarPorcentaje,
  dividirRedondeando,
  usdAMoneda,
  monedaAUsd,
  calcularTotalesVenta,
  sumarMinimos,
  decimalAMinimo,
  minimoADecimal,
  type CodigoMoneda,
} from './money.js';

/** PRNG determinista (mulberry32): los tests de propiedad son reproducibles. */
function prng(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = prng(20261001);
const entero = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));

describe('money.ts — conversión a unidades mínimas (F7)', () => {
  it('evita los errores de coma flotante que tenía Math.round(x*100)/100', () => {
    expect(Math.round(1.005 * 100) / 100).toBe(1); // el bug que se corrige
    expect(aMinimo(1.005, 'USD')).toBe(101);
    expect(aMinimo(0.1 + 0.2, 'USD')).toBe(30);
    expect(aMinimo('12.345', 'USD')).toBe(1235);
    expect(aMinimo(4100.5, 'COP')).toBe(4101);
    expect(aMinimo('-2.005', 'VES')).toBe(-201);
    expect(aMinimo(1e-7, 'USD')).toBe(0);
  });

  it('rechaza textos que no son montos', () => {
    expect(() => aMinimo('abc', 'USD')).toThrow(/Monto inválido/);
    expect(() => aMinimo('', 'USD')).toThrow(/Monto inválido/);
  });

  it('minimoATexto y Decimal ida y vuelta son exactos', () => {
    expect(minimoATexto(5, 'USD')).toBe('0.05');
    expect(minimoATexto(-1234, 'VES')).toBe('-12.34');
    expect(minimoATexto(157760, 'COP')).toBe('157760');
    for (let i = 0; i < 500; i++) {
      const m = entero(-10_000_000, 10_000_000);
      expect(decimalAMinimo(minimoADecimal(m, 'USD'), 'USD')).toBe(m);
      expect(desdeMinimo(m, 'USD')).toBeCloseTo(m / 100, 10);
    }
  });

  it('dividirRedondeando redondea half-up simétrico', () => {
    expect(dividirRedondeando(5n, 2n)).toBe(3n);
    expect(dividirRedondeando(-5n, 2n)).toBe(-3n);
    expect(dividirRedondeando(4n, 3n)).toBe(1n);
    expect(() => dividirRedondeando(1n, 0n)).toThrow();
  });

  it('porcentajes y tasas escaladas', () => {
    expect(porcentajeAPuntosBasicos(16)).toBe(1600);
    expect(porcentajeAPuntosBasicos('7.5')).toBe(750);
    expect(aplicarPorcentaje(4500, 1600)).toBe(720); // IVA 16 % de $45,00
    expect(aplicarPorcentaje(850, 1600)).toBe(136);
    expect(tasaAEscalada('860.1234')).toBe(8_601_234);
    expect(() => tasaAEscalada(0)).toThrow(/mayor a 0/);
  });

  it('sumarMinimos rechaza flotantes colados', () => {
    expect(sumarMinimos([1, 2, 3])).toBe(6);
    expect(() => sumarMinimos([1, 0.5])).toThrow(/no entero/);
  });
});

describe('money.ts — propiedades (F7)', () => {
  it('Σ líneas = subtotal y Σ IVA de líneas = impuesto, para 2 000 carritos aleatorios', () => {
    for (let i = 0; i < 2000; i++) {
      const lineas = Array.from({ length: entero(1, 12) }, () => ({
        cantidad: entero(1, 500),
        precioCentavos: entero(1, 500_000),
        descuentoPb: rnd() < 0.3 ? entero(0, 1000) : 0,
        ivaPb: rnd() < 0.2 ? 0 : 1600,
      }));
      const t = calcularTotalesVenta(lineas);
      expect(t.lineas.reduce((s, l) => s + l.netoCentavos, 0)).toBe(t.subtotalCentavos);
      expect(t.lineas.reduce((s, l) => s + l.ivaCentavos, 0)).toBe(t.impuestoCentavos);
      expect(t.totalCentavos).toBe(t.subtotalCentavos + t.impuestoCentavos);
      for (const l of t.lineas) {
        expect(Number.isInteger(l.ivaCentavos)).toBe(true);
        expect(l.netoCentavos + l.descuentoCentavos).toBe(l.brutoCentavos);
      }
    }
  });

  it('USD → VES/COP → USD no pierde más de 1 centavo, con tasas y montos aleatorios', () => {
    const monedas: CodigoMoneda[] = ['VES', 'COP'];
    for (let i = 0; i < 5000; i++) {
      const moneda = monedas[i % 2]!;
      const tasa = moneda === 'VES' ? entero(10_000, 50_000_000) : entero(20_000_000, 60_000_000); // 1–5000 Bs, 2000–6000 COP
      const centavos = entero(1, 10_000_000);
      const ida = usdAMoneda(centavos, moneda, tasa);
      const vuelta = monedaAUsd(ida, moneda, tasa);
      expect(Math.abs(vuelta - centavos)).toBeLessThanOrEqual(1);
    }
  });

  it('pagar el total convertido a VES/COP cubre el total en USD con tolerancia de 1 centavo', () => {
    for (let i = 0; i < 2000; i++) {
      const tasaVes = entero(10_000, 50_000_000);
      const tasaCop = entero(20_000_000, 60_000_000);
      const total = entero(1, 5_000_000);
      expect(total - monedaAUsd(usdAMoneda(total, 'VES', tasaVes), 'VES', tasaVes)).toBeLessThanOrEqual(1);
      expect(total - monedaAUsd(usdAMoneda(total, 'COP', tasaCop), 'COP', tasaCop)).toBeLessThanOrEqual(1);
    }
  });

  it('decimalAMinimo acepta Prisma.Decimal sin pasar por flotante', () => {
    expect(decimalAMinimo(new Prisma.Decimal('0.105'), 'USD')).toBe(11);
    expect(decimalAMinimo(null, 'USD')).toBe(0);
  });
});
