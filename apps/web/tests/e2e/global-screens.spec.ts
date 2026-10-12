import { expect, test } from '@playwright/test';

/** No session needed: both screens are reachable by an anonymous visitor. */
test('an unknown route shows the global not-found screen with theme and language controls', async ({
  page,
}) => {
  const response = await page.goto('/this-route-does-not-exist');

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Language' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Switch to (dark|light) theme/ })).toBeVisible();
});

test('a failed magic-link callback returns to login with an explanation', async ({ page }) => {
  await page.goto('/auth/callback');

  await expect(page).toHaveURL(/\/login\?error=callback_failed/);
  await expect(page.getByRole('alert').filter({ hasText: "Sign-in link didn't work" })).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
});
