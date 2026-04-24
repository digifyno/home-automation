import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import fibaroRouter from './routes/fibaro.js';
import { fibaroClient } from './integrations/fibaro/client.js';
import { createRequireAuth } from './middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
// Trust only the first hop (nginx) so req.ip reflects the real Tailscale client IP for per-client rate limiting.
// Using 1 (not true) prevents spoofing via client-supplied X-Forwarded-For headers.
app.set('trust proxy', 1);
const PORT = process.env.PORT || 4018;

const API_TOKEN = process.env.API_TOKEN;
if (!API_TOKEN) {
  console.error('FATAL: API_TOKEN environment variable is not set');
  process.exit(1);
}

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN ? [process.env.ALLOWED_ORIGIN] : false,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Authorization', 'Content-Type'],
}));
app.use(express.json());

const fibaroLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

const healthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

// API routes
app.use('/api/fibaro', createRequireAuth(API_TOKEN));
app.use('/api/fibaro', fibaroLimiter);
app.use('/api/fibaro', fibaroRouter);

app.get('/api/health', healthLimiter, async (_req, res) => {
  try {
    await fibaroClient.get('/api/loginStatus', { timeout: 3000 });
    res.json({ status: 'ok', fibaro: 'reachable', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded', fibaro: 'unreachable', timestamp: new Date().toISOString() });
  }
});

// JSON parse error → return consistent JSON 400 response
app.use((err: { status?: number; type?: string }, _req: Request, res: Response, next: NextFunction) => {
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }
  next(err);
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // Catch unmatched /api/* routes before serving the SPA
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  const publicDir = path.join(__dirname, '../../dist');
  app.use(express.static(publicDir));
  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Home Automation server running on port ${PORT}`);
});
