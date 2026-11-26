import { test, expect } from '@playwright/test';
import { mockBank } from './fixtures';

// College Board deadlines end at 11:59 p.m. ET, wherever the student is
test.use({ timezoneId: 'Asia/Tokyo' });

test('a student in Tokyo sees regular registration open until it closes in ET', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-20T20:00:00Z') });   // Nov 21 in Tokyo, Nov 20 3 p.m. in ET
  await mockBank(page);
  await page.goto('/');
  await page.getByLabel('Official SAT date').selectOption('2026-12-05');
  await expect(page.getByText(/^Register by .*11:59 p\.m\. ET/)).toBeVisible();
});
