import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import DeviceCard from './DeviceCard';
import type { FibaroDevice } from '../../shared/types';

const mockMutate = vi.fn();

const { mockIsPending } = vi.hoisted(() => ({ mockIsPending: { value: false } }));

vi.mock('../hooks/useFibaro.ts', () => ({
  useDeviceAction: () => ({
    mutate: mockMutate,
    isPending: mockIsPending.value,
  }),
}));

function makeDevice(overrides: Partial<FibaroDevice> & { properties?: Partial<FibaroDevice['properties']> } = {}): FibaroDevice {
  const { properties: propOverrides, ...rest } = overrides;
  return {
    id: 1,
    name: 'Test Light',
    type: 'com.fibaro.binarySwitch',
    roomID: 1,
    parentId: 0,
    enabled: true,
    visible: true,
    properties: {
      value: false,
      dead: false,
      ...propOverrides,
    },
    interfaces: [],
    ...rest,
  };
}

describe('DeviceCard', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockMutate.mockClear();
    mockIsPending.value = false;
  });

  it('renders device name', () => {
    render(<DeviceCard device={makeDevice({ name: 'Living Room Light' })} />);
    expect(screen.getByText('Living Room Light')).toBeTruthy();
  });

  it('shows ToggleRight (blue) when device is on', () => {
    render(<DeviceCard device={makeDevice({ properties: { value: true, dead: false } })} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toContain('Turn off');
  });

  it('shows ToggleLeft when device is off', () => {
    render(<DeviceCard device={makeDevice({ properties: { value: false, dead: false } })} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toContain('Turn on');
  });

  it('calls action.mutate with turnOff when device is on and toggle clicked', () => {
    render(<DeviceCard device={makeDevice({ properties: { value: true, dead: false } })} />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockMutate).toHaveBeenCalledWith({ id: 1, action: 'turnOff' });
  });

  it('calls action.mutate with turnOn when device is off and toggle clicked', () => {
    render(<DeviceCard device={makeDevice({ properties: { value: false, dead: false } })} />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockMutate).toHaveBeenCalledWith({ id: 1, action: 'turnOn' });
  });

  it('toggle button is disabled when isDead is true', () => {
    render(<DeviceCard device={makeDevice({ properties: { value: false, dead: true } })} />);
    const btn = screen.getByRole('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('does not render toggle button for thermostat', () => {
    render(<DeviceCard device={makeDevice({ type: 'com.fibaro.hvacSystem' })} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not render toggle button for sensor', () => {
    render(<DeviceCard device={makeDevice({ type: 'com.fibaro.doorSensor' })} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows Offline text when device is dead', () => {
    render(<DeviceCard device={makeDevice({ properties: { value: false, dead: true } })} />);
    expect(screen.getByText('Offline')).toBeTruthy();
  });

  it('shows battery level when batteryLevel is defined', () => {
    render(<DeviceCard device={makeDevice({ properties: { value: false, dead: false, batteryLevel: 75 } })} />);
    expect(screen.getByText('Battery: 75%')).toBeTruthy();
  });

  it('toggle button aria-label contains device name', () => {
    render(<DeviceCard device={makeDevice({ name: 'Kitchen Lamp' })} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toContain('Kitchen Lamp');
  });

  it('toggle button is disabled when action.isPending is true', () => {
    mockIsPending.value = true;
    render(<DeviceCard device={makeDevice({ properties: { value: true, dead: false } })} />);
    const btn = screen.getByRole('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('shows value and unit when device has numeric value and unit', () => {
    render(<DeviceCard device={makeDevice({ type: 'com.fibaro.temperatureSensor', properties: { value: 21.5, dead: false, unit: '°C' } })} />);
    expect(screen.getByText('21.5 °C')).toBeTruthy();
  });

  it('shows power in watts when device has power property', () => {
    render(<DeviceCard device={makeDevice({ properties: { value: false, dead: false, power: 150 } })} />);
    expect(screen.getByText('150W')).toBeTruthy();
  });
});
