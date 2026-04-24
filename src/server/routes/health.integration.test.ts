import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// vi.hoisted ensures mocks are available inside the vi.mock factory (hoisted above imports)
const mockGet = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
      post: vi.fn(),
    })),
  },
}));

// Import after mocks are registered
import { fibaroClient } from '../integrations/fibaro/client.js';

// Build a minimal express app with just the health route (no requireAuth — intentional by design)
const app = express();
app.use(helmet());
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    await fibaroClient.get('/api/loginStatus', { timeout: 3000 });
    res.json({ status: 'ok', fibaro: 'reachable', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded', fibaro: 'unreachable', timestamp: new Date().toISOString() });
  }
});

describe('GET /api/health', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('returns 200 with status ok when Fibaro is reachable', async () => {
    mockGet.mockResolvedValueOnce({ data: { status: 'ok' } });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.fibaro).toBe('reachable');
    expect(res.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(mockGet).toHaveBeenCalledWith('/api/loginStatus', { timeout: 3000 });
  });

  it('returns 503 with status degraded when Fibaro is unreachable', async () => {
    mockGet.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.fibaro).toBe('unreachable');
    expect(res.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('response includes Helmet security headers', async () => {
    mockGet.mockResolvedValueOnce({ data: {} });
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  // Intentional design: /api/health is public and does not require an Authorization header.
  // This allows load balancers and monitoring tools to probe the endpoint without credentials.
  it('is accessible without an Authorization header (no 401)', async () => {
    mockGet.mockResolvedValueOnce({ data: {} });
    const res = await request(app).get('/api/health');
    expect(res.status).not.toBe(401);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/health rate limiting', () => {
  it('returns 429 after exceeding the rate limit', async () => {
    const limitedApp = express();
    limitedApp.use(helmet());
    const limiter = rateLimit({ max: 2, windowMs: 60000, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } });
    limitedApp.get('/api/health', limiter, async (_req: Request, res: Response) => {
      try {
        await fibaroClient.get('/api/loginStatus', { timeout: 3000 });
        res.json({ status: 'ok', fibaro: 'reachable', timestamp: new Date().toISOString() });
      } catch {
        res.status(503).json({ status: 'degraded', fibaro: 'unreachable', timestamp: new Date().toISOString() });
      }
    });
    mockGet.mockResolvedValue({ data: {} });
    await request(limitedApp).get('/api/health');
    await request(limitedApp).get('/api/health');
    const res = await request(limitedApp).get('/api/health');
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: 'Too many requests' });
  });
});

describe('GET /api/health rate limiting with CORS', () => {
  it('429 response includes CORS allow-origin header for cross-origin clients', async () => {
    const corsApp = express();
    corsApp.use(helmet());
    corsApp.use(cors({ origin: ['http://localhost:5173'], methods: ['GET', 'POST'], allowedHeaders: ['Authorization', 'Content-Type'] }));
    const limiter = rateLimit({ max: 2, windowMs: 60000, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } });
    corsApp.get('/api/health', limiter, async (_req: Request, res: Response) => {
      try {
        await fibaroClient.get('/api/loginStatus', { timeout: 3000 });
        res.json({ status: 'ok', fibaro: 'reachable', timestamp: new Date().toISOString() });
      } catch {
        res.status(503).json({ status: 'degraded', fibaro: 'unreachable', timestamp: new Date().toISOString() });
      }
    });
    mockGet.mockResolvedValue({ data: {} });
    await request(corsApp).get('/api/health').set('Origin', 'http://localhost:5173');
    await request(corsApp).get('/api/health').set('Origin', 'http://localhost:5173');
    const res = await request(corsApp).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(res.status).toBe(429);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
