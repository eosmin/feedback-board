import { test } from '@playwright/test';

import { createBoard, createOrg, createPost, signInViaMagicLink, uniqueSlug, voteOnPost } from './helpers';

/**
 * Golden path A (TDD §14, §14.1, Step 19.6): sign in → create org → create board → create post →
 * vote. Runs against the local Supabase stack's real Mailpit mailbox (TDD §14, D8) — there is no
 * password flow to shortcut through, so this drives the real magic-link email a user would click.
 */
test('sign in, create org, create board, create post, vote', async ({ page }) => {
  const email = `e2e-golden-path-${Date.now()}@example.com`;
  const orgName = `Golden Org ${Date.now()}`;
  const orgSlug = uniqueSlug('golden-org');
  const boardName = `Golden Board ${Date.now()}`;
  const boardSlug = uniqueSlug('golden-board');
  const postTitle = `Golden post ${Date.now()}`;

  await signInViaMagicLink(page, email);
  await createOrg(page, orgName, orgSlug);
  await createBoard(page, boardName, boardSlug);
  await createPost(page, postTitle, 'A feature request written by the Playwright golden path.');
  await voteOnPost(page, postTitle);
});
