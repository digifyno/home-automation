import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';

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
import rateLimit from 'express-rate-limit';

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

const app = express();
app.use(express.json());
app.use('/api/fibaro', requireAuth);
app.use('/api/fibaro', fibaroRouter);

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
});

describe('rate limiter', () => {
  const limiterApp = express();
  limiterApp.use(express.json());
  limiterApp.use('/api/fibaro', requireAuth);
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
  });

  it('returns 400 for invalid scene ID', async () => {
    const res = await request(app)
      .post('/api/fibaro/scenes/foo/execute')
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
