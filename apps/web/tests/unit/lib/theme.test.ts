import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  applyTheme,
  readCurrentTheme,
  subscribeTheme,
} from '../../../lib/theme';

interface FakeQuery {
  matches: boolean;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

function stubSystemDark(matches: boolean): FakeQuery {
  const listeners = new Set<() => void>();
  const query: FakeQuery = {
    matches,
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', () => query);
  return Object.assign(query, { fire: () => listeners.forEach((listener) => listener()) });
}

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.head.querySelectorAll('style').forEach((node) => node.remove());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('persists the choice, toggles the dark class and notifies subscribers', () => {
    stubSystemDark(false);
    const onChange = vi.fn();
    const unsubscribe = subscribeTheme(onChange);
    applyTheme('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(readCurrentTheme()).toBe('dark');
    applyTheme('light');
    expect(readCurrentTheme()).toBe('light');
    expect(onChange).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('removes the transition-suspending style even when no frame ever runs', () => {
    vi.useFakeTimers();
    stubSystemDark(false);
    applyTheme('dark');
    expect(document.head.querySelectorAll('style')).toHaveLength(1);
    vi.advanceTimersByTime(100);
    expect(document.head.querySelectorAll('style')).toHaveLength(0);
  });

  it('applies a choice stored by another tab when a storage event arrives', () => {
    stubSystemDark(false);
    const unsubscribe = subscribeTheme(vi.fn());
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY }));
    expect(readCurrentTheme()).toBe('dark');
    unsubscribe();
  });

  it('follows OS changes only while nothing is stored', () => {
    const query = stubSystemDark(false) as FakeQuery & { fire: () => void };
    const unsubscribe = subscribeTheme(vi.fn());
    query.matches = true;
    query.fire();
    expect(readCurrentTheme()).toBe('dark');

    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    applyTheme('light');
    query.matches = true;
    query.fire();
    expect(readCurrentTheme()).toBe('light');
    unsubscribe();
  });

  describe('init script (runs before first paint)', () => {
    it.each([
      ['dark', false, true],
      ['light', true, false],
      [null, true, true],
      [null, false, false],
    ] as const)('stored=%s, OS dark=%s -> dark class %s', (stored, osDark, expected) => {
      stubSystemDark(osDark);
      if (stored !== null) localStorage.setItem(THEME_STORAGE_KEY, stored);
      new Function(THEME_INIT_SCRIPT)();
      expect(readCurrentTheme()).toBe(expected ? 'dark' : 'light');
    });

    it('still follows the OS when localStorage throws', () => {
      stubSystemDark(true);
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      new Function(THEME_INIT_SCRIPT)();
      expect(readCurrentTheme()).toBe('dark');
      vi.restoreAllMocks();
    });
  });
});
