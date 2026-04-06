import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { useDeviceAction, useSceneExecute, useRooms, useDevices, useScenes, useWeather, useEnergy } from './useFibaro.js';

const { mockDeviceAction, mockExecuteScene, mockGetRooms, mockGetDevices, mockGetScenes, mockGetWeather, mockGetEnergy } = vi.hoisted(() => ({
  mockDeviceAction: vi.fn(),
  mockExecuteScene: vi.fn(),
  mockGetRooms: vi.fn(),
  mockGetDevices: vi.fn(),
  mockGetScenes: vi.fn(),
  mockGetWeather: vi.fn(),
  mockGetEnergy: vi.fn(),
}));

vi.mock('../services/api.ts', () => ({
  api: {
    deviceAction: mockDeviceAction,
    executeScene: mockExecuteScene,
    getRooms: mockGetRooms,
    getDevices: mockGetDevices,
    getScenes: mockGetScenes,
    getWeather: mockGetWeather,
    getEnergy: mockGetEnergy,
  },
}));

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  mockDeviceAction.mockReset();
  mockExecuteScene.mockReset();
  mockGetRooms.mockReset();
  mockGetDevices.mockReset();
  mockGetScenes.mockReset();
  mockGetWeather.mockReset();
  mockGetEnergy.mockReset();
});

describe('useDeviceAction', () => {
  it('calls api.deviceAction with correct arguments', async () => {
    mockDeviceAction.mockResolvedValue({});
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useDeviceAction(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 42, action: 'turnOn', args: [1] });
    });

    expect(mockDeviceAction).toHaveBeenCalledWith(42, 'turnOn', [1]);
  });

  it('invalidates devices query on success', async () => {
    mockDeviceAction.mockResolvedValue({});
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeviceAction(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 1, action: 'turnOff' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['devices'] });
  });
});

describe('useSceneExecute', () => {
  it('calls api.executeScene with correct id', async () => {
    mockExecuteScene.mockResolvedValue({});
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useSceneExecute(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync(7);
    });

    expect(mockExecuteScene).toHaveBeenCalledWith(7);
  });

  it('invalidates scenes query on success', async () => {
    mockExecuteScene.mockResolvedValue({});
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSceneExecute(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync(3);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['scenes'] });
  });
});

function getQueryOptions(queryClient: QueryClient, queryKey: string[]) {
  return queryClient.getQueryCache().find({ queryKey })?.options as Record<string, unknown> | undefined;
}

describe('useRooms', () => {
  it('uses queryKey ["rooms"] and calls api.getRooms', async () => {
    mockGetRooms.mockResolvedValue([]);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderHook(() => useRooms(), { wrapper: makeWrapper(queryClient) });

    const opts = getQueryOptions(queryClient, ['rooms']);
    expect(opts?.queryKey).toEqual(['rooms']);
    expect(opts?.queryFn).toBe(mockGetRooms);
  });
});

describe('useDevices', () => {
  it('uses queryKey ["devices"], api.getDevices, and refetchInterval 30000', async () => {
    mockGetDevices.mockResolvedValue([]);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderHook(() => useDevices(), { wrapper: makeWrapper(queryClient) });

    const opts = getQueryOptions(queryClient, ['devices']);
    expect(opts?.queryKey).toEqual(['devices']);
    expect(opts?.queryFn).toBe(mockGetDevices);
    expect(opts?.refetchInterval).toBe(30000);
  });
});

describe('useScenes', () => {
  it('uses queryKey ["scenes"], api.getScenes, and refetchInterval 60000', async () => {
    mockGetScenes.mockResolvedValue([]);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderHook(() => useScenes(), { wrapper: makeWrapper(queryClient) });

    const opts = getQueryOptions(queryClient, ['scenes']);
    expect(opts?.queryKey).toEqual(['scenes']);
    expect(opts?.queryFn).toBe(mockGetScenes);
    expect(opts?.refetchInterval).toBe(60000);
  });
});

describe('useWeather', () => {
  it('uses queryKey ["weather"], api.getWeather, and refetchInterval 60000', async () => {
    mockGetWeather.mockResolvedValue({});
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderHook(() => useWeather(), { wrapper: makeWrapper(queryClient) });

    const opts = getQueryOptions(queryClient, ['weather']);
    expect(opts?.queryKey).toEqual(['weather']);
    expect(opts?.queryFn).toBe(mockGetWeather);
    expect(opts?.refetchInterval).toBe(60000);
  });
});

describe('useEnergy', () => {
  it('uses queryKey ["energy"], api.getEnergy, and refetchInterval 30000', async () => {
    mockGetEnergy.mockResolvedValue([]);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderHook(() => useEnergy(), { wrapper: makeWrapper(queryClient) });

    const opts = getQueryOptions(queryClient, ['energy']);
    expect(opts?.queryKey).toEqual(['energy']);
    expect(opts?.queryFn).toBe(mockGetEnergy);
    expect(opts?.refetchInterval).toBe(30000);
  });
});
