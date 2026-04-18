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

  it('shows yellow battery bar when batteryLevel is 35 (medium, 21–50%)', () => {
    mockDevices = [
      makeDevice({ id: 1, name: 'Door Sensor', type: 'com.fibaro.doorSensor', properties: { value: false, dead: false, batteryLevel: 35 } }),
    ];
    render(<Security />);
    expect(screen.getByText('35%')).toBeTruthy();
    const bar = screen.getByRole('progressbar', { name: /Battery level for Door Sensor/ }).querySelector('div');
    expect(bar?.className).toContain('bg-yellow-500');
  });

  it('shows red battery bar when batteryLevel is 10 (low, ≤20%)', () => {
    mockDevices = [
      makeDevice({ id: 1, name: 'Door Sensor', type: 'com.fibaro.doorSensor', properties: { value: false, dead: false, batteryLevel: 10 } }),
    ];
    render(<Security />);
    expect(screen.getByText('10%')).toBeTruthy();
    const bar = screen.getByRole('progressbar', { name: /Battery level for Door Sensor/ }).querySelector('div');
    expect(bar?.className).toContain('bg-red-500');
  });

  it('shows green battery bar when batteryLevel is 75 (high, >50%)', () => {
    mockDevices = [
      makeDevice({ id: 1, name: 'Door Sensor', type: 'com.fibaro.doorSensor', properties: { value: false, dead: false, batteryLevel: 75 } }),
    ];
    render(<Security />);
    const bar = screen.getByRole('progressbar', { name: /Battery level for Door Sensor/ }).querySelector('div');
    expect(bar?.className).toContain('bg-green-500');
    expect(bar?.className).not.toContain('bg-yellow-500');
    expect(bar?.className).not.toContain('bg-red-500');
  });

  it('shows green battery bar when batteryLevel is exactly 51 (boundary, >50)', () => {
    mockDevices = [
      makeDevice({ id: 1, name: 'Door Sensor', type: 'com.fibaro.doorSensor', properties: { value: false, dead: false, batteryLevel: 51 } }),
    ];
    render(<Security />);
    const bar = screen.getByRole('progressbar', { name: /Battery level for Door Sensor/ }).querySelector('div');
    expect(bar?.className).toContain('bg-green-500');
  });

  it('shows yellow battery bar when batteryLevel is exactly 50 (boundary, not green)', () => {
    mockDevices = [
      makeDevice({ id: 1, name: 'Door Sensor', type: 'com.fibaro.doorSensor', properties: { value: false, dead: false, batteryLevel: 50 } }),
    ];
    render(<Security />);
    const bar = screen.getByRole('progressbar', { name: /Battery level for Door Sensor/ }).querySelector('div');
    expect(bar?.className).toContain('bg-yellow-500');
    expect(bar?.className).not.toContain('bg-green-500');
  });

  it('shows red battery bar when batteryLevel is exactly 20 (boundary, not yellow)', () => {
    mockDevices = [
      makeDevice({ id: 1, name: 'Door Sensor', type: 'com.fibaro.doorSensor', properties: { value: false, dead: false, batteryLevel: 20 } }),
    ];
    render(<Security />);
    const bar = screen.getByRole('progressbar', { name: /Battery level for Door Sensor/ }).querySelector('div');
    expect(bar?.className).toContain('bg-red-500');
    expect(bar?.className).not.toContain('bg-yellow-500');
  });

  it('renders progressbars with distinct aria-labels for two devices with battery levels', () => {
    mockDevices = [
      makeDevice({ id: 1, name: 'Front Door', type: 'com.fibaro.doorSensor', properties: { value: false, dead: false, batteryLevel: 80 } }),
      makeDevice({ id: 2, name: 'Back Door', type: 'com.fibaro.doorSensor', properties: { value: false, dead: false, batteryLevel: 30 } }),
    ];
    render(<Security />);
    expect(screen.getByRole('progressbar', { name: 'Battery level for Front Door' })).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Battery level for Back Door' })).toBeTruthy();
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

  it('highlights device card when value is numeric 1', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.doorSensor', properties: { value: 1, dead: false } }),
    ];
    render(<Security />);
    expect(screen.getByText('1 alert active')).toBeTruthy();
  });

  it('shows plural alert count when multiple sensors are triggered', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.doorSensor', properties: { value: true, dead: false } }),
      makeDevice({ id: 2, type: 'com.fibaro.smokeDetector', properties: { value: true, dead: false } }),
    ];
    render(<Security />);
    expect(screen.getByText('2 alerts active')).toBeTruthy();
  });

  it('shows both alert count and tampered count when sensors are both triggered and tampered', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.doorSensor', properties: { value: true, dead: false } }),  // triggered
      makeDevice({ id: 2, type: 'com.fibaro.doorSensor', properties: { value: false, dead: false, tampered: true } }),  // tampered only
    ];
    render(<Security />);
    expect(screen.getByText('1 alert active')).toBeTruthy();
    expect(screen.getByText('1 sensor tampered')).toBeTruthy();
  });

  it('shows plural sensors tampered when 2 devices are tampered', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.doorSensor', properties: { value: false, dead: false, tampered: true } }),
      makeDevice({ id: 2, type: 'com.fibaro.doorSensor', properties: { value: false, dead: false, tampered: true } }),
    ];
    render(<Security />);
    expect(screen.getByText('2 sensors tampered')).toBeTruthy();
  });

  it('shows room name in device card when room is found', () => {
    mockRooms = [makeRoom({ id: 1, name: 'Hallway' })];
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.doorSensor', roomID: 1, properties: { value: false, dead: false } }),
    ];
    render(<Security />);
    expect(screen.getByText('Hallway')).toBeTruthy();
  });

  it('shows singular "1 sensor monitored" in All Clear banner when 1 sensor present', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.doorSensor', properties: { value: false, dead: false } }),
    ];
    render(<Security />);
    expect(screen.getByText('1 sensor monitored')).toBeTruthy();
  });

  it('shows plural "N sensors monitored" in All Clear banner when multiple sensors present', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.doorSensor', properties: { value: false, dead: false } }),
      makeDevice({ id: 2, type: 'com.fibaro.smokeDetector', properties: { value: false, dead: false } }),
    ];
    render(<Security />);
    expect(screen.getByText('2 sensors monitored')).toBeTruthy();
  });

  it('counts dead device with value=true in alert total (dead does not suppress alert)', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.doorSensor', properties: { value: true, dead: true } }),
    ];
    render(<Security />);
    expect(screen.getByText('1 alert active')).toBeTruthy();
  });
});
