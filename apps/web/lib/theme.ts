export type ThemeChoice = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Runs as an inline script in `<head>`, before the first paint, so the page never flashes the
 * wrong theme. With nothing stored it follows the OS preference; once the user toggles, the
 * stored choice wins. The storage read has its own try/catch so a blocked `localStorage` still
 * falls through to the OS preference. It cannot import anything, so it duplicates the key and
 * the rule on purpose; covered by tests/unit/lib/theme.test.ts.
 */
export const THEME_INIT_SCRIPT = `(function(){var c=null;try{c=localStorage.getItem('${THEME_STORAGE_KEY}')}catch(e){}var d=c==='dark';if(c!=='dark'&&c!=='light'){try{d=matchMedia('${SYSTEM_DARK_QUERY}').matches}catch(e){}}document.documentElement.classList.toggle('dark',d)})()`;

const THEME_CHANGE_EVENT = 'themechange';

function readStoredChoice(): ThemeChoice | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
}

function setDarkClass(dark: boolean): void {
  document.documentElement.classList.toggle('dark', dark);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/**
 * For `useSyncExternalStore`: same-tab changes (`applyTheme`), other-tab changes (`storage`,
 * re-applied here because the other tab only wrote the key), and OS changes while the user has
 * made no explicit choice.
 */
export function subscribeTheme(onChange: () => void): () => void {
  const query = typeof matchMedia === 'function' ? matchMedia(SYSTEM_DARK_QUERY) : null;
  const onStorage = (event: StorageEvent): void => {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
    const stored = readStoredChoice();
    setDarkClass(stored === null ? (query?.matches ?? false) : stored === 'dark');
  };
  const onSystemChange = (): void => {
    if (query !== null && readStoredChoice() === null) setDarkClass(query.matches);
  };
  // Safari < 14 only has the legacy `addListener`; without this guard the subscribe would throw.
  const watchSystem = query !== null && typeof query.addEventListener === 'function';
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  if (watchSystem) query?.addEventListener('change', onSystemChange);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
    if (watchSystem) query?.removeEventListener('change', onSystemChange);
  };
}

/** The theme actually on screen: the init script already resolved stored choice vs. OS. */
export function readCurrentTheme(): ThemeChoice {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/** Persists the choice (best effort: storage can be blocked) and toggles `.dark` on `<html>`. */
export function applyTheme(choice: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage blocked: the choice still applies for this page view.
  }
  // Elements with `transition-colors` would fade while the rest flips instantly, which reads as
  // a flicker. Suspend transitions while the theme changes. A timeout, not rAF: rAF never fires
  // in a hidden tab and the style would stay.
  const suspend = document.createElement('style');
  suspend.textContent = '*,*::before,*::after{transition:none!important}';
  document.head.appendChild(suspend);
  setDarkClass(choice === 'dark');
  void getComputedStyle(document.documentElement).color; // flush styles while transitions are off
  window.setTimeout(() => suspend.remove(), 50);
}
