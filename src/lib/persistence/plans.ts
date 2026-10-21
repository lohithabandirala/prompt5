import { SavedEventSchema, type SavedEvent } from '../schemas/event-plan';

export type { SavedEvent };

const STORAGE_KEY = 'festiva-ai-events';
const MAX_SAVED_EVENTS = 50;

/**
 * Parse and validate the raw localStorage payload.
 *
 * Every record is validated against the runtime schema. Invalid or corrupted
 * records are discarded rather than rendered, so a manually edited or
 * partially-written localStorage entry can never inject unexpected shapes
 * into the UI.
 */
export function parseSavedEvents(raw: string | null): SavedEvent[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const valid: SavedEvent[] = [];
  for (const candidate of parsed) {
    const result = SavedEventSchema.safeParse(candidate);
    if (result.success) {
      valid.push(result.data);
    }
  }

  return valid
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, MAX_SAVED_EVENTS);
}

/**
 * Get all valid saved events from localStorage.
 */
export function getSavedEvents(): SavedEvent[] {
  if (typeof window === 'undefined') return [];

  try {
    return parseSavedEvents(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

/**
 * Get a specific saved event by ID.
 */
export function getSavedEvent(id: string): SavedEvent | null {
  return getSavedEvents().find((event) => event.id === id) ?? null;
}

/**
 * Save or update an event. Returns false when the data is invalid or the
 * browser storage quota is exhausted, so the UI can report a real failure.
 */
export function saveEvent(event: SavedEvent): boolean {
  if (typeof window === 'undefined') return false;

  const validation = SavedEventSchema.safeParse(event);
  if (!validation.success) return false;

  const events = getSavedEvents();
  const existingIndex = events.findIndex((entry) => entry.id === event.id);
  const nextEvent: SavedEvent = {
    ...validation.data,
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    events[existingIndex] = nextEvent;
  } else {
    events.unshift(nextEvent);
  }

  while (events.length > MAX_SAVED_EVENTS) {
    events.pop();
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete a saved event and all of its locally stored data.
 */
export function deleteEvent(id: string): void {
  if (typeof window === 'undefined') return;

  try {
    const events = getSavedEvents().filter((event) => event.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Storage may be unavailable (private mode / quota). Nothing else to do.
  }
}

/**
 * Remove every saved event from this browser.
 */
export function clearAllEvents(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}

export const STORAGE_LIMIT = MAX_SAVED_EVENTS;
