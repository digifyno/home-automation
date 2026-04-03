import { FibaroDevice, FibaroRoom, FibaroScene, FibaroWeather } from '../../shared/types.ts';

const BASE = '/api/fibaro';
const TOKEN = import.meta.env.VITE_API_TOKEN as string;

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  getRooms: () => fetchJSON<FibaroRoom[]>(`${BASE}/rooms`),
  getDevices: () => fetchJSON<FibaroDevice[]>(`${BASE}/devices`),
  getDevice: (id: number) => fetchJSON<FibaroDevice>(`${BASE}/devices/${id}`),
  getScenes: () => fetchJSON<FibaroScene[]>(`${BASE}/scenes`),
  getWeather: () => fetchJSON<FibaroWeather>(`${BASE}/weather`),
  getEnergy: () => fetchJSON<unknown>(`${BASE}/energy`),

  deviceAction: async (id: number, action: string, args?: unknown) => {
    const res = await fetch(`${BASE}/devices/${id}/action/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(args ?? {}),
    });
    if (!res.ok) throw new Error(`Action failed: HTTP ${res.status}`);
    return res.json();
  },

  executeScene: async (id: number) => {
    const res = await fetch(`${BASE}/scenes/${id}/execute`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) throw new Error(`Scene execute failed: HTTP ${res.status}`);
    return res.json();
  },
};
