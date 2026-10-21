import {
  calculateDueDates,
  calculateProgress,
  daysBetween,
  detectScheduleConflicts,
  formatCalendarDate,
  isDateInPast,
  isShortNotice,
  isTaskOverdue,
  normalizeTasksForShortNotice,
  parseCalendarDate,
  parseTimeToMinutes,
  resolveDependencies,
  sortScheduleEntries,
  sortTasks,
  subtractDays,
  todayCalendarDate,
  validateDependencies,
} from '@/lib/timeline/schedule';
import type { ScheduleEntry, TimelineTask } from '@/lib/schemas/event-plan';

function task(overrides: Partial<TimelineTask> = {}): TimelineTask {
  return {
    id: 'task-1',
    title: 'Book venue',
    phase: 'Early planning',
    daysBeforeEvent: 90,
    priority: 'high',
    status: 'not_started',
    ...overrides,
  };
}

function entry(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    id: 'entry-1',
    time: '15:00',
    activity: 'Arrival',
    ...overrides,
  };
}

describe('calendar-date arithmetic', () => {
  it('parses valid dates and rejects impossible dates', () => {
    expect(parseCalendarDate('2026-02-28')).toEqual({ year: 2026, month: 2, day: 28 });
    expect(parseCalendarDate('2026-02-30')).toBeNull();
    expect(parseCalendarDate('not-a-date')).toBeNull();
    expect(parseCalendarDate('2026-2-8')).toBeNull();
  });

  it('subtracts days across month and year boundaries', () => {
    expect(subtractDays('2026-03-01', 1)).toBe('2026-02-28');
    expect(subtractDays('2024-03-01', 1)).toBe('2024-02-29');
    expect(subtractDays('2026-01-10', 10)).toBe('2025-12-31');
    expect(subtractDays('2026-01-10', 0)).toBe('2026-01-10');
  });

  it('does not drift with timezone offsets', () => {
    // UTC arithmetic means the result is identical in every runtime timezone.
    expect(subtractDays('2026-10-31', 180)).toBe('2026-05-04');
    const due = calculateDueDates(
      [
        {
          id: 't',
          title: 'Task',
          phase: 'Phase',
          daysBeforeEvent: 1,
          priority: 'low',
          status: 'not_started',
        },
      ],
      '2026-10-31'
    );
    expect(due[0].dueDate).toBe('2026-10-30');
  });

  it('computes whole-day differences', () => {
    expect(daysBetween('2026-10-01', '2026-10-31')).toBe(30);
    expect(daysBetween('2026-10-31', '2026-10-01')).toBe(-30);
    expect(daysBetween('2026-03-01', '2026-03-01')).toBe(0);
    expect(daysBetween('nope', '2026-03-01')).toBeNull();
  });

  it('formats calendar dates with padding', () => {
    expect(formatCalendarDate(2026, 3, 5)).toBe('2026-03-05');
  });

  it('compares past dates as calendar days', () => {
    expect(isDateInPast('2026-10-20', '2026-10-21')).toBe(true);
    expect(isDateInPast('2026-10-21', '2026-10-21')).toBe(false);
    expect(isDateInPast('2026-10-22', '2026-10-21')).toBe(false);
  });

  it('flags short-notice events only when today or later', () => {
    expect(isShortNotice('2026-10-25', '2026-10-21')).toBe(true);
    expect(isShortNotice('2026-11-10', '2026-10-21')).toBe(false);
    expect(isShortNotice('2026-10-01', '2026-10-21')).toBe(false);
  });

  it('returns today as a calendar date', () => {
    expect(todayCalendarDate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

describe('short-notice timeline handling', () => {
  it('clamps every task so nothing is due before today', () => {
    const tasks = [
      task({ id: 'a', daysBeforeEvent: 60, dueDate: '2026-08-01' }),
      task({ id: 'b', daysBeforeEvent: 2, dueDate: '2026-10-23' }),
    ];

    const result = normalizeTasksForShortNotice(tasks, '2026-10-25', '2026-10-21');
    expect(result[0].daysBeforeEvent).toBe(4);
    expect(result[0].dueDate).toBe('2026-10-21');
    expect(result[1].daysBeforeEvent).toBe(2);
  });

  it('leaves longer-notice timelines untouched', () => {
    const tasks = [task({ daysBeforeEvent: 60 })];
    expect(normalizeTasksForShortNotice(tasks, '2027-01-01', '2026-10-21')).toEqual(tasks);
  });
});

describe('dependency handling', () => {
  it('maps dependency titles to concrete task ids', () => {
    const resolved = resolveDependencies(
      [
        { ...task({ id: undefined as unknown as string, title: 'Book venue' }), dependsOnTitles: [] },
        { ...task({ id: undefined as unknown as string, title: 'Send invites' }), dependsOnTitles: ['book VENUE'] },
      ],
      ['id-venue', 'id-invites']
    );

    expect(resolved[1].dependsOn).toEqual(['id-venue']);
  });

  it('drops unknown and self-referencing dependencies', () => {
    const resolved = resolveDependencies(
      [{ ...task({ id: undefined as unknown as string }), dependsOnTitles: ['Send invites', 'Missing task'] }],
      ['id-1']
    );

    expect(resolved[0].dependsOn).toBeUndefined();
  });

  it('detects dependencies scheduled after the dependent task', () => {
    const errors = validateDependencies([
      task({ id: 'a', title: 'Send invites', daysBeforeEvent: 60, dependsOn: ['b'] }),
      task({ id: 'b', title: 'Book venue', daysBeforeEvent: 30 }),
    ]);

    expect(errors.some((message) => message.includes('scheduled after it'))).toBe(true);
  });

  it('detects circular dependencies', () => {
    const errors = validateDependencies([
      task({ id: 'a', title: 'A', daysBeforeEvent: 60, dependsOn: ['b'] }),
      task({ id: 'b', title: 'B', daysBeforeEvent: 30, dependsOn: ['a'] }),
    ]);

    expect(errors.some((message) => message.includes('Circular dependency'))).toBe(true);
  });

  it('accepts a valid dependency order', () => {
    const errors = validateDependencies([
      task({ id: 'a', title: 'Send invites', daysBeforeEvent: 30, dependsOn: ['b'] }),
      task({ id: 'b', title: 'Book venue', daysBeforeEvent: 90 }),
    ]);

    expect(errors).toEqual([]);
  });
});

describe('task sorting, progress and overdue state', () => {
  it('sorts earliest deadline first and then by priority', () => {
    const result = sortTasks([
      task({ id: 'a', daysBeforeEvent: 10, priority: 'low' }),
      task({ id: 'b', daysBeforeEvent: 30, priority: 'medium' }),
      task({ id: 'c', daysBeforeEvent: 30, priority: 'critical' }),
    ]);

    expect(result.map((item) => item.id)).toEqual(['c', 'b', 'a']);
  });

  it('calculates progress counts', () => {
    const now = '2026-10-21';
    const tasks = [
      task({ id: 'a', status: 'completed', dueDate: '2026-10-01' }),
      task({ id: 'b', status: 'completed', dueDate: '2026-10-30' }),
      task({ id: 'c', status: 'in_progress', dueDate: '2026-10-20' }),
      task({ id: 'd', status: 'not_started', dueDate: '2026-10-19' }),
    ];

    const progress = calculateProgress(tasks);
    expect(progress).toEqual({
      total: 4,
      completed: 2,
      inProgress: 1,
      notStarted: 1,
      overdue: 2,
      percentage: 50,
    });

    expect(isTaskOverdue(tasks[2], now)).toBe(true);
    expect(isTaskOverdue(tasks[1], now)).toBe(false);
    expect(isTaskOverdue({ ...tasks[3], status: 'completed' }, now)).toBe(false);
  });
});

describe('run-sheet scheduling', () => {
  it('parses valid 24-hour times and rejects invalid ones', () => {
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('15:30')).toBe(930);
    expect(parseTimeToMinutes('23:59')).toBe(1439);
    expect(parseTimeToMinutes('24:00')).toBeNull();
    expect(parseTimeToMinutes('7:30')).toBeNull();
    expect(parseTimeToMinutes('noon')).toBeNull();
  });

  it('detects overlapping slots for the same responsible person', () => {
    const conflicts = detectScheduleConflicts([
      entry({ id: 'a', time: '15:00', endTime: '16:00', responsible: 'Alex' }),
      entry({ id: 'b', time: '15:30', endTime: '16:30', responsible: 'Alex' }),
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].resource).toBe('Alex');
  });

  it('does not flag adjacent slots or different people', () => {
    expect(
      detectScheduleConflicts([
        entry({ id: 'a', time: '15:00', endTime: '16:00', responsible: 'Alex' }),
        entry({ id: 'b', time: '16:00', endTime: '17:00', responsible: 'Alex' }),
      ])
    ).toEqual([]);

    expect(
      detectScheduleConflicts([
        entry({ id: 'a', time: '15:00', endTime: '16:00', responsible: 'Alex' }),
        entry({ id: 'b', time: '15:30', endTime: '16:30', responsible: 'Sam' }),
      ])
    ).toEqual([]);
  });

  it('flags overlapping activities in the same location', () => {
    const conflicts = detectScheduleConflicts([
      entry({ id: 'a', time: '15:00', endTime: '16:00', location: 'Lawn' }),
      entry({ id: 'b', time: '15:15', endTime: '15:45', location: 'Lawn' }),
    ]);

    expect(conflicts.some((conflict) => conflict.resource === 'Lawn')).toBe(true);
  });

  it('sorts entries by start time and keeps invalid times last', () => {
    const sorted = sortScheduleEntries([
      entry({ id: 'a', time: '18:00' }),
      entry({ id: 'b', time: '09:30' }),
      entry({ id: 'c', time: 'TBC' }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual(['b', 'a', 'c']);
  });
});
