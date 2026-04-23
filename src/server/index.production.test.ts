import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
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
import { createRequireAuth } from './middleware/auth.js';

const API_TOKEN = process.env.API_TOKEN!;

// Replicate production-mode route ordering from index.ts lines 47–73
const app = express();
app.use(helmet());
app.use(cors({ origin: ['http://localhost:5173'], methods: ['GET', 'POST'], allowedHeaders: ['Authorization', 'Content-Type'] }));
app.use(express.json());

// API routes (lines 47–49)
app.use('/api/fibaro', createRequireAuth(API_TOKEN));
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

describe('CORS middleware', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    invalidateCache('/api/devices');
  });

  it('includes CORS allow-origin header when origin matches', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    const res = await request(app)
      .get('/api/fibaro/devices')
      .set(AUTH)
      .set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('does NOT return CORS allow-origin header for a disallowed origin', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    const res = await request(app)
      .get('/api/fibaro/devices')
      .set(AUTH)
      .set('Origin', 'http://attacker.example.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('OPTIONS pre-flight from disallowed origin does NOT return CORS allow-origin header', async () => {
    const res = await request(app)
      .options('/api/fibaro/devices')
      .set('Origin', 'http://attacker.example.com')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('OPTIONS pre-flight does not return 401 (cors registered before auth)', async () => {
    const res = await request(app)
      .options('/api/fibaro/devices')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.status).not.toBe(401);
    expect(res.status).toBe(204);
  });

  it('returns 204 for OPTIONS POST pre-flight on action endpoint from allowed origin', async () => {
    const res = await request(app)
      .options('/api/fibaro/devices/42/action/turnOn')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Authorization, Content-Type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('401 response includes CORS allow-origin header for cross-origin clients', async () => {
    const res = await request(app)
      .get('/api/fibaro/devices')
      .set('Origin', 'http://localhost:5173');
    // No Authorization header
    expect(res.status).toBe(401);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});

describe('CORS with origin: false (ALLOWED_ORIGIN unset)', () => {
  const noOriginApp = express();
  noOriginApp.use(helmet());
  noOriginApp.use(cors({ origin: false }));
  noOriginApp.use(express.json());
  noOriginApp.use('/api/fibaro', createRequireAuth(API_TOKEN));
  noOriginApp.use('/api/fibaro', rateLimit({ max: 500, windowMs: 60000, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } }));
  noOriginApp.use('/api/fibaro', fibaroRouter);

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    invalidateCache('/api/devices');
  });

  it('does not include CORS allow-origin header when ALLOWED_ORIGIN is unset', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    const res = await request(noOriginApp)
      .get('/api/fibaro/devices')
      .set(AUTH)
      .set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
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

  it('returns 503 from /api/health when Fibaro is unreachable', async () => {
    mockGet.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.fibaro).toBe('unreachable');
  });
});

describe('production-mode rate limiter', () => {
  const limiterApp = express();
  limiterApp.use(helmet());
  limiterApp.use(cors({ origin: ['http://localhost:5173'], methods: ['GET', 'POST'], allowedHeaders: ['Authorization', 'Content-Type'] }));
  limiterApp.use(express.json());
  limiterApp.use('/api/fibaro', createRequireAuth(API_TOKEN));
  limiterApp.use('/api/fibaro', rateLimit({ max: 2, windowMs: 60000, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } }));
  limiterApp.use('/api/fibaro', fibaroRouter);
  limiterApp.use((err: { status?: number; type?: string }, _req: Request, res: Response, next: NextFunction) => {
    if (err.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }
    next(err);
  });
  limiterApp.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockGet.mockResolvedValue({ data: [] });
    invalidateCache('/api/devices');
  });

  it('returns 400 JSON for malformed JSON body on fibaro routes through the rate-limiter stack', async () => {
    const res = await request(limiterApp)
      .post('/api/fibaro/devices/10/action/setValue')
      .set(AUTH)
      .set('Content-Type', 'application/json')
      .send('{invalid json}');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it('returns 429 after exceeding the limit in production middleware ordering', async () => {
    await request(limiterApp).get('/api/fibaro/devices').set(AUTH);
    await request(limiterApp).get('/api/fibaro/devices').set(AUTH);
    const res = await request(limiterApp).get('/api/fibaro/devices').set(AUTH);
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: 'Too many requests' });
  });

  it('unauthenticated requests do not consume rate-limit budget (auth before limiter)', async () => {
    // Fresh app with its own rate limiter instance to avoid cross-test contamination
    const freshApp = express();
    freshApp.use(helmet());
    freshApp.use(cors({ origin: ['http://localhost:5173'], methods: ['GET', 'POST'], allowedHeaders: ['Authorization', 'Content-Type'] }));
    freshApp.use(express.json());
    freshApp.use('/api/fibaro', createRequireAuth(API_TOKEN));
    freshApp.use('/api/fibaro', rateLimit({ max: 2, windowMs: 60000, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } }));
    freshApp.use('/api/fibaro', fibaroRouter);

    // 2 unauthenticated requests — should return 401 and not consume budget
    const unauth1 = await request(freshApp).get('/api/fibaro/devices');
    const unauth2 = await request(freshApp).get('/api/fibaro/devices');
    expect(unauth1.status).toBe(401);
    expect(unauth2.status).toBe(401);

    // Budget still full — 2 authenticated requests should succeed
    const res1 = await request(freshApp).get('/api/fibaro/devices').set(AUTH);
    const res2 = await request(freshApp).get('/api/fibaro/devices').set(AUTH);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // 3rd authenticated request exhausts the budget
    const res3 = await request(freshApp).get('/api/fibaro/devices').set(AUTH);
    expect(res3.status).toBe(429);
    expect(res3.body).toEqual({ error: 'Too many requests' });
  });

  it('429 response includes CORS allow-origin header for cross-origin clients', async () => {
    const freshApp = express();
    freshApp.use(helmet());
    freshApp.use(cors({ origin: ['http://localhost:5173'], methods: ['GET', 'POST'], allowedHeaders: ['Authorization', 'Content-Type'] }));
    freshApp.use(express.json());
    freshApp.use('/api/fibaro', createRequireAuth(API_TOKEN));
    freshApp.use('/api/fibaro', rateLimit({ max: 2, windowMs: 60000, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } }));
    freshApp.use('/api/fibaro', fibaroRouter);

    await request(freshApp).get('/api/fibaro/devices').set(AUTH).set('Origin', 'http://localhost:5173');
    await request(freshApp).get('/api/fibaro/devices').set(AUTH).set('Origin', 'http://localhost:5173');
    const res = await request(freshApp)
      .get('/api/fibaro/devices')
      .set(AUTH)
      .set('Origin', 'http://localhost:5173');
    expect(res.status).toBe(429);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
