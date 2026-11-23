import { test, expect } from '@playwright/test';
import { mockBank } from './fixtures';

// the service worker only exists in a production build, served on 5182 (see playwright.config.ts)
test.use({ baseURL: 'http://localhost:5182' });

test('the app opens with no connection after one online visit, at any address', async ({ page, context }) => {
  await mockBank(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SAT Practice' })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'SAT Practice' })).toBeVisible();
  await page.goto('/index.html?x=1');
  await expect(page.getByRole('heading', { name: 'SAT Practice' })).toBeVisible();
  // the page and its two built files, nothing piling up
  expect(await page.evaluate(async () => (await (await caches.open('sat-shell')).keys()).length)).toBe(3);
});
