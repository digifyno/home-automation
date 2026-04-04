import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { useDeviceAction, useSceneExecute } from './useFibaro.js';

const { mockDeviceAction, mockExecuteScene } = vi.hoisted(() => ({
  mockDeviceAction: vi.fn(),
  mockExecuteScene: vi.fn(),
}));

vi.mock('../services/api.ts', () => ({
  api: {
    deviceAction: mockDeviceAction,
    executeScene: mockExecuteScene,
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
