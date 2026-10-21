'use client';

import { useCallback, useMemo, useState } from 'react';
import type { CelebrationIdea } from '@/lib/schemas/event-plan';
import type { EventInput } from '@/lib/schemas/event-input';

interface IdeasPanelProps {
  ideas: CelebrationIdea[];
  themeInfo?: {
    theme: string;
    decorationIdeas?: string;
    venueIdeas?: string;
    entertainmentSuggestions?: string;
    foodConcepts?: string;
    guestEngagement?: string;
  };
  input: EventInput;
  onUpdate: (ideas: CelebrationIdea[]) => void;
  onRegenerateIdeas?: () => void;
  isRegenerating?: boolean;
}

const CARD_PALETTES = [
  { bg: 'bg-purple-50', textColor: 'text-purple-700', titleColor: 'text-purple-900', border: 'border-purple-100' },
  { bg: 'bg-blue-50', textColor: 'text-blue-700', titleColor: 'text-blue-900', border: 'border-blue-100' },
  { bg: 'bg-pink-50', textColor: 'text-pink-700', titleColor: 'text-pink-900', border: 'border-pink-100' },
  { bg: 'bg-amber-50', textColor: 'text-amber-700', titleColor: 'text-amber-900', border: 'border-amber-100' },
  { bg: 'bg-teal-50', textColor: 'text-teal-700', titleColor: 'text-teal-900', border: 'border-teal-100' },
  { bg: 'bg-rose-50', textColor: 'text-rose-700', titleColor: 'text-rose-900', border: 'border-rose-100' },
];

export default function IdeasPanel({
  ideas,
  themeInfo,
  input,
  onUpdate,
  onRegenerateIdeas,
  isRegenerating,
}: IdeasPanelProps) {
  const [savedOnly, setSavedOnly] = useState(false);

  const savedCount = useMemo(() => ideas.filter((idea) => idea.saved).length, [ideas]);
  const visibleIdeas = savedOnly ? ideas.filter((idea) => idea.saved) : ideas;

  const toggleSaved = useCallback(
    (id: string) => {
      onUpdate(ideas.map((idea) => (idea.id === id ? { ...idea, saved: !idea.saved } : idea)));
    },
    [ideas, onUpdate]
  );

  const discard = useCallback(
    (id: string) => {
      onUpdate(ideas.filter((idea) => idea.id !== id));
    },
    [ideas, onUpdate]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card card-body">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="section-title">💡 Personalised ideas &amp; inspiration</h3>
            {themeInfo && (
              <p className="text-sm text-slate-500">
                Curated for your {input.category} event with a <strong>{themeInfo.theme}</strong> theme.
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Save the ideas you want to keep. Discarded ideas return if you regenerate this section.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {savedCount > 0 && (
              <button
                type="button"
                onClick={() => setSavedOnly((value) => !value)}
                className={`btn btn-sm ${savedOnly ? 'btn-primary' : 'btn-ghost'}`}
                aria-pressed={savedOnly}
              >
                ★ Saved ({savedCount})
              </button>
            )}
            {onRegenerateIdeas && (
              <button
                type="button"
                onClick={onRegenerateIdeas}
                disabled={isRegenerating}
                className="btn btn-ghost btn-sm"
                aria-label="Regenerate celebration ideas"
              >
                {isRegenerating ? <span className="spinner" aria-hidden="true" /> : '🔄'} Fresh ideas
              </button>
            )}
          </div>
        </div>
      </div>

      {themeInfo && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {themeInfo.decorationIdeas && (
            <div className="card p-5 bg-fuchsia-50 border border-fuchsia-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl" aria-hidden="true">🌸</span>
                <h4 className="font-semibold text-fuchsia-900">Decoration ideas</h4>
              </div>
              <p className="text-sm leading-relaxed text-fuchsia-700">{themeInfo.decorationIdeas}</p>
            </div>
          )}
          {themeInfo.venueIdeas && (
            <div className="card p-5 bg-sky-50 border border-sky-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl" aria-hidden="true">🏛️</span>
                <h4 className="font-semibold text-sky-900">Venue ideas</h4>
              </div>
              <p className="text-sm leading-relaxed text-sky-700">{themeInfo.venueIdeas}</p>
            </div>
          )}
          {themeInfo.entertainmentSuggestions && (
            <div className="card p-5 bg-green-50 border border-green-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl" aria-hidden="true">🎭</span>
                <h4 className="font-semibold text-green-900">Entertainment</h4>
              </div>
              <p className="text-sm leading-relaxed text-green-700">{themeInfo.entertainmentSuggestions}</p>
            </div>
          )}
          {themeInfo.foodConcepts && (
            <div className="card p-5 bg-orange-50 border border-orange-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl" aria-hidden="true">🍽️</span>
                <h4 className="font-semibold text-orange-900">Food &amp; drink</h4>
              </div>
              <p className="text-sm leading-relaxed text-orange-700">{themeInfo.foodConcepts}</p>
            </div>
          )}
          {themeInfo.guestEngagement && (
            <div className="card p-5 bg-rose-50 border border-rose-100 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl" aria-hidden="true">🎉</span>
                <h4 className="font-semibold text-rose-900">Guest engagement</h4>
              </div>
              <p className="text-sm leading-relaxed text-rose-700">{themeInfo.guestEngagement}</p>
            </div>
          )}
        </div>
      )}

      {visibleIdeas.length > 0 && (
        <>
          <h4 className="font-semibold text-slate-700 px-1">
            {savedOnly ? '★ Saved ideas' : '✨ Unique celebration ideas'}
          </h4>
          <div className="columns-1 gap-4 space-y-4 sm:columns-2 lg:columns-3">
            {visibleIdeas.map((idea, index) => {
              const palette = CARD_PALETTES[index % CARD_PALETTES.length];
              return (
                <article
                  key={idea.id}
                  className={`break-inside-avoid card p-5 ${palette.bg} border ${palette.border} animate-fade-in`}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-start gap-2">
                      <span className="text-xl" aria-hidden="true">💡</span>
                      <h4 className={`font-semibold ${palette.titleColor}`}>{idea.title}</h4>
                    </div>
                    {idea.saved && (
                      <span className="badge badge-warning flex-shrink-0" aria-label="Saved idea">★</span>
                    )}
                  </div>

                  <p className={`text-sm leading-relaxed ${palette.textColor}`}>{idea.description}</p>

                  {idea.whyItFits && (
                    <p className={`text-xs mt-2 italic ${palette.textColor} opacity-80`}>
                      ✅ {idea.whyItFits}
                    </p>
                  )}
                  {idea.estimatedCost && (
                    <p className={`text-xs mt-1 font-medium ${palette.textColor}`}>
                      💰 Illustrative cost: {idea.estimatedCost}
                    </p>
                  )}
                  {idea.implementationSteps && idea.implementationSteps.length > 0 && (
                    <details className="mt-2">
                      <summary className={`text-xs cursor-pointer ${palette.textColor} font-medium`}>
                        Implementation steps
                      </summary>
                      <ol className={`mt-1 text-xs space-y-0.5 list-decimal list-inside ${palette.textColor} opacity-90`}>
                        {idea.implementationSteps.map((step, stepIndex) => (
                          <li key={stepIndex}>{step}</li>
                        ))}
                      </ol>
                    </details>
                  )}
                  {idea.tradeoffs && (
                    <p className={`text-xs mt-2 ${palette.textColor} opacity-70`}>
                      ⚖️ {idea.tradeoffs}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => toggleSaved(idea.id)}
                      className="btn btn-sm btn-ghost"
                      aria-pressed={idea.saved}
                      aria-label={idea.saved ? `Remove ${idea.title} from saved ideas` : `Save ${idea.title}`}
                    >
                      {idea.saved ? '★ Saved' : '☆ Save idea'}
                    </button>
                    <button
                      type="button"
                      onClick={() => discard(idea.id)}
                      className="btn btn-sm btn-ghost text-slate-500"
                      aria-label={`Discard ${idea.title}`}
                    >
                      Discard
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {visibleIdeas.length === 0 && (
        <div className="card card-body text-center text-slate-500">
          <p>
            {savedOnly
              ? 'No saved ideas yet. Save the ideas you like from the full list.'
              : 'No additional ideas generated. Try regenerating this section.'}
          </p>
        </div>
      )}

      {input.additionalNotes && (
        <div className="card card-body">
          <h4 className="font-semibold text-slate-700 mb-2">📌 Your additional notes</h4>
          <p className="text-sm text-slate-600 italic whitespace-pre-line">{input.additionalNotes}</p>
          <p className="text-xs text-slate-500 mt-2">These notes were used to personalise all ideas above.</p>
        </div>
      )}

      {input.style && (
        <div className="card card-body">
          <h4 className="font-semibold text-slate-700 mb-3">🎨 Your style preference</h4>
          <span className="badge badge-primary px-3 py-1.5 text-sm capitalize">{input.style}</span>
        </div>
      )}
    </div>
  );
}
