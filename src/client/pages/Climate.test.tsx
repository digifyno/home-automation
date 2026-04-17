import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import Climate from './Climate';
import type { FibaroDevice, FibaroRoom, FibaroWeather } from '../../shared/types';

let mockDevices: FibaroDevice[] = [];
let mockRooms: FibaroRoom[] = [];
let mockWeather: FibaroWeather | undefined = undefined;
let mockIsLoading = false;
let mockIsError = false;

vi.mock('../hooks/useFibaro.ts', () => ({
  useDevices: () => ({ data: mockDevices, isLoading: mockIsLoading, isError: mockIsError }),
  useRooms: () => ({ data: mockRooms }),
  useWeather: () => ({ data: mockWeather }),
}));

function makeDevice(overrides: Partial<FibaroDevice> & { properties?: Partial<FibaroDevice['properties']> } = {}): FibaroDevice {
  const { properties: propOverrides, ...rest } = overrides;
  return {
    id: 1,
    name: 'Device',
    type: 'com.fibaro.temperatureSensor',
    roomID: 1,
    parentId: 0,
    enabled: true,
    visible: true,
    properties: { value: false, dead: false, ...propOverrides },
    interfaces: [],
    ...rest,
  };
}

describe('Climate page', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockDevices = [];
    mockRooms = [];
    mockWeather = undefined;
    mockIsLoading = false;
    mockIsError = false;
  });

  it('shows loading spinner when isLoading is true', () => {
    mockIsLoading = true;
    const { container } = render(<Climate />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('shows error state when isError is true', () => {
    mockIsError = true;
    render(<Climate />);
    expect(screen.getByText('Failed to load devices')).toBeTruthy();
  });

  it('renders outdoor weather panel when useWeather returns data', () => {
    mockWeather = { Temperature: 12, Humidity: 65, Wind: 10, WeatherCondition: 'Cloudy', ConditionCode: 2 };
    render(<Climate />);
    expect(screen.getByText('12°C')).toBeTruthy();
    expect(screen.getByText('Outdoor')).toBeTruthy();
    expect(screen.getByText('65%')).toBeTruthy();
    expect(screen.getByText('10 km/h')).toBeTruthy();
    expect(screen.getByText('Cloudy')).toBeTruthy();
  });

  it('does not render outdoor panel when weather is undefined', () => {
    mockWeather = undefined;
    render(<Climate />);
    expect(screen.queryByText('Outdoor')).toBeNull();
  });

  it('renders thermostat card when device type is com.fibaro.hvacSystem', () => {
    mockDevices = [
      makeDevice({ id: 1, name: 'Living Thermostat', type: 'com.fibaro.hvacSystem', properties: { value: 21, dead: false } }),
    ];
    render(<Climate />);
    expect(screen.getByText('Living Thermostat')).toBeTruthy();
    expect(screen.getByText('Thermostats')).toBeTruthy();
  });

  it('renders temperature sensor when device type includes temperatureSensor', () => {
    mockDevices = [
      makeDevice({ id: 1, name: 'Bedroom Temp', type: 'com.fibaro.temperatureSensor', properties: { value: 19, dead: false } }),
    ];
    render(<Climate />);
    expect(screen.getByText('Bedroom Temp')).toBeTruthy();
    expect(screen.getByText('Temperature Sensors')).toBeTruthy();
  });

  it('renders humidity sensors section when humidity devices are present', () => {
    mockDevices = [
      makeDevice({ id: 1, name: 'Bathroom Humidity', type: 'com.fibaro.humiditySensor', properties: { value: 65, dead: false } }),
    ];
    render(<Climate />);
    expect(screen.getByText('Humidity Sensors')).toBeTruthy();
    expect(screen.getByText('Bathroom Humidity')).toBeTruthy();
    expect(screen.getByText('65%')).toBeTruthy();
  });

  it('does not show No climate devices found when only humidity sensors are present', () => {
    mockDevices = [
      makeDevice({ id: 1, name: 'Bathroom Humidity', type: 'com.fibaro.humiditySensor', properties: { value: 65, dead: false } }),
    ];
    render(<Climate />);
    expect(screen.getByText('Humidity Sensors')).toBeTruthy();
    expect(screen.queryByText('No climate devices found')).toBeNull();
  });

  it('shows No climate devices found when there are no thermostats or temp sensors', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.binarySwitch', properties: { value: false, dead: false } }),
    ];
    render(<Climate />);
    expect(screen.getByText('No climate devices found')).toBeTruthy();
  });

  it('shows target temperature arrow when thermostat has targetLevel defined', () => {
    mockDevices = [
      makeDevice({
        id: 1,
        name: 'Living Thermostat',
        type: 'com.fibaro.hvacSystem',
        properties: { value: 21, dead: false, targetLevel: 23 },
      }),
    ];
    render(<Climate />);
    expect(screen.getByText('→ 23°C')).toBeTruthy();
  });

  it('shows Offline label when thermostat device is dead', () => {
    mockDevices = [
      makeDevice({
        id: 1,
        name: 'Living Thermostat',
        type: 'com.fibaro.hvacSystem',
        properties: { value: 21, dead: true },
      }),
    ];
    render(<Climate />);
    expect(screen.getByText('Offline')).toBeTruthy();
  });

  it('shows Offline label when temperature sensor is dead', () => {
    mockDevices = [
      makeDevice({ id: 1, name: 'Bedroom Temp', type: 'com.fibaro.temperatureSensor', properties: { value: 19, dead: true } }),
    ];
    render(<Climate />);
    expect(screen.getByText('Offline')).toBeTruthy();
  });

  it('shows Offline label when humidity sensor is dead', () => {
    mockDevices = [
      makeDevice({ id: 1, name: 'Bathroom Hum', type: 'com.fibaro.humiditySensor', properties: { value: 65, dead: true } }),
    ];
    render(<Climate />);
    expect(screen.getByText('Offline')).toBeTruthy();
  });

  it('shows -- when thermostat value is not a number', () => {
    mockDevices = [
      makeDevice({
        id: 1,
        name: 'Living Thermostat',
        type: 'com.fibaro.hvacSystem',
        properties: { value: false, dead: false }, // boolean — not a number
      }),
    ];
    render(<Climate />);
    expect(screen.getByText('--°C')).toBeTruthy();
  });

  it('shows -- when temperature sensor value is not a number', () => {
    mockDevices = [
      makeDevice({
        id: 1,
        name: 'Bedroom Temp',
        type: 'com.fibaro.temperatureSensor',
        properties: { value: false, dead: false },
      }),
    ];
    render(<Climate />);
    expect(screen.getByText('--°C')).toBeTruthy();
  });

  it('shows -- when humidity sensor value is not a number', () => {
    mockDevices = [
      makeDevice({
        id: 1,
        name: 'Bathroom Humidity',
        type: 'com.fibaro.humiditySensor',
        properties: { value: false, dead: false },
      }),
    ];
    render(<Climate />);
    expect(screen.getByText('--%')).toBeTruthy();
  });

  it('shows Unknown room when thermostat roomID does not match any room', () => {
    mockDevices = [
      makeDevice({ id: 1, name: 'Living Thermostat', type: 'com.fibaro.hvacSystem', roomID: 99, properties: { value: 21, dead: false } }),
    ];
    mockRooms = []; // no matching room
    render(<Climate />);
    expect(screen.getByText('Unknown room')).toBeTruthy();
  });

  it('renders temperature sensor card without crashing when roomID has no matching room', () => {
    mockDevices = [
      makeDevice({
        id: 1,
        name: 'Orphan Temp Sensor',
        type: 'com.fibaro.temperatureSensor',
        roomID: 999,
        properties: { value: 21, dead: false },
      }),
    ];
    mockRooms = []; // no matching room
    render(<Climate />);
    expect(screen.getByText('Orphan Temp Sensor')).toBeTruthy();
    // room name cell is blank — no crash
    expect(screen.getByText('Temperature Sensors')).toBeTruthy();
  });

  it('renders temperature sensor when device type includes uppercase Temperature (capital T variant)', () => {
    mockDevices = [
      makeDevice({ id: 1, name: 'Main Temp Sensor', type: 'com.fibaro.MainTemperatureSensor', properties: { value: 20, dead: false } }),
    ];
    render(<Climate />);
    expect(screen.getByText('Main Temp Sensor')).toBeTruthy();
    expect(screen.getByText('Temperature Sensors')).toBeTruthy();
  });

  it('renders humidity sensor card without crashing when roomID has no matching room', () => {
    mockDevices = [
      makeDevice({
        id: 1,
        name: 'Orphan Humidity Sensor',
        type: 'com.fibaro.humiditySensor',
        roomID: 999,
        properties: { value: 60, dead: false },
      }),
    ];
    mockRooms = []; // no matching room
    render(<Climate />);
    expect(screen.getByText('Orphan Humidity Sensor')).toBeTruthy();
    // room name cell is blank — no crash
    expect(screen.getByText('Humidity Sensors')).toBeTruthy();
  });
});
