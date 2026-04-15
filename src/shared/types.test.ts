import { describe, it, expect } from 'vitest';
import { categorizeDevice, isDeviceOn, FibaroDevice } from './types.js';

function makeDevice(value: boolean | number | string): FibaroDevice {
  return {
    id: 1,
    name: 'Test',
    type: 'com.fibaro.binarySwitch',
    roomID: 1,
    parentId: 0,
    enabled: true,
    visible: true,
    properties: { value, dead: false },
    interfaces: [],
  };
}

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

  it('classifies motionDetector as sensor (Detector suffix catch-all)', () => {
    expect(categorizeDevice('com.fibaro.motionDetector')).toBe('sensor');
  });

  it('classifies type containing cover as shutter', () => {
    expect(categorizeDevice('com.fibaro.cover')).toBe('shutter');
  });
});

describe('isDeviceOn', () => {
  it('returns true when value is boolean true', () => {
    expect(isDeviceOn(makeDevice(true))).toBe(true);
  });

  it('returns true when value is 1', () => {
    expect(isDeviceOn(makeDevice(1))).toBe(true);
  });

  it('returns true when value is string "true"', () => {
    expect(isDeviceOn(makeDevice('true'))).toBe(true);
  });

  it('returns false when value is false', () => {
    expect(isDeviceOn(makeDevice(false))).toBe(false);
  });

  it('returns false when value is 0', () => {
    expect(isDeviceOn(makeDevice(0))).toBe(false);
  });

  it('returns true when value is a non-zero number like 50', () => {
    expect(isDeviceOn(makeDevice(50))).toBe(true);
  });

  it('returns false when value is string \'false\'', () => {
    expect(isDeviceOn(makeDevice('false'))).toBe(false);
  });

  it('returns false when value is a negative number', () => {
    expect(isDeviceOn(makeDevice(-1))).toBe(false);
  });
});
