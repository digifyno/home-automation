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
  });

  it('returns 502 when Fibaro post fails', async () => {
    mockPost.mockRejectedValueOnce(new Error('fibaro down'));
    const res = await request(app)
      .post('/api/fibaro/devices/10/action/turnOn')
      .set(AUTH);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Failed to execute device action' });
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
  });

  it('returns 502 when Fibaro post fails', async () => {
    mockPost.mockRejectedValueOnce(new Error('fibaro down'));
    const res = await request(app)
      .post('/api/fibaro/scenes/5/execute')
      .set(AUTH);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Failed to execute scene' });
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
