import type { EventPlan } from '../schemas/event-plan';
import { getCurrencyPrecision } from '../schemas/event-input';

/**
 * Escape a value for RFC 4180 CSV.
 *
 * Text cells that begin with a formula trigger (=, +, -, @, tab, carriage
 * return) are prefixed with an apostrophe to neutralise spreadsheet formula
 * injection when a user opens the file in Excel/Sheets.
 */
export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }

  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  if (/[",\r\n]/.test(text) || /^\s|\s$/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatAmount(amount: number | undefined, precision: number): string {
  if (amount === undefined || amount === null) return '';
  return amount.toFixed(precision);
}

/**
 * Build a budget CSV from a plan. Amounts are emitted as plain numbers in the
 * event currency (no symbols) so they remain machine-readable.
 */
export function budgetToCsv(plan: EventPlan, currency: string, includeBom = true): string {
  const precision = getCurrencyPrecision(currency);
  const rows: string[][] = [
    [
      'Category',
      'Allocation %',
      'Planned Amount',
      'Quoted Amount',
      'Actual Amount',
      'Status',
      'Contingency',
      'Notes',
    ],
  ];

  for (const category of plan.budgetCategories) {
    rows.push([
      category.name,
      category.allocatedPercentage.toFixed(2),
      formatAmount(category.allocatedAmount, precision),
      formatAmount(category.quotedAmount, precision),
      formatAmount(category.actualAmount, precision),
      category.status,
      category.isContingency ? 'yes' : 'no',
      category.notes ?? '',
    ]);
  }

  const totals = plan.budgetCategories.reduce(
    (sum, category) => {
      sum.planned += category.allocatedAmount;
      sum.quoted += category.quotedAmount ?? 0;
      sum.actual += category.actualAmount ?? 0;
      return sum;
    },
    { planned: 0, quoted: 0, actual: 0 }
  );

  rows.push([
    'TOTAL',
    plan.budgetCategories
      .reduce((sum, category) => sum + category.allocatedPercentage, 0)
      .toFixed(2),
    totals.planned.toFixed(precision),
    totals.quoted.toFixed(precision),
    totals.actual.toFixed(precision),
    '',
    '',
    'Illustrative planning estimates, not verified vendor prices.',
  ]);

  const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  return includeBom ? `\uFEFF${csv}` : csv;
}
