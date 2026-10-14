import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const APP_DIR = resolve(__dirname, '../../../app');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const files = walk(APP_DIR).map((path) => relative(APP_DIR, path));
const pagesBelow = (folder: string): string[] =>
  files.filter(
    (file) => file.endsWith('page.tsx') && (folder === '' || file.startsWith(`${folder}/`)),
  );

/**
 * A `loading.tsx` above several pages is what the router shows for any of them whose own
 * boundary it has not prefetched yet, so a click lands on the wrong shape and is then replaced by
 * the right one: two different skeletons in a row. Each page therefore owns its fallback, in its
 * own folder or in one that holds only that page.
 */
describe('loading boundaries', () => {
  const boundaries = files.filter((file) => file.endsWith('loading.tsx'));

  it('finds the route files', () => {
    expect(boundaries.length).toBeGreaterThan(0);
  });

  it.each(boundaries)('%s covers a single page', (file) => {
    const folder = file.slice(0, -'/loading.tsx'.length);
    expect(pagesBelow(file === 'loading.tsx' ? '' : folder)).toHaveLength(1);
  });
});
