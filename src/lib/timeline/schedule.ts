import type { ScheduleEntry, TimelineTask } from '../schemas/event-plan';

/**
 * Split a YYYY-MM-DD (or ISO datetime) string into calendar parts using UTC.
 * Calendar dates are treated as timezone-free values to prevent a server in
 * one timezone and a browser in another from disagreeing about the day.
 */
export function parseCalendarDate(dateStr: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function formatCalendarDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Subtract a number of days from a calendar date without timezone drift.
 */
export function subtractDays(dateStr: string, days: number): string {
  const parts = parseCalendarDate(dateStr);
  if (!parts) return dateStr;
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  base.setUTCDate(base.getUTCDate() - Math.max(0, Math.round(days)));
  return formatCalendarDate(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate());
}

/**
 * Today's calendar date in the runtime's local timezone, as YYYY-MM-DD.
 */
export function todayCalendarDate(now: Date = new Date()): string {
  return formatCalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * Calculate actual calendar due dates from relative daysBeforeEvent and event date.
 */
export function calculateDueDates(
  tasks: Omit<TimelineTask, 'dueDate'>[],
  eventDateStr: string
): TimelineTask[] {
  return tasks.map((task) => ({
    ...task,
    dueDate: subtractDays(eventDateStr, task.daysBeforeEvent),
  }));
}

/**
 * Short-notice events (< 14 days) must not receive deadlines in the past.
 * Clamp every task to at most "today" so the plan is actionable immediately.
 */
export function normalizeTasksForShortNotice(
  tasks: TimelineTask[],
  eventDateStr: string,
  today: string = todayCalendarDate()
): TimelineTask[] {
  const daysUntil = daysBetween(today, eventDateStr);
  if (daysUntil === null || daysUntil < 0 || daysUntil >= 14) return tasks;

  return tasks.map((task) => {
    const clampedDays = Math.min(task.daysBeforeEvent, daysUntil);
    return {
      ...task,
      daysBeforeEvent: clampedDays,
      dueDate: subtractDays(eventDateStr, clampedDays),
    };
  });
}

/**
 * Whole-day difference between two calendar dates (to - from).
 */
export function daysBetween(fromDateStr: string, toDateStr: string): number | null {
  const from = parseCalendarDate(fromDateStr);
  const to = parseCalendarDate(toDateStr);
  if (!from || !to) return null;

  const fromUtc = Date.UTC(from.year, from.month - 1, from.day);
  const toUtc = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toUtc - fromUtc) / (1000 * 60 * 60 * 24));
}

/**
 * Determine if the event is short-notice (< 14 days away, today or later).
 */
export function isShortNotice(eventDateStr: string, today: string = todayCalendarDate()): boolean {
  const days = daysBetween(today, eventDateStr);
  return days !== null && days >= 0 && days < 14;
}

/**
 * Get the number of days until the event.
 */
export function getDaysUntilEvent(eventDateStr: string, today: string = todayCalendarDate()): number {
  return daysBetween(today, eventDateStr) ?? 0;
}

/**
 * Check if a date is in the past.
 */
export function isDateInPast(dateStr: string, today: string = todayCalendarDate()): boolean {
  const days = daysBetween(today, dateStr);
  return days !== null && days < 0;
}

/**
 * Sort tasks by due date (earliest first), then priority.
 */
export function sortTasks(tasks: TimelineTask[]): TimelineTask[] {
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

  return [...tasks].sort((a, b) => {
    if (a.daysBeforeEvent !== b.daysBeforeEvent) {
      return b.daysBeforeEvent - a.daysBeforeEvent;
    }
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Convert model-generated dependency titles into concrete task ids.
 * Unknown titles are dropped rather than producing impossible schedules.
 */
export function resolveDependencies(
  tasks: Array<Omit<TimelineTask, 'id'> & { id?: string; dependsOnTitles?: string[] }>,
  ids: string[]
): Array<Omit<TimelineTask, 'dueDate'> & { id: string }> {
  const titleToId = new Map<string, string>();
  tasks.forEach((task, index) => {
    titleToId.set(normalizeTitle(task.title), ids[index]);
  });

  return tasks.map((task, index) => {
    const resolved = (task.dependsOnTitles ?? [])
      .map((title) => titleToId.get(normalizeTitle(title)))
      .filter((id): id is string => Boolean(id) && id !== ids[index]);
    return {
      ...task,
      id: ids[index],
      dependsOn: resolved.length > 0 ? Array.from(new Set(resolved)) : undefined,
    };
  });
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Check for task dependency violations.
 *
 * A dependency must not be scheduled after the task that depends on it.
 */
export function validateDependencies(tasks: TimelineTask[]): string[] {
  const errors: string[] = [];
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (task: TimelineTask, path: string[]) => {
    if (visited.has(task.id)) return;
    if (visiting.has(task.id)) {
      errors.push(`Circular dependency detected: ${[...path, task.title].join(' → ')}`);
      return;
    }
    visiting.add(task.id);
    for (const dependencyId of task.dependsOn ?? []) {
      const dependency = taskMap.get(dependencyId);
      if (!dependency) {
        errors.push(`Task "${task.title}" depends on an unknown task (${dependencyId})`);
        continue;
      }
      if (dependency.daysBeforeEvent < task.daysBeforeEvent) {
        errors.push(
          `Task "${task.title}" depends on "${dependency.title}", which is scheduled after it`
        );
      }
      visit(dependency, [...path, task.title]);
    }
    visiting.delete(task.id);
    visited.add(task.id);
  };

  for (const task of tasks) visit(task, []);
  return errors;
}

/**
 * Group tasks by phase, preserving the incoming (sorted) order.
 */
export function groupTasksByPhase(tasks: TimelineTask[]): Map<string, TimelineTask[]> {
  const groups = new Map<string, TimelineTask[]>();

  for (const task of tasks) {
    const phase = task.phase || 'Unassigned';
    if (!groups.has(phase)) {
      groups.set(phase, []);
    }
    groups.get(phase)!.push(task);
  }

  return groups;
}

/**
 * Calculate completion progress.
 */
export function calculateProgress(tasks: TimelineTask[]): {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
  percentage: number;
} {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.status === 'completed').length;
  const inProgress = tasks.filter((task) => task.status === 'in_progress').length;
  const notStarted = tasks.filter((task) => task.status === 'not_started').length;
  const overdue = tasks.filter((task) => isTaskOverdue(task)).length;

  return {
    total,
    completed,
    inProgress,
    notStarted,
    overdue,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

/**
 * Check if a task is overdue. Compares calendar-date strings, so it is not
 * affected by timezone offsets or daylight-saving changes.
 */
export function isTaskOverdue(task: TimelineTask, today: string = todayCalendarDate()): boolean {
  if (task.status === 'completed') return false;
  if (!task.dueDate) return false;
  const due = parseCalendarDate(task.dueDate);
  if (!due) return false;
  return formatCalendarDate(due.year, due.month, due.day) < today;
}

/**
 * Read a HH:MM time (24h) into minutes since midnight.
 */
export function parseTimeToMinutes(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export interface ScheduleConflict {
  firstEntryId: string;
  secondEntryId: string;
  resource: string;
  message: string;
}

/**
 * Detect overlapping assignments for the same responsible person or venue.
 * Entries without an explicit end time are treated as 30-minute slots when
 * comparing adjacency, and never reported as conflicting on their own.
 */
export function detectScheduleConflicts(entries: ScheduleEntry[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  const timed = entries
    .map((entry) => {
      const start = parseTimeToMinutes(entry.time);
      if (start === null) return null;
      const end = entry.endTime ? parseTimeToMinutes(entry.endTime) : null;
      return {
        entry,
        start,
        end: end !== null && end > start ? end : start + 30,
      };
    })
    .filter((item): item is { entry: ScheduleEntry; start: number; end: number } => item !== null)
    .sort((a, b) => a.start - b.start);

  for (let i = 0; i < timed.length; i += 1) {
    for (let j = i + 1; j < timed.length; j += 1) {
      const first = timed[i];
      const second = timed[j];
      if (second.start >= first.end) break;

      const sharedResources = [
        first.entry.responsible && second.entry.responsible
          ? { label: first.entry.responsible, same: first.entry.responsible === second.entry.responsible }
          : null,
        first.entry.location && second.entry.location
          ? { label: first.entry.location, same: first.entry.location === second.entry.location }
          : null,
      ].filter((item): item is { label: string; same: boolean } => Boolean(item) && item!.same);

      for (const resource of sharedResources) {
        conflicts.push({
          firstEntryId: first.entry.id,
          secondEntryId: second.entry.id,
          resource: resource.label,
          message: `"${first.entry.activity}" and "${second.entry.activity}" overlap and both use ${resource.label}.`,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Return entries ordered by start time. Entries with unparseable times are
 * kept at the end in their original order.
 */
export function sortScheduleEntries(entries: ScheduleEntry[]): ScheduleEntry[] {
  return [...entries].sort((a, b) => {
    const first = parseTimeToMinutes(a.time);
    const second = parseTimeToMinutes(b.time);
    if (first === null && second === null) return 0;
    if (first === null) return 1;
    if (second === null) return -1;
    return first - second;
  });
}
