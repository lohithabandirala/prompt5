'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { z } from 'zod';
import type { EventInput } from '@/lib/schemas/event-input';
import { EventPlanSchema, type EventPlan, type RegenerateSection } from '@/lib/schemas/event-plan';
import { RegeneratedSectionPayloadSchema } from '@/lib/schemas/regenerate-payload';
import type { SavedEvent } from '@/lib/persistence/plans';
import {
  getSavedEvents,
  saveEvent,
  deleteEvent,
  clearAllEvents,
} from '@/lib/persistence/plans';
import { postJson, ApiError } from '@/lib/api/client';
import { mergeRegeneratedSection } from '@/lib/plan/merge';
import { buildRegenerationContext } from '@/lib/plan/section-context';

import EventWizard from '@/components/EventWizard';
import EventOverview from '@/components/EventOverview';
import BudgetPlanner from '@/components/BudgetPlanner';
import TimelinePlanner from '@/components/TimelinePlanner';
import VendorChecklist from '@/components/VendorChecklist';
import IdeasPanel from '@/components/IdeasPanel';
import RunSheet from '@/components/RunSheet';
import SavedEventsDashboard from '@/components/SavedEventsDashboard';
import SettingsPanel from '@/components/SettingsPanel';
import ExportBar from '@/components/ExportBar';
import ConfirmDialog from '@/components/ConfirmDialog';

type AppView = 'dashboard' | 'wizard' | 'plan' | 'settings';
type PlanTab = 'overview' | 'budget' | 'timeline' | 'vendors' | 'ideas' | 'schedule';

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

type DialogState =
  | { kind: 'delete'; id: string; title: string }
  | { kind: 'clear-all' }
  | null;

const PLAN_TABS: Array<{ id: PlanTab; label: string; emoji: string }> = [
  { id: 'overview', label: 'Overview', emoji: '📋' },
  { id: 'budget', label: 'Budget', emoji: '💰' },
  { id: 'timeline', label: 'Timeline', emoji: '📅' },
  { id: 'vendors', label: 'Vendors', emoji: '🤝' },
  { id: 'ideas', label: 'Ideas', emoji: '💡' },
  { id: 'schedule', label: 'Run sheet', emoji: '🗓️' },
];

const SECTION_LABEL: Record<RegenerateSection, string> = {
  theme: 'Theme',
  budget: 'Budget',
  timeline: 'Timeline',
  vendors: 'Vendor checklist',
  ideas: 'Ideas',
  schedule: 'Run sheet',
};

const PlanResponseSchema = z.object({ plan: EventPlanSchema });

// Hydration detection without a setState-in-effect: React uses the server
// snapshot during hydration, then re-renders with the client snapshot.
const subscribeToHydration = () => () => undefined;
const getClientHydratedSnapshot = () => true;
const getServerHydratedSnapshot = () => false;

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Home() {
  const [view, setView] = useState<AppView>('dashboard');
  const [activeTab, setActiveTab] = useState<PlanTab>('overview');
  const [savedEvents, setSavedEvents] = useState<SavedEvent[]>([]);
  const [currentEvent, setCurrentEvent] = useState<SavedEvent | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState<RegenerateSection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [editingDetails, setEditingDetails] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydratedSnapshot,
    getServerHydratedSnapshot
  );

  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const pendingSaveRef = useRef<SavedEvent | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshSavedEvents = useCallback(() => {
    setSavedEvents(getSavedEvents());
  }, []);

  useEffect(() => {
    // Load persisted plans after mount, then mirror changes made in other tabs.
    // This synchronises with an external store (localStorage); it is not
    // derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshSavedEvents();

    const handleStorage = () => refreshSavedEvents();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [refreshSavedEvents]);

  useEffect(() => {
    if (!isGenerating && !regenerating) return;

    const startedAt = Date.now();
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isGenerating, regenerating]);

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const target = pendingSaveRef.current;
    if (!target) return;

    pendingSaveRef.current = null;
    const ok = saveEvent(target);
    setSaveState(ok ? 'saved' : 'failed');
    if (ok) {
      refreshSavedEvents();
    } else {
      setError('Your latest changes could not be saved. Browser storage may be full or unavailable.');
    }
  }, [refreshSavedEvents]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const target = pendingSaveRef.current;
      if (target) saveEvent(target);
      abortRef.current?.abort();
    };
  }, []);

  const persist = useCallback(
    (event: SavedEvent, immediate = false) => {
      pendingSaveRef.current = event;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      if (immediate) {
        flushSave();
        return;
      }

      setSaveState('saving');
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        flushSave();
      }, 450);
    },
    [flushSave]
  );

  const goToDashboard = useCallback(() => {
    flushSave();
    refreshSavedEvents();
    setEditingDetails(false);
    setView('dashboard');
  }, [flushSave, refreshSavedEvents]);

  const startNewEvent = useCallback(() => {
    flushSave();
    setCurrentEvent(null);
    setEditingDetails(false);
    setActiveTab('overview');
    setError(null);
    setNotice(null);
    setView('wizard');
  }, [flushSave]);

  // ── Plan generation ────────────────────────────────────────────────────────

  const runGeneration = useCallback(
    async (input: EventInput, existing: SavedEvent | null) => {
      if (busyRef.current) return;
      busyRef.current = true;

      const controller = new AbortController();
      abortRef.current = controller;
      setIsGenerating(true);
      setElapsedSeconds(0);
      setError(null);
      setNotice(null);

      try {
        const response = await postJson<unknown>('/api/plan', input, {
          signal: controller.signal,
        });

        const parsed = PlanResponseSchema.safeParse(response);
        if (!parsed.success) {
          throw new ApiError(
            'The planning service returned an unreadable plan. Nothing was saved.',
            502,
            'INVALID_RESPONSE'
          );
        }

        const now = new Date().toISOString();
        const nextEvent: SavedEvent = existing
          ? {
              ...existing,
              input,
              plan: parsed.data.plan,
              updatedAt: now,
            }
          : {
              id: createId('event'),
              createdAt: now,
              updatedAt: now,
              input,
              plan: parsed.data.plan,
            };

        const saved = saveEvent(nextEvent);
        setCurrentEvent(nextEvent);
        setEditingDetails(false);
        setActiveTab('overview');
        setView('plan');
        setSaveState(saved ? 'saved' : 'failed');
        refreshSavedEvents();

        if (!saved) {
          setError(
            'The plan was generated but could not be saved in this browser. Export it now before leaving this page.'
          );
        } else {
          setNotice(
            existing
              ? 'Event details updated and the plan regenerated.'
              : 'Your plan is ready. Every section is editable.'
          );
        }
      } catch (caught) {
        if (caught instanceof ApiError && caught.code === 'CANCELLED') {
          setNotice('Generation cancelled. No plan was saved.');
        } else {
          setError(
            caught instanceof Error
              ? caught.message
              : 'The plan could not be generated. Please try again.'
          );
        }
      } finally {
        setIsGenerating(false);
        busyRef.current = false;
        abortRef.current = null;
      }
    },
    [refreshSavedEvents]
  );

  const handleWizardSubmit = useCallback(
    (input: EventInput) => {
      void runGeneration(input, editingDetails ? currentEvent : null);
    },
    [runGeneration, editingDetails, currentEvent]
  );

  // ── Plan editing ───────────────────────────────────────────────────────────

  const handlePlanUpdate = useCallback(
    (updates: Partial<EventPlan>) => {
      if (!currentEvent?.plan) return;

      const updatedEvent: SavedEvent = {
        ...currentEvent,
        updatedAt: new Date().toISOString(),
        plan: {
          ...currentEvent.plan,
          ...updates,
          updatedAt: new Date().toISOString(),
        },
      };

      setCurrentEvent(updatedEvent);
      persist(updatedEvent);
    },
    [currentEvent, persist]
  );

  const handleSaveNow = useCallback(() => {
    if (!currentEvent) return;
    pendingSaveRef.current = currentEvent;
    flushSave();
    setNotice('Plan saved in this browser.');
  }, [currentEvent, flushSave]);

  const handleRegenerate = useCallback(
    async (section: RegenerateSection) => {
      if (!currentEvent?.plan || busyRef.current) return;

      busyRef.current = true;
      const controller = new AbortController();
      abortRef.current = controller;
      setRegenerating(section);
      setElapsedSeconds(0);
      setError(null);
      setNotice(null);

      try {
        const currentSummary = buildRegenerationContext(currentEvent.plan, section);
        const response = await postJson<unknown>(
          '/api/regenerate',
          { section, input: currentEvent.input, currentSummary },
          { signal: controller.signal }
        );

        const parsed = RegeneratedSectionPayloadSchema.safeParse(response);
        if (!parsed.success || parsed.data.section !== section) {
          throw new ApiError(
            'The AI service returned an invalid section. Your existing plan was kept.',
            502,
            'INVALID_RESPONSE'
          );
        }

        const merged = mergeRegeneratedSection(currentEvent.plan, parsed.data);
        const updatedEvent: SavedEvent = {
          ...currentEvent,
          updatedAt: new Date().toISOString(),
          plan: {
            ...currentEvent.plan,
            ...merged,
            updatedAt: new Date().toISOString(),
          },
        };

        setCurrentEvent(updatedEvent);
        const saved = saveEvent(updatedEvent);
        setSaveState(saved ? 'saved' : 'failed');
        refreshSavedEvents();

        if (!saved) {
          setError('The section was updated but could not be saved in this browser.');
        } else {
          setNotice(
            `${SECTION_LABEL[section]} regenerated. Your edits in other sections were preserved.`
          );
        }
      } catch (caught) {
        if (caught instanceof ApiError && caught.code === 'CANCELLED') {
          setNotice('Regeneration cancelled. Your existing plan is unchanged.');
        } else {
          setError(
            caught instanceof Error ? caught.message : 'That section could not be regenerated.'
          );
        }
      } finally {
        setRegenerating(null);
        busyRef.current = false;
        abortRef.current = null;
      }
    },
    [currentEvent, refreshSavedEvents]
  );

  // ── Navigation and destructive actions ─────────────────────────────────────

  const handleLoadEvent = useCallback(
    (event: SavedEvent) => {
      flushSave();
      setCurrentEvent(event);
      setActiveTab('overview');
      setError(null);
      setNotice(null);
      setEditingDetails(false);
      setView('plan');
    },
    [flushSave]
  );

  const handleConfirmDialog = useCallback(() => {
    if (!dialog) return;

    if (dialog.kind === 'delete') {
      deleteEvent(dialog.id);
      if (currentEvent?.id === dialog.id) {
        setCurrentEvent(null);
        setView('dashboard');
      }
      refreshSavedEvents();
      setNotice(`Deleted “${dialog.title}”.`);
    } else if (dialog.kind === 'clear-all') {
      clearAllEvents();
      setSavedEvents([]);
      setCurrentEvent(null);
      setView('dashboard');
      setNotice('All saved plans were deleted from this browser.');
    }

    setDialog(null);
  }, [dialog, currentEvent, refreshSavedEvents]);

  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      let nextIndex: number | null = null;

      if (event.key === 'ArrowRight') nextIndex = (index + 1) % PLAN_TABS.length;
      else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + PLAN_TABS.length) % PLAN_TABS.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = PLAN_TABS.length - 1;

      if (nextIndex === null) return;
      event.preventDefault();
      const nextTab = PLAN_TABS[nextIndex];
      setActiveTab(nextTab.id);
      document.getElementById(`tab-${nextTab.id}`)?.focus();
    },
    []
  );

  const dialogCopy = (() => {
    if (!dialog) return null;
    if (dialog.kind === 'delete') {
      return {
        title: 'Delete this plan?',
        description: `“${dialog.title}” and all of its edits will be removed from this browser. This cannot be undone.`,
        confirmLabel: 'Delete plan',
        destructive: true,
      };
    }
    return {
      title: 'Delete all saved plans?',
      description:
        'Every saved event, budget edit, vendor note and checklist in this browser will be removed. This cannot be undone.',
      confirmLabel: 'Delete everything',
      destructive: true,
    };
  })();

  const saveStatusText =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
        ? 'Saved in this browser'
        : saveState === 'failed'
          ? 'Not saved'
          : '';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-100"
      data-app-ready={hydrated ? 'true' : undefined}
    >
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/85 backdrop-blur-md no-print">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={goToDashboard}
            className="flex items-center gap-2 group"
            aria-label="Festiva AI home"
          >
            <span className="text-2xl" aria-hidden="true">🎊</span>
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-xl font-bold text-transparent">
              Festiva AI
            </span>
          </button>

          <div className="flex flex-wrap items-center gap-1.5">
            {view === 'plan' && currentEvent?.plan && (
              <button type="button" onClick={handleSaveNow} className="btn btn-ghost btn-sm">
                💾 Save
              </button>
            )}
            {view !== 'wizard' && (
              <button type="button" onClick={startNewEvent} className="btn btn-primary btn-sm">
                + New event
              </button>
            )}
            {view !== 'dashboard' && (
              <button type="button" onClick={goToDashboard} className="btn btn-ghost btn-sm">
                📁 My events
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                flushSave();
                setView('settings');
              }}
              className="btn btn-ghost btn-sm"
              aria-label="Settings and privacy"
              aria-pressed={view === 'settings'}
            >
              ⚙️
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4"
          >
            <div>
              <p className="font-semibold text-red-800">Something went wrong</p>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="flex-shrink-0 text-red-500 hover:text-red-700"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        <p role="status" aria-live="polite" className="sr-only">
          {notice ?? ''}
        </p>
        {notice && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-sm text-emerald-900">{notice}</p>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="flex-shrink-0 text-emerald-800 hover:text-emerald-950"
              aria-label="Dismiss message"
            >
              ✕
            </button>
          </div>
        )}

        {view === 'dashboard' && (
          <SavedEventsDashboard
            plans={savedEvents}
            onLoad={handleLoadEvent}
            onRequestDelete={(id) => {
              const target = savedEvents.find((event) => event.id === id);
              setDialog({
                kind: 'delete',
                id,
                title: target?.plan?.eventName ?? 'Untitled event',
              });
            }}
            onCreateNew={startNewEvent}
          />
        )}

        {view === 'settings' && (
          <SettingsPanel
            eventCount={savedEvents.length}
            onClearAll={() => setDialog({ kind: 'clear-all' })}
          />
        )}

        {view === 'wizard' && (
          <div className="mx-auto max-w-3xl">
            {editingDetails && currentEvent && (
              <button
                type="button"
                onClick={() => {
                  setEditingDetails(false);
                  setView('plan');
                }}
                className="btn btn-ghost btn-sm mb-4"
              >
                ← Cancel and return to plan
              </button>
            )}
            <EventWizard
              key={editingDetails ? `edit-${currentEvent?.id}` : 'new-event'}
              onSubmit={handleWizardSubmit}
              isLoading={isGenerating}
              initialData={editingDetails ? currentEvent?.input : undefined}
              editing={editingDetails}
              submitLabel={editingDetails ? 'Update details & regenerate plan' : undefined}
            />
          </div>
        )}

        {view === 'plan' && currentEvent?.plan && (
          <div>
            <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Current plan
                </p>
                <h1 className="text-xl font-bold text-slate-900">{currentEvent.plan.eventName}</h1>
                <p className="text-xs text-slate-500" role="status" aria-live="polite">
                  {saveStatusText}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ExportBar event={currentEvent} />
                <button
                  type="button"
                  onClick={() => {
                    setDialog({
                      kind: 'delete',
                      id: currentEvent.id,
                      title: currentEvent.plan?.eventName ?? 'Untitled event',
                    });
                  }}
                  className="btn btn-ghost btn-sm text-red-700"
                >
                  Delete plan
                </button>
              </div>
            </div>

            <div className="mb-6">
              <div
                className="no-print flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1"
                role="tablist"
                aria-label="Event plan sections"
              >
                {PLAN_TABS.map((tab, index) => (
                  <button
                    key={tab.id}
                    id={`tab-${tab.id}`}
                    role="tab"
                    type="button"
                    aria-selected={activeTab === tab.id}
                    aria-controls={`tabpanel-${tab.id}`}
                    tabIndex={activeTab === tab.id ? 0 : -1}
                    onClick={() => setActiveTab(tab.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span aria-hidden="true">{tab.emoji}</span>
                    {tab.label}
                    {regenerating === tab.id && (
                      <span className="spinner h-3 w-3" aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div
              id={`tabpanel-${activeTab}`}
              role="tabpanel"
              aria-labelledby={`tab-${activeTab}`}
              tabIndex={0}
            >
              {activeTab === 'overview' && (
                <EventOverview
                  plan={currentEvent.plan}
                  input={currentEvent.input}
                  onRegenerateTheme={() => handleRegenerate('theme')}
                  isRegenerating={regenerating === 'theme'}
                  onEditDetails={() => {
                    flushSave();
                    setEditingDetails(true);
                    setView('wizard');
                  }}
                />
              )}

              {activeTab === 'budget' && (
                <BudgetPlanner
                  categories={currentEvent.plan.budgetCategories}
                  totalBudget={currentEvent.input.totalBudget}
                  currency={currentEvent.input.currency}
                  onUpdate={(categories) => handlePlanUpdate({ budgetCategories: categories })}
                  onRegenerate={() => handleRegenerate('budget')}
                  isRegenerating={regenerating === 'budget'}
                />
              )}

              {activeTab === 'timeline' && (
                <TimelinePlanner
                  tasks={currentEvent.plan.timelineTasks}
                  eventDate={currentEvent.input.eventDate}
                  onUpdate={(tasks) => handlePlanUpdate({ timelineTasks: tasks })}
                  onRegenerate={() => handleRegenerate('timeline')}
                  isRegenerating={regenerating === 'timeline'}
                />
              )}

              {activeTab === 'vendors' && (
                <VendorChecklist
                  vendors={currentEvent.plan.vendorEntries}
                  currency={currentEvent.input.currency}
                  onUpdate={(vendors) => handlePlanUpdate({ vendorEntries: vendors })}
                  onRegenerate={() => handleRegenerate('vendors')}
                  isRegenerating={regenerating === 'vendors'}
                />
              )}

              {activeTab === 'ideas' && (
                <IdeasPanel
                  ideas={currentEvent.plan.celebrationIdeas}
                  themeInfo={{
                    theme: currentEvent.plan.recommendedTheme,
                    decorationIdeas: currentEvent.plan.decorationIdeas,
                    venueIdeas: currentEvent.plan.venueIdeas,
                    entertainmentSuggestions: currentEvent.plan.entertainmentSuggestions,
                    foodConcepts: currentEvent.plan.foodConcepts,
                    guestEngagement: currentEvent.plan.guestEngagement,
                  }}
                  input={currentEvent.input}
                  onUpdate={(ideas) => handlePlanUpdate({ celebrationIdeas: ideas })}
                  onRegenerateIdeas={() => handleRegenerate('ideas')}
                  isRegenerating={regenerating === 'ideas'}
                />
              )}

              {activeTab === 'schedule' && (
                <RunSheet
                  entries={currentEvent.plan.eventDaySchedule}
                  eventDate={currentEvent.input.eventDate}
                  eventName={currentEvent.plan.eventName}
                  onUpdate={(entries) => handlePlanUpdate({ eventDaySchedule: entries })}
                  onRegenerate={() => handleRegenerate('schedule')}
                  isRegenerating={regenerating === 'schedule'}
                />
              )}
            </div>
          </div>
        )}

        {view === 'plan' && currentEvent && !currentEvent.plan && (
          <div className="card card-body mx-auto max-w-lg text-center">
            <div className="mb-3 text-5xl" aria-hidden="true">📝</div>
            <h2 className="text-xl font-bold text-slate-800">No plan generated yet</h2>
            <p className="mt-2 text-sm text-slate-500">
              The saved event details are intact, but this browser has no generated plan for it.
            </p>
            <button
              type="button"
              onClick={() => void runGeneration(currentEvent.input, currentEvent)}
              className="btn btn-primary mx-auto mt-4"
              disabled={isGenerating}
            >
              Generate plan
            </button>
          </div>
        )}
      </main>

      <footer className="no-print mt-16 border-t border-slate-200 bg-white/60 py-8 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-slate-500 sm:px-6 lg:px-8">
          <p>🎊 <strong>Festiva AI</strong> — an AI-assisted celebration planner</p>
          <p className="mt-1">
            Plans are illustrative estimates. Verify vendor pricing, availability and legal
            requirements independently. Saved locally in this browser; no account required.
          </p>
          <button
            type="button"
            onClick={() => {
              flushSave();
              setView('settings');
            }}
            className="mt-2 text-xs font-medium text-indigo-700 hover:underline"
          >
            Privacy and data settings
          </button>
        </div>
      </footer>

      {/* Real generation progress, cancellable */}
      {(isGenerating || regenerating) && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="generation-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl">
            <div className="mb-4 text-5xl" aria-hidden="true">✨</div>
            <h2 id="generation-title" className="mb-2 text-xl font-bold text-slate-900">
              {regenerating ? `Regenerating ${SECTION_LABEL[regenerating].toLowerCase()}…` : 'Creating your plan…'}
            </h2>
            <p className="mb-4 text-sm text-slate-500">
              {regenerating
                ? 'Only this section is regenerated. Your other edits stay untouched.'
                : 'This usually takes 10–30 seconds. The plan is not saved until the AI returns a valid response.'}
            </p>
            <div className="mb-4 flex justify-center">
              <span
                className="spinner"
                style={{ width: '2rem', height: '2rem', borderWidth: '3px' }}
                aria-hidden="true"
              />
            </div>
            <p className="mb-4 text-xs text-slate-500" aria-live="polite">
              {elapsedSeconds}s elapsed
            </p>
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="btn btn-ghost btn-sm"
            >
              Cancel request
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={dialog !== null}
        title={dialogCopy?.title ?? ''}
        description={dialogCopy?.description ?? ''}
        confirmLabel={dialogCopy?.confirmLabel}
        destructive={dialogCopy?.destructive}
        onConfirm={handleConfirmDialog}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}
