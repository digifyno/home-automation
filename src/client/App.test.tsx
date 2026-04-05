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
  useDeviceAction: () => ({ mutate: vi.fn(), isPending: false }),
  useSceneExecute: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('./hooks/useHealth.ts', () => ({
  useHealth: vi.fn(() => ({ data: undefined, isError: false })),
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
    vi.mocked(useHealth).mockReturnValueOnce({ data: { status: 'ok', fibaro: 'reachable' }, isError: false });
    renderApp();
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.queryByText('Offline')).toBeNull();
  });

  it('shows Offline indicator when health check errors', () => {
    vi.mocked(useHealth).mockReturnValueOnce({ data: undefined, isError: true });
    renderApp();
    expect(screen.getByText('Offline')).toBeTruthy();
    expect(screen.queryByText('Live')).toBeNull();
  });
});
