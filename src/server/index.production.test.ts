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
import fibaroRouter from './routes/fibaro.js';
import { invalidateCache } from './integrations/fibaro/client.js';

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
app.use(express.json());

// API routes (lines 47–49)
app.use('/api/fibaro', requireAuth);
app.use('/api/fibaro', fibaroRouter);

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

  it('does not catch /api/fibaro routes with the 404 fallback', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    const res = await request(app).get('/api/fibaro/devices').set(AUTH);
    expect(res.status).toBe(200);
  });
});
