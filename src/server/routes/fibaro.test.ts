import { describe, it, expect } from 'vitest';
import { parseDeviceId, validateActionBody } from './fibaro.js';

describe('parseDeviceId', () => {
  it('parses a valid positive integer', () => {
    expect(parseDeviceId('42')).toBe(42);
  });

  it('returns null for zero (must be > 0)', () => {
    expect(parseDeviceId('0')).toBeNull();
  });

  it('returns null for negative number', () => {
    expect(parseDeviceId('-1')).toBeNull();
  });

  it('returns null for non-numeric string', () => {
    expect(parseDeviceId('abc')).toBeNull();
  });

  it('returns null for float (toString check fails)', () => {
    expect(parseDeviceId('1.5')).toBeNull();
  });

  it('parses a valid large integer', () => {
    expect(parseDeviceId('99999999')).toBe(99999999);
  });

  it('returns null for empty string', () => {
    expect(parseDeviceId('')).toBeNull();
  });

  it('returns null for scientific notation', () => {
    expect(parseDeviceId('1e2')).toBeNull();
  });
});

describe('validateActionBody', () => {
  describe('setValue / setBrightness', () => {
    it.each(['setValue', 'setBrightness'])('%s: returns null when value is missing', (action) => {
      expect(validateActionBody(action, {})).toBeNull();
    });

    it.each(['setValue', 'setBrightness'])('%s: returns null when value is not a number', (action) => {
      expect(validateActionBody(action, { value: '50' })).toBeNull();
    });

    it.each(['setValue', 'setBrightness'])('%s: returns null when value < 0', (action) => {
      expect(validateActionBody(action, { value: -1 })).toBeNull();
    });

    it.each(['setValue', 'setBrightness'])('%s: returns null when value > 99', (action) => {
      expect(validateActionBody(action, { value: 100 })).toBeNull();
    });

    it.each(['setValue', 'setBrightness'])('%s: returns { value: 50 } for valid in-range value', (action) => {
      expect(validateActionBody(action, { value: 50 })).toEqual({ value: 50 });
    });

    it.each(['setValue', 'setBrightness'])('%s: returns null for value = -1 (boundary)', (action) => {
      expect(validateActionBody(action, { value: -1 })).toBeNull();
    });

    it.each(['setValue', 'setBrightness'])('%s: returns { value: 0 } for value = 0 (valid min)', (action) => {
      expect(validateActionBody(action, { value: 0 })).toEqual({ value: 0 });
    });

    it.each(['setValue', 'setBrightness'])('%s: returns { value: 99 } for value = 99 (valid max)', (action) => {
      expect(validateActionBody(action, { value: 99 })).toEqual({ value: 99 });
    });

    it.each(['setValue', 'setBrightness'])('%s: returns null for value = 100 (just over max)', (action) => {
      expect(validateActionBody(action, { value: 100 })).toBeNull();
    });
  });

  describe('setColor', () => {
    it('returns null when value is missing', () => {
      expect(validateActionBody('setColor', {})).toBeNull();
    });

    it('returns null when value is not a string', () => {
      expect(validateActionBody('setColor', { value: 255 })).toBeNull();
    });

    it('returns null for plain color name', () => {
      expect(validateActionBody('setColor', { value: 'red' })).toBeNull();
    });

    it('returns null for only 3 components', () => {
      expect(validateActionBody('setColor', { value: '1,2,3' })).toBeNull();
    });

    it('returns null for 5 components', () => {
      expect(validateActionBody('setColor', { value: '1,2,3,4,5' })).toBeNull();
    });

    it('returns { value: "255,0,128,0" } for valid RGBW string', () => {
      expect(validateActionBody('setColor', { value: '255,0,128,0' })).toEqual({ value: '255,0,128,0' });
    });

    it('returns null for components with >3 digits', () => {
      expect(validateActionBody('setColor', { value: '1000,0,0,0' })).toBeNull();
    });

    it('returns null when a component is 999 (out of 0-255 range)', () => {
      expect(validateActionBody('setColor', { value: '999,0,0,0' })).toBeNull();
    });

    it('returns null when a component is 256 (just over max)', () => {
      expect(validateActionBody('setColor', { value: '256,0,0,0' })).toBeNull();
    });

    it('returns { value: "0,0,0,0" } for all-zero RGBW', () => {
      expect(validateActionBody('setColor', { value: '0,0,0,0' })).toEqual({ value: '0,0,0,0' });
    });

    it('returns { value: "255,255,255,255" } for all-max RGBW', () => {
      expect(validateActionBody('setColor', { value: '255,255,255,255' })).toEqual({ value: '255,255,255,255' });
    });
  });

  describe('binary actions', () => {
    it.each(['turnOn', 'turnOff', 'toggle', 'open', 'close'])('%s: returns {} with body content', (action) => {
      expect(validateActionBody(action, { value: 42 })).toEqual({});
    });

    it.each(['turnOn', 'turnOff', 'toggle', 'open', 'close'])('%s: returns {} with empty body', (action) => {
      expect(validateActionBody(action, {})).toEqual({});
    });
  });

  describe('invalid body shapes', () => {
    it('returns null when body is null', () => {
      expect(validateActionBody('turnOn', null)).toBeNull();
    });

    it('returns null when body is an array', () => {
      expect(validateActionBody('turnOn', [])).toBeNull();
    });

    it('returns null when body is a string', () => {
      expect(validateActionBody('turnOn', 'on')).toBeNull();
    });
  });
});
