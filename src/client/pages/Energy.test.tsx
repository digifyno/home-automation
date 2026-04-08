import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import Energy from './Energy';
import type { FibaroDevice, FibaroRoom, FibaroEnergyDevice } from '../../shared/types';

let mockDevices: FibaroDevice[] = [];
let mockRooms: FibaroRoom[] = [];
let mockEnergyData: FibaroEnergyDevice[] = [];
let mockIsLoading = false;
let mockIsError = false;

vi.mock('../hooks/useFibaro.ts', () => ({
  useDevices: () => ({ data: mockDevices, isLoading: mockIsLoading, isError: mockIsError }),
  useRooms: () => ({ data: mockRooms }),
  useEnergy: () => ({ data: mockEnergyData }),
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

describe('Energy page', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockDevices = [];
    mockRooms = [];
    mockEnergyData = [];
    mockIsLoading = false;
    mockIsError = false;
  });

  it('shows loading spinner when isLoading is true', () => {
    mockIsLoading = true;
    const { container } = render(<Energy />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('shows error state when isError is true', () => {
    mockIsError = true;
    render(<Energy />);
    expect(screen.getByText('Failed to load devices')).toBeTruthy();
  });

  it('shows total power as sum of device power values', () => {
    mockDevices = [
      makeDevice({ id: 1, name: 'Heater', properties: { value: true, dead: false, power: 1500 } }),
      makeDevice({ id: 2, name: 'Fridge', properties: { value: true, dead: false, power: 200 } }),
    ];
    render(<Energy />);
    expect(screen.getByText('1700')).toBeTruthy();
  });

  it('shows No energy data available when no powerDevices and no energyMeters', () => {
    mockDevices = [
      makeDevice({ id: 1, type: 'com.fibaro.binarySwitch', properties: { value: false, dead: false } }),
    ];
    render(<Energy />);
    expect(screen.getByText('No energy data available')).toBeTruthy();
  });

  it('renders active consumers list sorted by power (highest first)', () => {
    mockDevices = [
      makeDevice({ id: 1, name: 'Small Device', properties: { value: true, dead: false, power: 100 } }),
      makeDevice({ id: 2, name: 'Big Device', properties: { value: true, dead: false, power: 2000 } }),
    ];
    render(<Energy />);
    const items = screen.getAllByText(/Device/);
    // Big Device should appear before Small Device in the DOM
    const bigIdx = items.findIndex(el => el.textContent === 'Big Device');
    const smallIdx = items.findIndex(el => el.textContent === 'Small Device');
    expect(bigIdx).toBeLessThan(smallIdx);
  });

  it('shows energy meters section for devices with electricMeter type', () => {
    mockDevices = [
      makeDevice({ id: 1, name: 'Main Meter', type: 'com.fibaro.electricMeter', properties: { value: false, dead: false, energy: 12.5 } }),
    ];
    render(<Energy />);
    expect(screen.getByText('Energy Meters')).toBeTruthy();
    expect(screen.getByText('Main Meter')).toBeTruthy();
  });

  it('does not include device with power 0 in active consumers', () => {
    mockDevices = [
      makeDevice({ id: 1, name: 'Idle Device', properties: { value: false, dead: false, power: 0 } }),
      makeDevice({ id: 2, name: 'Active Device', properties: { value: true, dead: false, power: 300 } }),
    ];
    render(<Energy />);
    expect(screen.queryByText('Active Consumers')).toBeTruthy();
    // Only Active Device in consumers list (Idle Device has power: 0, excluded)
    const consumerSection = screen.getByText('Active Consumers').closest('div');
    expect(consumerSection?.textContent).toContain('Active Device');
    expect(consumerSection?.textContent).not.toContain('Idle Device');
  });

  it('shows kWh from energyData when energyData entry matches device id', () => {
    mockEnergyData = [{ id: 1, value: 42.75 }];
    mockDevices = [
      makeDevice({ id: 1, name: 'Main Meter', type: 'com.fibaro.electricMeter', properties: { value: false, dead: false, energy: 10.0 } }),
    ];
    render(<Energy />);
    expect(screen.getByText('42.75')).toBeTruthy();
    expect(screen.getByText('kWh')).toBeTruthy();
  });

  it('falls back to device.properties.energy when no energyData entry matches', () => {
    mockEnergyData = [{ id: 999, value: 100 }];
    mockDevices = [
      makeDevice({ id: 1, name: 'Main Meter', type: 'com.fibaro.electricMeter', properties: { value: false, dead: false, energy: 15.5 } }),
    ];
    render(<Energy />);
    expect(screen.getByText('15.50')).toBeTruthy();
  });
});
