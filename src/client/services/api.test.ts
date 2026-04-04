import { vi, describe, it, expect, beforeEach } from 'vitest';
import { api } from './api.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeFetchResponse(ok: boolean, status: number, statusText: string, body: unknown) {
  return Promise.resolve({
    ok,
    status,
    statusText,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('fetchJSON success path', () => {
  it('getRooms calls fetch with correct URL and Authorization header', async () => {
    const rooms = [{ id: 1, name: 'Living Room' }];
    mockFetch.mockReturnValue(makeFetchResponse(true, 200, 'OK', rooms));

    const result = await api.getRooms();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/fibaro/rooms');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
    expect(result).toEqual(rooms);
  });

  it('getDevices calls fetch with correct URL and Authorization header', async () => {
    const devices = [{ id: 10, name: 'Light' }];
    mockFetch.mockReturnValue(makeFetchResponse(true, 200, 'OK', devices));

    const result = await api.getDevices();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/fibaro/devices');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
    expect(result).toEqual(devices);
  });
});

describe('fetchJSON error path', () => {
  it('getRooms rejects with HTTP 401 error message', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(false, 401, 'Unauthorized', {}));

    await expect(api.getRooms()).rejects.toThrow('HTTP 401: Unauthorized');
  });

  it('getRooms rejects with HTTP 502 error message', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(false, 502, 'Bad Gateway', {}));

    await expect(api.getRooms()).rejects.toThrow('HTTP 502: Bad Gateway');
  });
});

describe('deviceAction', () => {
  it('posts to correct URL', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(true, 200, 'OK', {}));

    await api.deviceAction(42, 'turnOn');

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/fibaro/devices/42/action/turnOn');
  });

  it('sends Content-Type and Authorization headers', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(true, 200, 'OK', {}));

    await api.deviceAction(42, 'setValue', [50]);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Authorization']).toBe('Bearer test-token');
  });

  it('serializes args as request body', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(true, 200, 'OK', {}));

    await api.deviceAction(42, 'setValue', [75]);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify([75]));
  });

  it('uses empty object as body when args is not provided', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(true, 200, 'OK', {}));

    await api.deviceAction(42, 'turnOn');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({}));
  });

  it('rejects when response is not ok', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(false, 500, 'Internal Server Error', {}));

    await expect(api.deviceAction(42, 'turnOn')).rejects.toThrow('HTTP 500');
  });
});

describe('executeScene', () => {
  it('posts to correct URL', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(true, 200, 'OK', {}));

    await api.executeScene(7);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/fibaro/scenes/7/execute');
    expect(init.method).toBe('POST');
  });

  it('rejects when response is not ok', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(false, 403, 'Forbidden', {}));

    await expect(api.executeScene(7)).rejects.toThrow('HTTP 403');
  });
});
