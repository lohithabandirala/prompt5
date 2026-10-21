import {
  calculateBudgetAllocations,
  calculateRemainingBudget,
  calculateVariance,
  formatCurrency,
  recalculateAllPercentages,
  recalculatePercentage,
  reconcileBudgetCategories,
  validateBudgetTotal,
} from '@/lib/budget/calculate';
import type { BudgetCategory } from '@/lib/schemas/event-plan';

function category(overrides: Partial<BudgetCategory> = {}): BudgetCategory {
  return {
    id: 'cat-1',
    name: 'Venue',
    allocatedPercentage: 100,
    allocatedAmount: 100,
    status: 'planned',
    isContingency: false,
    ...overrides,
  };
}

describe('calculateBudgetAllocations', () => {
  it('sums exactly to the total budget for awkward percentages', () => {
    const categories = calculateBudgetAllocations(1000, 'USD', [
      { name: 'Venue', allocatedPercentage: 33.33 },
      { name: 'Catering', allocatedPercentage: 33.33 },
      { name: 'Decor', allocatedPercentage: 33.34 },
    ]);

    const check = validateBudgetTotal(categories, 1000, 'USD');
    expect(check.valid).toBe(true);
    expect(check.difference).toBe(0);
    expect(categories.reduce((sum, item) => sum + item.allocatedAmount, 0)).toBeCloseTo(1000, 2);
  });

  it('handles a very small total without losing minor units', () => {
    const categories = calculateBudgetAllocations(0.05, 'USD', [
      { name: 'A', allocatedPercentage: 30 },
      { name: 'B', allocatedPercentage: 30 },
      { name: 'C', allocatedPercentage: 40 },
    ]);

    expect(validateBudgetTotal(categories, 0.05, 'USD').valid).toBe(true);
    expect(categories.reduce((sum, item) => sum + item.allocatedAmount, 0)).toBeCloseTo(0.05, 2);
  });

  it('uses zero decimal places for JPY', () => {
    const categories = calculateBudgetAllocations(100_001, 'JPY', [
      { name: 'Venue', allocatedPercentage: 40 },
      { name: 'Food', allocatedPercentage: 60 },
    ]);

    for (const item of categories) {
      expect(Number.isInteger(item.allocatedAmount)).toBe(true);
    }
    expect(validateBudgetTotal(categories, 100_001, 'JPY').valid).toBe(true);
  });

  it('normalises percentages that do not sum to 100', () => {
    const categories = calculateBudgetAllocations(900, 'USD', [
      { name: 'Venue', allocatedPercentage: 30 },
      { name: 'Food', allocatedPercentage: 30 },
      { name: 'Contingency', allocatedPercentage: 10, isContingency: true },
    ]);

    expect(validateBudgetTotal(categories, 900, 'USD').valid).toBe(true);
    expect(categories.reduce((sum, item) => sum + item.allocatedPercentage, 0)).toBeCloseTo(100, 2);
  });

  it('clamps malicious percentages and still produces a balanced budget', () => {
    const categories = calculateBudgetAllocations(500, 'EUR', [
      { name: 'Venue', allocatedPercentage: -50 },
      { name: 'Food', allocatedPercentage: 500 },
    ]);

    expect(categories.every((item) => item.allocatedAmount >= 0)).toBe(true);
    expect(validateBudgetTotal(categories, 500, 'EUR').valid).toBe(true);
  });

  it('returns an empty array for a non-positive or non-finite budget', () => {
    expect(calculateBudgetAllocations(0, 'USD', [{ name: 'A', allocatedPercentage: 100 }])).toEqual([]);
    expect(calculateBudgetAllocations(Number.NaN, 'USD', [{ name: 'A', allocatedPercentage: 100 }])).toEqual(
      []
    );
    expect(calculateBudgetAllocations(100, 'USD', [])).toEqual([]);
  });
});

describe('recalculateAllPercentages', () => {
  it('produces percentages that sum to exactly 100', () => {
    const categories = [
      category({ id: 'a', allocatedAmount: 33.33, name: 'A' }),
      category({ id: 'b', allocatedAmount: 33.33, name: 'B' }),
      category({ id: 'c', allocatedAmount: 33.34, name: 'C' }),
    ];

    const result = recalculateAllPercentages(categories, 100);
    expect(result.reduce((sum, item) => sum + item.allocatedPercentage, 0)).toBeCloseTo(100, 2);
  });

  it('sets percentages to zero when the budget is zero', () => {
    const result = recalculateAllPercentages([category({ allocatedAmount: 10 })], 0);
    expect(result[0].allocatedPercentage).toBe(0);
  });
});

describe('reconcileBudgetCategories', () => {
  it('adds an unallocated remainder to the contingency category', () => {
    const categories = [
      category({ id: 'venue', name: 'Venue', allocatedAmount: 600, allocatedPercentage: 60 }),
      category({ id: 'food', name: 'Food', allocatedAmount: 300, allocatedPercentage: 30 }),
      category({
        id: 'buffer',
        name: 'Contingency',
        allocatedAmount: 0,
        allocatedPercentage: 0,
        isContingency: true,
      }),
    ];

    const result = reconcileBudgetCategories(categories, 1000, 'USD');
    expect(result.find((item) => item.id === 'buffer')?.allocatedAmount).toBe(100);
    expect(validateBudgetTotal(result, 1000, 'USD').valid).toBe(true);
  });

  it('reduces the contingency first and then other categories largest-first', () => {
    const categories = [
      category({ id: 'big', name: 'Big', allocatedAmount: 700 }),
      category({ id: 'small', name: 'Small', allocatedAmount: 250 }),
      category({ id: 'buffer', name: 'Contingency', allocatedAmount: 50, isContingency: true }),
    ];

    const result = reconcileBudgetCategories(categories, 800, 'USD');
    expect(result.find((item) => item.id === 'buffer')?.allocatedAmount).toBe(0);
    expect(result.find((item) => item.id === 'big')?.allocatedAmount).toBe(550);
    expect(result.find((item) => item.id === 'small')?.allocatedAmount).toBe(250);
    expect(validateBudgetTotal(result, 800, 'USD').valid).toBe(true);
  });

  it('never drives a category below zero', () => {
    const categories = [
      category({ id: 'a', allocatedAmount: 10 }),
      category({ id: 'b', allocatedAmount: 10 }),
    ];

    const result = reconcileBudgetCategories(categories, 5, 'USD');
    expect(result.every((item) => item.allocatedAmount >= 0)).toBe(true);
    expect(validateBudgetTotal(result, 5, 'USD').valid).toBe(true);
  });

  it('keeps the category the user just edited and adjusts the others', () => {
    const categories = [
      category({ id: 'a', name: 'Venue', allocatedAmount: 600 }),
      category({ id: 'b', name: 'Catering', allocatedAmount: 500 }),
    ];

    const result = reconcileBudgetCategories(categories, 1000, 'USD', 'a');
    expect(result.find((item) => item.id === 'a')?.allocatedAmount).toBe(600);
    expect(result.find((item) => item.id === 'b')?.allocatedAmount).toBe(400);
    expect(validateBudgetTotal(result, 1000, 'USD').valid).toBe(true);
  });

  it('clamps an edited category that exceeds the whole budget', () => {
    const categories = [
      category({ id: 'a', name: 'Venue', allocatedAmount: 1200 }),
      category({ id: 'b', name: 'Catering', allocatedAmount: 500 }),
    ];

    const result = reconcileBudgetCategories(categories, 1000, 'USD', 'a');
    expect(result.find((item) => item.id === 'a')?.allocatedAmount).toBe(1000);
    expect(result.find((item) => item.id === 'b')?.allocatedAmount).toBe(0);
    expect(validateBudgetTotal(result, 1000, 'USD').valid).toBe(true);
  });
});

describe('calculateRemainingBudget', () => {
  it('uses actual, then quoted, then planned per category', () => {
    const categories = [
      category({ id: 'a', allocatedAmount: 100, actualAmount: 150 }),
      category({ id: 'b', allocatedAmount: 200, quotedAmount: 180 }),
      category({ id: 'c', allocatedAmount: 100 }),
    ];

    const summary = calculateRemainingBudget(500, categories, 'USD');
    expect(summary.totalPlanned).toBe(400);
    expect(summary.totalActual).toBe(150);
    expect(summary.totalQuoted).toBe(180);
    expect(summary.totalEffective).toBe(430);
    expect(summary.remaining).toBe(70);
    expect(summary.isOverBudget).toBe(false);
  });

  it('flags over-budget when effective spend exceeds the total', () => {
    const categories = [category({ id: 'a', allocatedAmount: 500, actualAmount: 620 })];
    const summary = calculateRemainingBudget(500, categories, 'USD');

    expect(summary.remaining).toBe(-120);
    expect(summary.isOverBudget).toBe(true);
  });

  it('separates the contingency reserve from the rest', () => {
    const categories = [
      category({ id: 'a', allocatedAmount: 900 }),
      category({ id: 'buffer', allocatedAmount: 100, isContingency: true }),
    ];

    expect(calculateRemainingBudget(1000, categories, 'USD').contingencyReserve).toBe(100);
  });
});

describe('helpers', () => {
  it('calculates a positive variance when under allocation', () => {
    const item = category({ allocatedAmount: 200, actualAmount: 150 });
    expect(calculateVariance(item, 'USD')).toBe(50);
  });

  it('calculates a negative variance when over allocation', () => {
    const item = category({ allocatedAmount: 200, actualAmount: 250 });
    expect(calculateVariance(item, 'USD')).toBe(-50);
  });

  it('calculates percentages safely', () => {
    expect(recalculatePercentage(25, 200)).toBe(12.5);
    expect(recalculatePercentage(25, 0)).toBe(0);
  });

  it('formats currency without throwing on an unknown currency code', () => {
    expect(formatCurrency(1234.5, 'USD')).toContain('234');
    expect(formatCurrency(10, 'INR')).toBeTruthy();
  });
});
