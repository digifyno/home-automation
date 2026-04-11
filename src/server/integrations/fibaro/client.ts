import axios from 'axios';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`FATAL: Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function createFibaroClient() {
  return axios.create({
    baseURL: requireEnv('FIBARO_URL'),
    auth: {
      username: requireEnv('FIBARO_USERNAME'),
      password: requireEnv('FIBARO_PASSWORD'),
    },
    timeout: 10000,
  });
}

export const fibaroClient = createFibaroClient();

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

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

  const promise = fibaroClient.get<T>(path).then(response => {
    const ttl = TTLs[path] ?? 30 * 1000;
    cache.set(path, { data: response.data, expiresAt: Date.now() + ttl });
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
}
