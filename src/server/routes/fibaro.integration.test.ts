import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';

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
import fibaroRouter from './fibaro.js';
import { invalidateCache } from '../integrations/fibaro/client.js';
import { createRequireAuth } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

const API_TOKEN = process.env.API_TOKEN!;

const app = express();
app.use(helmet());
app.use(cors({ origin: ['http://localhost:5173'], methods: ['GET', 'POST'], allowedHeaders: ['Authorization', 'Content-Type'] }));
app.use(express.json());
app.use('/api/fibaro', createRequireAuth(API_TOKEN));
app.use('/api/fibaro', fibaroRouter);
app.use((err: { status?: number; type?: string }, _req: Request, res: Response, next: NextFunction) => {
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }
  next(err);
});

const AUTH = { Authorization: 'Bearer test-token' };

describe('requireAuth middleware', () => {
  beforeEach(() => {
    mockGet.mockReset();
    invalidateCache('/api/devices');
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/api/fibaro/devices');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 when token is wrong', async () => {
    const res = await request(app)
      .get('/api/fibaro/devices')
      .set('Authorization', 'Bearer wrong-token');
    expect(res.status).toBe(401);
  });

  it('returns 200 when token is correct', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    const res = await request(app)
      .get('/api/fibaro/devices')
      .set(AUTH);
    expect(res.status).toBe(200);
  });

  it('401 response includes CORS allow-origin header for cross-origin clients', async () => {
    const res = await request(app)
      .get('/api/fibaro/devices')
      .set('Origin', 'http://localhost:5173');
    // No Authorization header — must return 401
    expect(res.status).toBe(401);
    // CORS must be present so the browser can read the error body
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('401 response with wrong token includes CORS allow-origin header', async () => {
    const res = await request(app)
      .get('/api/fibaro/devices')
      .set('Authorization', 'Bearer wrong-token')
      .set('Origin', 'http://localhost:5173');
    expect(res.status).toBe(401);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});

describe('rate limiter', () => {
  const limiterApp = express();
  limiterApp.use(express.json());
  limiterApp.use(cors({ origin: ['http://localhost:5173'], methods: ['GET', 'POST'], allowedHeaders: ['Authorization', 'Content-Type'] }));
  limiterApp.use('/api/fibaro', createRequireAuth(API_TOKEN));
  limiterApp.use('/api/fibaro', rateLimit({ max: 2, windowMs: 60000, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } }));
  limiterApp.use('/api/fibaro', fibaroRouter);

  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({ data: [] });
    invalidateCache('/api/devices');
  });

  it('returns 429 after exceeding the limit', async () => {
    await request(limiterApp).get('/api/fibaro/devices').set(AUTH);
    await request(limiterApp).get('/api/fibaro/devices').set(AUTH);
    const res = await request(limiterApp).get('/api/fibaro/devices').set(AUTH);
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: 'Too many requests' });
  });

  it('unauthenticated requests do not count against the rate limit budget', async () => {
    // Use a fresh app with its own rate limiter instance so prior tests don't affect the budget
    const freshApp = express();
    freshApp.use(express.json());
    freshApp.use('/api/fibaro', createRequireAuth(API_TOKEN));
    freshApp.use('/api/fibaro', rateLimit({ max: 2, windowMs: 60000, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } }));
    freshApp.use('/api/fibaro', fibaroRouter);

    // Send 2 unauthenticated requests (401, should not consume budget)
    await request(freshApp).get('/api/fibaro/devices'); // 401, no budget consumed
    await request(freshApp).get('/api/fibaro/devices'); // 401, no budget consumed
    // The next 2 authenticated requests should succeed (budget still full)
    mockGet.mockResolvedValue({ data: [] });
    const res1 = await request(freshApp).get('/api/fibaro/devices').set(AUTH);
    const res2 = await request(freshApp).get('/api/fibaro/devices').set(AUTH);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    // The 3rd authenticated request exceeds the 2-request limit
    const res3 = await request(freshApp).get('/api/fibaro/devices').set(AUTH);
    expect(res3.status).toBe(429);
  });

  it('429 response includes CORS allow-origin header for cross-origin clients', async () => {
    const freshApp = express();
    freshApp.use(express.json());
    freshApp.use(cors({ origin: ['http://localhost:5173'], methods: ['GET', 'POST'], allowedHeaders: ['Authorization', 'Content-Type'] }));
    freshApp.use('/api/fibaro', createRequireAuth(API_TOKEN));
    freshApp.use('/api/fibaro', rateLimit({ max: 2, windowMs: 60000, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } }));
    freshApp.use('/api/fibaro', fibaroRouter);
    mockGet.mockResolvedValue({ data: [] });
    await request(freshApp).get('/api/fibaro/devices').set(AUTH).set('Origin', 'http://localhost:5173');
    await request(freshApp).get('/api/fibaro/devices').set(AUTH).set('Origin', 'http://localhost:5173');
    const res = await request(freshApp).get('/api/fibaro/devices').set(AUTH).set('Origin', 'http://localhost:5173');
    expect(res.status).toBe(429);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('cross-origin unauthenticated requests get 401+CORS headers and do not consume rate-limit budget', async () => {
    const freshApp = express();
    freshApp.use(express.json());
    freshApp.use(cors({ origin: ['http://localhost:5173'], methods: ['GET', 'POST'], allowedHeaders: ['Authorization', 'Content-Type'] }));
    freshApp.use('/api/fibaro', createRequireAuth(API_TOKEN));
    freshApp.use('/api/fibaro', rateLimit({ max: 2, windowMs: 60000, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } }));
    freshApp.use('/api/fibaro', fibaroRouter);

    // Two unauthenticated cross-origin requests — must return 401 with CORS header and not consume budget
    const unauth1 = await request(freshApp)
      .get('/api/fibaro/devices')
      .set('Origin', 'http://localhost:5173');
    const unauth2 = await request(freshApp)
      .get('/api/fibaro/devices')
      .set('Origin', 'http://localhost:5173');
    expect(unauth1.status).toBe(401);
    expect(unauth1.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(unauth2.status).toBe(401);
    expect(unauth2.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    // Budget still full — 2 authenticated requests should succeed
    mockGet.mockResolvedValue({ data: [] });
    const res1 = await request(freshApp).get('/api/fibaro/devices').set(AUTH).set('Origin', 'http://localhost:5173');
    const res2 = await request(freshApp).get('/api/fibaro/devices').set(AUTH).set('Origin', 'http://localhost:5173');
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // 3rd authenticated request exceeds the 2-request limit
    const res3 = await request(freshApp).get('/api/fibaro/devices').set(AUTH).set('Origin', 'http://localhost:5173');
    expect(res3.status).toBe(429);
  });
});

describe('GET /api/fibaro/devices', () => {
  beforeEach(() => {
    mockGet.mockReset();
    invalidateCache('/api/devices');
  });

  it('returns 200 with cached data when auth is valid', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 1 }] });
    const res = await request(app)
      .get('/api/fibaro/devices')
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1 }]);
    expect(mockGet).toHaveBeenCalledWith('/api/devices');
  });

  it('returns 502 when Fibaro client throws', async () => {
    mockGet.mockRejectedValueOnce(new Error('network error'));
    const res = await request(app)
      .get('/api/fibaro/devices')
      .set(AUTH);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Failed to fetch devices from Fibaro' });
  });

  it('response includes Helmet security headers', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    const res = await request(app).get('/api/fibaro/devices').set(AUTH);
    expect(res.status).toBe(200);
    // Helmet sets these by default:
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });
});

describe('POST /api/fibaro/devices/:id/action/:action', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockGet.mockReset();
    invalidateCache('/api/devices');
  });

  it('returns 400 for non-numeric device ID', async () => {
    const res = await request(app)
      .post('/api/fibaro/devices/abc/action/turnOn')
      .set(AUTH);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid device id' });
  });

  it('returns 400 for unknown action', async () => {
    const res = await request(app)
      .post('/api/fibaro/devices/10/action/deleteAll')
      .set(AUTH);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Unknown action: deleteAll' });
  });

  it('returns 400 for invalid body (setValue with no value)', async () => {
    const res = await request(app)
      .post('/api/fibaro/devices/10/action/setValue')
      .set(AUTH)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid action body' });
  });

  it('returns 200 on success', async () => {
    mockPost.mockResolvedValueOnce({ data: { result: 'ok' } });
    const res = await request(app)
      .post('/api/fibaro/devices/10/action/turnOn')
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: 'ok' });
    expect(mockPost).toHaveBeenCalledOnce();
    expect(mockPost).toHaveBeenCalledWith('/api/devices/10/action/turnOn', {});
  });

  it('returns 502 when Fibaro post fails', async () => {
    mockPost.mockRejectedValueOnce(new Error('fibaro down'));
    const res = await request(app)
      .post('/api/fibaro/devices/10/action/turnOn')
      .set(AUTH);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Failed to execute device action' });
  });

  it('invalidates device cache so next GET returns fresh data', async () => {
    // Populate cache
    mockGet.mockResolvedValueOnce({ data: [{ id: 1, name: 'Old' }] });
    await request(app).get('/api/fibaro/devices').set(AUTH);

    // POST action (success)
    mockPost.mockResolvedValueOnce({ data: { result: 'ok' } });
    await request(app).post('/api/fibaro/devices/1/action/turnOn').set(AUTH);

    // Next GET should fetch fresh data (cache was invalidated)
    mockGet.mockResolvedValueOnce({ data: [{ id: 1, name: 'Fresh' }] });
    const res = await request(app).get('/api/fibaro/devices').set(AUTH);
    expect(res.body).toEqual([{ id: 1, name: 'Fresh' }]);
    expect(mockGet).toHaveBeenCalledTimes(2); // called twice: initial + post-invalidation
  });

  it('returns 200 for valid setValue body', async () => {
    mockPost.mockResolvedValueOnce({ data: { result: 'ok' } });
    const res = await request(app)
      .post('/api/fibaro/devices/10/action/setValue')
      .set(AUTH)
      .send({ value: 50 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: 'ok' });
    expect(mockPost).toHaveBeenCalledOnce();
    expect(mockPost).toHaveBeenCalledWith('/api/devices/10/action/setValue', { value: 50 });
  });

  it('returns 200 for valid setBrightness body', async () => {
    mockPost.mockResolvedValueOnce({ data: { result: 'ok' } });
    const res = await request(app)
      .post('/api/fibaro/devices/10/action/setBrightness')
      .set(AUTH)
      .send({ value: 75 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: 'ok' });
    expect(mockPost).toHaveBeenCalledOnce();
    expect(mockPost).toHaveBeenCalledWith('/api/devices/10/action/setBrightness', { value: 75 });
  });

  it('returns 200 for valid setColor body', async () => {
    mockPost.mockResolvedValueOnce({ data: { result: 'ok' } });
    const res = await request(app)
      .post('/api/fibaro/devices/10/action/setColor')
      .set(AUTH)
      .send({ value: '255,128,0,0' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: 'ok' });
    expect(mockPost).toHaveBeenCalledOnce();
    expect(mockPost).toHaveBeenCalledWith('/api/devices/10/action/setColor', { value: '255,128,0,0' });
  });

  it('returns 400 for setValue when body is missing (no Content-Type header)', async () => {
    const res = await request(app)
      .post('/api/fibaro/devices/10/action/setValue')
      .set(AUTH)
      // intentionally no .send() — no body, no Content-Type
      ;
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid action body' });
  });

  it('returns 400 for setColor when body is missing (no Content-Type header)', async () => {
    const res = await request(app)
      .post('/api/fibaro/devices/10/action/setColor')
      .set(AUTH)
      ;
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid action body' });
  });

  it.each(['toggle', 'open', 'close'])('returns 200 for binary action: %s', async (action) => {
    mockPost.mockResolvedValueOnce({ data: { result: 'ok' } });
    const res = await request(app)
      .post(`/api/fibaro/devices/10/action/${action}`)
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: 'ok' });
    expect(mockPost).toHaveBeenCalledWith(`/api/devices/10/action/${action}`, {});
  });

  it.each(['toggle', 'open', 'close'])('returns 502 when Fibaro post fails for action: %s', async (action) => {
    mockPost.mockRejectedValueOnce(new Error('fibaro down'));
    const res = await request(app)
      .post(`/api/fibaro/devices/10/action/${action}`)
      .set(AUTH);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Failed to execute device action' });
  });

  it('returns 400 when request body is malformed JSON', async () => {
    const res = await request(app)
      .post('/api/fibaro/devices/10/action/setValue')
      .set(AUTH)
      .set('Content-Type', 'application/json')
      .send('{invalid json}');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it('does NOT invalidate device cache when Fibaro post fails', async () => {
    // Populate cache first
    mockGet.mockResolvedValueOnce({ data: [{ id: 1, name: 'Cached' }] });
    await request(app).get('/api/fibaro/devices').set(AUTH);

    // POST action fails
    mockPost.mockRejectedValueOnce(new Error('fibaro down'));
    await request(app).post('/api/fibaro/devices/1/action/turnOn').set(AUTH);

    // Next GET should return cached data (no new mockGet call)
    const res = await request(app).get('/api/fibaro/devices').set(AUTH);
    expect(res.body).toEqual([{ id: 1, name: 'Cached' }]);
    expect(mockGet).toHaveBeenCalledTimes(1); // only the initial population call
  });
});

describe('GET /api/fibaro/scenes', () => {
  beforeEach(() => {
    mockGet.mockReset();
    invalidateCache('/api/scenes');
  });

  it('returns 200 with scene list when Fibaro responds', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 1, name: 'Morning', isRunning: false }] });
    const res = await request(app)
      .get('/api/fibaro/scenes')
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, name: 'Morning', isRunning: false }]);
    expect(mockGet).toHaveBeenCalledWith('/api/scenes');
  });

  it('returns 502 when Fibaro throws', async () => {
    mockGet.mockRejectedValueOnce(new Error('connection refused'));
    const res = await request(app)
      .get('/api/fibaro/scenes')
      .set(AUTH);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Failed to fetch scenes from Fibaro' });
  });
});

describe('POST /api/fibaro/scenes/:id/execute', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockGet.mockReset();
    invalidateCache('/api/scenes');
    invalidateCache('/api/devices');
  });

  it('returns 400 for invalid scene ID', async () => {
    const res = await request(app)
      .post('/api/fibaro/scenes/foo/execute')
      .set(AUTH);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid scene id' });
  });

  it('returns 400 for scene ID 0', async () => {
    const res = await request(app)
      .post('/api/fibaro/scenes/0/execute')
      .set(AUTH);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid scene id' });
  });

  it('returns 400 for a negative scene ID', async () => {
    const res = await request(app)
      .post('/api/fibaro/scenes/-1/execute')
      .set(AUTH);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid scene id' });
  });

  it('returns 200 on success', async () => {
    mockPost.mockResolvedValueOnce({ data: { result: 'started' } });
    const res = await request(app)
      .post('/api/fibaro/scenes/5/execute')
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: 'started' });
    expect(mockPost).toHaveBeenCalledOnce();
    expect(mockPost).toHaveBeenCalledWith('/api/scenes/5/action/start');
  });

  it('returns 502 when Fibaro post fails', async () => {
    mockPost.mockRejectedValueOnce(new Error('fibaro down'));
    const res = await request(app)
      .post('/api/fibaro/scenes/5/execute')
      .set(AUTH);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Failed to execute scene' });
  });

  it('invalidates scene cache so next GET returns fresh data', async () => {
    // Populate cache
    mockGet.mockResolvedValueOnce({ data: [{ id: 5, name: 'Old Scene', isRunning: false }] });
    await request(app).get('/api/fibaro/scenes').set(AUTH);

    // POST execute (success)
    mockPost.mockResolvedValueOnce({ data: { result: 'started' } });
    await request(app).post('/api/fibaro/scenes/5/execute').set(AUTH);

    // Next GET should fetch fresh data (cache was invalidated)
    mockGet.mockResolvedValueOnce({ data: [{ id: 5, name: 'Old Scene', isRunning: true }] });
    const res = await request(app).get('/api/fibaro/scenes').set(AUTH);
    expect(res.body[0].isRunning).toBe(true);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('does NOT invalidate scene cache when Fibaro post fails', async () => {
    // Populate cache first
    mockGet.mockResolvedValueOnce({ data: [{ id: 5, name: 'Morning', isRunning: false }] });
    await request(app).get('/api/fibaro/scenes').set(AUTH);

    // POST execute fails
    mockPost.mockRejectedValueOnce(new Error('fibaro down'));
    await request(app).post('/api/fibaro/scenes/5/execute').set(AUTH);

    // Next GET should return cached data (no new mockGet call)
    const res = await request(app).get('/api/fibaro/scenes').set(AUTH);
    expect(res.body).toEqual([{ id: 5, name: 'Morning', isRunning: false }]);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('invalidates device cache so next GET /devices returns fresh data after scene execution', async () => {
    // Populate device cache
    mockGet.mockResolvedValueOnce({ data: [{ id: 1, name: 'Old Light', value: false }] });
    await request(app).get('/api/fibaro/devices').set(AUTH);

    // Execute scene (success)
    mockPost.mockResolvedValueOnce({ data: { result: 'started' } });
    await request(app).post('/api/fibaro/scenes/5/execute').set(AUTH);

    // Next GET /devices should fetch fresh data (device cache was invalidated)
    mockGet.mockResolvedValueOnce({ data: [{ id: 1, name: 'Fresh Light', value: true }] });
    const res = await request(app).get('/api/fibaro/devices').set(AUTH);
    expect(res.body[0].name).toBe('Fresh Light');
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('does NOT invalidate device cache when scene execution fails', async () => {
    // Populate device cache
    mockGet.mockResolvedValueOnce({ data: [{ id: 1, name: 'Old Light', value: false }] });
    await request(app).get('/api/fibaro/devices').set(AUTH);

    // POST execute fails
    mockPost.mockRejectedValueOnce(new Error('fibaro down'));
    await request(app).post('/api/fibaro/scenes/5/execute').set(AUTH);

    // Next GET /devices should return cached data (no new mockGet call)
    const res = await request(app).get('/api/fibaro/devices').set(AUTH);
    expect(res.body).toEqual([{ id: 1, name: 'Old Light', value: false }]);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});

describe('GET /api/fibaro/rooms', () => {
  beforeEach(() => {
    mockGet.mockReset();
    invalidateCache('/api/rooms');
  });

  it('returns 200 with room data when Fibaro responds', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 1, name: 'Living Room' }] });
    const res = await request(app)
      .get('/api/fibaro/rooms')
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, name: 'Living Room' }]);
    expect(mockGet).toHaveBeenCalledWith('/api/rooms');
  });

  it('returns 502 when Fibaro throws', async () => {
    mockGet.mockRejectedValueOnce(new Error('connection refused'));
    const res = await request(app)
      .get('/api/fibaro/rooms')
      .set(AUTH);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Failed to fetch rooms from Fibaro' });
  });
});

describe('GET /api/fibaro/devices/:id', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('returns 200 with device data for a valid numeric ID', async () => {
    mockGet.mockResolvedValueOnce({ data: { id: 42, name: 'Lamp' } });
    const res = await request(app)
      .get('/api/fibaro/devices/42')
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 42, name: 'Lamp' });
    expect(mockGet).toHaveBeenCalledWith('/api/devices/42');
  });

  it('returns 400 for a non-numeric device ID', async () => {
    const res = await request(app)
      .get('/api/fibaro/devices/abc')
      .set(AUTH);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid device id' });
  });

  it('returns 400 for device ID 0', async () => {
    const res = await request(app)
      .get('/api/fibaro/devices/0')
      .set(AUTH);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid device id' });
  });

  it('returns 400 for a negative device ID', async () => {
    const res = await request(app)
      .get('/api/fibaro/devices/-5')
      .set(AUTH);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid device id' });
  });

  it('returns 502 when Fibaro throws', async () => {
    mockGet.mockRejectedValueOnce(new Error('timeout'));
    const res = await request(app)
      .get('/api/fibaro/devices/10')
      .set(AUTH);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Failed to fetch device from Fibaro' });
  });
});

describe('GET /api/fibaro/weather', () => {
  beforeEach(() => {
    mockGet.mockReset();
    invalidateCache('/api/weather');
  });

  it('returns 200 with weather data when Fibaro responds', async () => {
    mockGet.mockResolvedValueOnce({ data: { temperature: 21.5 } });
    const res = await request(app)
      .get('/api/fibaro/weather')
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ temperature: 21.5 });
    expect(mockGet).toHaveBeenCalledWith('/api/weather');
  });

  it('returns 502 when Fibaro throws', async () => {
    mockGet.mockRejectedValueOnce(new Error('fibaro unreachable'));
    const res = await request(app)
      .get('/api/fibaro/weather')
      .set(AUTH);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Failed to fetch weather from Fibaro' });
  });
});

describe('GET /api/fibaro/energy', () => {
  beforeEach(() => {
    mockGet.mockReset();
    invalidateCache('/api/energyDevices');
  });

  it('returns 200 with energy data when Fibaro responds', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 1, power: 100 }] });
    const res = await request(app)
      .get('/api/fibaro/energy')
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, power: 100 }]);
    expect(mockGet).toHaveBeenCalledWith('/api/energyDevices');
  });

  it('returns 502 when Fibaro throws', async () => {
    mockGet.mockRejectedValueOnce(new Error('energy endpoint down'));
    const res = await request(app)
      .get('/api/fibaro/energy')
      .set(AUTH);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Failed to fetch energy data from Fibaro' });
  });
});

describe('CORS middleware', () => {
  it('returns 204 with CORS headers for OPTIONS pre-flight from allowed origin', async () => {
    const res = await request(app)
      .options('/api/fibaro/devices')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'Authorization');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('OPTIONS pre-flight does not return 401 (cors before auth)', async () => {
    const res = await request(app)
      .options('/api/fibaro/devices')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.status).not.toBe(401);
  });

  it('does NOT return CORS allow-origin header for a disallowed origin', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    const res = await request(app)
      .get('/api/fibaro/devices')
      .set(AUTH)
      .set('Origin', 'http://evil.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('OPTIONS pre-flight from disallowed origin does NOT return CORS allow-origin header', async () => {
    const res = await request(app)
      .options('/api/fibaro/devices')
      .set('Origin', 'http://evil.com')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
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

  it('returns 204 for OPTIONS POST pre-flight on scenes execute endpoint from allowed origin', async () => {
    const res = await request(app)
      .options('/api/fibaro/scenes/5/execute')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Authorization');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
