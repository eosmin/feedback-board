import { expect, test } from '@playwright/test';

import { createBoard, createOrg, createPost, signInViaMagicLink, uniqueSlug } from './helpers';

/**
 * The org overview (Step 22.10): the plan usage, each board's post count and last post, and the
 * Free-plan cap turning the create dialog into the upgrade prompt.
 */
test('overview shows usage, per-board numbers and the cap prompt', async ({ page }) => {
  const orgSlug = uniqueSlug('overview-org');
  const boardSlug = uniqueSlug('overview-board');
  const postTitle = `Overview post ${Date.now()}`;

  await signInViaMagicLink(page, `e2e-overview-${Date.now()}@example.com`);
  await createOrg(page, 'Overview Org', orgSlug);

  await expect(page.getByRole('heading', { level: 1, name: 'Boards' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: '0 of 1 boards used' })).toBeVisible();
  await expect(page).toHaveTitle('Boards · FeedbackBoard');

  await createBoard(page, 'Overview Board', boardSlug);
  await createPost(page, postTitle, 'A post so the board card has numbers to show.');

  await page.goto(`/dashboard/${orgSlug}`);
  await expect(page.getByRole('progressbar', { name: '1 of 1 boards used' })).toBeVisible();
  const card = page.locator('li', { hasText: 'Overview Board' });
  await expect(card).toContainText('1 post');
  await expect(card).toContainText('Last post');

  await page.getByRole('button', { name: 'New board' }).click();
  await expect(page.getByText("You've reached the Free plan board limit")).toBeVisible();
  await expect(page.getByLabel('Board name')).toHaveCount(0);
});
