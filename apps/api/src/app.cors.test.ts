import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp, parseCorsOrigins } from './app.js';

describe('CORS con lista blanca (S1)', () => {
  const app = createApp({ corsOrigins: ['http://localhost:5173'] });

  it('rechaza con 403 un origen no permitido', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://atacante.trycloudflare.com');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, data: null, error: 'Origen no permitido' });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rechaza el preflight de un origen no permitido', async () => {
    const res = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(403);
  });

  it('acepta el origen permitido y lo refleja en CORS', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('acepta peticiones sin cabecera Origin (mismo origen / servidor a servidor)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });

  it('parseCorsOrigins separa por comas y usa localhost:5173 por defecto', () => {
    expect(parseCorsOrigins(' http://a.local/ , http://b.local ')).toEqual(['http://a.local', 'http://b.local']);
    expect(parseCorsOrigins(undefined)).toEqual(['http://localhost:5173']);
    expect(parseCorsOrigins('')).toEqual(['http://localhost:5173']);
  });
});
