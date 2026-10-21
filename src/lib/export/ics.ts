import type { EventPlan } from '../schemas/event-plan';
import type { EventInput } from '../schemas/event-input';
import { parseCalendarDate, formatCalendarDate } from '../timeline/schedule';

/** Escape text per RFC 5545 (backslash, semicolon, comma, newlines). */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Fold long content lines at 73 characters to stay under the 75-octet limit. */
export function foldIcsLine(line: string): string {
  if (line.length <= 73) return line;
  const chunks: string[] = [];
  let remaining = line;
  chunks.push(remaining.slice(0, 73));
  remaining = remaining.slice(73);
  while (remaining.length > 0) {
    chunks.push(` ${remaining.slice(0, 72)}`);
    remaining = remaining.slice(72);
  }
  return chunks.join('\r\n');
}

/** Convert a calendar date (YYYY-MM-DD) to an ICS DATE value (YYYYMMDD). */
export function toIcsDate(dateStr: string): string | null {
  const parts = parseCalendarDate(dateStr);
  if (!parts) return null;
  return `${String(parts.year).padStart(4, '0')}${String(parts.month).padStart(2, '0')}${String(parts.day).padStart(2, '0')}`;
}

function addDays(dateStr: string, days: number): string | null {
  const parts = parseCalendarDate(dateStr);
  if (!parts) return null;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() + days);
  return formatCalendarDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function stamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

/**
 * Build a valid iCalendar file containing:
 *  - one all-day event for the celebration itself
 *  - one all-day reminder for every preparation task that has a due date
 *
 * UIDs are stable for a given plan/task pair so re-importing updates rather
 * than duplicating entries in most calendar clients.
 */
export function buildIcsFile(plan: EventPlan, input: EventInput, now: Date = new Date()): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Festiva AI//Celebration Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(plan.eventName)}`,
  ];

  const eventStart = toIcsDate(input.eventDate);
  const eventEnd = toIcsDate(addDays(input.eventDate, 1) ?? input.eventDate);

  if (eventStart && eventEnd) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${plan.id}-event@festiva.local`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${eventStart}`,
      `DTEND;VALUE=DATE:${eventEnd}`,
      `SUMMARY:${escapeIcsText(plan.eventName)}`,
      `DESCRIPTION:${escapeIcsText(
        `${plan.eventSummary}\n\nLocation: ${input.location}\nGuests: ${input.guestCount}\nBudget: ${input.totalBudget} ${input.currency}`
      )}`,
      `LOCATION:${escapeIcsText(input.location)}`,
      'STATUS:CONFIRMED',
      'TRANSP:TRANSPARENT',
      'END:VEVENT'
    );
  }

  for (const task of plan.timelineTasks) {
    if (!task.dueDate) continue;
    const due = toIcsDate(task.dueDate);
    if (!due) continue;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${plan.id}-${task.id}@festiva.local`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${due}`,
      `SUMMARY:${escapeIcsText(`Prep: ${task.title}`)}`,
      `DESCRIPTION:${escapeIcsText(
        [task.description, `Phase: ${task.phase}`, `Priority: ${task.priority}`]
          .filter(Boolean)
          .join('\n')
      )}`,
      `LOCATION:${escapeIcsText(input.location)}`,
      'STATUS:CONFIRMED',
      'TRANSP:TRANSPARENT',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');

  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}
