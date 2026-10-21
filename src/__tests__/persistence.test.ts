/**
 * @jest-environment jsdom
 */
import {
  clearAllEvents,
  deleteEvent,
  getSavedEvent,
  getSavedEvents,
  parseSavedEvents,
  saveEvent,
  STORAGE_LIMIT,
} from '@/lib/persistence/plans';
import type { SavedEvent } from '@/lib/schemas/event-plan';
import { buildPlanFromAI } from '@/lib/plan/build-plan';
import { validAIPlan, validInput } from './fixtures/ai-plan';

const STORAGE_KEY = 'festiva-ai-events';

function savedEvent(overrides: Partial<SavedEvent> = {}): SavedEvent {
  const input = validInput();
  const plan = buildPlanFromAI(validAIPlan(), input);
  return {
    id: 'event-1',
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    input,
    plan,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

describe('parseSavedEvents', () => {
  it('returns an empty list for missing, malformed or non-array payloads', () => {
    expect(parseSavedEvents(null)).toEqual([]);
    expect(parseSavedEvents('{not json')).toEqual([]);
    expect(parseSavedEvents('{"id":"x"}')).toEqual([]);
  });

  it('validates every record and drops corrupted entries', () => {
    const valid = savedEvent();
    const raw = JSON.stringify([
      valid,
      { id: 'broken', input: null, plan: null },
      { ...valid, id: 'no-plan', plan: undefined },
      'not an object',
    ]);

    const parsed = parseSavedEvents(raw);
    expect(parsed.map((event) => event.id)).toEqual(['event-1', 'no-plan']);
  });

  it('rejects an event whose input no longer matches the schema', () => {
    const valid = savedEvent();
    const raw = JSON.stringify([
      {
        ...valid,
        input: { ...valid.input, totalBudget: -10 },
      },
    ]);

    expect(parseSavedEvents(raw)).toEqual([]);
  });

  it('sorts newest first and caps the number of restored events', () => {
    const events = Array.from({ length: STORAGE_LIMIT + 3 }, (_, index) =>
      savedEvent({
        id: `event-${index}`,
        updatedAt: new Date(2026, 0, index + 1).toISOString(),
      })
    );

    const parsed = parseSavedEvents(JSON.stringify(events));
    expect(parsed).toHaveLength(STORAGE_LIMIT);
    expect(parsed[0].id).toBe(`event-${STORAGE_LIMIT + 2}`);
  });
});

describe('localStorage persistence', () => {
  it('saves and restores an event round-trip', () => {
    const event = savedEvent();
    expect(saveEvent(event)).toBe(true);

    const restored = getSavedEvent(event.id);
    expect(restored).not.toBeNull();
    expect(restored?.input.location).toBe(event.input.location);
    expect(restored?.plan?.eventName).toBe(event.plan?.eventName);
    expect(restored?.plan?.budgetCategories).toHaveLength(
      event.plan?.budgetCategories.length ?? 0
    );
  });

  it('updates an existing event rather than duplicating it', () => {
    const event = savedEvent();
    saveEvent(event);
    saveEvent({ ...event, input: { ...event.input, location: 'Pune' } });

    const restored = getSavedEvents();
    expect(restored).toHaveLength(1);
    expect(restored[0].input.location).toBe('Pune');
  });

  it('refuses invalid data instead of writing it', () => {
    const invalid = { ...savedEvent(), input: { ...savedEvent().input, guestCount: 0 } };
    expect(saveEvent(invalid as SavedEvent)).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('reports quota failures instead of throwing', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(saveEvent(savedEvent())).toBe(false);
  });

  it('deletes one event and leaves the rest intact', () => {
    saveEvent(savedEvent({ id: 'event-1' }));
    saveEvent(savedEvent({ id: 'event-2' }));

    deleteEvent('event-1');

    expect(getSavedEvents().map((event) => event.id)).toEqual(['event-2']);
  });

  it('clears all events', () => {
    saveEvent(savedEvent());
    clearAllEvents();

    expect(getSavedEvents()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('survives corrupt JSON already present in storage', () => {
    localStorage.setItem(STORAGE_KEY, '<<<not-json>>>');
    expect(getSavedEvents()).toEqual([]);
    expect(() => saveEvent(savedEvent())).not.toThrow();
  });
});
