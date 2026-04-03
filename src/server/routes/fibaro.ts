import { Router } from 'express';
import { cachedGet, fibaroClient, invalidateCache } from '../integrations/fibaro/client.js';

const router = Router();

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
  try {
    const response = await fibaroClient.get(`/api/devices/${req.params.id}`);
    res.json(response.data);
  } catch (err) {
    console.error('Fibaro device error:', err);
    res.status(502).json({ error: 'Failed to fetch device from Fibaro' });
  }
});

router.post('/devices/:id/action/:action', async (req, res) => {
  try {
    const { id, action } = req.params;
    const response = await fibaroClient.post(`/api/devices/${id}/action/${action}`, req.body);
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
  try {
    const response = await fibaroClient.post(`/api/scenes/${req.params.id}/action/start`);
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
