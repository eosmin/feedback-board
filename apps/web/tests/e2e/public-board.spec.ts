import { expect, test } from '@playwright/test';

import { createBoard, createOrg, createPost, signInViaMagicLink, uniqueSlug } from './helpers';

/**
 * Golden path B (TDD §14, §14.1, Step 19.6): view a public board page unauthenticated. Setup
 * (sign in, create org/board/post) runs in an authenticated context so the fixture data exists;
 * the actual assertion happens in a **separate, cookie-less browser context** — proving the
 * public board route (Step 18) needs no session, not merely that the same browser can also see
 * it after signing in.
 */
test('unauthenticated visitor can view a public board', async ({ page, browser }) => {
  const email = `e2e-public-board-${Date.now()}@example.com`;
  const orgSlug = uniqueSlug('public-org');
  const boardSlug = uniqueSlug('public-board');
  const postTitle = `Public post ${Date.now()}`;

  await signInViaMagicLink(page, email);
  await createOrg(page, `Public Org ${Date.now()}`, orgSlug);
  // The board form's "Make this board publicly viewable" checkbox defaults to checked (TDD §13
  // step 19.2) — left untouched here on purpose, so this exercises the same default a real
  // admin would ship with.
  await createBoard(page, `Public Board ${Date.now()}`, boardSlug);
  await createPost(page, postTitle, 'Visible to the public without signing in.');

  const anonymousContext = await browser.newContext();
  try {
    const anonymousPage = await anonymousContext.newPage();
    await anonymousPage.goto(`/${orgSlug}/${boardSlug}`);

    await expect(anonymousPage.getByRole('heading', { name: postTitle })).toBeVisible();
  } finally {
    await anonymousContext.close();
  }
});
