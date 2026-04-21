import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import DeviceCard from './DeviceCard';
import type { FibaroDevice } from '../../shared/types';

const mockMutate = vi.fn();

const { mockIsPending, mockIsError } = vi.hoisted(() => ({
  mockIsPending: { value: false },
  mockIsError: { value: false },
}));

vi.mock('../hooks/useFibaro.ts', () => ({
  useDeviceAction: () => ({
    mutate: mockMutate,
    isPending: mockIsPending.value,
    isError: mockIsError.value,
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
    mockIsError.value = false;
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

  it('shows Action failed text when action.isError is true', () => {
    mockIsError.value = true;
    render(<DeviceCard device={makeDevice({ properties: { value: false, dead: false } })} />);
    expect(screen.getByText('Action failed')).toBeTruthy();
  });

  it('renders toggle button for dimmer device type', () => {
    render(<DeviceCard device={makeDevice({ type: 'com.fibaro.dimmer2' })} />);
    const btn = screen.getByRole('button');
    const label = btn.getAttribute('aria-label') ?? '';
    expect(label.includes('Turn on') || label.includes('Turn off')).toBe(true);
  });

  it('renders toggle button for colorController device type', () => {
    render(<DeviceCard device={makeDevice({ type: 'com.fibaro.colorController' })} />);
    const btn = screen.getByRole('button');
    const label = btn.getAttribute('aria-label') ?? '';
    expect(label.includes('Turn on') || label.includes('Turn off')).toBe(true);
  });

  it('shows On text when device is on (non-dead, non-numeric)', () => {
    render(<DeviceCard device={makeDevice({ properties: { value: true, dead: false } })} />);
    expect(screen.getByText('On')).toBeTruthy();
  });

  it('shows Off text when device is off (non-dead, non-numeric)', () => {
    render(<DeviceCard device={makeDevice({ properties: { value: false, dead: false } })} />);
    expect(screen.getByText('Off')).toBeTruthy();
  });

  it('does not render toggle button for shutter device type', () => {
    render(<DeviceCard device={makeDevice({ type: 'com.fibaro.shutterWithMotor' })} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not render toggle button for safety device type', () => {
    render(<DeviceCard device={makeDevice({ type: 'com.fibaro.smokeDetector' })} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not render toggle button for energy device type', () => {
    render(<DeviceCard device={makeDevice({ type: 'com.fibaro.electricMeter' })} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not render toggle button for other device type', () => {
    render(<DeviceCard device={makeDevice({ type: 'com.fibaro.unknownWidget' })} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows On when device value is numeric but unit is absent', () => {
    render(<DeviceCard device={makeDevice({ type: 'com.fibaro.temperatureSensor', properties: { value: 21.5, dead: false } })} />);
    expect(screen.getByText('On')).toBeTruthy();
  });

  it('shows On text when binarySwitch value is numeric 1 (Fibaro on state)', () => {
    render(<DeviceCard device={makeDevice({ type: 'com.fibaro.binarySwitch', properties: { value: 1, dead: false } })} />);
    expect(screen.getByText('On')).toBeTruthy();
  });

  it('calls action.mutate with turnOff when binarySwitch value is numeric 1 and toggle clicked', () => {
    render(<DeviceCard device={makeDevice({ id: 5, type: 'com.fibaro.binarySwitch', properties: { value: 1, dead: false } })} />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockMutate).toHaveBeenCalledWith({ id: 5, action: 'turnOff' });
  });

  it('shows Turn off label when dimmer2 is at numeric brightness value (e.g. 50)', () => {
    render(<DeviceCard device={makeDevice({ type: 'com.fibaro.dimmer2', properties: { value: 50, dead: false } })} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toContain('Turn off');
  });

  it('calls action.mutate with turnOff when dimmer2 is at numeric brightness 50 and toggle clicked', () => {
    render(<DeviceCard device={makeDevice({ id: 3, type: 'com.fibaro.dimmer2', properties: { value: 50, dead: false } })} />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockMutate).toHaveBeenCalledWith({ id: 3, action: 'turnOff' });
  });
});
