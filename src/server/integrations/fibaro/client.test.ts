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
import { cachedGet, invalidateCache } from './client.js';

describe('cachedGet', () => {
  beforeEach(() => {
    mockGet.mockReset();
    // Clear cache before each test
    invalidateCache('/api/devices');
    invalidateCache('/api/rooms');
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
