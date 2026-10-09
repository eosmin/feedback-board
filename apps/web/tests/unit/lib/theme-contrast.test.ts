import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const CSS = readFileSync(resolve(__dirname, '../../../styles/globals.css'), 'utf8');

type Rgb = readonly [number, number, number];

/** Body of the first `{ ... }` after `opening`, matched by brace depth (tolerates nested rules). */
function blockBody(opening: string): string {
  const start = CSS.indexOf(opening);
  if (start === -1) throw new Error(`block not found: ${opening}`);
  let depth = 0;
  for (let i = CSS.indexOf('{', start); i < CSS.length; i += 1) {
    if (CSS[i] === '{') depth += 1;
    if (CSS[i] === '}') depth -= 1;
    if (depth === 0) return CSS.slice(start, i);
  }
  throw new Error(`unterminated block: ${opening}`);
}

/** Every `--color-*` must be a plain oklch(): anything else would silently skip its contrast check. */
function readTokens(block: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const match of block.matchAll(/--color-([a-z0-9-]+):\s*([^;]+);/g)) {
    const value = match[2]?.trim() ?? '';
    const oklch = /^oklch\(([^)]+)\)$/.exec(value);
    if (oklch === null) throw new Error(`--color-${match[1]} is not a plain oklch() value: ${value}`);
    tokens.set(match[1] ?? '', oklch[1] ?? '');
  }
  return tokens;
}

const LIGHT = readTokens(blockBody('@theme {'));
// `.dark` must override every token; merged over LIGHT so a missing one fails the coverage test below.
const DARK = new Map([...LIGHT, ...readTokens(blockBody('.dark {'))]);

/** oklch -> linear sRGB (Ottosson's OKLab matrices), alpha ignored: opaque tokens only. */
function toLinearRgb(oklch: string): Rgb {
  const [l = 0, c = 0, h = 0] = oklch
    .split('/')[0]!
    .trim()
    .split(/\s+/)
    .map(Number);
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l3 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m3 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s3 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (v: number): number => Math.min(1, Math.max(0, v));
  return [
    clamp(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
    clamp(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
    clamp(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3),
  ];
}

function luminance(oklch: string): number {
  const [r, g, b] = toLinearRgb(oklch);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(tokens: Map<string, string>, fg: string, bg: string): number {
  const f = tokens.get(fg);
  const b = tokens.get(bg);
  if (f === undefined || b === undefined) throw new Error(`unknown token: ${fg} / ${bg}`);
  const [hi, lo] = [luminance(f), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const SURFACES = ['surface', 'surface-raised', 'surface-sunken'] as const;
const TONES = [
  'status-open',
  'status-planned',
  'status-in-progress',
  'status-done',
  'status-closed',
  'priority-low',
  'priority-medium',
  'priority-high',
] as const;

/** [foreground token, background token, minimum ratio] */
const PAIRS: ReadonlyArray<readonly [string, string, number]> = [
  ...SURFACES.flatMap((bg) =>
    ['text', 'text-muted', 'text-subtle', 'accent-text', 'danger'].map(
      (fg) => [fg, bg, 4.5] as const,
    ),
  ),
  ...['surface', 'surface-raised', 'surface-sunken'].flatMap((bg) => [
    ['border-strong', bg, 3] as const,
    ['focus', bg, 3] as const,
  ]),
  ['accent-text', 'accent-soft', 4.5],
  // Upgrade links sit inside the warning Alert.
  ['accent-text', 'warning-soft', 4.5],
  ['accent-fg', 'accent', 4.5],
  ['accent-fg', 'accent-hover', 4.5],
  ['accent-soft-text', 'accent-soft', 4.5],
  ['success', 'success-soft', 4.5],
  ['warning', 'warning-soft', 4.5],
  ['danger', 'danger-soft', 4.5],
  ['success-border', 'surface-raised', 1.5],
  ['warning-border', 'surface-raised', 1.5],
  ['danger-border', 'surface-raised', 1.5],
  ...TONES.map((tone) => [tone, `${tone}-soft`, 4.5] as const),
];

describe.each([
  ['light', LIGHT],
  ['dark', DARK],
] as const)('%s theme contrast', (_name, tokens) => {
  it.each(PAIRS)('%s on %s is at least %s:1', (fg, bg, min) => {
    expect(contrast(tokens, fg, bg)).toBeGreaterThanOrEqual(min);
  });
});

describe('dark theme coverage', () => {
  it('overrides every semantic token the light theme defines', () => {
    const darkOnly = readTokens(blockBody('.dark {'));
    const semantic = [...LIGHT.keys()];
    expect(semantic.filter((name) => !darkOnly.has(name))).toEqual([]);
  });
});
