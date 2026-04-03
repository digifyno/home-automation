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
  const response = await fibaroClient.get<T>(path);
  const ttl = TTLs[path] ?? 30 * 1000;
  cache.set(path, { data: response.data, expiresAt: now + ttl });
  return response.data;
}

export function invalidateCache(path: string): void {
  cache.delete(path);
}
