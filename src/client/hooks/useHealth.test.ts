import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { useHealth } from './useHealth.js';

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function makeMockFetch(response: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(response),
  });
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('useHealth', () => {
  it('returns data and isError=false on success', async () => {
    const mockFetch = makeMockFetch({ status: 'ok', fibaro: 'reachable' });
    vi.stubGlobal('fetch', mockFetch);

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useHealth(), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ status: 'ok', fibaro: 'reachable' });
    expect(result.current.isError).toBe(false);
  });

  it('returns degraded data and isError=false on degraded status', async () => {
    const mockFetch = makeMockFetch({ status: 'degraded', fibaro: 'unreachable' });
    vi.stubGlobal('fetch', mockFetch);

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useHealth(), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ status: 'degraded', fibaro: 'unreachable' });
    expect(result.current.isError).toBe(false);
  });

  it('sets isError=true on network failure', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', mockFetch);

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useHealth(), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('calls fetch with /api/health and no Authorization header', async () => {
    const mockFetch = makeMockFetch({ status: 'ok', fibaro: 'reachable' });
    vi.stubGlobal('fetch', mockFetch);

    const queryClient = makeQueryClient();
    renderHook(() => useHealth(), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit | undefined];
    expect(url).toBe('/api/health');
    const headers = options?.headers as Record<string, string> | undefined;
    expect(headers?.['Authorization']).toBeUndefined();
  });

  it('configures refetchInterval of 30000', () => {
    const mockFetch = makeMockFetch({ status: 'ok', fibaro: 'reachable' });
    vi.stubGlobal('fetch', mockFetch);

    const queryClient = makeQueryClient();
    renderHook(() => useHealth(), { wrapper: makeWrapper(queryClient) });

    const opts = queryClient.getQueryCache().find({ queryKey: ['health'] })?.options as Record<string, unknown> | undefined;
    expect(opts?.refetchInterval).toBe(30000);
  });
});
