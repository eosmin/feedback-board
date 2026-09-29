import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { getLatestMagicLinkUrl } from './fixtures/mailpit';

/** Unique enough per test run without a random-generator dependency (TDD §13 step 19.6). */
export function uniqueSlug(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

/**
 * Drives the real magic-link flow through the browser (TDD §14, §12): submit the login form,
 * read the email Mailpit received, and follow it — GoTrue redirects to `/auth/callback?code=...`,
 * which exchanges the code and lands on `/dashboard` with a real session cookie set.
 */
export async function signInViaMagicLink(page: Page, email: string): Promise<void> {
  const mailpitUrl = process.env.SUPABASE_INBUCKET_URL ?? 'http://127.0.0.1:54324';

  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send magic link' }).click();
  await expect(page.getByRole('status')).toContainText(email);

  const signInUrl = await getLatestMagicLinkUrl(mailpitUrl, email);
  await page.goto(signInUrl);
  await page.waitForURL('**/dashboard');
}

export async function createOrg(page: Page, name: string, slug: string): Promise<void> {
  await page.getByLabel('Organization name').fill(name);
  await page.getByLabel('URL slug').fill(slug);
  await page.getByRole('button', { name: 'Create organization' }).click();
  await page.getByRole('link', { name: new RegExp(name) }).click();
  await page.waitForURL(`**/dashboard/${slug}`);
}

export async function createBoard(page: Page, name: string, slug: string): Promise<void> {
  await page.getByLabel('Board name').fill(name);
  await page.getByLabel('URL slug').fill(slug);
  await page.getByRole('button', { name: 'Create board' }).click();
  await page.getByRole('link', { name: new RegExp(name) }).click();
  await page.waitForURL(`**/boards/${slug}`);
}

export async function createPost(page: Page, title: string, body: string): Promise<void> {
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Description').fill(body);
  await page.getByRole('button', { name: 'Post feedback' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

/** Clicks the post's vote toggle and waits for the count to move from 0 to 1 (TDD §11). */
export async function voteOnPost(page: Page, postTitle: string): Promise<void> {
  const postItem = page.locator('li', { has: page.getByRole('heading', { name: postTitle }) });
  await postItem.getByRole('button', { name: /^Vote \(0\)$/ }).click();
  await expect(postItem.getByRole('button', { name: /^Vote \(1\)$/ })).toBeVisible();
}
