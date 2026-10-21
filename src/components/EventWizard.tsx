'use client';

import { useState, useCallback } from 'react';
import type { EventInput } from '@/lib/schemas/event-input';
import {
  EventCategory,
  EventInputSchema,
  EventStyle,
  VenuePreference,
  PlanningGoal,
  SUPPORTED_CURRENCIES,
  MAX_TEXT_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_GUEST_COUNT,
  MAX_BUDGET,
  MIN_BUDGET,
} from '@/lib/schemas/event-input';
import { isDateInPast, todayCalendarDate } from '@/lib/timeline/schedule';

interface EventWizardProps {
  onSubmit: (input: EventInput) => void;
  isLoading: boolean;
  initialData?: Partial<EventInput>;
  submitLabel?: string;
  editing?: boolean;
}

const CATEGORY_INFO = {
  wedding: { emoji: '💍', label: 'Wedding', desc: 'Ceremony & reception planning' },
  birthday: { emoji: '🎂', label: 'Birthday', desc: 'Birthday celebration for any age' },
  community: { emoji: '🎪', label: 'Community Event', desc: 'Community gathering or festival' },
};

const STYLE_OPTIONS = EventStyle.options;
const VENUE_OPTIONS = VenuePreference.options;
const GOAL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'low_cost', label: '💰 Low Cost' },
  { value: 'memorable_experience', label: '✨ Memorable Experience' },
  { value: 'elegance', label: '🎩 Elegance' },
  { value: 'sustainability', label: '🌿 Sustainability' },
  { value: 'guest_engagement', label: '🎉 Guest Engagement' },
  { value: 'cultural_authenticity', label: '🏛️ Cultural Authenticity' },
  { value: 'family_friendly', label: '👨‍👩‍👧‍👦 Family Friendly' },
  { value: 'unique_theme', label: '🎨 Unique Theme' },
];

type FormErrors = Partial<Record<keyof EventInput, string>>;

export default function EventWizard({ onSubmit, isLoading, initialData, submitLabel, editing }: EventWizardProps) {
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FormErrors>({});
  const [form, setForm] = useState<Partial<EventInput>>({
    category: initialData?.category || undefined,
    eventDate: initialData?.eventDate || '',
    location: initialData?.location || '',
    currency: initialData?.currency || 'USD',
    totalBudget: initialData?.totalBudget || undefined,
    guestCount: initialData?.guestCount || undefined,
    theme: initialData?.theme || '',
    style: initialData?.style || 'casual',
    venuePreference: initialData?.venuePreference || 'flexible',
    foodPreferences: initialData?.foodPreferences || '',
    culturalTraditions: initialData?.culturalTraditions || '',
    dietaryRequirements: initialData?.dietaryRequirements || [],
    accessibilityNeeds: initialData?.accessibilityNeeds || '',
    colorPalette: initialData?.colorPalette || [],
    goals: initialData?.goals || [],
    additionalNotes: initialData?.additionalNotes || '',
  });

  const [dietaryInput, setDietaryInput] = useState('');
  const [colorInput, setColorInput] = useState('');

  const updateField = useCallback(<K extends keyof EventInput>(field: K, value: EventInput[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  const collectStepErrors = (stepIndex: number): FormErrors => {
    const newErrors: FormErrors = {};

    if (stepIndex === 0) {
      if (!form.category) newErrors.category = 'Please select an event type';
    }

    if (stepIndex === 1) {
      if (!form.eventDate) {
        newErrors.eventDate = 'Event date is required';
      } else {
        const date = new Date(form.eventDate);
        if (Number.isNaN(date.getTime())) {
          newErrors.eventDate = 'Enter a valid calendar date';
        } else if (isDateInPast(form.eventDate)) {
          newErrors.eventDate = 'Choose today or a future date. Past events cannot be planned.';
        } else {
          const maxDate = new Date();
          maxDate.setFullYear(maxDate.getFullYear() + 5);
          if (date > maxDate) {
            newErrors.eventDate = 'Event date must be within the next five years';
          }
        }
      }

      if (!form.location?.trim()) {
        newErrors.location = 'Location is required';
      } else if (form.location.length > 200) {
        newErrors.location = 'Location must be at most 200 characters';
      }

      if (!form.currency) {
        newErrors.currency = 'Currency is required';
      }

      if (typeof form.totalBudget !== 'number' || !Number.isFinite(form.totalBudget)) {
        newErrors.totalBudget = 'Enter a valid budget amount';
      } else if (form.totalBudget < MIN_BUDGET) {
        newErrors.totalBudget = `Budget must be at least ${MIN_BUDGET}`;
      } else if (form.totalBudget > MAX_BUDGET) {
        newErrors.totalBudget = `Budget must be at most ${MAX_BUDGET.toLocaleString()}`;
      }

      if (typeof form.guestCount !== 'number' || !Number.isFinite(form.guestCount)) {
        newErrors.guestCount = 'Enter a valid guest count';
      } else if (form.guestCount < 1) {
        newErrors.guestCount = 'At least 1 guest is required';
      } else if (form.guestCount > MAX_GUEST_COUNT) {
        newErrors.guestCount = `Maximum ${MAX_GUEST_COUNT.toLocaleString()} guests`;
      } else if (!Number.isInteger(form.guestCount)) {
        newErrors.guestCount = 'Guest count must be a whole number';
      }
    }

    return newErrors;
  };

  const validateStep = (stepIndex: number): boolean => {
    const newErrors = collectStepErrors(stepIndex);
    setErrors((previous) => {
      const next = { ...previous };
      if (stepIndex === 0) delete next.category;
      if (stepIndex === 1) {
        delete next.eventDate;
        delete next.location;
        delete next.currency;
        delete next.totalBudget;
        delete next.guestCount;
      }
      return { ...next, ...newErrors };
    });
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((current) => Math.min(current + 1, 2));
    }
  };

  const handleBack = () => setStep((current) => Math.max(current - 1, 0));

  const handleSubmit = () => {
    const baseErrors = { ...collectStepErrors(0), ...collectStepErrors(1) };
    if (Object.keys(baseErrors).length > 0) {
      setErrors(baseErrors);
      setStep(baseErrors.category ? 0 : 1);
      return;
    }

    const result = EventInputSchema.safeParse(form);
    if (!result.success) {
      const schemaErrors: FormErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof EventInput | undefined;
        if (field && !schemaErrors[field]) {
          schemaErrors[field] = issue.message;
        }
      }
      setErrors((previous) => ({ ...previous, ...schemaErrors }));
      setStep(2);
      return;
    }

    setErrors({});
    onSubmit(result.data);
  };

  const addDietary = () => {
    if (dietaryInput.trim() && (form.dietaryRequirements?.length || 0) < 20) {
      updateField('dietaryRequirements', [...(form.dietaryRequirements || []), dietaryInput.trim()]);
      setDietaryInput('');
    }
  };

  const removeDietary = (index: number) => {
    const updated = [...(form.dietaryRequirements || [])];
    updated.splice(index, 1);
    updateField('dietaryRequirements', updated);
  };

  const addColor = () => {
    if (colorInput.trim() && (form.colorPalette?.length || 0) < 5) {
      updateField('colorPalette', [...(form.colorPalette || []), colorInput.trim()]);
      setColorInput('');
    }
  };

  const removeColor = (index: number) => {
    const updated = [...(form.colorPalette || [])];
    updated.splice(index, 1);
    updateField('colorPalette', updated);
  };

  const toggleGoal = (goal: string) => {
    const current = form.goals || [];
    if (current.includes(goal as EventInput['goals'][number])) {
      updateField('goals', current.filter((g) => g !== goal) as EventInput['goals']);
    } else if (current.length < 5) {
      updateField('goals', [...current, goal] as EventInput['goals']);
    }
  };

  const today = todayCalendarDate();
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 5);
  const maxDateValue = maxDate.toISOString().slice(0, 10);
  const isPastDate = Boolean(form.eventDate) && isDateInPast(form.eventDate!);

  return (
    <div className="card max-w-2xl mx-auto" role="form" aria-label="Event creation wizard">
      {/* Step indicator */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-100">
        <nav aria-label="Wizard progress">
          <ol className="flex items-center gap-2 text-sm">
            {['Event Type', 'Event Details', 'Personalization'].map((label, i) => (
              <li key={label} className="flex items-center gap-2">
                <button
                  onClick={() => i < step && setStep(i)}
                  disabled={i > step}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-colors ${
                    i === step
                      ? 'bg-indigo-600 text-white'
                      : i < step
                      ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                  aria-current={i === step ? 'step' : undefined}
                >
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">
                    {i < step ? '✓' : i + 1}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </button>
                {i < 2 && (
                  <span className="w-8 h-0.5 bg-slate-200" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </nav>
      </div>

      <div className="card-body animate-fade-in">
        {/* Step 0: Event Type */}
        {step === 0 && (
          <fieldset>
            <legend className="section-title">What are you celebrating?</legend>
            <p className="text-slate-500 text-sm mb-6">Choose the type of event you&apos;re planning.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {EventCategory.options.map((cat) => {
                const info = CATEGORY_INFO[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => updateField('category', cat)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      form.category === cat
                        ? 'border-indigo-500 bg-indigo-50 shadow-md'
                        : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                    }`}
                    aria-pressed={form.category === cat}
                  >
                    <span className="text-2xl">{info.emoji}</span>
                    <p className="font-semibold mt-2">{info.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{info.desc}</p>
                  </button>
                );
              })}
            </div>
            {errors.category && (
              <p className="error-text mt-2" role="alert">{errors.category}</p>
            )}
          </fieldset>
        )}

        {/* Step 1: Event Details */}
        {step === 1 && (
          <fieldset>
            <legend className="section-title">Event Details</legend>
            <p className="text-slate-500 text-sm mb-6">Tell us the essentials about your event.</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="eventDate" className="label">
                  Event Date <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  type="date"
                  id="eventDate"
                  className={`input-field ${errors.eventDate ? 'input-error' : ''}`}
                  value={form.eventDate || ''}
                  onChange={(e) => updateField('eventDate', e.target.value)}
                  min={today}
                  max={maxDateValue}
                  aria-required="true"
                  aria-invalid={!!errors.eventDate}
                  aria-describedby={errors.eventDate ? 'eventDate-error' : 'eventDate-hint'}
                />
                <p id="eventDate-hint" className="mt-1 text-xs text-slate-500">
                  Past dates cannot be planned. Dates up to five years ahead are supported.
                </p>
                {errors.eventDate && (
                  <p id="eventDate-error" className="error-text" role="alert">{errors.eventDate}</p>
                )}
                {isPastDate && !errors.eventDate && (
                  <p className="mt-1 text-xs text-amber-700" role="alert">
                    This date is in the past. Pick today or a future date to generate a plan.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="location" className="label">
                  Location <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  type="text"
                  id="location"
                  className={`input-field ${errors.location ? 'input-error' : ''}`}
                  value={form.location || ''}
                  onChange={(e) => updateField('location', e.target.value)}
                  placeholder="City, Region, or Country"
                  maxLength={200}
                  aria-required="true"
                  aria-invalid={!!errors.location}
                  aria-describedby={errors.location ? 'location-error' : undefined}
                />
                {errors.location && (
                  <p id="location-error" className="error-text" role="alert">{errors.location}</p>
                )}
              </div>

              <div>
                <label htmlFor="currency" className="label">
                  Currency <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <select
                  id="currency"
                  className={`input-field ${errors.currency ? 'input-error' : ''}`}
                  value={form.currency || 'USD'}
                  onChange={(e) => updateField('currency', e.target.value as EventInput['currency'])}
                  aria-required="true"
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="totalBudget" className="label">
                  Total Budget <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  type="number"
                  id="totalBudget"
                  className={`input-field ${errors.totalBudget ? 'input-error' : ''}`}
                  value={form.totalBudget ?? ''}
                  onChange={(e) => updateField('totalBudget', e.target.value ? Number(e.target.value) : undefined as unknown as number)}
                  placeholder="e.g. 5000"
                  min={MIN_BUDGET}
                  max={MAX_BUDGET}
                  step="1"
                  aria-required="true"
                  aria-invalid={!!errors.totalBudget}
                  aria-describedby={errors.totalBudget ? 'budget-error' : undefined}
                />
                {errors.totalBudget && (
                  <p id="budget-error" className="error-text" role="alert">{errors.totalBudget}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="guestCount" className="label">
                  Guest Count <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  type="number"
                  id="guestCount"
                  className={`input-field max-w-xs ${errors.guestCount ? 'input-error' : ''}`}
                  value={form.guestCount ?? ''}
                  onChange={(e) => updateField('guestCount', e.target.value ? Number(e.target.value) : undefined as unknown as number)}
                  placeholder="e.g. 50"
                  min={1}
                  max={MAX_GUEST_COUNT}
                  step="1"
                  aria-required="true"
                  aria-invalid={!!errors.guestCount}
                  aria-describedby={errors.guestCount ? 'guest-error' : undefined}
                />
                {errors.guestCount && (
                  <p id="guest-error" className="error-text" role="alert">{errors.guestCount}</p>
                )}
              </div>
            </div>
          </fieldset>
        )}

        {/* Step 2: Personalization */}
        {step === 2 && (
          <fieldset>
            <legend className="section-title">Personalize Your Event</legend>
            <p className="text-slate-500 text-sm mb-6">Optional details to help us create the perfect plan. Skip anything that doesn&apos;t apply.</p>

            {Object.entries(errors)
              .filter(([field]) =>
                !['category', 'eventDate', 'location', 'currency', 'totalBudget', 'guestCount'].includes(field)
              )
              .length > 0 && (
              <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-semibold text-red-800">Please correct these details:</p>
                <ul className="mt-1 list-disc pl-5 text-sm text-red-700">
                  {Object.entries(errors)
                    .filter(([field]) =>
                      !['category', 'eventDate', 'location', 'currency', 'totalBudget', 'guestCount'].includes(field)
                    )
                    .map(([field, message]) => (
                      <li key={field}>{message}</li>
                    ))}
                </ul>
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label htmlFor="theme" className="label">Theme or Aesthetic</label>
                <input
                  type="text"
                  id="theme"
                  className="input-field"
                  value={form.theme || ''}
                  onChange={(e) => updateField('theme', e.target.value)}
                  placeholder="e.g. Enchanted Garden, Retro 80s"
                  maxLength={MAX_TEXT_LENGTH}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="style" className="label">Style</label>
                  <select
                    id="style"
                    className="input-field"
                    value={form.style || 'casual'}
                    onChange={(e) => updateField('style', e.target.value as EventInput['style'])}
                  >
                    {STYLE_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="venuePreference" className="label">Venue Preference</label>
                  <select
                    id="venuePreference"
                    className="input-field"
                    value={form.venuePreference || 'flexible'}
                    onChange={(e) => updateField('venuePreference', e.target.value as EventInput['venuePreference'])}
                  >
                    {VENUE_OPTIONS.map((v) => (
                      <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="foodPreferences" className="label">Food & Catering Preferences</label>
                <input
                  type="text"
                  id="foodPreferences"
                  className="input-field"
                  value={form.foodPreferences || ''}
                  onChange={(e) => updateField('foodPreferences', e.target.value)}
                  placeholder="e.g. Indian buffet, vegan options, BBQ"
                  maxLength={MAX_TEXT_LENGTH}
                />
              </div>

              <div>
                <label htmlFor="culturalTraditions" className="label">Cultural or Family Traditions</label>
                <input
                  type="text"
                  id="culturalTraditions"
                  className="input-field"
                  value={form.culturalTraditions || ''}
                  onChange={(e) => updateField('culturalTraditions', e.target.value)}
                  placeholder="e.g. Mehndi ceremony, lantern release, special dances"
                  maxLength={MAX_TEXT_LENGTH}
                />
              </div>

              {/* Dietary Requirements */}
              <div>
                <label htmlFor="dietaryInput" className="label">Dietary Requirements</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="dietaryInput"
                    className="input-field flex-1"
                    value={dietaryInput}
                    onChange={(e) => setDietaryInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDietary())}
                    placeholder="e.g. Gluten-free, Halal, Nut allergy"
                    maxLength={100}
                  />
                  <button type="button" onClick={addDietary} className="btn btn-secondary btn-sm">Add</button>
                </div>
                {form.dietaryRequirements && form.dietaryRequirements.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.dietaryRequirements.map((d, i) => (
                      <span key={i} className="badge badge-info flex items-center gap-1">
                        {d}
                        <button
                          type="button"
                          onClick={() => removeDietary(i)}
                          className="text-blue-600 hover:text-blue-800 ml-1"
                          aria-label={`Remove ${d}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="accessibilityNeeds" className="label">Accessibility Considerations</label>
                <input
                  type="text"
                  id="accessibilityNeeds"
                  className="input-field"
                  value={form.accessibilityNeeds || ''}
                  onChange={(e) => updateField('accessibilityNeeds', e.target.value)}
                  placeholder="e.g. Wheelchair access, hearing loop, quiet area"
                  maxLength={MAX_TEXT_LENGTH}
                />
              </div>

              {/* Color Palette */}
              <div>
                <label htmlFor="colorInput" className="label">Color Palette (up to 5)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="colorInput"
                    className="input-field flex-1"
                    value={colorInput}
                    onChange={(e) => setColorInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addColor())}
                    placeholder="e.g. Blush pink, Gold, Sage green"
                    maxLength={50}
                  />
                  <button type="button" onClick={addColor} className="btn btn-secondary btn-sm">Add</button>
                </div>
                {form.colorPalette && form.colorPalette.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.colorPalette.map((c, i) => (
                      <span key={i} className="badge badge-primary flex items-center gap-1">
                        {c}
                        <button
                          type="button"
                          onClick={() => removeColor(i)}
                          className="text-indigo-600 hover:text-indigo-800 ml-1"
                          aria-label={`Remove ${c}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Goals */}
              <div>
                <span className="label">Planning Goals (up to 5)</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {GOAL_OPTIONS.map((goal) => (
                    <button
                      key={goal.value}
                      type="button"
                      onClick={() => toggleGoal(goal.value)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        form.goals?.includes(goal.value as PlanningGoal)
                          ? 'bg-indigo-100 border-indigo-400 text-indigo-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                      }`}
                      aria-pressed={form.goals?.includes(goal.value as PlanningGoal)}
                    >
                      {goal.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="additionalNotes" className="label">Additional Notes</label>
                <textarea
                  id="additionalNotes"
                  className="input-field"
                  rows={3}
                  value={form.additionalNotes || ''}
                  onChange={(e) => updateField('additionalNotes', e.target.value)}
                  placeholder="Any other preferences or requirements..."
                  maxLength={MAX_NOTES_LENGTH}
                />
                <p className="text-xs text-slate-500 mt-1">
                  {(form.additionalNotes?.length || 0)}/{MAX_NOTES_LENGTH}
                </p>
              </div>
            </div>
          </fieldset>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleBack}
            className="btn btn-ghost"
            disabled={step === 0}
          >
            ← Back
          </button>

          {step < 2 ? (
            <button
              type="button"
              onClick={handleNext}
              className="btn btn-primary"
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Generating Plan...
                </>
              ) : (
                submitLabel ?? (editing ? 'Update details & regenerate' : '✨ Generate My Plan')
              )}
            </button>
          )}
        </div>
      </div>

      {/* Privacy notice */}
      <div className="px-6 pb-4">
        <p className="text-xs text-slate-500 text-center">
          Your event details are processed by Google Gemini AI to generate personalized plans.
          Data is stored locally in your browser. No personal data is stored on our servers.
        </p>
      </div>
    </div>
  );
}
