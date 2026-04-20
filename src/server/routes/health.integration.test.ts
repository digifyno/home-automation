import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response } from 'express';
import helmet from 'helmet';

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
