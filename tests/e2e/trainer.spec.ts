import { test, expect } from '@playwright/test';
import { mockBank } from './fixtures';

test.beforeEach(async ({ page }) => {
  await mockBank(page);
  page.on('dialog', d => d.accept());
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SAT Practice' })).toBeVisible();
});

test('a new student sees "not enough data" on the skill map', async ({ page }) => {
  await page.getByRole('button', { name: 'Open your skill map' }).click();
  await expect(page.getByRole('heading', { name: 'Your skill map' })).toBeVisible();
  await expect(page.getByText('Not enough data').first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('NaN');
});

test('Today runs with check-as-you-go and a clock that does not cut off, then a miss can be tagged', async ({ page }) => {
  await page.getByRole('button', { name: '10 min session' }).click();
  await expect(page.getByText('Question 1 of 7')).toBeVisible();
  await expect(page.getByText('Checking each answer as you go')).toBeVisible();
  for (let i = 0; i < 7; i++) {
    const grid = page.locator('#sprin');
    if (await grid.count()) await grid.fill('9');
    else await page.getByRole('radio', { name: /Option A/ }).click();     // A is always wrong in the fixtures
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.locator('.verdict')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
  }
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
  const first = page.getByRole('group', { name: 'Why did you miss this?' }).first();
  await first.getByRole('button', { name: 'Misread it' }).click();
  await expect(first.getByRole('button', { name: 'Misread it' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Why you missed: Misread it 1.')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Open your skill map' }).click();
  await expect(page.getByText(/Misread it 1/)).toBeVisible();
  await page.getByRole('button', { name: 'Back to menu' }).click();
  await expect(page.getByText(/This week: 1 Today session/)).toBeVisible();
});

test('a test date shows the days left', async ({ page }) => {
  const d = new Date(); d.setDate(d.getDate() + 30);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await page.getByLabel('Test date').fill(iso);
  await expect(page.getByText('30 days to go')).toBeVisible();
  await page.reload();
  await expect(page.getByText('30 days to go')).toBeVisible();
});

test('an official SAT date can be picked from the list', async ({ page }) => {
  const pick = page.getByLabel('Official SAT date');
  const first = await pick.locator('option').nth(1).getAttribute('value');
  await pick.selectOption(first!);
  await expect(page.getByLabel('Test date')).toHaveValue(first!);
  await expect(page.getByText(/days to go|Tomorrow|Today\. Good luck\./)).toBeVisible();
  await expect(page.getByText(/Register by|College Board has not confirmed|registration has closed/)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Official SAT date')).toHaveValue(first!);
});
