import { expect, test, type Page } from '@playwright/test';

import { createBoard, createOrg, createPost, signInViaMagicLink, uniqueSlug } from './helpers';

function postTitles(page: Page): Promise<string[]> {
  return page.locator('li h2').allTextContents();
}

/**
 * The board detail (Step 22.11): where a new post lands, a filtered view surviving a reload, and
 * the drawer with its comments, all through the real stack.
 */
test('board detail: order, filters in the URL and the comment drawer', async ({ page }) => {
  const stamp = Date.now();
  const first = `Alpha request ${stamp}`;
  const second = `Bravo request ${stamp}`;
  const third = `Charlie request ${stamp}`;
  const boardSlug = uniqueSlug('detail-board');

  await signInViaMagicLink(page, `e2e-board-detail-${stamp}@example.com`);
  await createOrg(page, 'Detail Org', uniqueSlug('detail-org'));
  await expect(page).toHaveURL(/\/dashboard\/[^/]+$/);
  await createBoard(page, 'Detail Board', boardSlug);
  await expect(page).toHaveTitle('Detail Board · FeedbackBoard');

  await createPost(page, first, 'The first thing someone asked for.');
  await createPost(page, second, 'The second thing someone asked for.');
  await createPost(page, third, 'The third thing someone asked for.');

  // A created post sits where the server puts it, and a reload leaves it there.
  const created = await postTitles(page);
  expect(created).toEqual([third, second, first]);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Detail Board' })).toBeVisible();
  expect(await postTitles(page)).toEqual(created);

  // Search lives in the URL, so a filtered view survives a reload.
  await page.getByRole('searchbox', { name: 'Search feedback' }).fill('bravo');
  await expect(page).toHaveURL(/[?&]q=bravo/);
  await expect(page.locator('li h2')).toHaveText([second]);
  await page.reload();
  await expect(page.getByRole('searchbox', { name: 'Search feedback' })).toHaveValue('bravo');
  await expect(page.locator('li h2')).toHaveText([second]);

  // A search that matches nothing is not the empty board.
  await page.getByRole('searchbox', { name: 'Search feedback' }).fill('zzz-nothing');
  await expect(page.getByText('No feedback matches your search or filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('li h2')).toHaveCount(3);
  await expect(page).not.toHaveURL(/[?&]q=/);

  // The drawer: opening it is a link, the comment shows with its author, and closing clears it.
  await page.getByRole('button', { name: second }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  await expect(page).toHaveURL(/[?&]post=/);
  await drawer.getByRole('textbox', { name: 'Add a comment' }).fill('A comment from the e2e run.');
  await drawer.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(drawer.getByText('A comment from the e2e run.')).toBeVisible();
  await expect(drawer.getByText('Sending…')).toHaveCount(0);
  await expect(
    drawer
      .getByRole('region', { name: 'Comments' })
      .getByText(`e2e-board-detail-${stamp}`, { exact: true }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('A comment from the e2e run.')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).not.toHaveURL(/[?&]post=/);
  await expect(page.locator('li', { hasText: second }).getByLabel('Comments: 1')).toBeVisible();
});
