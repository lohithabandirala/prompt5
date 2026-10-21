import type { SavedEvent } from '../schemas/event-plan';
import { formatCurrency } from '../budget/calculate';

/**
 * Escape untrusted text for safe inclusion in generated HTML.
 *
 * Model output and user notes are never trusted. Every interpolation in the
 * report passes through this function, so a note containing `<script>` is
 * rendered as literal text rather than executable markup.
 */
export function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function list(items: string[] | undefined, ordered = false): string {
  if (!items || items.length === 0) return '';
  const tag = ordered ? 'ol' : 'ul';
  return `<${tag}>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</${tag}>`;
}

function paragraph(value: string | undefined): string {
  return value ? `<p>${escapeHtml(value)}</p>` : '';
}

/**
 * Build a standalone, print-ready HTML planning report.
 * The document contains no scripts, no external resources and no raw model
 * output — only escaped text and inline presentation styles.
 */
export function buildPlanReportHtml(event: SavedEvent): string {
  const { input, plan } = event;
  if (!plan) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>No plan</title></head><body><p>No plan has been generated for this event yet.</p></body></html>`;
  }

  const budgetRows = plan.budgetCategories
    .map(
      (category) => `<tr>
        <td>${escapeHtml(category.name)}${category.isContingency ? ' (contingency)' : ''}</td>
        <td class="num">${category.allocatedPercentage.toFixed(2)}%</td>
        <td class="num">${escapeHtml(formatCurrency(category.allocatedAmount, input.currency))}</td>
        <td class="num">${category.quotedAmount !== undefined ? escapeHtml(formatCurrency(category.quotedAmount, input.currency)) : '—'}</td>
        <td class="num">${category.actualAmount !== undefined ? escapeHtml(formatCurrency(category.actualAmount, input.currency)) : '—'}</td>
        <td>${escapeHtml(category.status)}</td>
      </tr>`
    )
    .join('');

  const taskRows = plan.timelineTasks
    .map(
      (task) => `<tr>
        <td>${escapeHtml(task.title)}</td>
        <td>${escapeHtml(task.phase)}</td>
        <td>${escapeHtml(task.dueDate ?? 'To be confirmed')}</td>
        <td>${escapeHtml(task.priority)}</td>
        <td>${escapeHtml(task.status.replace('_', ' '))}</td>
      </tr>`
    )
    .join('');

  const vendorRows = plan.vendorEntries
    .map(
      (vendor) => `<tr>
        <td>${escapeHtml(vendor.vendorName ?? vendor.category)}</td>
        <td>${escapeHtml(vendor.category)}</td>
        <td>${escapeHtml(vendor.sourcingDeadline ?? 'To be confirmed')}</td>
        <td>${escapeHtml(vendor.status.replace('_', ' '))}</td>
        <td>${escapeHtml(vendor.quoteAmount !== undefined ? formatCurrency(vendor.quoteAmount, input.currency) : 'No quote entered')}</td>
      </tr>`
    )
    .join('');

  const ideaBlocks = plan.celebrationIdeas
    .map(
      (idea) => `<article class="idea">
        <h3>${escapeHtml(idea.title)}</h3>
        ${paragraph(idea.description)}
        ${idea.whyItFits ? `<p class="why"><strong>Why it fits:</strong> ${escapeHtml(idea.whyItFits)}</p>` : ''}
        ${idea.estimatedCost ? `<p><strong>Illustrative cost:</strong> ${escapeHtml(idea.estimatedCost)}</p>` : ''}
        ${idea.implementationSteps?.length ? `<p><strong>Steps:</strong></p>${list(idea.implementationSteps, true)}` : ''}
        ${idea.tradeoffs ? `<p><strong>Trade-offs:</strong> ${escapeHtml(idea.tradeoffs)}</p>` : ''}
      </article>`
    )
    .join('');

  const scheduleRows = plan.eventDaySchedule
    .map(
      (entry) => `<tr>
        <td class="nowrap">${escapeHtml(entry.time)}${entry.endTime ? ` – ${escapeHtml(entry.endTime)}` : ''}</td>
        <td>${escapeHtml(entry.activity)}</td>
        <td>${escapeHtml(entry.location ?? '')}</td>
        <td>${escapeHtml(entry.responsible ?? '')}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(plan.eventName)} — Planning Report</title>
<style>
  :root { color-scheme: light; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; max-width: 900px; margin: 0 auto; padding: 32px 24px; color: #1e293b; line-height: 1.55; }
  h1 { font-size: 1.9rem; margin: 0 0 8px; color: #4338ca; }
  h2 { font-size: 1.25rem; margin: 32px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; }
  h3 { font-size: 1rem; margin: 16px 0 6px; }
  .meta { color: #64748b; font-size: .9rem; margin-bottom: 24px; }
  .meta span { margin-right: 16px; white-space: nowrap; }
  .notice { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 14px; font-size: .85rem; color: #92400e; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 24px; font-size: .88rem; }
  th, td { border: 1px solid #e2e8f0; padding: 7px 10px; text-align: left; vertical-align: top; }
  th { background: #f8fafc; font-weight: 600; }
  .num { text-align: right; white-space: nowrap; }
  .nowrap { white-space: nowrap; }
  .idea { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin: 12px 0; break-inside: avoid; }
  ul, ol { margin: 6px 0 10px 20px; padding: 0; }
  footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: .8rem; color: #64748b; }
  @media print {
    body { padding: 0; max-width: none; font-size: 11pt; }
    h2 { break-after: avoid; }
    table { break-inside: auto; }
    tr { break-inside: avoid; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<h1>${escapeHtml(plan.eventName)}</h1>
<div class="meta">
  <span><strong>Type:</strong> ${escapeHtml(input.category)}</span>
  <span><strong>Date:</strong> ${escapeHtml(input.eventDate)}</span>
  <span><strong>Location:</strong> ${escapeHtml(input.location)}</span><br>
  <span><strong>Guests:</strong> ${escapeHtml(input.guestCount)}</span>
  <span><strong>Budget:</strong> ${escapeHtml(formatCurrency(input.totalBudget, input.currency))}</span>
  <span><strong>Currency:</strong> ${escapeHtml(input.currency)}</span>
</div>

<p class="notice">This report contains AI-generated suggestions and illustrative planning estimates. It is not a quotation, a booking confirmation, or a guarantee of availability or final cost. Verify all prices and vendor details independently.</p>

<h2>Overview</h2>
<p>${escapeHtml(plan.eventSummary)}</p>

<h2>Theme and ideas</h2>
<h3>${escapeHtml(plan.recommendedTheme)}</h3>
<p>${escapeHtml(plan.themeExplanation)}</p>
${plan.decorationIdeas ? `<p><strong>Decorations:</strong> ${escapeHtml(plan.decorationIdeas)}</p>` : ''}
${plan.venueIdeas ? `<p><strong>Venue:</strong> ${escapeHtml(plan.venueIdeas)}</p>` : ''}
${plan.foodConcepts ? `<p><strong>Food:</strong> ${escapeHtml(plan.foodConcepts)}</p>` : ''}
${plan.entertainmentSuggestions ? `<p><strong>Entertainment:</strong> ${escapeHtml(plan.entertainmentSuggestions)}</p>` : ''}
${plan.guestEngagement ? `<p><strong>Guest engagement:</strong> ${escapeHtml(plan.guestEngagement)}</p>` : ''}

<h2>Budget (${escapeHtml(input.currency)})</h2>
<p class="notice">Amounts below are planning allocations, not verified vendor prices.</p>
<table>
  <thead><tr><th>Category</th><th>Share</th><th>Planned</th><th>Quoted</th><th>Actual</th><th>Status</th></tr></thead>
  <tbody>${budgetRows}</tbody>
</table>

<h2>Preparation timeline</h2>
<table>
  <thead><tr><th>Task</th><th>Phase</th><th>Due</th><th>Priority</th><th>Status</th></tr></thead>
  <tbody>${taskRows}</tbody>
</table>

<h2>Vendors</h2>
<table>
  <thead><tr><th>Vendor</th><th>Category</th><th>Sourcing deadline</th><th>Status</th><th>Quote</th></tr></thead>
  <tbody>${vendorRows}</tbody>
</table>

<h2>Celebration ideas</h2>
${ideaBlocks}

<h2>Event-day run sheet</h2>
<table>
  <thead><tr><th>Time</th><th>Activity</th><th>Location</th><th>Responsible</th></tr></thead>
  <tbody>${scheduleRows}</tbody>
</table>

${plan.assumptions?.length ? `<h2>Assumptions</h2>${list(plan.assumptions)}` : ''}
${plan.contingencyPlans?.length ? `<h2>Contingency plans</h2>${list(plan.contingencyPlans)}` : ''}
${plan.unresolvedQuestions?.length ? `<h2>Open questions</h2>${list(plan.unresolvedQuestions)}` : ''}

<footer>
  <p>Generated by Festiva AI — Your Personal Celebration Planner.</p>
  <p>Plan created ${escapeHtml(new Date(plan.createdAt).toLocaleString())}. Saved locally in your browser; no account was created.</p>
</footer>
</body>
</html>`;
}
