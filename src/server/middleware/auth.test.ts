import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { createRequireAuth } from './auth.js';

const API_TOKEN = 'test-token';

function makeReq(authorization?: string): Request {
  return { headers: { authorization } } as unknown as Request;
}

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe('createRequireAuth', () => {
  const requireAuth = createRequireAuth(API_TOKEN);

  it('calls next() for valid token', () => {
    const req = makeReq(`Bearer ${API_TOKEN}`);
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is missing', () => {
    const req = makeReq(undefined);
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for wrong token with different length', () => {
    const req = makeReq('Bearer wrong');
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for same-length wrong-content token (exercises timingSafeEqual path)', () => {
    const sameLengthWrong = 'Bearer ' + 'X'.repeat(API_TOKEN.length);
    const req = makeReq(sameLengthWrong);
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for correct prefix with wrong case (same length, different content)', () => {
    // 'bearer test-token' vs 'Bearer test-token' — same length, different bytes
    const req = makeReq('bearer ' + API_TOKEN);
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for correct length but different prefix', () => {
    // 'Token  test-token' vs 'Bearer test-token' — same length, different bytes
    const req = makeReq('Token  ' + API_TOKEN);
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('createRequireAuth constructor guard', () => {
  it('throws when token is an empty string', () => {
    expect(() => createRequireAuth('')).toThrow('token must not be empty');
  });
});
