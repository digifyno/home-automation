import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// vi.hoisted ensures mocks are available inside the vi.mock factory (hoisted above imports)
const mockGet = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
      post: mockPost,
    })),
  },
}));

// Import after mocks are registered
import fibaroRouter from './routes/fibaro.js';
import { fibaroClient, invalidateCache } from './integrations/fibaro/client.js';

// Replicate the auth middleware from index.ts (API_TOKEN set to 'test-token' in test-setup.ts)
const API_TOKEN = process.env.API_TOKEN!;

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${API_TOKEN}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

// Replicate production-mode route ordering from index.ts lines 47–73
const app = express();
app.use(helmet());
app.use(express.json());

// API routes (lines 47–49)
app.use('/api/fibaro', requireAuth);
app.use('/api/fibaro', rateLimit({ max: 500, windowMs: 60000, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } }));
app.use('/api/fibaro', fibaroRouter);

// /api/health — registered before the catch-all (line 51 in index.ts)
app.get('/api/health', async (_req, res) => {
  try {
    await fibaroClient.get('/api/loginStatus', { timeout: 3000 });
    res.json({ status: 'ok', fibaro: 'reachable', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded', fibaro: 'unreachable', timestamp: new Date().toISOString() });
  }
});

// JSON parse error handler (mirrors index.ts lines 61–67)
app.use((err: { status?: number; type?: string }, _req: Request, res: Response, next: NextFunction) => {
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }
  next(err);
});

// /api/* 404 catch-all — production only (lines 62–65)
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const AUTH = { Authorization: 'Bearer test-token' };

describe('production-mode /api/* 404 catch-all', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    invalidateCache('/api/devices');
  });

  it('returns 404 JSON for unknown API routes', async () => {
    const res = await request(app).get('/api/unknown-endpoint');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('response includes Helmet security headers', async () => {
    const res = await request(app).get('/api/unknown-endpoint');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('does not catch /api/fibaro routes with the 404 fallback', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    const res = await request(app).get('/api/fibaro/devices').set(AUTH);
    expect(res.status).toBe(200);
  });

  it('returns 400 JSON for malformed JSON body on fibaro routes', async () => {
    const res = await request(app)
      .post('/api/fibaro/devices/10/action/setValue')
      .set(AUTH)
      .set('Content-Type', 'application/json')
      .send('{invalid json}');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });
});

describe('production-mode /api/health before catch-all', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it('returns 200 from /api/health before the /api catch-all fires', async () => {
    mockGet.mockResolvedValueOnce({ data: {} });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toMatch(/ok|degraded/);
  });
});

describe('production-mode rate limiter', () => {
  const limiterApp = express();
  limiterApp.use(helmet());
  limiterApp.use(express.json());
  limiterApp.use('/api/fibaro', requireAuth);
  limiterApp.use('/api/fibaro', rateLimit({ max: 2, windowMs: 60000, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } }));
  limiterApp.use('/api/fibaro', fibaroRouter);
  limiterApp.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockGet.mockResolvedValue({ data: [] });
    invalidateCache('/api/devices');
  });

  it('returns 429 after exceeding the limit in production middleware ordering', async () => {
    await request(limiterApp).get('/api/fibaro/devices').set(AUTH);
    await request(limiterApp).get('/api/fibaro/devices').set(AUTH);
    const res = await request(limiterApp).get('/api/fibaro/devices').set(AUTH);
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: 'Too many requests' });
  });
});
