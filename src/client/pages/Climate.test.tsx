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
});
