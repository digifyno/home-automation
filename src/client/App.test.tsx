import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { useHealth } from './hooks/useHealth.ts';

vi.mock('./hooks/useFibaro.ts', () => ({
  useDevices: () => ({ data: [], isLoading: false, isError: false }),
  useRooms: () => ({ data: [], isLoading: false, isError: false }),
  useScenes: () => ({ data: [], isLoading: false, isError: false }),
  useWeather: () => ({ data: [], isLoading: false, isError: false }),
  useEnergy: () => ({ data: [], isLoading: false, isError: false }),
  useDeviceAction: () => ({ mutate: vi.fn(), isPending: false }),
  useSceneExecute: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('./hooks/useHealth.ts', () => ({
  useHealth: vi.fn(() => ({ data: undefined, isError: false, isLoading: true })),
}));

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><App /></QueryClientProvider>);
}

describe('App navigation', () => {
  afterEach(() => {
    cleanup();
  });

  it('default page is Dashboard', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeTruthy();
    const dashboardBtn = screen.getByRole('button', { name: /dashboard/i });
    expect(dashboardBtn.getAttribute('aria-current')).toBe('page');
  });

  it('clicking Lights nav item shows Lights page', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /lights/i }));
    expect(screen.getByRole('heading', { name: /lights/i })).toBeTruthy();
  });

  it('clicking Climate nav item shows Climate page', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /climate/i }));
    expect(screen.getByRole('heading', { name: /climate/i })).toBeTruthy();
  });

  it('clicking Scenes nav item shows Scenes page', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /scenes/i }));
    expect(screen.getByRole('heading', { name: /scenes/i })).toBeTruthy();
  });

  it('clicking Security nav item shows Security page', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /security/i }));
    expect(screen.getByRole('heading', { name: /security/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /security/i }).getAttribute('aria-current')).toBe('page');
  });

  it('clicking Energy nav item shows Energy page', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /energy/i }));
    expect(screen.getByRole('heading', { name: /energy/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /energy/i }).getAttribute('aria-current')).toBe('page');
  });

  it('aria-current moves to the active page', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /lights/i }));
    const buttons = screen.getAllByRole('button');
    const activeButtons = buttons.filter((b) => b.getAttribute('aria-current') === 'page');
    expect(activeButtons).toHaveLength(1);
    expect(activeButtons[0].textContent).toMatch(/lights/i);
  });

  it('clicking the active nav item keeps it active', () => {
    renderApp();
    const dashboardBtn = screen.getByRole('button', { name: /dashboard/i });
    fireEvent.click(dashboardBtn);
    expect(dashboardBtn.getAttribute('aria-current')).toBe('page');
  });

  it('shows Live indicator when health status is ok', () => {
    vi.mocked(useHealth).mockReturnValueOnce({ data: { status: 'ok', fibaro: 'reachable' }, isError: false, isLoading: false } as unknown as ReturnType<typeof useHealth>);
    renderApp();
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.queryByText('Offline')).toBeNull();
  });

  it('shows Offline indicator when health check errors', () => {
    vi.mocked(useHealth).mockReturnValueOnce({ data: undefined, isError: true, isLoading: false } as unknown as ReturnType<typeof useHealth>);
    renderApp();
    expect(screen.getByText('Offline')).toBeTruthy();
    expect(screen.queryByText('Live')).toBeNull();
  });

  it('shows Degraded indicator when health status is degraded', () => {
    vi.mocked(useHealth).mockReturnValueOnce({ data: { status: 'degraded', fibaro: 'unreachable' }, isError: false, isLoading: false } as unknown as ReturnType<typeof useHealth>);
    renderApp();
    expect(screen.getByText('Degraded')).toBeTruthy();
    expect(screen.queryByText('Live')).toBeNull();
    expect(screen.queryByText('Offline')).toBeNull();
  });

  it('shows Checking indicator while health is loading', () => {
    vi.mocked(useHealth).mockReturnValueOnce({ data: undefined, isError: false, isLoading: true } as unknown as ReturnType<typeof useHealth>);
    renderApp();
    expect(screen.getByText('Checking')).toBeTruthy();
    expect(screen.queryByText('Offline')).toBeNull();
    expect(screen.queryByText('Live')).toBeNull();
  });
});
