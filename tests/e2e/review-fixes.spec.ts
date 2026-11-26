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

test('closing a panel puts focus back on the button that opened it', async ({ page }) => {
  await page.getByRole('button', { name: /^Math module/ }).click();
  const pick = page.getByRole('button', { name: /Question 1 of 22/ });
  await pick.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Question navigator' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(pick).toBeFocused();
  const ref = page.getByRole('button', { name: 'Reference' });
  await ref.click();
  await page.getByRole('dialog', { name: 'Reference sheet' }).getByRole('button', { name: 'Close' }).click();
  await expect(ref).toBeFocused();
});

test('Tab stays inside an open panel', async ({ page }) => {
  await page.getByRole('button', { name: /^Math module/ }).click();
  await page.getByRole('button', { name: /Question 1 of 22/ }).click();
  const nav = page.getByRole('dialog', { name: 'Question navigator' });
  const last = nav.getByRole('button', { name: 'Go to Review Page' });
  await expect(last).toBeFocused();
  await page.keyboard.press('Tab');       // past the last button wraps to the first
  await expect(nav.getByRole('button', { name: 'Question 1', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(last).toBeFocused();
});

test('a saved session with a question College Board removed is kept, not deleted', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await page.getByRole('button', { name: /^Math module/ }).click();
  await expect(page.getByText('Question 1 of 22')).toBeVisible();
  await page.getByRole('button', { name: /Save and exit/ }).click();
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('sat-remake.session')!);
    s.stages.find((x: any) => x.qs).qs[0] = 'gone';
    localStorage.setItem('sat-remake.session', JSON.stringify(s));
  });
  await page.getByRole('button', { name: /^Resume:/ }).click();
  await expect(page.getByText(/no longer in College Board's question bank/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Resume:/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('sat-remake.session'))).not.toBeNull();
});
