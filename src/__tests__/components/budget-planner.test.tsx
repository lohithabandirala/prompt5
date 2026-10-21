/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import BudgetPlanner from '@/components/BudgetPlanner';
import type { BudgetCategory } from '@/lib/schemas/event-plan';

function category(overrides: Partial<BudgetCategory> = {}): BudgetCategory {
  return {
    id: 'a',
    name: 'Venue',
    allocatedPercentage: 50,
    allocatedAmount: 500,
    status: 'planned',
    isContingency: false,
    ...overrides,
  };
}

const categories: BudgetCategory[] = [
  category({ id: 'a', name: 'Venue' }),
  category({ id: 'b', name: 'Catering' }),
];

describe('BudgetPlanner', () => {
  it('reconciles allocations so edits always sum to the total budget', () => {
    const onUpdate = jest.fn();
    render(
      <BudgetPlanner
        categories={categories}
        totalBudget={1000}
        currency="USD"
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    fireEvent.change(document.querySelector('#alloc-a') as HTMLInputElement, {
      target: { value: '600' },
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const next = onUpdate.mock.calls[0][0] as BudgetCategory[];
    expect(next.reduce((sum, item) => sum + item.allocatedAmount, 0)).toBeCloseTo(1000, 2);
    expect(next.find((item) => item.id === 'a')?.allocatedAmount).toBe(600);
    expect(next.find((item) => item.id === 'b')?.allocatedAmount).toBe(400);
  });

  it('shows an explicit over-budget alert based on committed spend', () => {
    render(
      <BudgetPlanner
        categories={[category({ actualAmount: 1500 })]}
        totalBudget={1000}
        currency="USD"
        onUpdate={jest.fn()}
      />
    );

    const alert = screen.getByText(/Over budget by/i);
    expect(alert).toHaveTextContent(/500/);
  });

  it('offers a rebalance action when stored allocations do not match the total', () => {
    const onUpdate = jest.fn();
    render(
      <BudgetPlanner
        categories={[category({ allocatedAmount: 400 }), category({ id: 'b', allocatedAmount: 400 })]}
        totalBudget={1000}
        currency="USD"
        onUpdate={onUpdate}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/differ from the total budget/i);
    fireEvent.click(screen.getByRole('button', { name: /Rebalance to budget/i }));

    const next = onUpdate.mock.calls[0][0] as BudgetCategory[];
    expect(next.reduce((sum, item) => sum + item.allocatedAmount, 0)).toBeCloseTo(1000, 2);
  });

  it('disables regeneration while a request is running', () => {
    render(
      <BudgetPlanner
        categories={categories}
        totalBudget={1000}
        currency="USD"
        onUpdate={jest.fn()}
        onRegenerate={jest.fn()}
        isRegenerating
      />
    );

    expect(screen.getByRole('button', { name: /Regenerate budget allocations/i })).toBeDisabled();
  });
});
