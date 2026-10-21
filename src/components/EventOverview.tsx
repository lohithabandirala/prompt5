'use client';

import type { EventPlan } from '@/lib/schemas/event-plan';
import type { EventInput } from '@/lib/schemas/event-input';
import { getDaysUntilEvent, parseCalendarDate } from '@/lib/timeline/schedule';

interface EventOverviewProps {
  plan: EventPlan;
  input: EventInput;
  onRegenerateTheme?: () => void;
  isRegenerating?: boolean;
  onEditDetails?: () => void;
}

function formatEventDate(dateString: string): string {
  const parts = parseCalendarDate(dateString);
  if (!parts) return dateString;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default function EventOverview({
  plan,
  input,
  onRegenerateTheme,
  isRegenerating,
  onEditDetails,
}: EventOverviewProps) {
  const daysUntil = getDaysUntilEvent(input.eventDate);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Event Header */}
      <div className="card card-body">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{plan.eventName}</h2>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="badge badge-primary">
                {input.category.charAt(0).toUpperCase() + input.category.slice(1)}
              </span>
              <span className="badge badge-info">{input.guestCount} guests</span>
              <span className="badge badge-success">
                {input.totalBudget.toLocaleString()} {input.currency}
              </span>
              {daysUntil > 0 ? (
                <span className={`badge ${daysUntil < 14 ? 'badge-warning' : 'badge-info'}`}>
                  {daysUntil} days away
                </span>
              ) : daysUntil === 0 ? (
                <span className="badge badge-danger">Today!</span>
              ) : (
                <span className="badge badge-warning">Past event</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="text-sm text-slate-500 sm:text-right">
              <p>📅 {formatEventDate(input.eventDate)}</p>
              <p>📍 {input.location}</p>
            </div>
            {onEditDetails && (
              <button type="button" onClick={onEditDetails} className="btn btn-ghost btn-sm">
                ✏️ Edit event details
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" role="note">
        Costs and vendor suggestions are AI-generated planning estimates, not quotations. Festiva AI
        does not contact, book or pay vendors, and it cannot confirm availability.
      </div>

      {/* Summary */}
      <div className="card card-body">
        <h3 className="section-title">📋 Event Overview</h3>
        <p className="text-slate-600 leading-relaxed whitespace-pre-line">{plan.eventSummary}</p>
      </div>

      {/* Theme */}
      <div className="card card-body">
        <div className="flex items-start justify-between gap-4">
          <h3 className="section-title">🎨 Theme: {plan.recommendedTheme}</h3>
          {onRegenerateTheme && (
            <button
              onClick={onRegenerateTheme}
              disabled={isRegenerating}
              className="btn btn-ghost btn-sm flex-shrink-0"
              aria-label="New Theme — regenerate theme suggestions"
            >
              {isRegenerating ? <span className="spinner" aria-hidden="true" /> : '🔄'} New Theme
            </button>
          )}
        </div>
        <p className="text-slate-600 mb-4 leading-relaxed">{plan.themeExplanation}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          {plan.decorationIdeas && (
            <div className="p-3 bg-purple-50 rounded-lg">
              <h4 className="font-semibold text-sm text-purple-800 mb-1">🌸 Decorations</h4>
              <p className="text-sm text-purple-700">{plan.decorationIdeas}</p>
            </div>
          )}
          {plan.venueIdeas && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-sm text-blue-800 mb-1">🏛️ Venue Ideas</h4>
              <p className="text-sm text-blue-700">{plan.venueIdeas}</p>
            </div>
          )}
          {plan.entertainmentSuggestions && (
            <div className="p-3 bg-pink-50 rounded-lg">
              <h4 className="font-semibold text-sm text-pink-800 mb-1">🎵 Entertainment</h4>
              <p className="text-sm text-pink-700">{plan.entertainmentSuggestions}</p>
            </div>
          )}
          {plan.foodConcepts && (
            <div className="p-3 bg-amber-50 rounded-lg">
              <h4 className="font-semibold text-sm text-amber-800 mb-1">🍽️ Food Concepts</h4>
              <p className="text-sm text-amber-700">{plan.foodConcepts}</p>
            </div>
          )}
          {plan.guestEngagement && (
            <div className="p-3 bg-green-50 rounded-lg sm:col-span-2">
              <h4 className="font-semibold text-sm text-green-800 mb-1">🎉 Guest Engagement</h4>
              <p className="text-sm text-green-700">{plan.guestEngagement}</p>
            </div>
          )}
        </div>
      </div>

      {/* Budget allocation rationale */}
      {plan.budgetAllocationRationale && (
        <div className="card card-body">
          <h3 className="section-title">💰 Budget Strategy</h3>
          <p className="text-slate-600 leading-relaxed">{plan.budgetAllocationRationale}</p>
        </div>
      )}

      {/* Assumptions & Risks */}
      {((plan.assumptions && plan.assumptions.length > 0) ||
        (plan.contingencyPlans && plan.contingencyPlans.length > 0) ||
        (plan.unresolvedQuestions && plan.unresolvedQuestions.length > 0)) && (
        <div className="card card-body">
          <h3 className="section-title">⚠️ Important Notes</h3>

          {plan.assumptions && plan.assumptions.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-sm text-slate-700 mb-2">Assumptions</h4>
              <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                {plan.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          {plan.contingencyPlans && plan.contingencyPlans.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-sm text-slate-700 mb-2">Contingency Plans</h4>
              <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                {plan.contingencyPlans.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {plan.unresolvedQuestions && plan.unresolvedQuestions.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm text-slate-700 mb-2">Questions to Resolve</h4>
              <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                {plan.unresolvedQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
