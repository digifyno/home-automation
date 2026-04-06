import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import Security from './Security';
import type { FibaroDevice, FibaroRoom } from '../../shared/types';

let mockDevices: FibaroDevice[] = [];
let mockRooms: FibaroRoom[] = [];
let mockIsLoading = false;
let mockIsError = false;

vi.mock('../hooks/useFibaro.ts', () => ({
  useDevices: () => ({ data: mockDevices, isLoading: mockIsLoading, isError: mockIsError }),
  useRooms: () => ({ data: mockRooms }),
}));

function makeRoom(overrides: Partial<FibaroRoom> = {}): FibaroRoom {
  return {
    id: 1,
    name: 'Room',
    sectionID: 1,
    icon: '',
    defaultSensor: 0,
    defaultThermostat: 0,
    sortOrder: 0,
    ...overrides,
  };
}

function makeDevice(overrides: Partial<FibaroDevice> & { properties?: Partial<FibaroDevice['properties']> } = {}): FibaroDevice {
  const { properties: propOverrides, ...rest } = overrides;
  return {
    id: 1,
    name: 'Device',
    type: 'com.fibaro.doorSensor',
    roomID: 1,
    parentId: 0,
    enabled: true,
    visible: true,
    properties: { value: false, dead: false, ...propOverrides },
    interfaces: [],
    ...rest,
  };
}

describe('Security page', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockDevices = [];
    mockRooms = [];
    mockIsLoading = false;
    mockIsError = false;
  });

  it('shows loading spinner when isLoading is true', () => {
    mockIsLoading = true;
    const { container } = render(<Security />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('shows error state when isError is true', () => {
    mockIsError = true;
    render(<Security />);
    expect(screen.getByText('Failed to load devices')).toBeTruthy();
  });

  it('shows All Clear banner when no safety sensors are triggered', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.smokeDetector', properties: { value: false, dead: false } }),
    ];
    render(<Security />);
    expect(screen.getByText('All Clear')).toBeTruthy();
  });

  it('shows alert count banner when safety device has value true', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.smokeDetector', properties: { value: true, dead: false } }),
    ];
    render(<Security />);
    expect(screen.getByText('1 alert active')).toBeTruthy();
  });

  it('shows No security sensors found when device list is empty', () => {
    mockDevices = [];
    render(<Security />);
    expect(screen.getByText('No security sensors found')).toBeTruthy();
  });

  it('shows No security sensors found when no safety or sensor-type devices', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.binarySwitch', properties: { value: false, dead: false } }),
    ];
    render(<Security />);
    expect(screen.getByText('No security sensors found')).toBeTruthy();
  });

  it('displays tamper warning when device.properties.tampered is true', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.doorSensor', properties: { value: false, dead: false, tampered: true } }),
    ];
    render(<Security />);
    expect(screen.getByText('Tampered!')).toBeTruthy();
  });

  it('shows battery level bar when device.properties.batteryLevel is defined', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.doorSensor', properties: { value: false, dead: false, batteryLevel: 75 } }),
    ];
    render(<Security />);
    expect(screen.getByText('75%')).toBeTruthy();
    expect(screen.getByText('Battery')).toBeTruthy();
  });

  it('shows Device offline text when device.properties.dead is true', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.doorSensor', properties: { value: false, dead: true } }),
    ];
    render(<Security />);
    expect(screen.getByText('Device offline')).toBeTruthy();
  });

  it('shows alert banner with tampered sensor count when device is tampered but not triggered', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.doorSensor', properties: { value: false, dead: false, tampered: true } }),
    ];
    render(<Security />);
    expect(screen.getByText('0 alerts active')).toBeTruthy();
    expect(screen.getByText('1 sensor tampered')).toBeTruthy();
  });

  it('shows plural alert count when multiple sensors are triggered', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.doorSensor', properties: { value: true, dead: false } }),
      makeDevice({ id: 2, type: 'com.fibaro.smokeDetector', properties: { value: true, dead: false } }),
    ];
    render(<Security />);
    expect(screen.getByText('2 alerts active')).toBeTruthy();
  });

  it('shows room name in device card when room is found', () => {
    mockRooms = [makeRoom({ id: 1, name: 'Hallway' })];
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.doorSensor', roomID: 1, properties: { value: false, dead: false } }),
    ];
    render(<Security />);
    expect(screen.getByText('Hallway')).toBeTruthy();
  });
});
