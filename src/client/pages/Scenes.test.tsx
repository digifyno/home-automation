import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import Scenes from './Scenes';
import type { FibaroScene } from '../../shared/types';

const mockMutate = vi.fn();
let mockScenes: FibaroScene[] = [];
let mockIsLoading = false;
let mockIsError = false;

vi.mock('../hooks/useFibaro.ts', () => ({
  useScenes: () => ({ data: mockScenes, isLoading: mockIsLoading, isError: mockIsError }),
  useSceneExecute: () => ({ mutate: mockMutate }),
}));

function makeScene(overrides: Partial<FibaroScene> = {}): FibaroScene {
  return {
    id: 1,
    name: 'Test Scene',
    roomID: 1,
    type: 'lua',
    runConfig: '',
    enabled: true,
    isRunning: false,
    ...overrides,
  };
}

describe('Scenes page', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockMutate.mockClear();
    mockScenes = [];
    mockIsLoading = false;
    mockIsError = false;
  });

  it('shows loading spinner when isLoading is true', () => {
    mockIsLoading = true;
    const { container } = render(<Scenes />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('loading spinner has role status and aria-label', () => {
    mockIsLoading = true;
    const { container } = render(<Scenes />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner?.getAttribute('role')).toBe('status');
    expect(spinner?.getAttribute('aria-label')).toBe('Loading');
  });

  it('shows error state when isError is true', () => {
    mockIsError = true;
    render(<Scenes />);
    expect(screen.getByText('Failed to load scenes')).toBeTruthy();
  });

  it('error banner has role alert', () => {
    mockIsError = true;
    render(<Scenes />);
    const alert = document.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
  });

  it('renders only enabled scenes', () => {
    mockScenes = [
      makeScene({ id: 1, name: 'Active Scene', enabled: true }),
      makeScene({ id: 2, name: 'Disabled Scene', enabled: false }),
    ];
    render(<Scenes />);
    expect(screen.getByText('Active Scene')).toBeTruthy();
    expect(screen.queryByText('Disabled Scene')).toBeNull();
  });

  it('shows no scenes message when enabledScenes is empty', () => {
    mockScenes = [makeScene({ enabled: false })];
    render(<Scenes />);
    expect(screen.getByText('No scenes available')).toBeTruthy();
  });

  it('shows no scenes message when scenes list is empty', () => {
    mockScenes = [];
    render(<Scenes />);
    expect(screen.getByText('No scenes available')).toBeTruthy();
  });

  it('calls execute.mutate with correct scene id on button click', () => {
    mockScenes = [makeScene({ id: 42, name: 'My Scene' })];
    render(<Scenes />);
    fireEvent.click(screen.getByText('Run Scene'));
    expect(mockMutate).toHaveBeenCalledWith(42, expect.any(Object));
  });

  it('disables scene button while mutation is in flight', () => {
    mockScenes = [makeScene({ id: 1, name: 'My Scene' })];
    // mutate does NOT call onSettled — simulates in-flight mutation
    mockMutate.mockImplementation(() => undefined);
    render(<Scenes />);
    const btn = screen.getByText('Run Scene').closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(btn.disabled).toBe(true);
  });

  it('re-enables button after onSettled callback fires', () => {
    mockScenes = [makeScene({ id: 1, name: 'My Scene' })];
    mockMutate.mockImplementation((_id: number, opts: { onSettled: () => void }) => {
      opts.onSettled();
    });
    render(<Scenes />);
    const btn = screen.getByText('Run Scene').closest('button') as HTMLButtonElement;
    fireEvent.click(btn);
    expect(btn.disabled).toBe(false);
  });

  it('shows Running label and pulse indicator when scene isRunning is true', () => {
    mockScenes = [makeScene({ id: 1, name: 'Active Scene', isRunning: true })];
    render(<Scenes />);
    expect(screen.getByText('Running')).toBeTruthy();
  });

  it('shows scene-level error indicator when mutate calls onError', () => {
    mockScenes = [makeScene({ id: 1, name: 'My Scene' })];
    mockMutate.mockImplementation((_id: number, opts: { onSettled?: () => void; onError?: () => void }) => {
      opts.onError?.();
      opts.onSettled?.();
    });
    render(<Scenes />);
    fireEvent.click(screen.getByText('Run Scene'));
    expect(screen.getByText('Scene failed to run')).toBeTruthy();
  });

  it('shows error indicator only for the failed scene, not the successful one', () => {
    mockScenes = [
      makeScene({ id: 1, name: 'Failing Scene' }),
      makeScene({ id: 2, name: 'Good Scene' }),
    ];
    // Only first mutate call triggers onError
    mockMutate.mockImplementationOnce((_id: number, opts: { onSettled?: () => void; onError?: () => void }) => {
      opts.onError?.();
      opts.onSettled?.();
    });
    mockMutate.mockImplementationOnce((_id: number, opts: { onSettled?: () => void }) => {
      opts.onSettled?.();
    });
    render(<Scenes />);
    const buttons = screen.getAllByText('Run Scene').map(el => el.closest('button') as HTMLButtonElement);
    fireEvent.click(buttons[0]); // click Failing Scene
    fireEvent.click(buttons[1]); // click Good Scene
    expect(screen.getByText('Scene failed to run')).toBeTruthy();
    // Only one error message should appear
    expect(screen.getAllByText('Scene failed to run')).toHaveLength(1);
  });

  it('clicking Run Scene again after an error clears the error display', () => {
    mockScenes = [makeScene({ id: 1, name: 'My Scene' })];
    // First click: fails and settles
    mockMutate
      .mockImplementationOnce((_id: number, opts: { onSettled?: () => void; onError?: () => void }) => {
        opts.onError?.();
        opts.onSettled?.();
      })
      // Second click: succeeds and settles
      .mockImplementationOnce((_id: number, opts: { onSettled?: () => void }) => {
        opts.onSettled?.();
      });
    render(<Scenes />);
    const btn = screen.getByText('Run Scene').closest('button') as HTMLButtonElement;
    fireEvent.click(btn); // first click — fails
    expect(screen.getByText('Scene failed to run')).toBeTruthy();
    fireEvent.click(btn); // second click — error should clear immediately
    expect(screen.queryByText('Scene failed to run')).toBeNull();
  });

  it('shows scene type label when isRunning is false', () => {
    mockScenes = [makeScene({ id: 1, name: 'My Scene', type: 'lua', isRunning: false })];
    render(<Scenes />);
    expect(screen.getByText('lua')).toBeTruthy();
  });

  it('only disables the clicked scene button, not others', () => {
    mockScenes = [
      makeScene({ id: 1, name: 'Scene One' }),
      makeScene({ id: 2, name: 'Scene Two' }),
    ];
    mockMutate.mockImplementation(() => undefined);
    render(<Scenes />);
    const buttons = screen.getAllByText('Run Scene').map(el => el.closest('button') as HTMLButtonElement);
    fireEvent.click(buttons[0]);
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(false);
  });

  it('Run Scene button is enabled (not disabled) when scene isRunning is true', () => {
    mockScenes = [makeScene({ id: 1, name: 'Active Scene', isRunning: true })];
    render(<Scenes />);
    const btn = screen.getByText('Run Scene').closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('Run Scene button aria-label contains scene name', () => {
    mockScenes = [makeScene({ id: 1, name: 'Morning Routine' })];
    render(<Scenes />);
    // getByRole with name asserts the accessible name (aria-label)
    const btn = screen.getByRole('button', { name: 'Run Morning Routine' });
    expect(btn).toBeTruthy();
  });

  it('each Run Scene button has a distinct aria-label when multiple scenes are present', () => {
    mockScenes = [
      makeScene({ id: 1, name: 'Morning Routine' }),
      makeScene({ id: 2, name: 'Evening Mode' }),
    ];
    render(<Scenes />);
    expect(screen.getByRole('button', { name: 'Run Morning Routine' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Run Evening Mode' })).toBeTruthy();
  });
});
