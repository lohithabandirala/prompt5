/**
 * Automated tests for the Event Planner core modules.
 * Run with: npx jest src/__tests__/
 */

import {
  calculateBudgetAllocations,
  validateBudgetTotal,
  calculateRemainingBudget,
  recalculatePercentage,
  formatCurrency,
  roundCurrency,
} from '../lib/budget/calculate';

import {
  calculateDueDates,
  isShortNotice,
  getDaysUntilEvent,
  sortTasks,
  calculateProgress,
  isTaskOverdue,
  groupTasksByPhase,
} from '../lib/timeline/schedule';

import type { TimelineTask } from '../lib/schemas/event-plan';

// ── Budget Tests ────────────────────────────────────────────────────────────

describe('Budget Calculator', () => {
  const mockCategories = [
    { name: 'Venue', allocatedPercentage: 40 },
    { name: 'Catering', allocatedPercentage: 30 },
    { name: 'Photography', allocatedPercentage: 20 },
    { name: 'Contingency', allocatedPercentage: 10, isContingency: true },
  ];

  describe('calculateBudgetAllocations', () => {
    it('should sum exactly to total budget', () => {
      const categories = calculateBudgetAllocations(10000, 'USD', mockCategories);
      const total = categories.reduce((sum, c) => sum + c.allocatedAmount, 0);
      // Allow for floating point representation only
      expect(Math.round(total * 100)).toBe(Math.round(10000 * 100));
    });

    it('should handle zero-decimal currency (JPY)', () => {
      const categories = calculateBudgetAllocations(100000, 'JPY', mockCategories);
      const total = categories.reduce((sum, c) => sum + c.allocatedAmount, 0);
      expect(total).toBe(100000);
      // All amounts should be integers
      categories.forEach((c) => {
        expect(Number.isInteger(c.allocatedAmount)).toBe(true);
      });
    });

    it('should normalize percentages that don\'t sum to 100', () => {
      const skewedCategories = [
        { name: 'A', allocatedPercentage: 25 },
        { name: 'B', allocatedPercentage: 25 },
        { name: 'C', allocatedPercentage: 25 },
        // Total is 75, not 100
      ];
      const categories = calculateBudgetAllocations(3000, 'USD', skewedCategories);
      const total = categories.reduce((sum, c) => sum + c.allocatedAmount, 0);
      expect(Math.round(total * 100)).toBe(Math.round(3000 * 100));
    });

    it('should mark contingency categories correctly', () => {
      const categories = calculateBudgetAllocations(10000, 'USD', mockCategories);
      const contingency = categories.find((c) => c.name === 'Contingency');
      expect(contingency?.isContingency).toBe(true);
    });

    it('should handle single category (100%)', () => {
      const single = [{ name: 'All', allocatedPercentage: 100 }];
      const categories = calculateBudgetAllocations(5000, 'USD', single);
      expect(categories[0].allocatedAmount).toBe(5000);
    });

    it('should handle budget of 1 with many categories', () => {
      const many = Array.from({ length: 3 }, (_, i) => ({
        name: `Cat ${i}`,
        allocatedPercentage: 33.333,
      }));
      const categories = calculateBudgetAllocations(1, 'USD', many);
      const total = categories.reduce((sum, c) => sum + c.allocatedAmount, 0);
      expect(Math.round(total * 100)).toBe(100);
    });
  });

  describe('validateBudgetTotal', () => {
    it('should validate when categories sum to total', () => {
      const categories = calculateBudgetAllocations(10000, 'USD', mockCategories);
      const result = validateBudgetTotal(categories, 10000, 'USD');
      expect(result.valid).toBe(true);
      expect(result.difference).toBe(0);
    });

    it('should detect over-budget', () => {
      const categories = calculateBudgetAllocations(10000, 'USD', mockCategories);
      // Manually inflate one category
      categories[0].allocatedAmount += 100;
      const result = validateBudgetTotal(categories, 10000, 'USD');
      expect(result.valid).toBe(false);
      expect(result.difference).toBeGreaterThan(0);
    });
  });

  describe('calculateRemainingBudget', () => {
    it('should return correct remaining when no actual spend', () => {
      const categories = calculateBudgetAllocations(10000, 'USD', mockCategories);
      const result = calculateRemainingBudget(10000, categories, 'USD');
      // planned = totalBudget, so remaining = 0
      expect(result.remaining).toBeCloseTo(0, 2);
      expect(result.isOverBudget).toBe(false);
    });

    it('should flag over-budget when actual exceeds total', () => {
      const categories = calculateBudgetAllocations(10000, 'USD', mockCategories);
      // Set all categories to actuals that sum to more than 10000
      categories.forEach((c) => { c.actualAmount = c.allocatedAmount * 1.5; });
      const result = calculateRemainingBudget(10000, categories, 'USD');
      expect(result.isOverBudget).toBe(true);
    });

    it('should identify contingency reserve', () => {
      const categories = calculateBudgetAllocations(10000, 'USD', mockCategories);
      const result = calculateRemainingBudget(10000, categories, 'USD');
      expect(result.contingencyReserve).toBeGreaterThan(0);
    });
  });

  describe('recalculatePercentage', () => {
    it('should compute correct percentage', () => {
      expect(recalculatePercentage(2500, 10000)).toBeCloseTo(25, 2);
    });

    it('should return 0 for zero total budget', () => {
      expect(recalculatePercentage(100, 0)).toBe(0);
    });
  });

  describe('formatCurrency', () => {
    it('should format USD correctly', () => {
      const formatted = formatCurrency(1234.56, 'USD');
      expect(formatted).toContain('1,234');
    });

    it('should format JPY without decimals', () => {
      const formatted = formatCurrency(100000, 'JPY');
      expect(formatted).not.toContain('.');
    });

    it('should handle invalid currency gracefully', () => {
      // Should fall back to manual formatting
      const formatted = formatCurrency(100, 'INVALID');
      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('100');
    });
  });

  describe('roundCurrency', () => {
    it('should round to 2 decimal places', () => {
      expect(roundCurrency(10.555, 2)).toBe(10.56);
    });

    it('should round to 0 decimal places for JPY-style', () => {
      expect(roundCurrency(100.5, 0)).toBe(101);
    });
  });
});

// ── Timeline Tests ──────────────────────────────────────────────────────────

describe('Timeline Scheduler', () => {
  const mockTasks: Omit<TimelineTask, 'dueDate'>[] = [
    {
      id: 'task-1',
      title: 'Book venue',
      phase: 'Early Planning',
      daysBeforeEvent: 180,
      priority: 'critical',
      status: 'not_started',
    },
    {
      id: 'task-2',
      title: 'Send invitations',
      phase: 'Preparation',
      daysBeforeEvent: 60,
      priority: 'high',
      status: 'not_started',
    },
    {
      id: 'task-3',
      title: 'Final headcount',
      phase: 'Final Week',
      daysBeforeEvent: 7,
      priority: 'medium',
      status: 'not_started',
    },
  ];

  describe('calculateDueDates', () => {
    it('should calculate correct due dates', () => {
      const eventDate = '2025-12-31';
      const tasks = calculateDueDates(mockTasks, eventDate);

      // Task 1: 180 days before 2025-12-31
      const task1Date = new Date('2025-12-31');
      task1Date.setDate(task1Date.getDate() - 180);
      expect(tasks[0].dueDate).toBe(task1Date.toISOString().split('T')[0]);

      // Task 3: 7 days before 2025-12-31
      const task3Date = new Date('2025-12-31');
      task3Date.setDate(task3Date.getDate() - 7);
      expect(tasks[2].dueDate).toBe(task3Date.toISOString().split('T')[0]);
    });

    it('should return ISO date strings', () => {
      const tasks = calculateDueDates(mockTasks, '2025-06-15');
      tasks.forEach((t) => {
        expect(t.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });
  });

  describe('isShortNotice', () => {
    it('should return true for event within 14 days', () => {
      const nearDate = new Date();
      nearDate.setDate(nearDate.getDate() + 7);
      expect(isShortNotice(nearDate.toISOString().split('T')[0])).toBe(true);
    });

    it('should return false for event more than 14 days away', () => {
      const farDate = new Date();
      farDate.setDate(farDate.getDate() + 60);
      expect(isShortNotice(farDate.toISOString().split('T')[0])).toBe(false);
    });

    it('should return false for past events', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      expect(isShortNotice(pastDate.toISOString().split('T')[0])).toBe(false);
    });
  });

  describe('getDaysUntilEvent', () => {
    it('should return positive number for future events', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const days = getDaysUntilEvent(futureDate.toISOString().split('T')[0]);
      expect(days).toBeGreaterThan(0);
    });
  });

  describe('calculateProgress', () => {
    it('should calculate 0% when no tasks completed', () => {
      const tasks = calculateDueDates(mockTasks, '2025-12-31');
      const progress = calculateProgress(tasks);
      expect(progress.percentage).toBe(0);
      expect(progress.completed).toBe(0);
      expect(progress.total).toBe(3);
    });

    it('should calculate 100% when all tasks completed', () => {
      const tasks = calculateDueDates(mockTasks, '2025-12-31').map((t) => ({
        ...t,
        status: 'completed' as const,
      }));
      const progress = calculateProgress(tasks);
      expect(progress.percentage).toBe(100);
    });

    it('should handle empty task list', () => {
      const progress = calculateProgress([]);
      expect(progress.percentage).toBe(0);
      expect(progress.total).toBe(0);
    });
  });

  describe('groupTasksByPhase', () => {
    it('should group tasks by phase correctly', () => {
      const tasks = calculateDueDates(mockTasks, '2025-12-31');
      const groups = groupTasksByPhase(tasks);
      expect(groups.has('Early Planning')).toBe(true);
      expect(groups.has('Preparation')).toBe(true);
      expect(groups.has('Final Week')).toBe(true);
      expect(groups.get('Early Planning')?.length).toBe(1);
    });
  });

  describe('sortTasks', () => {
    it('should sort by daysBeforeEvent descending (earliest tasks first)', () => {
      const tasks = calculateDueDates(mockTasks, '2025-12-31');
      const sorted = sortTasks(tasks);
      expect(sorted[0].daysBeforeEvent).toBe(180);
      expect(sorted[1].daysBeforeEvent).toBe(60);
      expect(sorted[2].daysBeforeEvent).toBe(7);
    });
  });

  describe('isTaskOverdue', () => {
    it('should return false for completed tasks regardless of date', () => {
      const pastTask: TimelineTask = {
        id: 'x',
        title: 'Old task',
        phase: 'P',
        daysBeforeEvent: 100,
        priority: 'low',
        status: 'completed',
        dueDate: '2020-01-01',
      };
      expect(isTaskOverdue(pastTask)).toBe(false);
    });

    it('should return true for non-completed tasks with past due date', () => {
      const overdueTask: TimelineTask = {
        id: 'y',
        title: 'Overdue task',
        phase: 'P',
        daysBeforeEvent: 100,
        priority: 'high',
        status: 'not_started',
        dueDate: '2020-01-01',
      };
      expect(isTaskOverdue(overdueTask)).toBe(true);
    });

    it('should return false for task with no due date', () => {
      const noDateTask: TimelineTask = {
        id: 'z',
        title: 'No date',
        phase: 'P',
        daysBeforeEvent: 10,
        priority: 'low',
        status: 'not_started',
      };
      expect(isTaskOverdue(noDateTask)).toBe(false);
    });
  });
});
