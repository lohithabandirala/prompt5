import { getCurrencyPrecision } from '../schemas/event-input';
import type { BudgetCategory } from '../schemas/event-plan';

/**
 * Round a number to the given number of precision digits.
 * All budget maths is performed on integer minor units to avoid float drift.
 */
export function roundCurrency(amount: number, precision: number): number {
  const factor = Math.pow(10, precision);
  return Math.round(amount * factor) / factor;
}

function toMinorUnits(amount: number, precision: number): number {
  return Math.round(amount * Math.pow(10, precision));
}

function fromMinorUnits(units: number, precision: number): number {
  return units / Math.pow(10, precision);
}

/**
 * Recompute every category percentage from its monetary amount so that the
 * displayed percentages sum to exactly 100 (largest-remainder method on
 * percentage hundredths). Amounts remain the source of truth.
 */
export function recalculateAllPercentages(
  categories: BudgetCategory[],
  totalBudget: number
): BudgetCategory[] {
  if (categories.length === 0) return [];
  if (totalBudget <= 0) {
    return categories.map((cat) => ({ ...cat, allocatedPercentage: 0 }));
  }

  const raw = categories.map((cat) => (cat.allocatedAmount / totalBudget) * 100);
  const floored = raw.map((pct) => Math.floor(pct * 100));
  const targetUnits = 10000;
  let remainder = targetUnits - floored.reduce((sum, pct) => sum + pct, 0);

  const order = raw
    .map((pct, index) => ({ index, fraction: pct * 100 - Math.floor(pct * 100) }))
    .sort((a, b) => b.fraction - a.fraction);

  const finalUnits = [...floored];
  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    finalUnits[order[cursor % order.length].index] += 1;
    remainder -= 1;
    cursor += 1;
  }

  return categories.map((cat, index) => ({
    ...cat,
    allocatedPercentage: finalUnits[index] / 100,
  }));
}

/**
 * Given a total budget, currency, and percentage allocations from the model,
 * calculate deterministic monetary amounts that sum exactly to the total budget.
 *
 * Uses the largest-remainder method to distribute rounding differences.
 */
export function calculateBudgetAllocations(
  totalBudget: number,
  currency: string,
  aiPercentages: Array<{
    name: string;
    description?: string;
    allocatedPercentage: number;
    isContingency?: boolean;
  }>
): BudgetCategory[] {
  if (!Number.isFinite(totalBudget) || totalBudget <= 0 || aiPercentages.length === 0) {
    return [];
  }

  const precision = getCurrencyPrecision(currency);
  const factor = Math.pow(10, precision);

  // Normalize percentages to sum to exactly 100. Percentages outside the
  // supported range are clamped first so a malicious model cannot create
  // negative or runaway allocations.
  const safePercentages = aiPercentages.map((cat) => ({
    ...cat,
    allocatedPercentage: Math.min(100, Math.max(0, cat.allocatedPercentage)),
  }));
  const rawSum = safePercentages.reduce((sum, cat) => sum + cat.allocatedPercentage, 0);

  const normalizedPercentages = safePercentages.map((cat, index) => ({
    ...cat,
    index,
    normalizedPercentage: rawSum > 0 ? (cat.allocatedPercentage / rawSum) * 100 : 100 / safePercentages.length,
  }));

  const rawAmounts = normalizedPercentages.map((cat) => ({
    ...cat,
    rawAmount: (cat.normalizedPercentage / 100) * totalBudget,
  }));

  const floored = rawAmounts.map((cat) => ({
    ...cat,
    flooredUnits: Math.floor(cat.rawAmount * factor),
    remainder: cat.rawAmount * factor - Math.floor(cat.rawAmount * factor),
  }));

  const flooredTotal = floored.reduce((sum, cat) => sum + cat.flooredUnits, 0);
  const budgetUnits = Math.round(totalBudget * factor);
  let unitsToDistribute = budgetUnits - flooredTotal;

  const finalUnits = floored.map((cat) => cat.flooredUnits);
  const sortedByRemainder = [...floored].sort((a, b) => b.remainder - a.remainder);

  for (const cat of sortedByRemainder) {
    if (unitsToDistribute <= 0) break;
    finalUnits[cat.index] += 1;
    unitsToDistribute -= 1;
  }

  // If more minor units remain than there are categories (very small totals
  // or heavily rounded percentages), keep cycling until the budget balances.
  let cursor = 0;
  while (unitsToDistribute > 0 && sortedByRemainder.length > 0) {
    finalUnits[sortedByRemainder[cursor % sortedByRemainder.length].index] += 1;
    unitsToDistribute -= 1;
    cursor += 1;
  }

  const categories: BudgetCategory[] = normalizedPercentages.map((cat, index) => ({
    id: `budget-${index}-${cat.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40)}`,
    name: cat.name,
    description: cat.description,
    allocatedPercentage: 0,
    allocatedAmount: fromMinorUnits(finalUnits[index], precision),
    status: 'planned' as const,
    isContingency: cat.isContingency ?? false,
  }));

  return recalculateAllPercentages(categories, totalBudget);
}

/**
 * Validate that budget categories sum to the total budget.
 */
export function validateBudgetTotal(
  categories: BudgetCategory[],
  totalBudget: number,
  currency: string
): { valid: boolean; difference: number; allocatedTotal: number } {
  const precision = getCurrencyPrecision(currency);

  const allocatedUnits = categories.reduce(
    (sum, cat) => sum + toMinorUnits(cat.allocatedAmount, precision),
    0
  );
  const budgetUnits = toMinorUnits(totalBudget, precision);
  const difference = fromMinorUnits(allocatedUnits - budgetUnits, precision);

  return {
    valid: allocatedUnits === budgetUnits,
    difference,
    allocatedTotal: fromMinorUnits(allocatedUnits, precision),
  };
}

/**
 * Adjust category amounts so their sum matches the total budget exactly.
 *
 * When `protectedId` is supplied (normally the category the user just edited),
 * that category keeps its amount and every other category absorbs the
 * difference. Reductions target the contingency reserve first, then the
 * largest categories. The protected category is only reduced as a last resort
 * when the user has allocated more than the whole budget.
 */
export function reconcileBudgetCategories(
  categories: BudgetCategory[],
  totalBudget: number,
  currency: string,
  protectedId?: string
): BudgetCategory[] {
  if (categories.length === 0) return [];

  const precision = getCurrencyPrecision(currency);
  const factor = Math.pow(10, precision);
  const budgetUnits = Math.round(totalBudget * factor);
  const currentUnits = categories.map((cat) => Math.round(cat.allocatedAmount * factor));
  let difference = budgetUnits - currentUnits.reduce((sum, units) => sum + units, 0);

  if (difference !== 0) {
    const protectedIndex = protectedId
      ? categories.findIndex((cat) => cat.id === protectedId)
      : -1;
    const isProtected = (index: number) => index === protectedIndex;

    if (difference > 0) {
      // Adding budget: prefer the contingency reserve, then the largest
      // category that the user is not currently editing.
      let targetIndex = categories.findIndex(
        (cat, index) => cat.isContingency && !isProtected(index)
      );

      if (targetIndex < 0) {
        targetIndex = currentUnits.reduce(
          (best, units, index) =>
            !isProtected(index) && (best < 0 || units > currentUnits[best]) ? index : best,
          -1
        );
      }

      if (targetIndex < 0) {
        targetIndex = protectedIndex >= 0 ? protectedIndex : 0;
      }

      currentUnits[targetIndex] += difference;
      difference = 0;
    } else {
      const reductionOrder: number[] = [];
      const contingencyIndex = categories.findIndex(
        (cat, index) => cat.isContingency && !isProtected(index)
      );

      if (contingencyIndex >= 0) reductionOrder.push(contingencyIndex);

      currentUnits
        .map((units, index) => ({ units, index }))
        .filter((entry) => !isProtected(entry.index) && entry.index !== contingencyIndex)
        .sort((a, b) => b.units - a.units)
        .forEach((entry) => reductionOrder.push(entry.index));

      if (protectedIndex >= 0) reductionOrder.push(protectedIndex);

      for (const index of reductionOrder) {
        if (difference >= 0) break;
        const absorb = Math.min(currentUnits[index], -difference);
        currentUnits[index] -= absorb;
        difference += absorb;
      }
    }
  }

  const reconciled = categories.map((cat, index) => ({
    ...cat,
    allocatedAmount: fromMinorUnits(currentUnits[index], precision),
  }));

  return recalculateAllPercentages(reconciled, totalBudget);
}

/**
 * Calculate planned, quoted, actual and effective spend.
 *
 * Effective spend per category is: actual (if entered) -> quoted (if entered)
 * -> planned allocation. This prevents a single actual entry from hiding the
 * planned spend of every other category.
 */
export function calculateRemainingBudget(
  totalBudget: number,
  categories: BudgetCategory[],
  currency: string
): {
  totalPlanned: number;
  totalActual: number;
  totalQuoted: number;
  totalEffective: number;
  remaining: number;
  contingencyReserve: number;
  isOverBudget: boolean;
} {
  const precision = getCurrencyPrecision(currency);

  let plannedUnits = 0;
  let actualUnits = 0;
  let quotedUnits = 0;
  let effectiveUnits = 0;
  let contingencyUnits = 0;

  for (const cat of categories) {
    const planned = Math.round(cat.allocatedAmount * Math.pow(10, precision));
    plannedUnits += planned;

    if (typeof cat.actualAmount === 'number') {
      actualUnits += Math.round(cat.actualAmount * Math.pow(10, precision));
    }
    if (typeof cat.quotedAmount === 'number') {
      quotedUnits += Math.round(cat.quotedAmount * Math.pow(10, precision));
    }

    const effective = cat.actualAmount ?? cat.quotedAmount ?? cat.allocatedAmount;
    effectiveUnits += Math.round(effective * Math.pow(10, precision));

    if (cat.isContingency) {
      contingencyUnits += Math.round(effective * Math.pow(10, precision));
    }
  }

  const budgetUnits = Math.round(totalBudget * Math.pow(10, precision));
  const remaining = fromMinorUnits(budgetUnits - effectiveUnits, precision);

  return {
    totalPlanned: fromMinorUnits(plannedUnits, precision),
    totalActual: fromMinorUnits(actualUnits, precision),
    totalQuoted: fromMinorUnits(quotedUnits, precision),
    totalEffective: fromMinorUnits(effectiveUnits, precision),
    remaining,
    contingencyReserve: fromMinorUnits(contingencyUnits, precision),
    isOverBudget: remaining < 0,
  };
}

/**
 * Recalculate a single category's percentage after an amount edit.
 */
export function recalculatePercentage(amount: number, totalBudget: number): number {
  if (!Number.isFinite(amount) || totalBudget <= 0) return 0;
  return roundCurrency((amount / totalBudget) * 100, 2);
}

/**
 * Variance between what was allocated and what is actually committed.
 * Positive means the category is under its allocation.
 */
export function calculateVariance(category: BudgetCategory, currency: string): number {
  const precision = getCurrencyPrecision(currency);
  const committed =
    category.actualAmount ?? category.quotedAmount ?? category.allocatedAmount;
  const units =
    Math.round(category.allocatedAmount * Math.pow(10, precision)) -
    Math.round(committed * Math.pow(10, precision));
  return units / Math.pow(10, precision);
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
