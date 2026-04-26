import axios from 'axios';

const fibaroBaseUrl = process.env.FIBARO_URL;
const username = process.env.FIBARO_USERNAME;
const password = process.env.FIBARO_PASSWORD;

if (!fibaroBaseUrl || !username || !password) {
  const missing = [
    !fibaroBaseUrl && 'FIBARO_URL',
    !username && 'FIBARO_USERNAME',
    !password && 'FIBARO_PASSWORD',
  ].filter(Boolean).join(', ');
  console.error(`FATAL: Missing required environment variables: ${missing}`);
  process.exit(1);
}

export const fibaroClient = axios.create({
  baseURL: fibaroBaseUrl,
  auth: { username, password },
  timeout: 10000,
});

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const generations = new Map<string, number>();

const TTLs: Record<string, number> = {
  '/api/rooms': 5 * 60 * 1000,
  '/api/devices': 30 * 1000,
  '/api/scenes': 60 * 1000,
  '/api/weather': 60 * 1000,
  '/api/energyDevices': 30 * 1000,
};

export async function cachedGet<T>(path: string): Promise<T> {
  const now = Date.now();
  const cached = cache.get(path);
  if (cached && cached.expiresAt > now) {
    return cached.data as T;
  }
  const existing = inflight.get(path);
  if (existing) return existing as Promise<T>;

  const gen = generations.get(path) ?? 0;
  const promise = fibaroClient.get<T>(path).then(response => {
    if ((generations.get(path) ?? 0) === gen) {
      const ttl = TTLs[path] ?? 30 * 1000;
      cache.set(path, { data: response.data, expiresAt: Date.now() + ttl });
    }
    inflight.delete(path);
    return response.data;
  }).catch(err => {
    inflight.delete(path);
    throw err;
  });

  inflight.set(path, promise);
  return promise;
}

export function invalidateCache(path: string): void {
  cache.delete(path);
  generations.set(path, (generations.get(path) ?? 0) + 1);
}

export function resetAllCaches(): void {
  cache.clear();
  inflight.clear();
  generations.clear();
}
