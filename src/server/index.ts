import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fibaroRouter from './routes/fibaro.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4018;

const API_TOKEN = process.env.API_TOKEN;
if (!API_TOKEN) {
  console.error('FATAL: API_TOKEN environment variable is not set');
  process.exit(1);
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${API_TOKEN}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

app.use(express.json());

// API routes
app.use('/api/fibaro', requireAuth);
app.use('/api/fibaro', fibaroRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const publicDir = path.join(__dirname, '../../dist/public');
  app.use(express.static(publicDir));
  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Home Automation server running on port ${PORT}`);
});
