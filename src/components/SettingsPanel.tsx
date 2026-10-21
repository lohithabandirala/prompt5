'use client';

import { useEffect, useState } from 'react';
import { getJson } from '@/lib/api/client';
import { STORAGE_LIMIT } from '@/lib/persistence/plans';

interface SettingsPanelProps {
  eventCount: number;
  onClearAll: () => void;
}

interface HealthResponse {
  status: string;
  aiConfigured: boolean;
  model: string;
}

export default function SettingsPanel({ eventCount, onClearAll }: SettingsPanelProps) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getJson<HealthResponse>('/api/health', { signal: controller.signal })
      .then(setHealth)
      .catch((error: Error) => {
        if (error.name !== 'AbortError') {
          setHealthError('Could not check the AI service status.');
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card card-body">
        <h2 className="section-title">⚙️ Settings</h2>
        <p className="text-sm text-slate-500">
          Festiva AI runs without an account. Plans are stored only in this browser.
        </p>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Saved events
            </dt>
            <dd className="mt-1 text-lg font-bold text-slate-900">
              {eventCount} of {STORAGE_LIMIT}
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Older plans are removed automatically when the limit is reached.
              </span>
            </dd>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              AI planning service
            </dt>
            <dd className="mt-1 text-lg font-bold text-slate-900">
              {health ? (health.aiConfigured ? 'Configured' : 'Not configured') : 'Checking…'}
              <span
                className="mt-1 block text-xs font-normal text-slate-500"
                role="status"
                aria-live="polite"
              >
                {healthError
                  ? healthError
                  : health
                    ? health.aiConfigured
                      ? `Requests are processed server-side with ${health.model}.`
                      : 'Add GEMINI_API_KEY to the server environment to enable plan generation.'
                    : 'Contacting the server…'}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="card card-body">
        <h3 className="font-semibold text-slate-800">Privacy</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>
            Event details you enter are sent to the configured AI provider (Google Gemini) to
            generate the plan. They are not used to train a model by this application.
          </li>
          <li>
            Plans, edits, vendor notes and budget figures are stored in this browser&apos;s local
            storage. They are not uploaded to an application database.
          </li>
          <li>
            No attendee contact lists, home addresses, payment details or provider credentials are
            collected or stored.
          </li>
          <li>
            This application has no user accounts. Anyone with access to this browser profile can
            read locally saved plans.
          </li>
        </ul>
      </div>

      <div className="card card-body">
        <h3 className="font-semibold text-slate-800">Your data</h3>
        <p className="mt-1 text-sm text-slate-600">
          Deleting data removes every saved event from this browser. It cannot be undone.
        </p>
        <button
          type="button"
          onClick={onClearAll}
          className="btn btn-danger mt-4"
          disabled={eventCount === 0}
        >
          Delete all saved plans
        </button>
      </div>
    </div>
  );
}
