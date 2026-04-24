import { timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export function createRequireAuth(token: string) {
  if (!token) throw new Error('createRequireAuth: token must not be empty');
  const expectedBuf = Buffer.from(`Bearer ${token}`);
  return function requireAuth(req: Request, res: Response, next: NextFunction) {
    const auth = req.headers.authorization;
    const authBuf = auth ? Buffer.from(auth) : null;
    if (
      !authBuf ||
      authBuf.byteLength !== expectedBuf.byteLength ||
      !timingSafeEqual(authBuf, expectedBuf)
    ) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  };
}
