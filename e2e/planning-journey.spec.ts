import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

function calendarDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('[data-app-ready="true"]').waitFor();
}

async function createEvent(
  page: Page,
  options: { location?: string; budget?: number; guests?: number } = {}
): Promise<void> {
  const { location = 'Mumbai', budget = 5000, guests = 50 } = options;

  await openApp(page);
  await page.getByRole('button', { name: /Create your first event/i }).click();
  await page.getByRole('button', { name: /Wedding/i }).click();
  await page.getByRole('button', { name: /Continue/i }).click();

  await page.locator('#eventDate').fill(calendarDate(120));
  await page.locator('#location').fill(location);
  await page.locator('#totalBudget').fill(String(budget));
  await page.locator('#guestCount').fill(String(guests));

  await page.getByRole('button', { name: /Continue/i }).click();
  await page.getByRole('button', { name: /Generate My Plan/i }).click();
}

test.describe('Festiva AI journey', () => {
  test('generates, edits, persists and exports a real plan', async ({ page }) => {
    await createEvent(page);

    await expect(page.getByText('Current plan')).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole('heading', { name: 'A Garden Romance Wedding' }).first()
    ).toBeVisible();
    await expect(page.getByText(/not quotations/i)).toBeVisible();

    // Budget tab: exact allocation of the entered total.
    await page.getByRole('tab', { name: /Budget/ }).click();
    await expect(page.getByText('Total Budget', { exact: true })).toBeVisible();
    await expect(page.getByText('$5,000.00').first()).toBeVisible();
    await expect(page.getByText('Balances to the total budget')).toBeVisible();

    // Save an idea, then regenerate the ideas section and confirm the saved
    // flag survives the merge.
    await page.getByRole('tab', { name: /Ideas/ }).click();
    await page.getByRole('button', { name: 'Save Herb favours' }).click();
    await expect(page.getByRole('button', { name: /Saved \(1\)/i })).toBeVisible();

    await page.getByRole('button', { name: /Regenerate celebration ideas/i }).click();
    await expect(page.getByRole('button', { name: /Saved \(1\)/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole('paragraph').filter({ hasText: /Your edits in other sections were preserved/i })
    ).toBeVisible();

    // A real CSV download with the expected content.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Budget CSV/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/-budget\.csv$/);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const csv = readFileSync(downloadPath as string, 'utf8');
    expect(csv).toContain('Category,Allocation %');
    expect(csv).toContain('TOTAL');

    // Persist through a full page reload.
    await page.getByRole('button', { name: /My events/i }).click();
    await expect(page.getByRole('heading', { name: 'A Garden Romance Wedding' })).toBeVisible();

    await page.reload();
    await page.locator('[data-app-ready="true"]').waitFor();
    await expect(page.getByRole('heading', { name: 'A Garden Romance Wedding' })).toBeVisible();
    await page.getByRole('button', { name: /Open plan/i }).click();
    await expect(page.getByText('Current plan')).toBeVisible();
    await page.getByRole('tab', { name: /Ideas/ }).click();
    await expect(page.getByRole('button', { name: /Saved \(1\)/i })).toBeVisible();

    // Destructive actions go through the accessible confirmation dialog.
    await page.getByRole('button', { name: /Settings and privacy/i }).click();
    await expect(page.getByRole('heading', { name: /Settings/i })).toBeVisible();
    await page.getByRole('button', { name: /Delete all saved plans/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Delete everything' }).click();
    await expect(page.getByText(/Plan your next celebration/i)).toBeVisible();
  });

  test('shows a transparent error when the provider fails and saves nothing', async ({ page }) => {
    await createEvent(page, { location: 'SIMULATE_PROVIDER_FAILURE' });

    await expect(page.getByText(/temporarily unavailable/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Current plan')).not.toBeVisible();

    await page.getByRole('button', { name: /My events/i }).click();
    await expect(page.getByText(/Plan your next celebration/i)).toBeVisible();
  });

  test('rejects invalid model output instead of rendering it', async ({ page }) => {
    await createEvent(page, { location: 'SIMULATE_INVALID_OUTPUT' });

    await expect(page.getByText(/did not match the required plan format/i)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('Current plan')).not.toBeVisible();
  });

  test('blocks a past event date before contacting the provider', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: /Create your first event/i }).click();
    await page.getByRole('button', { name: /Wedding/i }).click();
    await page.getByRole('button', { name: /Continue/i }).click();

    await page.locator('#eventDate').fill('2020-01-01');
    await page.locator('#location').fill('Mumbai');
    await page.locator('#totalBudget').fill('5000');
    await page.locator('#guestCount').fill('50');
    await page.getByRole('button', { name: /Continue/i }).click();

    await expect(page.getByText(/Choose today or a future date/i)).toBeVisible();
    await expect(page.getByText('Current plan')).not.toBeVisible();
  });
});
