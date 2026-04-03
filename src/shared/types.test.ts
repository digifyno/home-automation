import { describe, it, expect } from 'vitest';
import { categorizeDevice } from './types.js';

describe('categorizeDevice', () => {
  it('classifies binarySwitch as light', () => {
    expect(categorizeDevice('com.fibaro.binarySwitch')).toBe('light');
  });

  it('classifies dimmer2 as dimmer', () => {
    expect(categorizeDevice('com.fibaro.dimmer2')).toBe('dimmer');
  });

  it('classifies colorController as dimmer', () => {
    expect(categorizeDevice('com.fibaro.colorController')).toBe('dimmer');
  });

  it('classifies hvacSystem as thermostat', () => {
    expect(categorizeDevice('com.fibaro.hvacSystem')).toBe('thermostat');
  });

  it('classifies smokeDetector as safety', () => {
    expect(categorizeDevice('com.fibaro.smokeDetector')).toBe('safety');
  });

  it('classifies coDetector as safety', () => {
    expect(categorizeDevice('com.fibaro.coDetector')).toBe('safety');
  });

  it('classifies floodSensor as safety', () => {
    expect(categorizeDevice('com.fibaro.floodSensor')).toBe('safety');
  });

  it('classifies doorSensor as sensor (Sensor suffix)', () => {
    expect(categorizeDevice('com.fibaro.doorSensor')).toBe('sensor');
  });

  it('classifies electricMeter as energy', () => {
    expect(categorizeDevice('com.fibaro.electricMeter')).toBe('energy');
  });

  it('classifies FGR222 (shutter) as other when type string lacks shutter keyword', () => {
    expect(categorizeDevice('com.fibaro.FGR222')).toBe('other');
  });

  it('returns other for unknown type', () => {
    expect(categorizeDevice('com.fibaro.unknownWidget')).toBe('other');
  });

  it('returns other for empty string', () => {
    expect(categorizeDevice('')).toBe('other');
  });

  it('classifies type containing shutter as shutter', () => {
    expect(categorizeDevice('com.fibaro.shutterWithMotor')).toBe('shutter');
  });
});
