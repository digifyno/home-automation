import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { useDeviceAction, useSceneExecute, useRooms, useDevices, useScenes, useWeather, useEnergy, useDevice } from './useFibaro.js';

const { mockDeviceAction, mockExecuteScene, mockGetRooms, mockGetDevices, mockGetScenes, mockGetWeather, mockGetEnergy, mockGetDevice } = vi.hoisted(() => ({
  mockDeviceAction: vi.fn(),
  mockExecuteScene: vi.fn(),
  mockGetRooms: vi.fn(),
  mockGetDevices: vi.fn(),
  mockGetScenes: vi.fn(),
  mockGetWeather: vi.fn(),
  mockGetEnergy: vi.fn(),
  mockGetDevice: vi.fn(),
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
    getDevice: mockGetDevice,
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
  mockGetDevice.mockReset();
});

describe('useDeviceAction', () => {
  it('calls api.deviceAction with correct arguments', async () => {
    mockDeviceAction.mockResolvedValue({});
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useDeviceAction(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 42, action: 'setValue', args: { value: 50 } });
    });

    expect(mockDeviceAction).toHaveBeenCalledWith(42, 'setValue', { value: 50 });
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

  it('sets isError=true when api.deviceAction rejects', async () => {
    mockDeviceAction.mockRejectedValue(new Error('network failure'));
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeviceAction(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ id: 42, action: 'turnOn' });
      } catch {
        // expected
      }
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(Error);
    expect(invalidateSpy).not.toHaveBeenCalled(); // cache must NOT be invalidated on failure
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

  it('sets isError=true when api.executeScene rejects', async () => {
    mockExecuteScene.mockRejectedValue(new Error('fibaro down'));
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSceneExecute(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync(7);
      } catch {
        // expected
      }
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(Error);
    expect(invalidateSpy).not.toHaveBeenCalled(); // cache must NOT be invalidated on failure
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

  it('sets isError=true when api.getRooms rejects', async () => {
    mockGetRooms.mockRejectedValue(new Error('network failure'));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useRooms(), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('does not set a refetchInterval (rooms are static data)', async () => {
    mockGetRooms.mockResolvedValue([]);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useRooms(), { wrapper: makeWrapper(queryClient) });
    const opts = getQueryOptions(queryClient, ['rooms']);
    expect(opts?.refetchInterval).toBeUndefined();
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

  it('sets isError=true when api.getDevices rejects', async () => {
    mockGetDevices.mockRejectedValue(new Error('network failure'));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useDevices(), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
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

  it('sets isError=true when api.getScenes rejects', async () => {
    mockGetScenes.mockRejectedValue(new Error('network failure'));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useScenes(), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
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

  it('sets isError=true when api.getWeather rejects', async () => {
    mockGetWeather.mockRejectedValue(new Error('network failure'));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useWeather(), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
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

  it('sets isError=true when api.getEnergy rejects', async () => {
    mockGetEnergy.mockRejectedValue(new Error('network failure'));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useEnergy(), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

describe('useDevice', () => {
  it('uses queryKey ["device", id] and calls api.getDevice with correct id', async () => {
    mockGetDevice.mockResolvedValue({ id: 5, name: 'Light' });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderHook(() => useDevice(5), { wrapper: makeWrapper(queryClient) });

    const opts = queryClient.getQueryCache().find({ queryKey: ['device', 5] })?.options as Record<string, unknown> | undefined;
    expect(opts?.queryKey).toEqual(['device', 5]);
    await waitFor(() => expect(mockGetDevice).toHaveBeenCalledWith(5));
  });

  it('returns data when api.getDevice resolves', async () => {
    const device = { id: 5, name: 'Light' };
    mockGetDevice.mockResolvedValue(device);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useDevice(5), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(device);
  });

  it('sets isError=true when api.getDevice rejects', async () => {
    mockGetDevice.mockRejectedValue(new Error('not found'));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useDevice(99), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('does not set a refetchInterval (no auto-polling for individual device)', async () => {
    mockGetDevice.mockResolvedValue({ id: 5 });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useDevice(5), { wrapper: makeWrapper(queryClient) });
    const opts = queryClient.getQueryCache().find({ queryKey: ['device', 5] })?.options as Record<string, unknown> | undefined;
    expect(opts?.refetchInterval).toBeUndefined();
  });
});
