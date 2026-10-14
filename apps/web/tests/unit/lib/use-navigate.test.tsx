import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import { onNavigationStart } from '../../../lib/navigation-events';
import { useNavigate, type Navigate } from '../../../lib/use-navigate';

let container: HTMLDivElement;
let root: Root;
const captured: { navigate: Navigate | null } = { navigate: null };

function Probe(): null {
  const value = useNavigate();
  useEffect(() => {
    captured.navigate = value;
  });
  return null;
}

const navigate = (): Navigate => captured.navigate as Navigate;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<Probe />);
  });
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

describe('useNavigate', () => {
  it('announces the navigation and pushes the route', () => {
    const started = vi.fn();
    const stop = onNavigationStart(started);

    act(() => {
      navigate().push('/dashboard/acme');
    });

    expect(started).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/dashboard/acme');
    stop();
  });

  it('announces a replace too', () => {
    const started = vi.fn();
    const stop = onNavigationStart(started);

    act(() => {
      navigate().replace('/login');
    });

    expect(started).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/login');
    stop();
  });

  it('refreshes without announcing, since the URL does not change', () => {
    const started = vi.fn();
    const stop = onNavigationStart(started);

    act(() => {
      navigate().refresh();
    });

    expect(started).not.toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalledTimes(1);
    stop();
  });

  it('does not announce a navigation to the URL already shown, which would leave the bar stuck', () => {
    const started = vi.fn();
    const stop = onNavigationStart(started);

    act(() => {
      navigate().push(window.location.pathname + window.location.search);
    });

    expect(started).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledTimes(1);
    stop();
  });

  it('still announces and pushes when the href is not a parseable URL', () => {
    const started = vi.fn();
    const stop = onNavigationStart(started);

    act(() => {
      navigate().push('http://');
    });

    expect(started).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('http://');
    stop();
  });
});
