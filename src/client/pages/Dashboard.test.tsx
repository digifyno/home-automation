import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dashboard from './Dashboard';
import type { FibaroDevice, FibaroRoom, FibaroScene, FibaroWeather } from '../../shared/types';

let mockDevices: FibaroDevice[] = [];
let mockRooms: FibaroRoom[] = [];
let mockWeather: FibaroWeather | undefined = undefined;
let mockScenes: FibaroScene[] = [];
let mockIsLoading = false;
let mockIsError = false;

vi.mock('../hooks/useFibaro.ts', () => ({
  useDevices: () => ({ data: mockDevices, isLoading: mockIsLoading, isError: mockIsError }),
  useRooms: () => ({ data: mockRooms }),
  useWeather: () => ({ data: mockWeather }),
  useScenes: () => ({ data: mockScenes }),
}));

function makeDevice(overrides: Partial<FibaroDevice> & { properties?: Partial<FibaroDevice['properties']> } = {}): FibaroDevice {
  const { properties: propOverrides, ...rest } = overrides;
  return {
    id: 1,
    name: 'Device',
    type: 'com.fibaro.binarySwitch',
    roomID: 1,
    parentId: 0,
    enabled: true,
    visible: true,
    properties: { value: false, dead: false, ...propOverrides },
    interfaces: [],
    ...rest,
  };
}

function makeRoom(overrides: Partial<FibaroRoom> = {}): FibaroRoom {
  return {
    id: 1,
    name: 'Living Room',
    sectionID: 1,
    icon: '',
    defaultSensor: 0,
    defaultThermostat: 0,
    sortOrder: 0,
    ...overrides,
  };
}

describe('Dashboard page', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockDevices = [];
    mockRooms = [];
    mockWeather = undefined;
    mockScenes = [];
    mockIsLoading = false;
    mockIsError = false;
  });

  it('shows loading spinner when isLoading is true', () => {
    mockIsLoading = true;
    const { container } = render(<Dashboard />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('shows error state when isError is true', () => {
    mockIsError = true;
    render(<Dashboard />);
    expect(screen.getByText('Failed to load devices')).toBeTruthy();
  });

  it('counts only lights/dimmers that are on in the lights stat', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.binarySwitch', properties: { value: true, dead: false } }),
      makeDevice({ id: 2, type: 'com.fibaro.binarySwitch', properties: { value: false, dead: false } }),
      makeDevice({ id: 3, type: 'com.fibaro.dimmer', properties: { value: 1, dead: false } }),
    ];
    render(<Dashboard />);
    expect(screen.getByText('2/3')).toBeTruthy();
  });

  it('shows safety alert banner when safety sensors are triggered', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.smokeDetector', properties: { value: true, dead: false } }),
    ];
    render(<Dashboard />);
    expect(screen.getByText('Safety Alert')).toBeTruthy();
    expect(screen.getByText('1 safety sensor triggered')).toBeTruthy();
  });

  it('shows plural safety alert when multiple sensors triggered', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.smokeDetector', properties: { value: true, dead: false } }),
      makeDevice({ id: 2, type: 'com.fibaro.floodSensor', properties: { value: true, dead: false } }),
    ];
    render(<Dashboard />);
    expect(screen.getByText('2 safety sensors triggered')).toBeTruthy();
  });

  it('does not show alert banner when no safety sensors triggered', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.smokeDetector', properties: { value: false, dead: false } }),
    ];
    render(<Dashboard />);
    expect(screen.queryByText('Safety Alert')).toBeNull();
  });

  it('renders one room card per room', () => {
    mockRooms = [
      makeRoom({ id: 1, name: 'Living Room' }),
      makeRoom({ id: 2, name: 'Bedroom' }),
      makeRoom({ id: 3, name: 'Kitchen' }),
    ];
    render(<Dashboard />);
    expect(screen.getByText('Living Room')).toBeTruthy();
    expect(screen.getByText('Bedroom')).toBeTruthy();
    expect(screen.getByText('Kitchen')).toBeTruthy();
  });

  it('shows offline device count stat when devices are dead', () => {
    mockDevices = [
      makeDevice({ id: 1, properties: { value: false, dead: true } }),
      makeDevice({ id: 2, properties: { value: false, dead: true } }),
    ];
    render(<Dashboard />);
    expect(screen.getByText('Offline')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('does not show offline stat when all devices are online', () => {
    mockDevices = [
      makeDevice({ id: 1, properties: { value: false, dead: false } }),
    ];
    render(<Dashboard />);
    expect(screen.queryByText('Offline')).toBeNull();
  });

  it('shows weather stat card when weather data is provided', () => {
    mockWeather = { Temperature: 18, Humidity: 60, Wind: 15, WeatherCondition: 'Sunny', ConditionCode: 1 };
    render(<Dashboard />);
    expect(screen.getByText('18°C')).toBeTruthy();
    expect(screen.getByText('Sunny')).toBeTruthy();
  });

  it('does not show weather stat card when weather is undefined', () => {
    mockWeather = undefined;
    render(<Dashboard />);
    expect(screen.queryByText('Sunny')).toBeNull();
  });

  it('shows offline device count in room card when a room device is dead', () => {
    mockRooms = [makeRoom({ id: 1, name: 'Living Room' })];
    mockDevices = [
      makeDevice({ id: 1, roomID: 1, properties: { value: false, dead: true } }),
      makeDevice({ id: 2, roomID: 1, properties: { value: false, dead: false } }),
    ];
    render(<Dashboard />);
    expect(screen.getByText('1 offline')).toBeTruthy();
    expect(screen.queryByText('All online')).toBeNull();
  });

  it('shows All online in room card when all room devices are online', () => {
    mockRooms = [makeRoom({ id: 1, name: 'Living Room' })];
    mockDevices = [
      makeDevice({ id: 1, roomID: 1, properties: { value: false, dead: false } }),
      makeDevice({ id: 2, roomID: 1, properties: { value: false, dead: false } }),
    ];
    render(<Dashboard />);
    expect(screen.getByText('All online')).toBeTruthy();
  });

  it('shows no online/offline status in room card when room has no devices', () => {
    mockRooms = [makeRoom({ id: 1, name: 'Empty Room' })];
    mockDevices = [];
    render(<Dashboard />);
    expect(screen.queryByText('All online')).toBeNull();
    expect(screen.queryByText(/offline/)).toBeNull();
  });

  it('shows lights-on count in room card when a light device is on', () => {
    mockRooms = [makeRoom({ id: 1, name: 'Kitchen' })];
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.binarySwitch', roomID: 1, properties: { value: true, dead: false } }),
    ];
    render(<Dashboard />);
    expect(screen.getByText('1 on')).toBeTruthy();
  });

  it('shows thermostat temperature in room card', () => {
    mockRooms = [makeRoom({ id: 1, name: 'Bedroom' })];
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.hvacSystem', roomID: 1, properties: { value: 22, dead: false } }),
    ];
    render(<Dashboard />);
    expect(screen.getByText('22°C')).toBeTruthy();
  });

  it('shows -- in room card when thermostat value is not a number', () => {
    mockRooms = [makeRoom({ id: 1, name: 'Bedroom' })];
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.hvacSystem', roomID: 1, properties: { value: false, dead: false } }),
    ];
    render(<Dashboard />);
    expect(screen.getByText('--')).toBeTruthy();
  });

  it('shows 0.0°C in Avg Indoor stat when thermostat value is not a number', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.hvacSystem', properties: { value: false, dead: false } }),
    ];
    render(<Dashboard />);
    // Non-numeric thermostat value contributes 0 to the average → displays 0.0°C
    expect(screen.getByText('0.0°C')).toBeTruthy();
  });

  it('shows Avg Indoor stat card with thermostat temperature', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.hvacSystem', properties: { value: 21, dead: false } }),
    ];
    render(<Dashboard />);
    expect(screen.getByText('21.0°C')).toBeTruthy();
    expect(screen.getByText('1 thermostat')).toBeTruthy();
  });

  it('shows plural thermostats label when multiple thermostats are present', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.hvacSystem', properties: { value: 21, dead: false } }),
      makeDevice({ id: 2, type: 'com.fibaro.hvacSystem', properties: { value: 22, dead: false } }),
    ];
    render(<Dashboard />);
    expect(screen.getByText('2 thermostats')).toBeTruthy();
  });

  it('shows --°C and 0 thermostats in Avg Indoor stat when no thermostat devices exist', () => {
    mockDevices = []; // no thermostat devices
    render(<Dashboard />);
    expect(screen.getByText('--°C')).toBeTruthy();
    expect(screen.getByText('0 thermostats')).toBeTruthy();
  });

  it('shows Power Usage stat card with summed device watts', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.binarySwitch', properties: { value: true, dead: false, power: 1500 } }),
    ];
    render(<Dashboard />);
    expect(screen.getByText('1500W')).toBeTruthy();
  });

  it('excludes dead devices from Power Usage total', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.binarySwitch', properties: { value: true, dead: false, power: 500 } }),
      makeDevice({ id: 2, type: 'com.fibaro.binarySwitch', properties: { value: true, dead: true, power: 1500 } }),
    ];
    render(<Dashboard />);
    expect(screen.getByText('500W')).toBeTruthy();
  });

  it('shows Safety stat card as OK when no alerts', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.doorSensor', properties: { value: false, dead: false } }),
    ];
    render(<Dashboard />);
    expect(screen.getByText('OK')).toBeTruthy();
  });

  it('shows Scenes stat card count from useScenes data', () => {
    mockScenes = [{ id: 1, name: 'Eve', roomID: 1, type: 'lua', runConfig: '', enabled: true, isRunning: false }];
    render(<Dashboard />);
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });
});
