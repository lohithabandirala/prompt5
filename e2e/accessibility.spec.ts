import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// Six full-page axe scans plus a cold dev-server compile can exceed the default.
test.setTimeout(180_000);

function calendarDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function analyze(page: Page) {
  return new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
}

async function expectNoViolations(page: Page, label: string) {
  const results = await analyze(page);
  if (results.violations.length > 0) {
    console.log(
      `AXE ${label}: ` +
        results.violations
          .map(
            (violation) =>
              `${violation.id}(${violation.impact}) ` +
              violation.nodes
                .map((node) => `${node.target.join(' ')} :: ${node.html}`)
                .join(' || ')
          )
          .join('\n')
    );
  }
  expect(results.violations).toEqual([]);
}

test('key views have no automated WCAG A/AA violations', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-app-ready="true"]').waitFor();
  await page.addStyleTag({
    content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
  });

  await expectNoViolations(page, 'view');

  await page.getByRole('button', { name: /Create your first event/i }).click();
  await expectNoViolations(page, 'view');

  await page.getByRole('button', { name: /Wedding/i }).click();
  await page.getByRole('button', { name: /Continue/i }).click();
  await expectNoViolations(page, 'view');

  await page.locator('#eventDate').fill(calendarDate(120));
  await page.locator('#location').fill('Mumbai');
  await page.locator('#totalBudget').fill('5000');
  await page.locator('#guestCount').fill('50');
  await page.getByRole('button', { name: /Continue/i }).click();
  await page.getByRole('button', { name: /Generate My Plan/i }).click();
  await expect(page.getByText('Current plan')).toBeVisible({ timeout: 30_000 });

  await expectNoViolations(page, 'view');

  await page.getByRole('tab', { name: /Budget/ }).click();
  await expectNoViolations(page, 'view');

  await page.getByRole('button', { name: /Settings and privacy/i }).click();
  await page.getByRole('button', { name: /Delete all saved plans/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoViolations(page, 'view');
});
