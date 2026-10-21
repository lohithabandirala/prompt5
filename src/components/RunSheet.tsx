'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ScheduleEntry } from '@/lib/schemas/event-plan';
import {
  detectScheduleConflicts,
  parseCalendarDate,
  sortScheduleEntries,
} from '@/lib/timeline/schedule';

interface RunSheetProps {
  entries: ScheduleEntry[];
  eventDate: string;
  eventName: string;
  onUpdate: (entries: ScheduleEntry[]) => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

const EMPTY_ENTRY = {
  time: '',
  endTime: '',
  activity: '',
  location: '',
  responsible: '',
  notes: '',
};

function formatEventDate(eventDate: string): string {
  const parts = parseCalendarDate(eventDate);
  if (!parts) return eventDate;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default function RunSheet({
  entries,
  eventDate,
  eventName,
  onUpdate,
  onRegenerate,
  isRegenerating,
}: RunSheetProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newEntry, setNewEntry] = useState({ ...EMPTY_ENTRY });

  const conflicts = useMemo(() => detectScheduleConflicts(entries), [entries]);

  const updateEntry = useCallback(
    (id: string, field: keyof ScheduleEntry, value: string | undefined) => {
      onUpdate(entries.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry)));
    },
    [entries, onUpdate]
  );

  const deleteEntry = useCallback(
    (id: string) => {
      onUpdate(entries.filter((entry) => entry.id !== id));
    },
    [entries, onUpdate]
  );

  const finishEditing = useCallback(() => {
    onUpdate(sortScheduleEntries(entries));
    setEditingId(null);
  }, [entries, onUpdate]);

  const addEntry = useCallback(() => {
    if (!newEntry.time || !newEntry.activity.trim()) return;

    const created: ScheduleEntry = {
      id: `run-custom-${Date.now()}`,
      time: newEntry.time,
      endTime: newEntry.endTime || undefined,
      activity: newEntry.activity.trim(),
      location: newEntry.location.trim() || undefined,
      responsible: newEntry.responsible.trim() || undefined,
      notes: newEntry.notes.trim() || undefined,
    };

    onUpdate(sortScheduleEntries([...entries, created]));
    setNewEntry({ ...EMPTY_ENTRY });
    setShowAdd(false);
  }, [newEntry, entries, onUpdate]);

  const formattedDate = formatEventDate(eventDate);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card card-body no-print">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="section-title">📅 Day-of run sheet</h3>
            <p className="text-sm text-slate-500">Schedule for {formattedDate}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowAdd((open) => !open)}
              className="btn btn-secondary btn-sm"
              aria-expanded={showAdd}
            >
              + Add entry
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn btn-ghost btn-sm"
              aria-label="Print run sheet"
            >
              🖨️ Print
            </button>
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                disabled={isRegenerating}
                className="btn btn-ghost btn-sm"
                aria-label="Regenerate run sheet"
              >
                {isRegenerating ? <span className="spinner" aria-hidden="true" /> : '🔄'} Regenerate
              </button>
            )}
          </div>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 no-print" role="alert">
          <p className="text-sm font-semibold text-amber-900">Possible double-booking</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-amber-800">
            {conflicts.map((conflict) => (
              <li key={`${conflict.firstEntryId}-${conflict.secondEntryId}-${conflict.resource}`}>
                {conflict.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showAdd && (
        <div className="card card-body no-print animate-fade-in">
          <h4 className="font-semibold text-slate-700 mb-3">New schedule entry</h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="run-time" className="label">Start time <span aria-hidden="true">*</span></label>
              <input
                type="time"
                id="run-time"
                className="input-field"
                value={newEntry.time}
                onChange={(event) => setNewEntry({ ...newEntry, time: event.target.value })}
                required
              />
            </div>
            <div>
              <label htmlFor="run-end" className="label">End time</label>
              <input
                type="time"
                id="run-end"
                className="input-field"
                value={newEntry.endTime}
                onChange={(event) => setNewEntry({ ...newEntry, endTime: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="run-activity" className="label">Activity <span aria-hidden="true">*</span></label>
              <input
                type="text"
                id="run-activity"
                className="input-field"
                value={newEntry.activity}
                onChange={(event) => setNewEntry({ ...newEntry, activity: event.target.value })}
                placeholder="e.g. Guest arrival"
                maxLength={200}
                required
              />
            </div>
            <div>
              <label htmlFor="run-location" className="label">Location</label>
              <input
                type="text"
                id="run-location"
                className="input-field"
                value={newEntry.location}
                onChange={(event) => setNewEntry({ ...newEntry, location: event.target.value })}
                maxLength={200}
              />
            </div>
            <div>
              <label htmlFor="run-resp" className="label">Responsible</label>
              <input
                type="text"
                id="run-resp"
                className="input-field"
                value={newEntry.responsible}
                onChange={(event) => setNewEntry({ ...newEntry, responsible: event.target.value })}
                placeholder="Person or role"
                maxLength={200}
              />
            </div>
            <div>
              <label htmlFor="run-notes" className="label">Notes</label>
              <input
                type="text"
                id="run-notes"
                className="input-field"
                value={newEntry.notes}
                onChange={(event) => setNewEntry({ ...newEntry, notes: event.target.value })}
                maxLength={500}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={addEntry}
              className="btn btn-primary btn-sm"
              disabled={!newEntry.time || !newEntry.activity.trim()}
            >
              Add to schedule
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="btn btn-ghost btn-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden print-full-width">
        <div className="hidden print:block px-6 py-4 border-b">
          <h2 className="text-xl font-bold">{eventName} — Day-of run sheet</h2>
          <p className="text-sm text-slate-500">{formattedDate}</p>
        </div>

        {entries.length === 0 ? (
          <div className="card-body text-center text-slate-500">
            <p>No run sheet entries yet. Add schedule items or regenerate the plan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Day-of run sheet">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th scope="col" className="text-left py-3 px-4 font-semibold text-slate-700">Time</th>
                  <th scope="col" className="text-left py-3 px-4 font-semibold text-slate-700">Activity</th>
                  <th scope="col" className="text-left py-3 px-4 font-semibold text-slate-700 hidden sm:table-cell">Location</th>
                  <th scope="col" className="text-left py-3 px-4 font-semibold text-slate-700 hidden md:table-cell">Who</th>
                  <th scope="col" className="text-left py-3 px-4 font-semibold text-slate-700 hidden lg:table-cell">Notes</th>
                  <th scope="col" className="py-3 px-4 no-print"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const isEditing = editingId === entry.id;
                  return (
                    <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 whitespace-nowrap align-top">
                        {isEditing ? (
                          <div className="flex flex-col gap-1">
                            <label htmlFor={`start-${entry.id}`} className="sr-only">Start time for {entry.activity}</label>
                            <input
                              type="time"
                              id={`start-${entry.id}`}
                              className="input-field text-sm"
                              value={entry.time}
                              onChange={(event) => updateEntry(entry.id, 'time', event.target.value)}
                            />
                            <label htmlFor={`end-${entry.id}`} className="sr-only">End time for {entry.activity}</label>
                            <input
                              type="time"
                              id={`end-${entry.id}`}
                              className="input-field text-sm"
                              value={entry.endTime ?? ''}
                              onChange={(event) =>
                                updateEntry(entry.id, 'endTime', event.target.value || undefined)
                              }
                            />
                          </div>
                        ) : (
                          <span className="font-mono font-bold text-slate-800">
                            {entry.time}
                            {entry.endTime ? ` – ${entry.endTime}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 align-top">
                        {isEditing ? (
                          <input
                            type="text"
                            className="input-field text-sm"
                            value={entry.activity}
                            onChange={(event) => updateEntry(entry.id, 'activity', event.target.value)}
                            maxLength={200}
                            aria-label={`Activity for ${entry.time} entry`}
                          />
                        ) : (
                          <span className="text-slate-700">{entry.activity}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 hidden sm:table-cell align-top">
                        {isEditing ? (
                          <input
                            type="text"
                            className="input-field text-sm"
                            value={entry.location ?? ''}
                            onChange={(event) =>
                              updateEntry(entry.id, 'location', event.target.value || undefined)
                            }
                            maxLength={200}
                            aria-label={`Location for ${entry.activity}`}
                          />
                        ) : (
                          entry.location || '—'
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 hidden md:table-cell align-top">
                        {isEditing ? (
                          <input
                            type="text"
                            className="input-field text-sm"
                            value={entry.responsible ?? ''}
                            onChange={(event) =>
                              updateEntry(entry.id, 'responsible', event.target.value || undefined)
                            }
                            maxLength={200}
                            aria-label={`Responsible person for ${entry.activity}`}
                          />
                        ) : (
                          entry.responsible || '—'
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-xs hidden lg:table-cell max-w-xs align-top">
                        {isEditing ? (
                          <input
                            type="text"
                            className="input-field text-sm"
                            value={entry.notes ?? ''}
                            onChange={(event) =>
                              updateEntry(entry.id, 'notes', event.target.value || undefined)
                            }
                            maxLength={500}
                            aria-label={`Notes for ${entry.activity}`}
                          />
                        ) : (
                          entry.notes || '—'
                        )}
                      </td>
                      <td className="py-3 px-2 no-print align-top">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => (isEditing ? finishEditing() : setEditingId(entry.id))}
                            className="text-slate-500 hover:text-indigo-700 p-1 text-xs"
                            aria-label={isEditing ? `Save changes to ${entry.activity}` : `Edit ${entry.activity}`}
                          >
                            {isEditing ? '✓ Done' : '✏️'}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteEntry(entry.id)}
                            className="text-slate-500 hover:text-red-700 p-1 text-xs"
                            aria-label={`Delete ${entry.activity}`}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 text-center no-print">
        Use Print for this view, or the report export for the complete planning pack.
      </p>
    </div>
  );
}
