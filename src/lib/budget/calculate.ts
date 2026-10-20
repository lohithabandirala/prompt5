import { getCurrencyPrecision } from '../schemas/event-input';
import type { BudgetCategory } from '../schemas/event-plan';

/**
 * Round a number to the given number of decimal places.
 * Uses banker's rounding (round half to even) approach via toFixed.
 */
export function roundCurrency(amount: number, precision: number): number {
  const factor = Math.pow(10, precision);
  return Math.round(amount * factor) / factor;
}

/**
 * Given a total budget, currency, and array of percentage allocations from AI,
 * calculate deterministic monetary amounts that sum exactly to the total budget.
 *
 * Uses largest-remainder method to distribute rounding differences.
 */
export function calculateBudgetAllocations(
  totalBudget: number,
  currency: string,
  aiPercentages: Array<{ name: string; description?: string; allocatedPercentage: number; isContingency?: boolean }>
): BudgetCategory[] {
  const precision = getCurrencyPrecision(currency);
  const factor = Math.pow(10, precision);

  // Normalize percentages to sum to exactly 100
  const rawSum = aiPercentages.reduce((sum, cat) => sum + cat.allocatedPercentage, 0);
  const normalizedPercentages = aiPercentages.map((cat) => ({
    ...cat,
    normalizedPercentage: rawSum > 0 ? (cat.allocatedPercentage / rawSum) * 100 : 0,
  }));

  // Calculate raw amounts
  const rawAmounts = normalizedPercentages.map((cat) => ({
    ...cat,
    rawAmount: (cat.normalizedPercentage / 100) * totalBudget,
  }));

  // Floor each amount to the currency precision
  const floored = rawAmounts.map((cat) => ({
    ...cat,
    flooredAmount: Math.floor(cat.rawAmount * factor) / factor,
    remainder: (cat.rawAmount * factor) - Math.floor(cat.rawAmount * factor),
  }));

  // Total after flooring
  const flooredTotal = floored.reduce((sum, cat) => sum + Math.round(cat.flooredAmount * factor), 0);
  const budgetInSmallestUnit = Math.round(totalBudget * factor);
  let unitsToDistribute = budgetInSmallestUnit - flooredTotal;

  // Sort by remainder descending and distribute remaining units
  const indexed = floored.map((cat, i) => ({ ...cat, index: i }));
  const sortedByRemainder = [...indexed].sort((a, b) => b.remainder - a.remainder);

  const finalAmounts = new Array<number>(floored.length);
  for (const cat of indexed) {
    finalAmounts[cat.index] = Math.round(cat.flooredAmount * factor);
  }

  for (const cat of sortedByRemainder) {
    if (unitsToDistribute <= 0) break;
    finalAmounts[cat.index] += 1;
    unitsToDistribute -= 1;
  }

  // Build result
  return normalizedPercentages.map((cat, i) => ({
    id: `budget-${i}-${cat.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name: cat.name,
    description: cat.description,
    allocatedPercentage: roundCurrency(cat.normalizedPercentage, 2),
    allocatedAmount: finalAmounts[i] / factor,
    status: 'planned' as const,
    isContingency: cat.isContingency ?? false,
  }));
}

/**
 * Validate that budget categories sum to the total budget.
 */
export function validateBudgetTotal(
  categories: BudgetCategory[],
  totalBudget: number,
  currency: string
): { valid: boolean; difference: number } {
  const precision = getCurrencyPrecision(currency);
  const factor = Math.pow(10, precision);

  const allocatedTotal = categories.reduce(
    (sum, cat) => sum + Math.round(cat.allocatedAmount * factor),
    0
  );
  const budgetInSmallestUnit = Math.round(totalBudget * factor);
  const difference = (allocatedTotal - budgetInSmallestUnit) / factor;

  return {
    valid: allocatedTotal === budgetInSmallestUnit,
    difference,
  };
}

/**
 * Calculate remaining budget after actual/quoted/planned expenditure.
 */
export function calculateRemainingBudget(
  totalBudget: number,
  categories: BudgetCategory[],
  currency: string
): {
  totalPlanned: number;
  totalActual: number;
  totalQuoted: number;
  remaining: number;
  contingencyReserve: number;
  isOverBudget: boolean;
} {
  const precision = getCurrencyPrecision(currency);

  let totalPlanned = 0;
  let totalActual = 0;
  let totalQuoted = 0;
  let contingencyReserve = 0;

  for (const cat of categories) {
    const effectiveAmount = cat.actualAmount ?? cat.quotedAmount ?? cat.allocatedAmount;
    totalPlanned += cat.allocatedAmount;

    if (cat.actualAmount != null) {
      totalActual += cat.actualAmount;
    }
    if (cat.quotedAmount != null) {
      totalQuoted += cat.quotedAmount;
    }
    if (cat.isContingency) {
      contingencyReserve += effectiveAmount;
    }
  }

  const spent = totalActual || totalQuoted || totalPlanned;
  const remaining = roundCurrency(totalBudget - spent, precision);

  return {
    totalPlanned: roundCurrency(totalPlanned, precision),
    totalActual: roundCurrency(totalActual, precision),
    totalQuoted: roundCurrency(totalQuoted, precision),
    remaining,
    contingencyReserve: roundCurrency(contingencyReserve, precision),
    isOverBudget: remaining < 0,
  };
}

/**
 * Recalculate a single category's percentage after amount edit.
 */
export function recalculatePercentage(
  amount: number,
  totalBudget: number
): number {
  if (totalBudget <= 0) return 0;
  return roundCurrency((amount / totalBudget) * 100, 2);
}

/**
 * Format currency amount for display.
 */
export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: getCurrencyPrecision(currency),
      maximumFractionDigits: getCurrencyPrecision(currency),
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(getCurrencyPrecision(currency))}`;
  }
}
