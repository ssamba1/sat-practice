import { test, expect } from '@playwright/test';
import { mockBank } from './fixtures';

test.beforeEach(async ({ page }) => {
  await mockBank(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SAT Practice' })).toBeVisible();
});

test('Important 1: starting something new asks before replacing a saved session', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await page.getByRole('button', { name: /^Math module/ }).click();
  await expect(page.getByText('Question 1 of 22')).toBeVisible();
  await page.getByRole('button', { name: /Save and exit/ }).click();
  await expect(page.getByRole('button', { name: /^Resume:/ })).toBeVisible();
  page.removeAllListeners('dialog');
  const seen: string[] = [];
  page.on('dialog', d => { seen.push(d.message()); d.dismiss(); });
  await page.getByRole('button', { name: /^Reading and Writing module/ }).click();
  await expect.poll(() => seen.some(m => m.includes('replaces your saved session'))).toBe(true);
  await expect(page.getByRole('button', { name: /^Resume:/ })).toBeVisible();
});

test('Important 6: a failed load mid-test can be left with Save and exit', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await page.getByRole('button', { name: /^Full-length test/ }).click();
  await expect(page.getByText('Question 1 of 27')).toBeVisible();
  await page.unroute('https://qbank-api.collegeboard.org/**');
  await page.route('https://qbank-api.collegeboard.org/**', r => r.fulfill({ status: 503 }));
  await page.getByRole('button', { name: /Question 1 of 27/ }).click();
  await page.getByRole('button', { name: 'Go to Review Page' }).click();
  await page.getByRole('button', { name: 'Submit module' }).click();
  await expect(page.getByText('Something went wrong')).toBeVisible({ timeout: 15000 });
  await page.getByRole('alertdialog').getByRole('button', { name: 'Save and exit' }).click();
  await expect(page.getByRole('button', { name: /^Resume: Full-length test/ })).toBeVisible();
});

test('the question navigator takes focus and closes with Escape, also from the review page', async ({ page }) => {
  await page.getByRole('button', { name: /^Math module/ }).click();
  await page.getByRole('button', { name: /Question 1 of 22/ }).click();
  await expect(page.getByRole('button', { name: 'Go to Review Page' })).toBeFocused();
  await page.getByRole('button', { name: 'Go to Review Page' }).click();
  await page.getByRole('button', { name: /^Questions/ }).click();
  await expect(page.getByRole('dialog', { name: 'Question navigator' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Question navigator' })).toHaveCount(0);
});

test('when a module runs out of time it is submitted, the student is told, and open panels close', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  page.on('dialog', d => d.accept());
  await page.getByRole('button', { name: /^Full-length test/ }).click();
  await expect(page.getByText('Question 1 of 27')).toBeVisible();
  await page.getByRole('button', { name: /Question 1 of 27/ }).click();
  await expect(page.getByRole('dialog', { name: 'Question navigator' })).toBeVisible();
  await page.clock.runFor('32:05');
  await expect(page.getByRole('status')).toContainText('Time is up');
  await expect(page.getByText(/Question 1 of \d+/)).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Question navigator' })).toHaveCount(0);
});
