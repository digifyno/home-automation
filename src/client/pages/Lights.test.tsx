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
});
