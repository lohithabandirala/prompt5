'use client';

import { useState, useCallback } from 'react';
import type { BudgetCategory } from '@/lib/schemas/event-plan';
import {
  calculateRemainingBudget,
  calculateVariance,
  recalculatePercentage,
  formatCurrency,
  roundCurrency,
  reconcileBudgetCategories,
  validateBudgetTotal,
} from '@/lib/budget/calculate';
import { getCurrencyPrecision } from '@/lib/schemas/event-input';

interface BudgetPlannerProps {
  categories: BudgetCategory[];
  totalBudget: number;
  currency: string;
  onUpdate: (categories: BudgetCategory[]) => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

export default function BudgetPlanner({
  categories,
  totalBudget,
  currency,
  onUpdate,
  onRegenerate,
  isRegenerating,
}: BudgetPlannerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const precision = getCurrencyPrecision(currency);

  const summary = calculateRemainingBudget(totalBudget, categories, currency);
  const allocationCheck = validateBudgetTotal(categories, totalBudget, currency);

  const handleAmountEdit = useCallback(
    (id: string, field: 'allocatedAmount' | 'quotedAmount' | 'actualAmount', value: number | undefined) => {
      const safeValue = value !== undefined && Number.isFinite(value) ? Math.max(0, value) : 0;

      if (field === 'allocatedAmount') {
        // Keep the plan balanced: the edited category keeps the user's value
        // and the other categories (contingency first, then largest first)
        // absorb the difference so allocations always sum to the budget.
        const edited = categories.map((cat) =>
          cat.id === id
            ? {
                ...cat,
                allocatedAmount: roundCurrency(safeValue, precision),
                allocatedPercentage: recalculatePercentage(safeValue, totalBudget),
              }
            : cat
        );
        onUpdate(reconcileBudgetCategories(edited, totalBudget, currency, id));
        return;
      }

      const updated = categories.map((cat) =>
        cat.id === id
          ? {
              ...cat,
              [field]:
                value === undefined || !Number.isFinite(value)
                  ? undefined
                  : roundCurrency(Math.max(0, value), precision),
            }
          : cat
      );
      onUpdate(updated);
    },
    [categories, onUpdate, totalBudget, precision, currency]
  );

  const handleRebalance = useCallback(() => {
    onUpdate(reconcileBudgetCategories(categories, totalBudget, currency));
  }, [categories, onUpdate, totalBudget, currency]);

  const handleStatusChange = useCallback(
    (id: string, status: BudgetCategory['status']) => {
      const updated = categories.map((cat) =>
        cat.id === id ? { ...cat, status } : cat
      );
      onUpdate(updated);
    },
    [categories, onUpdate]
  );

  // Calculate chart data
  const maxPercentage = Math.max(...categories.map((c) => c.allocatedPercentage), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Budget Summary */}
      <div className="card card-body">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h3 className="section-title">💰 Budget Overview</h3>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="btn btn-ghost btn-sm"
              aria-label="Regenerate budget allocations"
            >
              {isRegenerating ? <span className="spinner" aria-hidden="true" /> : '🔄'} Regenerate
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="p-4 bg-indigo-50 rounded-xl">
            <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide">Total Budget</p>
            <p className="text-xl font-bold text-indigo-900 mt-1">{formatCurrency(totalBudget, currency)}</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-xl">
            <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Planned Allocation</p>
            <p className="text-xl font-bold text-blue-900 mt-1">{formatCurrency(summary.totalPlanned, currency)}</p>
            <p className="mt-1 text-xs text-blue-700">
              {allocationCheck.valid
                ? 'Balances to the total budget'
                : `Off by ${formatCurrency(allocationCheck.difference, currency)}`}
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Committed</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(summary.totalEffective, currency)}</p>
            <p className="mt-1 text-xs text-slate-500">
              Paid {formatCurrency(summary.totalActual, currency)} · Quoted {formatCurrency(summary.totalQuoted, currency)}
            </p>
          </div>
          <div className={`p-4 rounded-xl ${summary.isOverBudget ? 'bg-red-50' : 'bg-emerald-50'}`}>
            <p className={`text-xs font-medium uppercase tracking-wide ${summary.isOverBudget ? 'text-red-800' : 'text-emerald-800'}`}>
              Remaining
            </p>
            <p className={`text-xl font-bold mt-1 ${summary.isOverBudget ? 'text-red-900' : 'text-emerald-900'}`}>
              {formatCurrency(summary.remaining, currency)}
            </p>
            {summary.isOverBudget && (
              <p className="text-xs text-red-800 mt-0.5 font-medium" role="alert">
                ⚠️ Over budget by {formatCurrency(Math.abs(summary.remaining), currency)}
              </p>
            )}
          </div>
        </div>

        {!allocationCheck.valid && (
          <div className="mt-4 flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <p className="text-sm text-amber-900">
              Category allocations differ from the total budget by{' '}
              <strong>{formatCurrency(allocationCheck.difference, currency)}</strong>.
            </p>
            <button type="button" onClick={handleRebalance} className="btn btn-secondary btn-sm">
              Rebalance to budget
            </button>
          </div>
        )}

        {summary.contingencyReserve > 0 && (
          <p className="text-sm text-slate-500 mt-3">
            🛡️ Contingency reserve: {formatCurrency(summary.contingencyReserve, currency)}
          </p>
        )}
      </div>

      {/* Budget Distribution Chart (accessible bar chart) */}
      <div className="card card-body">
        <h4 className="font-semibold text-sm text-slate-700 mb-4">Budget Distribution</h4>
        <div className="space-y-3" role="img" aria-label="Budget distribution chart">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-600 w-28 truncate" title={cat.name}>
                {cat.name}
              </span>
              <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden" role="progressbar"
                aria-valuenow={cat.allocatedPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${cat.name}: ${cat.allocatedPercentage.toFixed(1)}%`}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(cat.allocatedPercentage / maxPercentage) * 100}%`,
                    background: cat.isContingency
                      ? 'linear-gradient(90deg, #fdcb6e, #e17055)'
                      : `linear-gradient(90deg, #6c5ce7, #a29bfe)`,
                  }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-700 w-14 text-right">
                {cat.allocatedPercentage.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
        {/* Accessible data table */}
        <details className="mt-4">
          <summary className="text-sm text-indigo-600 cursor-pointer hover:text-indigo-800">
            View as data table
          </summary>
          <table className="w-full mt-2 text-sm" aria-label="Budget allocation details">
            <thead>
              <tr className="border-b border-slate-200">
                <th scope="col" className="text-left py-2 px-1 font-semibold text-slate-700">Category</th>
                <th scope="col" className="text-right py-2 px-1 font-semibold text-slate-700">%</th>
                <th scope="col" className="text-right py-2 px-1 font-semibold text-slate-700">Amount</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className="border-b border-slate-100">
                  <td className="py-1.5 px-1">{cat.name}{cat.isContingency ? ' 🛡️' : ''}</td>
                  <td className="py-1.5 px-1 text-right">{cat.allocatedPercentage.toFixed(1)}%</td>
                  <td className="py-1.5 px-1 text-right">{formatCurrency(cat.allocatedAmount, currency)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="py-2 px-1">Total</td>
                <td className="py-2 px-1 text-right">100%</td>
                <td className="py-2 px-1 text-right">{formatCurrency(totalBudget, currency)}</td>
              </tr>
            </tbody>
          </table>
        </details>
      </div>

      {/* Editable Budget Categories */}
      <div className="card card-body">
        <h4 className="font-semibold text-sm text-slate-700 mb-4">Category Details</h4>
        <p className="text-xs text-amber-800 mb-3 italic">
          💡 All amounts are illustrative planning estimates. Verify pricing with actual vendors.
        </p>
        <div className="space-y-3">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className={`border rounded-lg p-4 transition-colors ${
                editingId === cat.id ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h5 className="font-semibold text-slate-800">{cat.name}</h5>
                    {cat.isContingency && <span className="badge badge-warning">Contingency</span>}
                    <span className={`badge ${
                      cat.status === 'paid' ? 'badge-success' :
                      cat.status === 'quoted' ? 'badge-info' :
                      'badge-primary'
                    }`}>
                      {cat.status}
                    </span>
                  </div>
                  {cat.description && (
                    <p className="text-sm text-slate-500 mt-0.5">{cat.description}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-lg text-slate-900">
                    {formatCurrency(cat.allocatedAmount, currency)}
                  </p>
                  <p className="text-xs text-slate-500">{cat.allocatedPercentage.toFixed(1)}%</p>
                  <p className={`text-xs mt-0.5 ${calculateVariance(cat, currency) < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                    Variance {formatCurrency(calculateVariance(cat, currency), currency)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingId(editingId === cat.id ? null : cat.id)}
                className="btn btn-ghost btn-sm mt-2"
                aria-expanded={editingId === cat.id}
              >
                {editingId === cat.id ? 'Close' : 'Edit'}
              </button>

              {editingId === cat.id && (
                <div className="mt-3 pt-3 border-t border-slate-200 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="label" htmlFor={`alloc-${cat.id}`}>Allocated</label>
                    <input
                      type="number"
                      id={`alloc-${cat.id}`}
                      className="input-field"
                      value={cat.allocatedAmount}
                      onChange={(e) => handleAmountEdit(cat.id, 'allocatedAmount', Number(e.target.value))}
                      min={0}
                      step={precision === 0 ? 1 : 0.01}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`quoted-${cat.id}`}>Quoted</label>
                    <input
                      type="number"
                      id={`quoted-${cat.id}`}
                      className="input-field"
                      value={cat.quotedAmount ?? ''}
                      onChange={(e) => handleAmountEdit(cat.id, 'quotedAmount', e.target.value === '' ? undefined : Number(e.target.value))}
                      min={0}
                      step={precision === 0 ? 1 : 0.01}
                      placeholder="Enter quote"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`actual-${cat.id}`}>Actual</label>
                    <input
                      type="number"
                      id={`actual-${cat.id}`}
                      className="input-field"
                      value={cat.actualAmount ?? ''}
                      onChange={(e) => handleAmountEdit(cat.id, 'actualAmount', e.target.value === '' ? undefined : Number(e.target.value))}
                      min={0}
                      step={precision === 0 ? 1 : 0.01}
                      placeholder="Enter actual"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`status-${cat.id}`}>Status</label>
                    <select
                      id={`status-${cat.id}`}
                      className="input-field"
                      value={cat.status}
                      onChange={(e) => handleStatusChange(cat.id, e.target.value as BudgetCategory['status'])}
                    >
                      <option value="planned">Planned</option>
                      <option value="quoted">Quoted</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
