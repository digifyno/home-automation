import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import Lights from './Lights';
import type { FibaroDevice, FibaroRoom } from '../../shared/types';

const mockMutate = vi.fn();
let mockDevices: FibaroDevice[] = [];
let mockRooms: FibaroRoom[] = [];
let mockIsLoading = false;
let mockIsError = false;

vi.mock('../hooks/useFibaro.ts', () => ({
  useDevices: () => ({ data: mockDevices, isLoading: mockIsLoading, isError: mockIsError }),
  useRooms: () => ({ data: mockRooms }),
  useDeviceAction: () => ({ mutate: mockMutate, isPending: false }),
}));

function makeLight(overrides: Partial<FibaroDevice> & { properties?: Partial<FibaroDevice['properties']> } = {}): FibaroDevice {
  const { properties: propOverrides, ...rest } = overrides;
  return {
    id: 1,
    name: 'Light 1',
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

describe('Lights page', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockMutate.mockClear();
    mockDevices = [];
    mockRooms = [];
    mockIsLoading = false;
    mockIsError = false;
  });

  it('shows loading spinner when isLoading is true', () => {
    mockIsLoading = true;
    const { container } = render(<Lights />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('shows error state when isError is true', () => {
    mockIsError = true;
    render(<Lights />);
    expect(screen.getByText('Failed to load devices')).toBeTruthy();
  });

  it('shows all light devices when no room filter selected', () => {
    mockDevices = [
      makeLight({ id: 1, name: 'Kitchen Light' }),
      makeLight({ id: 2, name: 'Bedroom Light' }),
    ];
    render(<Lights />);
    expect(screen.getByText('Kitchen Light')).toBeTruthy();
    expect(screen.getByText('Bedroom Light')).toBeTruthy();
  });

  it('filters devices by room when room button clicked', () => {
    mockDevices = [
      makeLight({ id: 1, name: 'Kitchen Light', roomID: 1 }),
      makeLight({ id: 2, name: 'Bedroom Light', roomID: 2 }),
    ];
    mockRooms = [
      makeRoom({ id: 1, name: 'Kitchen' }),
      makeRoom({ id: 2, name: 'Bedroom' }),
    ];
    render(<Lights />);
    fireEvent.click(screen.getByText('Kitchen'));
    expect(screen.getByText('Kitchen Light')).toBeTruthy();
    expect(screen.queryByText('Bedroom Light')).toBeNull();
  });

  it('clicking All Rooms after room filter clears the filter and shows all devices', () => {
    mockDevices = [
      makeLight({ id: 1, name: 'Kitchen Light', roomID: 1 }),
      makeLight({ id: 2, name: 'Bedroom Light', roomID: 2 }),
    ];
    mockRooms = [
      makeRoom({ id: 1, name: 'Kitchen' }),
      makeRoom({ id: 2, name: 'Bedroom' }),
    ];
    render(<Lights />);
    fireEvent.click(screen.getByText('Kitchen'));
    expect(screen.queryByText('Bedroom Light')).toBeNull();
    fireEvent.click(screen.getByText('All Rooms'));
    expect(screen.getByText('Kitchen Light')).toBeTruthy();
    expect(screen.getByText('Bedroom Light')).toBeTruthy();
  });

  it('All Off button is disabled when no lights are on', () => {
    mockDevices = [makeLight({ properties: { value: false, dead: false } })];
    render(<Lights />);
    const btn = screen.getByText('All Off').closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('All Off button calls action.mutate for each on device', () => {
    mockDevices = [
      makeLight({ id: 1, properties: { value: true, dead: false } }),
      makeLight({ id: 2, properties: { value: true, dead: false } }),
    ];
    render(<Lights />);
    fireEvent.click(screen.getByText('All Off'));
    expect(mockMutate).toHaveBeenCalledTimes(2);
    expect(mockMutate).toHaveBeenCalledWith(
      { id: 1, action: 'turnOff' },
      expect.any(Object),
    );
    expect(mockMutate).toHaveBeenCalledWith(
      { id: 2, action: 'turnOff' },
      expect.any(Object),
    );
  });

  it('All Off button is disabled when filtered room has no lights on, even if other rooms do', () => {
    mockDevices = [
      makeLight({ id: 1, roomID: 1, properties: { value: false, dead: false } }), // Kitchen — off
      makeLight({ id: 2, roomID: 2, properties: { value: true, dead: false } }),  // Bedroom — on
    ];
    mockRooms = [
      makeRoom({ id: 1, name: 'Kitchen' }),
      makeRoom({ id: 2, name: 'Bedroom' }),
    ];
    render(<Lights />);
    fireEvent.click(screen.getByText('Kitchen'));
    const btn = screen.getByText('All Off').closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('shows No lights found when there are no light devices', () => {
    mockDevices = [];
    render(<Lights />);
    expect(screen.getByText('No lights found')).toBeTruthy();
  });

  it('does not show room filter button for rooms that have no light devices', () => {
    mockDevices = [
      makeLight({ id: 1, name: 'Kitchen Light', roomID: 1 }),
    ];
    mockRooms = [
      makeRoom({ id: 1, name: 'Kitchen' }),   // has a light device
      makeRoom({ id: 2, name: 'Office' }),    // no light devices
    ];
    render(<Lights />);
    expect(screen.getByText('Kitchen')).toBeTruthy();
    expect(screen.queryByText('Office')).toBeNull();
  });


  it('shows error message after All Off batch has at least one failure', () => {
    mockDevices = [makeLight({ id: 1, properties: { value: true, dead: false } })];
    mockMutate.mockImplementation((_args: unknown, opts: { onError?: () => void; onSettled?: () => void }) => {
      opts.onError?.();
      opts.onSettled?.();
    });
    render(<Lights />);
    fireEvent.click(screen.getByText('All Off'));
    expect(screen.getByText('Some lights failed to turn off')).toBeTruthy();
  });

  it('All Off button re-enables after all mutations settle successfully', () => {
    mockDevices = [
      makeLight({ id: 1, properties: { value: true, dead: false } }),
      makeLight({ id: 2, properties: { value: true, dead: false } }),
    ];
    // Simulate successful mutations: call onSettled immediately, no onError
    mockMutate.mockImplementation((_args: unknown, opts: { onSettled?: () => void }) => {
      opts.onSettled?.();
    });
    render(<Lights />);
    const btn = screen.getByText('All Off').closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    // After all onSettled callbacks fire, button should be re-enabled
    expect(btn.disabled).toBe(false);
    // No error message should be shown
    expect(screen.queryByText('Some lights failed to turn off')).toBeNull();
  });

  it('All Off button becomes disabled (pending) after clicking while mutations are in flight', () => {
    mockDevices = [makeLight({ id: 1, properties: { value: true, dead: false } })];
    // mutate does NOT call onSettled — simulates in-flight mutation
    mockMutate.mockImplementation(() => undefined);
    render(<Lights />);
    const btn = screen.getByText('All Off').closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(btn.disabled).toBe(true);
  });

  it('shows lights-on count in subtitle (N of M on)', () => {
    mockDevices = [
      makeLight({ id: 1, properties: { value: true, dead: false } }),
      makeLight({ id: 2, properties: { value: false, dead: false } }),
      makeLight({ id: 3, properties: { value: true, dead: false } }),
    ];
    render(<Lights />);
    expect(screen.getByText('2 of 3 on')).toBeTruthy();
  });

  it('shows 0 of N on when no lights are on', () => {
    mockDevices = [
      makeLight({ id: 1, properties: { value: false, dead: false } }),
      makeLight({ id: 2, properties: { value: false, dead: false } }),
    ];
    render(<Lights />);
    expect(screen.getByText('0 of 2 on')).toBeTruthy();
  });

  it('subtitle still shows global lights-on count when a room filter is active', () => {
    mockDevices = [
      makeLight({ id: 1, roomID: 1, properties: { value: true, dead: false } }),  // Kitchen — on
      makeLight({ id: 2, roomID: 2, properties: { value: true, dead: false } }),  // Bedroom — on
      makeLight({ id: 3, roomID: 2, properties: { value: false, dead: false } }), // Bedroom — off
    ];
    mockRooms = [
      makeRoom({ id: 1, name: 'Kitchen' }),
      makeRoom({ id: 2, name: 'Bedroom' }),
    ];
    render(<Lights />);
    // Select Kitchen — only 1 of 1 on in Kitchen, but global is 2 of 3 on
    fireEvent.click(screen.getByText('Kitchen'));
    // Subtitle always reflects the global count, not the filtered count
    expect(screen.getByText('2 of 3 on')).toBeTruthy();
  });
});
