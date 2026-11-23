import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { mockBank } from './fixtures';

test.beforeEach(async ({ page }) => {
  await mockBank(page);
  page.on('dialog', d => d.accept());
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SAT Practice' })).toBeVisible();
});

const noHScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

const submitStage = async (page: Page, label: RegExp, button: string) => {
  await page.getByRole('button', { name: label }).click();
  await page.getByRole('button', { name: 'Go to Review Page' }).click();
  await page.getByRole('button', { name: button }).click();
};

test('math module by keyboard, grid-in, mark, review, submit, results', async ({ page }) => {
  await page.getByRole('button', { name: /^Math module/ }).click();
  await expect(page.getByText('Question 1 of 22')).toBeVisible();
  await noHScroll(page);
  await page.locator('body').press('b');
  await page.locator('body').press('m');
  await expect(page.getByRole('button', { name: /Mark for Review/ })).toHaveAttribute('aria-pressed', 'true');
  for (let i = 0; i < 21; i++) await page.locator('body').press('ArrowRight');
  await expect(page.getByText('Question 22 of 22')).toBeVisible();
  await page.locator('#sprin').fill('1/2');
  await expect(page.getByText('Answer preview: 1/2')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Check your work' })).toBeVisible();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
  await expect(page.getByText('2 / 22')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Drill these 20 again' })).toBeVisible();
  await noHScroll(page);
});

test('full test routes Module 2, breaks, and resumes after reload', async ({ page }) => {
  await page.getByRole('button', { name: /^Full-length test/ }).click();
  await expect(page.getByText('Question 1 of 27')).toBeVisible();
  await submitStage(page, /Question 1 of 27/, 'Submit module');
  await expect(page.getByText(/Easier Module 2/)).toBeVisible();
  await page.locator('body').press('d');
  await page.reload();
  await page.getByRole('button', { name: /Resume: Full-length test/ }).click();
  await expect(page.getByText(/Easier Module 2/)).toBeVisible();
  await expect(page.getByRole('radio', { name: /Option D/ })).toHaveAttribute('aria-checked', 'true');
  await submitStage(page, /Question 1 of 27/, 'Submit module');
  await expect(page.getByRole('heading', { name: 'Break' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume testing' }).click();
  await expect(page.getByText('Question 1 of 22')).toBeVisible();
});

test('custom drill with check-as-you-go locks the answer and shows the explanation', async ({ page }) => {
  await page.getByRole('button', { name: 'Reading and Writing', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Questions' }).fill('3');
  await page.getByLabel(/Check each answer as I go \(shows/).check();
  await page.getByRole('button', { name: 'Start drill' }).click();
  await page.getByRole('radio', { name: /Option A/ }).click();
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText('Not quite. Correct answer: B')).toBeVisible();
  await expect(page.getByRole('radio', { name: /Option A/ })).toBeDisabled();
});

test('mistakes, vocab and a backup round trip', async ({ page }) => {
  await page.getByRole('button', { name: /^Math module/ }).click();
  await expect(page.getByText('Question 1 of 22')).toBeVisible();
  await submitStage(page, /Question 1 of 22/, 'Finish');
  await page.getByRole('button', { name: 'Back to menu' }).click();
  await expect(page.getByText(/22 in total/)).toBeVisible();

  await page.getByRole('button', { name: /^Vocabulary/ }).click();
  await expect(page.getByText(/What does this word mean|Which word means this/)).toBeVisible();
  await page.locator('.vopt').first().click();
  await expect(page.locator('.vfeed')).toBeVisible();
  await page.getByRole('button', { name: 'Exit' }).click();

  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const path = await (await dl).path();
  const buffer = readFileSync(path!);   // bytes, not the path: Edge can still hold a lock on its fresh download
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByText(/Questions you miss land here/)).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer });
  await expect(page.getByText(/22 in total/)).toBeVisible();
});

test('first visit with College Board down offers the bundle fallback', async ({ page }) => {
  await page.evaluate(() => new Promise(r => { const q = indexedDB.deleteDatabase('sat-remake'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }));
  await page.unroute('https://qbank-api.collegeboard.org/**');
  await page.route('https://qbank-api.collegeboard.org/**', r => r.fulfill({ status: 503 }));
  await page.reload();
  await expect(page.getByText(/did not respond/)).toBeVisible({ timeout: 20000 });
  await expect(page.getByLabel('Load a question bundle')).toBeVisible();
});
