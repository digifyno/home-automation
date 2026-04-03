import { Router } from 'express';
import { cachedGet, fibaroClient, invalidateCache } from '../integrations/fibaro/client.js';

const router = Router();

const ALLOWED_ACTIONS = new Set([
  'turnOn', 'turnOff', 'setValue', 'open', 'close',
  'toggle', 'setBrightness', 'setColor',
]);

interface ActionBody {
  value?: number | boolean | string;
}

function validateActionBody(action: string, body: unknown): ActionBody | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;

  // Actions that require a numeric value
  if (action === 'setValue' || action === 'setBrightness') {
    if (b.value === undefined) return null;
    if (typeof b.value !== 'number') return null;
    if (b.value < 0 || b.value > 99) return null;
    return { value: b.value };
  }

  // setColor expects a string like 'R,G,B,W'
  if (action === 'setColor') {
    if (typeof b.value !== 'string') return null;
    if (!/^\d{1,3},\d{1,3},\d{1,3},\d{1,3}$/.test(b.value)) return null;
    return { value: b.value };
  }

  // Binary actions: turnOn, turnOff, toggle, open, close — no body needed
  return {};
}

export function parseDeviceId(raw: string): number | null {
  const id = parseInt(raw, 10);
  if (isNaN(id) || id <= 0 || id.toString() !== raw) return null;
  return id;
}

router.get('/rooms', async (_req, res) => {
  try {
    const data = await cachedGet('/api/rooms');
    res.json(data);
  } catch (err) {
    console.error('Fibaro rooms error:', err);
    res.status(502).json({ error: 'Failed to fetch rooms from Fibaro' });
  }
});

router.get('/devices', async (_req, res) => {
  try {
    const data = await cachedGet('/api/devices');
    res.json(data);
  } catch (err) {
    console.error('Fibaro devices error:', err);
    res.status(502).json({ error: 'Failed to fetch devices from Fibaro' });
  }
});

router.get('/devices/:id', async (req, res) => {
  const deviceId = parseDeviceId(req.params.id);
  if (deviceId === null) {
    res.status(400).json({ error: 'Invalid device id' });
    return;
  }
  try {
    const response = await fibaroClient.get(`/api/devices/${deviceId}`);
    res.json(response.data);
  } catch (err) {
    console.error('Fibaro device error:', err);
    res.status(502).json({ error: 'Failed to fetch device from Fibaro' });
  }
});

router.post('/devices/:id/action/:action', async (req, res) => {
  const deviceId = parseDeviceId(req.params.id);
  if (deviceId === null) {
    res.status(400).json({ error: 'Invalid device id' });
    return;
  }
  const { action } = req.params;
  if (!ALLOWED_ACTIONS.has(action)) {
    res.status(400).json({ error: `Unknown action: ${action}` });
    return;
  }
  const validatedBody = validateActionBody(action, req.body);
  if (validatedBody === null) {
    res.status(400).json({ error: 'Invalid action body' });
    return;
  }
  try {
    const response = await fibaroClient.post(`/api/devices/${deviceId}/action/${action}`, validatedBody);
    invalidateCache('/api/devices');
    res.json(response.data);
  } catch (err) {
    console.error('Fibaro action error:', err);
    res.status(502).json({ error: 'Failed to execute device action' });
  }
});

router.get('/scenes', async (_req, res) => {
  try {
    const data = await cachedGet('/api/scenes');
    res.json(data);
  } catch (err) {
    console.error('Fibaro scenes error:', err);
    res.status(502).json({ error: 'Failed to fetch scenes from Fibaro' });
  }
});

router.post('/scenes/:id/execute', async (req, res) => {
  const sceneId = parseDeviceId(req.params.id);
  if (sceneId === null) {
    res.status(400).json({ error: 'Invalid scene id' });
    return;
  }
  try {
    const response = await fibaroClient.post(`/api/scenes/${sceneId}/action/start`);
    invalidateCache('/api/scenes');
    res.json(response.data);
  } catch (err) {
    console.error('Fibaro scene execute error:', err);
    res.status(502).json({ error: 'Failed to execute scene' });
  }
});

router.get('/weather', async (_req, res) => {
  try {
    const data = await cachedGet('/api/weather');
    res.json(data);
  } catch (err) {
    console.error('Fibaro weather error:', err);
    res.status(502).json({ error: 'Failed to fetch weather from Fibaro' });
  }
});

router.get('/energy', async (_req, res) => {
  try {
    const data = await cachedGet('/api/energyDevices');
    res.json(data);
  } catch (err) {
    console.error('Fibaro energy error:', err);
    res.status(502).json({ error: 'Failed to fetch energy data from Fibaro' });
  }
});

export default router;
