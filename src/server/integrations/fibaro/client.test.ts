import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// vi.hoisted ensures mockGet is available inside the vi.mock factory (which is hoisted above imports)
const mockGet = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
    })),
  },
}));

// Import after mocks are registered so client.ts picks up the mocked axios
import { cachedGet, invalidateCache, resetAllCaches } from './client.js';

describe('cachedGet', () => {
  beforeEach(() => {
    mockGet.mockReset();
    resetAllCaches();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches from Fibaro on first call and returns data', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 1 }] });
    const result = await cachedGet('/api/devices');
    expect(result).toEqual([{ id: 1 }]);
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('/api/devices');
  });

  it('returns cached data on second call within TTL without hitting Fibaro again', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 1 }] });
    await cachedGet('/api/devices');
    const result = await cachedGet('/api/devices');
    expect(result).toEqual([{ id: 1 }]);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('fetches fresh data after TTL expiry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    mockGet.mockResolvedValueOnce({ data: { rooms: 'original' } });
    await cachedGet('/api/rooms');

    // Rooms TTL is 5 minutes — advance past it
    vi.setSystemTime(new Date('2026-01-01T00:06:00Z'));

    mockGet.mockResolvedValueOnce({ data: { rooms: 'fresh' } });
    const result = await cachedGet('/api/rooms');

    expect(result).toEqual({ rooms: 'fresh' });
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('fetches fresh data after 30s TTL expiry for /api/devices', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    invalidateCache('/api/devices');

    mockGet.mockResolvedValueOnce({ data: [{ id: 1 }] });
    await cachedGet('/api/devices');

    // Within TTL (29s) — should still be cached
    vi.setSystemTime(new Date('2026-01-01T00:00:29Z'));
    mockGet.mockResolvedValueOnce({ data: [{ id: 2 }] });
    const cached = await cachedGet('/api/devices');
    expect(cached).toEqual([{ id: 1 }]);
    expect(mockGet).toHaveBeenCalledTimes(1);

    // Past TTL (31s) — should fetch fresh
    vi.setSystemTime(new Date('2026-01-01T00:00:31Z'));
    mockGet.mockResolvedValueOnce({ data: [{ id: 2 }] });
    const fresh = await cachedGet('/api/devices');
    expect(fresh).toEqual([{ id: 2 }]);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('fetches fresh data after 60s TTL expiry for /api/scenes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    invalidateCache('/api/scenes');

    mockGet.mockResolvedValueOnce({ data: [{ id: 10 }] });
    await cachedGet('/api/scenes');

    // Within TTL (59s) — should still be cached
    vi.setSystemTime(new Date('2026-01-01T00:00:59Z'));
    mockGet.mockResolvedValueOnce({ data: [{ id: 20 }] });
    const cached = await cachedGet('/api/scenes');
    expect(cached).toEqual([{ id: 10 }]);
    expect(mockGet).toHaveBeenCalledTimes(1);

    // Past TTL (61s) — should fetch fresh
    vi.setSystemTime(new Date('2026-01-01T00:01:01Z'));
    mockGet.mockResolvedValueOnce({ data: [{ id: 20 }] });
    const fresh = await cachedGet('/api/scenes');
    expect(fresh).toEqual([{ id: 20 }]);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('fetches fresh data after 60s TTL expiry for /api/weather', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    invalidateCache('/api/weather');

    mockGet.mockResolvedValueOnce({ data: { Temperature: 20 } });
    await cachedGet('/api/weather');

    // Within TTL (59s) — should still be cached
    vi.setSystemTime(new Date('2026-01-01T00:00:59Z'));
    mockGet.mockResolvedValueOnce({ data: { Temperature: 25 } });
    const cached = await cachedGet('/api/weather');
    expect(cached).toEqual({ Temperature: 20 });
    expect(mockGet).toHaveBeenCalledTimes(1);

    // Past TTL (61s) — should fetch fresh
    vi.setSystemTime(new Date('2026-01-01T00:01:01Z'));
    mockGet.mockResolvedValueOnce({ data: { Temperature: 25 } });
    const fresh = await cachedGet('/api/weather');
    expect(fresh).toEqual({ Temperature: 25 });
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('fetches fresh data after 30s default TTL expiry for unknown path', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    invalidateCache('/api/unknownPath');

    mockGet.mockResolvedValueOnce({ data: { value: 'original' } });
    await cachedGet('/api/unknownPath');

    // Within TTL (29s) — should still be cached
    vi.setSystemTime(new Date('2026-01-01T00:00:29Z'));
    mockGet.mockResolvedValueOnce({ data: { value: 'updated' } });
    const cached = await cachedGet('/api/unknownPath');
    expect(cached).toEqual({ value: 'original' });
    expect(mockGet).toHaveBeenCalledTimes(1);

    // Past TTL (31s) — should fetch fresh
    vi.setSystemTime(new Date('2026-01-01T00:00:31Z'));
    mockGet.mockResolvedValueOnce({ data: { value: 'updated' } });
    const fresh = await cachedGet('/api/unknownPath');
    expect(fresh).toEqual({ value: 'updated' });
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('fetches fresh data after 30s TTL expiry for /api/energyDevices', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    invalidateCache('/api/energyDevices');

    mockGet.mockResolvedValueOnce({ data: [{ id: 100 }] });
    await cachedGet('/api/energyDevices');

    // Within TTL (29s) — should still be cached
    vi.setSystemTime(new Date('2026-01-01T00:00:29Z'));
    mockGet.mockResolvedValueOnce({ data: [{ id: 200 }] });
    const cached = await cachedGet('/api/energyDevices');
    expect(cached).toEqual([{ id: 100 }]);
    expect(mockGet).toHaveBeenCalledTimes(1);

    // Past TTL (31s) — should fetch fresh
    vi.setSystemTime(new Date('2026-01-01T00:00:31Z'));
    mockGet.mockResolvedValueOnce({ data: [{ id: 200 }] });
    const fresh = await cachedGet('/api/energyDevices');
    expect(fresh).toEqual([{ id: 200 }]);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('invalidateCache causes next call to fetch fresh data', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 1 }] });
    await cachedGet('/api/devices');

    invalidateCache('/api/devices');

    mockGet.mockResolvedValueOnce({ data: [{ id: 2 }] });
    const result = await cachedGet('/api/devices');

    expect(result).toEqual([{ id: 2 }]);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('propagates error when Fibaro client throws', async () => {
    invalidateCache('/api/devices');
    mockGet.mockRejectedValueOnce(new Error('network failure'));
    await expect(cachedGet('/api/devices')).rejects.toThrow('network failure');
  });

  it('coalesces concurrent requests for the same path into a single network call', async () => {
    let resolveRequest!: (value: { data: unknown }) => void;
    const pendingRequest = new Promise<{ data: unknown }>(resolve => {
      resolveRequest = resolve;
    });
    mockGet.mockReturnValueOnce(pendingRequest);

    // Both calls start before any promise resolves — the second should reuse the inflight entry
    const promise1 = cachedGet('/api/devices');
    const promise2 = cachedGet('/api/devices');

    resolveRequest({ data: [{ id: 1 }] });

    const [result1, result2] = await Promise.all([promise1, promise2]);

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(result1).toEqual([{ id: 1 }]);
    expect(result2).toEqual([{ id: 1 }]);
  });

  it('propagates rejection to all concurrent callers when inflight fails', async () => {
    let rejectRequest!: (reason: Error) => void;
    const pendingRequest = new Promise<{ data: unknown }>((_, reject) => {
      rejectRequest = reject;
    });
    mockGet.mockReturnValueOnce(pendingRequest);

    const p1 = cachedGet('/api/devices');
    const p2 = cachedGet('/api/devices');

    rejectRequest(new Error('network failure'));

    await expect(p1).rejects.toThrow('network failure');
    await expect(p2).rejects.toThrow('network failure');
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('does not repopulate cache with stale data when invalidateCache is called while inflight', async () => {
    invalidateCache('/api/devices');

    let resolveRequest!: (value: { data: unknown }) => void;
    const pendingRequest = new Promise<{ data: unknown }>(resolve => {
      resolveRequest = resolve;
    });
    mockGet.mockReturnValueOnce(pendingRequest);

    // Start an inflight request
    const inflightPromise = cachedGet('/api/devices');

    // Invalidate while the request is still in flight
    invalidateCache('/api/devices');

    // Resolve the inflight with (now-stale) data
    resolveRequest({ data: [{ id: 1, name: 'Stale' }] });
    await inflightPromise; // let the .then() run

    // Cache should NOT be populated with stale data
    mockGet.mockResolvedValueOnce({ data: [{ id: 2, name: 'Fresh' }] });
    const result = await cachedGet('/api/devices');
    expect(result).toEqual([{ id: 2, name: 'Fresh' }]);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('invalidateCache clears inflight so a call after invalidation starts a fresh request', async () => {
    let resolveFirst!: (value: { data: unknown }) => void;
    const firstRequest = new Promise<{ data: unknown }>(resolve => {
      resolveFirst = resolve;
    });
    let resolveSecond!: (value: { data: unknown }) => void;
    const secondRequest = new Promise<{ data: unknown }>(resolve => {
      resolveSecond = resolve;
    });
    mockGet.mockReturnValueOnce(firstRequest);
    mockGet.mockReturnValueOnce(secondRequest);

    const promise1 = cachedGet('/api/devices');

    // Invalidate while inflight — must clear the inflight entry
    invalidateCache('/api/devices');

    // This call should start a NEW fetch, not reuse the cleared inflight
    const promise2 = cachedGet('/api/devices');
    expect(mockGet).toHaveBeenCalledTimes(2);

    resolveFirst({ data: [{ id: 1 }] });
    resolveSecond({ data: [{ id: 2 }] });

    expect(await promise1).toEqual([{ id: 1 }]);
    expect(await promise2).toEqual([{ id: 2 }]);
  });

  it('does not cache failed responses', async () => {
    invalidateCache('/api/devices');
    mockGet.mockRejectedValueOnce(new Error('timeout'));
    await expect(cachedGet('/api/devices')).rejects.toThrow();
    // Second call should hit Fibaro again
    mockGet.mockResolvedValueOnce({ data: [{ id: 1 }] });
    const result = await cachedGet('/api/devices');
    expect(result).toEqual([{ id: 1 }]);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});
