import { describe, it, expect } from 'vitest';
import { parseDeviceId } from './fibaro.js';

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
