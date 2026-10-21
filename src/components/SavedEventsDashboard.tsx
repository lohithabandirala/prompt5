'use client';

import { useMemo, useState } from 'react';
import type { SavedEvent } from '@/lib/persistence/plans';
import { formatCurrency } from '@/lib/budget/calculate';
import { getDaysUntilEvent } from '@/lib/timeline/schedule';

interface SavedEventsDashboardProps {
  plans: SavedEvent[];
  onLoad: (plan: SavedEvent) => void;
  onRequestDelete: (id: string) => void;
  onCreateNew: () => void;
}

const CATEGORY_EMOJI: Record<string, string> = {
  wedding: '💍',
  birthday: '🎂',
  community: '🎪',
};

const CATEGORY_LABEL: Record<string, string> = {
  wedding: 'Wedding',
  birthday: 'Birthday',
  community: 'Community event',
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function SavedEventsDashboard({
  plans,
  onLoad,
  onRequestDelete,
  onCreateNew,
}: SavedEventsDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return plans;
    return plans.filter(
      (saved) =>
        (saved.plan?.eventName ?? '').toLowerCase().includes(query) ||
        saved.input.category.toLowerCase().includes(query) ||
        saved.input.location.toLowerCase().includes(query) ||
        (saved.plan?.recommendedTheme ?? '').toLowerCase().includes(query)
    );
  }, [plans, searchQuery]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card card-body">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">My events</h2>
            <p className="text-sm text-slate-500 mt-1">
              {plans.length} saved event{plans.length !== 1 ? 's' : ''} in this browser
            </p>
          </div>
          <button type="button" onClick={onCreateNew} className="btn btn-primary">
            + New event
          </button>
        </div>

        {plans.length > 0 && (
          <div className="mt-4">
            <label htmlFor="search-events" className="sr-only">Search events</label>
            <input
              type="search"
              id="search-events"
              className="input-field"
              placeholder="Search by name, category, location or theme…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Search saved events"
            />
          </div>
        )}
      </div>

      {plans.length === 0 ? (
        <div className="card card-body text-center py-14">
          <div className="text-6xl mb-4" aria-hidden="true">🎉</div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Plan your next celebration</h3>
          <p className="mx-auto max-w-xl text-slate-500 mb-6">
            Answer a few questions and Festiva AI builds a personalised theme, budget, preparation
            timeline, vendor checklist, idea list and event-day run sheet. You can edit everything.
          </p>
          <button type="button" onClick={onCreateNew} className="btn btn-primary mx-auto">
            Create your first event
          </button>
          <p className="mt-4 text-xs text-slate-500">
            No account needed. Plans stay in this browser unless you export them.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card card-body text-center text-slate-500 py-8">
          <p>No events match your search.</p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="btn btn-ghost btn-sm mx-auto mt-3"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((savedPlan) => {
            const emoji = CATEGORY_EMOJI[savedPlan.input.category] ?? '🎊';
            const daysUntil = getDaysUntilEvent(savedPlan.input.eventDate);
            const title = savedPlan.plan?.eventName ?? 'Untitled event';

            return (
              <article key={savedPlan.id} className="card p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <span className="text-3xl" aria-hidden="true">{emoji}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">{title}</h3>
                    <p className="text-sm text-slate-500">
                      {CATEGORY_LABEL[savedPlan.input.category] ?? savedPlan.input.category}
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true">📅</span>
                    <span>{formatDate(savedPlan.input.eventDate)}</span>
                    {daysUntil > 0 && (
                      <span className={`badge ${daysUntil < 14 ? 'badge-warning' : 'badge-info'} ml-auto`}>
                        {daysUntil}d away
                      </span>
                    )}
                    {daysUntil === 0 && <span className="badge badge-warning ml-auto">Today</span>}
                    {daysUntil < 0 && <span className="badge badge-danger ml-auto">Past</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true">📍</span>
                    <span className="truncate">{savedPlan.input.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true">👥</span>
                    <span>{savedPlan.input.guestCount} guests</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true">💰</span>
                    <span>{formatCurrency(savedPlan.input.totalBudget, savedPlan.input.currency)}</span>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1">
                  {savedPlan.plan?.recommendedTheme && (
                    <span className="badge badge-primary text-xs">
                      🎨 {savedPlan.plan.recommendedTheme.slice(0, 28)}
                    </span>
                  )}
                  {!savedPlan.plan && (
                    <span className="badge badge-warning text-xs">No plan generated yet</span>
                  )}
                </div>

                <p className="text-xs text-slate-500 mt-3">
                  Updated {formatDate(savedPlan.updatedAt)}
                </p>

                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => onLoad(savedPlan)}
                    className="btn btn-primary btn-sm flex-1"
                  >
                    Open plan
                  </button>
                  <button
                    type="button"
                    onClick={() => onRequestDelete(savedPlan.id)}
                    className="btn btn-ghost btn-sm"
                    aria-label={`Delete ${title}`}
                  >
                    🗑️
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
