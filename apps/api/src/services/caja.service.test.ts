import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CajaService } from './caja.service.js';
import { prisma } from '../lib/prisma.js';
import { EstadoTurnoCaja, TipoMovimientoCaja, Moneda, MetodoPago } from '@ferreteria/shared';

vi.mock('./backup.service.js', () => ({
  backupService: { crearBackupSeguro: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    turnoCaja: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    movimientoCaja: {
      create: vi.fn(),
    },
    venta: {
      findMany: vi.fn(),
    },
  },
}));

describe('CajaService', () => {
  let service: CajaService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CajaService();
  });

  describe('getTurnoActivo', () => {
    it('debe retornar null cuando no hay ningún turno de caja abierto', async () => {
      vi.mocked(prisma.turnoCaja.findFirst).mockResolvedValue(null);
      const result = await service.getTurnoActivo();
      expect(result).toBeNull();
    });

    it('debe retornar el turno abierto formateado a DTO', async () => {
      const mockTurno = {
        id: 'turno-1',
        cajaNumero: 'Caja 1',
        usuarioAperturaId: 'user-1',
        usuarioApertura: { id: 'user-1', nombre: 'Cajero Mostrador', email: 'cajero@test.com', rol: 'CAJERO', activo: true, createdAt: new Date(), updatedAt: new Date() },
        usuarioCierreId: null,
        usuarioCierre: null,
        estado: EstadoTurnoCaja.ABIERTO,
        fechaApertura: new Date(),
        fechaCierre: null,
        montoInicialUsd: 50.0,
        montoInicialCop: 100000.0,
        montoInicialVes: 0.0,
        conteoFisicoUsd: null,
        conteoFisicoCop: null,
        conteoFisicoVes: null,
        ventasTotalesUsd: null,
        ventasEfectivoUsd: null,
        ventasEfectivoCop: null,
        ventasPagoMovilVes: null,
        ventasTarjetaVes: null,
        ventasZelleUsd: null,
        ingresosManualesUsd: null,
        egresosManualesUsd: null,
        ingresosManualesCop: null,
        egresosManualesCop: null,
        ingresosManualesVes: null,
        egresosManualesVes: null,
        diferenciaUsd: null,
        diferenciaCop: null,
        diferenciaVes: null,
        observaciones: null,
        movimientos: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.turnoCaja.findFirst).mockResolvedValue(mockTurno as any);
      const result = await service.getTurnoActivo('user-1');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('turno-1');
      expect(result?.montoInicialUsd).toBe(50.0);
      expect(result?.montoInicialCop).toBe(100000.0);
      expect(result?.estado).toBe(EstadoTurnoCaja.ABIERTO);
    });
  });

  describe('abrirTurno', () => {
    it('debe lanzar un error si ya existe un turno abierto', async () => {
      vi.mocked(prisma.turnoCaja.findFirst).mockResolvedValue({ id: 'turno-existente', cajaNumero: 'Caja 1' } as any);

      await expect(
        service.abrirTurno('user-1', {
          cajaNumero: 'Caja 1',
          montoInicialUsd: 20,
          montoInicialCop: 50000,
        })
      ).rejects.toThrow(/Ya existe un turno de caja abierto/);
    });

    it('debe rechazar montos iniciales negativos', async () => {
      vi.mocked(prisma.turnoCaja.findFirst).mockResolvedValue(null);

      await expect(
        service.abrirTurno('user-1', {
          cajaNumero: 'Caja 1',
          montoInicialUsd: -10,
          montoInicialCop: 50000,
        })
      ).rejects.toThrow('Los fondos iniciales de caja no pueden ser negativos.');
    });

    it('debe abrir el turno correctamente con fondos iniciales en USD y COP', async () => {
      vi.mocked(prisma.turnoCaja.findFirst).mockResolvedValue(null);

      const mockCreado = {
        id: 'turno-nuevo-1',
        cajaNumero: 'Caja Principal',
        usuarioAperturaId: 'user-1',
        estado: EstadoTurnoCaja.ABIERTO,
        fechaApertura: new Date(),
        fechaCierre: null,
        montoInicialUsd: 30.0,
        montoInicialCop: 80000.0,
        montoInicialVes: 0.0,
        movimientos: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.turnoCaja.create).mockResolvedValue(mockCreado as any);

      const result = await service.abrirTurno('user-1', {
        cajaNumero: 'Caja Principal',
        montoInicialUsd: 30,
        montoInicialCop: 80000,
      });

      expect(result.id).toBe('turno-nuevo-1');
      expect(result.montoInicialUsd).toBe(30);
      expect(result.montoInicialCop).toBe(80000);
      expect(prisma.turnoCaja.create).toHaveBeenCalled();
    });
  });

  describe('registrarMovimiento', () => {
    it('debe rechazar un movimiento si el turno está cerrado', async () => {
      vi.mocked(prisma.turnoCaja.findUnique).mockResolvedValue({
        id: 'turno-cerrado',
        estado: EstadoTurnoCaja.CERRADO,
      } as any);

      await expect(
        service.registrarMovimiento('user-1', {
          turnoCajaId: 'turno-cerrado',
          tipo: TipoMovimientoCaja.EGRESO,
          monto: 5,
          moneda: Moneda.USD,
          motivo: 'Compra de hielo',
        })
      ).rejects.toThrow('El turno de caja ya se encuentra cerrado');
    });

    it('debe rechazar montos menores o iguales a 0', async () => {
      vi.mocked(prisma.turnoCaja.findUnique).mockResolvedValue({
        id: 'turno-abierto',
        estado: EstadoTurnoCaja.ABIERTO,
      } as any);

      await expect(
        service.registrarMovimiento('user-1', {
          turnoCajaId: 'turno-abierto',
          tipo: TipoMovimientoCaja.EGRESO,
          monto: 0,
          moneda: Moneda.USD,
          motivo: 'Gasto',
        })
      ).rejects.toThrow('El monto del movimiento debe ser mayor a 0');
    });

    it('debe registrar un egreso de efectivo correctamente', async () => {
      vi.mocked(prisma.turnoCaja.findUnique).mockResolvedValue({
        id: 'turno-abierto',
        estado: EstadoTurnoCaja.ABIERTO,
      } as any);

      const mockMovCreado = {
        id: 'mov-1',
        turnoCajaId: 'turno-abierto',
        usuarioId: 'user-1',
        tipo: TipoMovimientoCaja.EGRESO,
        monto: 15.0,
        moneda: Moneda.USD,
        motivo: 'Pago a flete',
        fecha: new Date(),
        usuario: { id: 'user-1', nombre: 'Cajero 1' },
      };

      vi.mocked(prisma.movimientoCaja.create).mockResolvedValue(mockMovCreado as any);

      const result = await service.registrarMovimiento('user-1', {
        turnoCajaId: 'turno-abierto',
        tipo: TipoMovimientoCaja.EGRESO,
        monto: 15,
        moneda: Moneda.USD,
        motivo: 'Pago a flete',
      });

      expect(result.id).toBe('mov-1');
      expect(result.tipo).toBe(TipoMovimientoCaja.EGRESO);
      expect(result.monto).toBe(15);
    });
  });

  describe('calcularResumenTurno (Reporte X)', () => {
    it('debe calcular el dinero esperado en efectivo USD y COP acumulando ventas y movimientos', async () => {
      const mockTurno = {
        id: 'turno-1',
        cajaNumero: 'Caja 1',
        usuarioAperturaId: 'user-1',
        estado: EstadoTurnoCaja.ABIERTO,
        fechaApertura: new Date(Date.now() - 3600000),
        fechaCierre: null,
        montoInicialUsd: 50.0,
        montoInicialCop: 100000.0,
        montoInicialVes: 0.0,
        movimientos: [
          {
            id: 'm-1',
            turnoCajaId: 'turno-1',
            usuarioId: 'user-1',
            tipo: TipoMovimientoCaja.INGRESO,
            monto: 20.0,
            moneda: Moneda.USD,
            motivo: 'Cambio adicional',
            fecha: new Date(),
          },
          {
            id: 'm-2',
            turnoCajaId: 'turno-1',
            usuarioId: 'user-1',
            tipo: TipoMovimientoCaja.EGRESO,
            monto: 10.0,
            moneda: Moneda.USD,
            motivo: 'Gastos menores',
            fecha: new Date(),
          },
          {
            id: 'm-3',
            turnoCajaId: 'turno-1',
            usuarioId: 'user-1',
            tipo: TipoMovimientoCaja.EGRESO,
            monto: 20000.0,
            moneda: Moneda.COP,
            motivo: 'Pago flete local',
            fecha: new Date(),
          },
        ],
      };

      const mockVentas = [
        {
          id: 'v-1',
          totalUsd: 30.0,
          total: 30.0,
          pagos: [
            {
              metodoPago: MetodoPago.EFECTIVO_USD,
              moneda: Moneda.USD,
              montoRecibido: 30.0,
              vuelto: 0,
              montoMoneda: 30.0,
              montoUsd: 30.0,
            },
          ],
        },
        {
          id: 'v-2',
          totalUsd: 20.0,
          total: 20.0,
          pagos: [
            {
              metodoPago: MetodoPago.EFECTIVO_COP,
              moneda: Moneda.COP,
              montoRecibido: 82000.0,
              vuelto: 0,
              montoMoneda: 82000.0,
              montoUsd: 20.0,
            },
          ],
        },
        {
          id: 'v-3',
          totalUsd: 15.0,
          total: 15.0,
          pagos: [
            {
              metodoPago: MetodoPago.PAGO_MOVIL_VES,
              moneda: Moneda.VES,
              montoRecibido: 900.0,
              vuelto: 0,
              montoMoneda: 900.0,
              montoUsd: 15.0,
            },
          ],
        },
      ];

      vi.mocked(prisma.turnoCaja.findUnique).mockResolvedValue(mockTurno as any);
      vi.mocked(prisma.venta.findMany).mockResolvedValue(mockVentas as any);

      const resumen = await service.calcularResumenTurno('turno-1');

      // Fondos iniciales
      expect(resumen.fondosIniciales.usd).toBe(50);
      expect(resumen.fondosIniciales.cop).toBe(100000);

      // Ventas
      expect(resumen.ventasPorMetodo.efectivoUsd.monto).toBe(30);
      expect(resumen.ventasPorMetodo.efectivoCop.monto).toBe(82000);
      expect(resumen.ventasPorMetodo.pagoMovilVes.monto).toBe(900);
      expect(resumen.ventasPorMetodo.totalVentasUsd).toBe(65);

      // Movimientos
      expect(resumen.movimientosManuales.ingresosUsd).toBe(20);
      expect(resumen.movimientosManuales.egresosUsd).toBe(10);
      expect(resumen.movimientosManuales.egresosCop).toBe(20000);

      // Dinero esperado en gaveta:
      // USD esperado = 50 (inicial) + 30 (ventas) + 20 (ingreso) - 10 (egreso) = 90 USD
      expect(resumen.esperadoEnCaja.efectivoUsd).toBe(90);

      // COP esperado = 100,000 (inicial) + 82,000 (ventas) - 20,000 (egreso) = 162,000 COP
      expect(resumen.esperadoEnCaja.efectivoCop).toBe(162000);
    });
  });

  describe('cerrarTurno (Reporte Z)', () => {
    it('debe cerrar el turno, calcular descuadres exactos y actualizar estado a CERRADO', async () => {
      const mockTurnoAbierto = {
        id: 'turno-cierre',
        cajaNumero: 'Caja 1',
        usuarioAperturaId: 'user-1',
        estado: EstadoTurnoCaja.ABIERTO,
        fechaApertura: new Date(Date.now() - 7200000),
        fechaCierre: null,
        montoInicialUsd: 100.0,
        montoInicialCop: 50000.0,
        montoInicialVes: 0.0,
        movimientos: [],
      };

      const mockVentas = [
        {
          id: 'v-1',
          totalUsd: 40.0,
          pagos: [
            {
              metodoPago: MetodoPago.EFECTIVO_USD,
              moneda: Moneda.USD,
              montoRecibido: 40.0,
              vuelto: 0,
              montoMoneda: 40.0,
              montoUsd: 40.0,
            },
          ],
        },
      ];

      vi.mocked(prisma.turnoCaja.findUnique).mockResolvedValue(mockTurnoAbierto as any);
      vi.mocked(prisma.venta.findMany).mockResolvedValue(mockVentas as any);
      vi.mocked(prisma.turnoCaja.update).mockResolvedValue({} as any);

      // Esperado:
      // USD = 100 inicial + 40 ventas = 140 USD
      // COP = 50,000 inicial
      // Conteo ciego cajero:
      // 138 USD (-2 USD faltante)
      // 52,000 COP (+2,000 COP sobrante)
      const mockTurnoCerrado = {
        ...mockTurnoAbierto,
        estado: EstadoTurnoCaja.CERRADO,
        fechaCierre: new Date(),
        conteoFisicoUsd: 138.0,
        conteoFisicoCop: 52000.0,
        conteoFisicoVes: 0.0,
      };

      // Segunda llamada de findUnique dentro de cerrarTurno retorna el turno cerrado
      vi.mocked(prisma.turnoCaja.findUnique)
        .mockResolvedValueOnce(mockTurnoAbierto as any) // primer check
        .mockResolvedValueOnce(mockTurnoAbierto as any) // dentro de calcularResumenTurno previo
        .mockResolvedValueOnce(mockTurnoCerrado as any); // dentro de calcularResumenTurno post cierre

      const resultado = await service.cerrarTurno('user-admin', {
        turnoCajaId: 'turno-cierre',
        conteoFisicoUsd: 138.0,
        conteoFisicoCop: 52000.0,
        observaciones: 'Faltaron 2 dólares en cambio',
      });

      expect(prisma.turnoCaja.update).toHaveBeenCalled();
      expect(resultado.diferencias?.usd).toBe(-2);
      expect(resultado.diferencias?.cop).toBe(2000);
    });
  });
});
