import { timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export function createRequireAuth(token: string) {
  if (!token) throw new Error('createRequireAuth: token must not be empty');
  const expected = `Bearer ${token}`;
  return function requireAuth(req: Request, res: Response, next: NextFunction) {
    const auth = req.headers.authorization;
    if (
      !auth ||
      auth.length !== expected.length ||
      !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
    ) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  };
}
