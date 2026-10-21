'use client';

import { useCallback, useState } from 'react';
import type { VendorEntry } from '@/lib/schemas/event-plan';
import { formatCurrency } from '@/lib/budget/calculate';

interface VendorChecklistProps {
  vendors: VendorEntry[];
  currency: string;
  onUpdate: (vendors: VendorEntry[]) => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

const STATUS_LABEL: Record<VendorEntry['status'], string> = {
  researching: 'Researching',
  contacted: 'Contacted',
  quote_received: 'Quote received',
  selected: 'Selected',
  booked: 'Booked',
  completed: 'Completed',
};

const STATUS_CLASS: Record<VendorEntry['status'], string> = {
  researching: 'badge-primary',
  contacted: 'badge-info',
  quote_received: 'badge-warning',
  selected: 'badge-warning',
  booked: 'badge-success',
  completed: 'badge-success',
};

const CATEGORY_ICONS: Record<string, string> = {
  venue: '🏛️',
  catering: '🍽️',
  photography: '📸',
  videography: '🎥',
  music: '🎵',
  entertainment: '🎭',
  flowers: '🌸',
  decoration: '🎨',
  transportation: '🚗',
  cake: '🎂',
  officiant: '💍',
  hair: '💇',
  makeup: '💄',
  lighting: '💡',
  furniture: '🪑',
  security: '🔒',
  cleaning: '🧹',
  permits: '📄',
  accessibility: '♿',
  other: '📋',
};

function iconFor(category: string): string {
  return CATEGORY_ICONS[category.toLowerCase()] ?? '📋';
}

export default function VendorChecklist({
  vendors,
  currency,
  onUpdate,
  onRegenerate,
  isRegenerating,
}: VendorChecklistProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [filterStatus, setFilterStatus] = useState<VendorEntry['status'] | 'all'>('all');
  const [newVendor, setNewVendor] = useState({ category: '', vendorName: '', vendorContact: '' });

  const filtered =
    filterStatus === 'all' ? vendors : vendors.filter((vendor) => vendor.status === filterStatus);

  const booked = vendors.filter(
    (vendor) => vendor.status === 'booked' || vendor.status === 'completed'
  ).length;
  const researching = vendors.filter((vendor) => vendor.status === 'researching').length;
  const withQuotes = vendors.filter((vendor) => vendor.quoteAmount !== undefined).length;

  const handleStatusChange = useCallback(
    (id: string, status: VendorEntry['status']) => {
      onUpdate(vendors.map((vendor) => (vendor.id === id ? { ...vendor, status } : vendor)));
    },
    [vendors, onUpdate]
  );

  const handleTextField = useCallback(
    (id: string, field: 'vendorName' | 'vendorContact' | 'notes', value: string) => {
      onUpdate(
        vendors.map((vendor) =>
          vendor.id === id ? { ...vendor, [field]: value.trim() || undefined } : vendor
        )
      );
    },
    [vendors, onUpdate]
  );

  const handleQuoteAmount = useCallback(
    (id: string, value: number | undefined) => {
      onUpdate(
        vendors.map((vendor) =>
          vendor.id === id
            ? { ...vendor, quoteAmount: value !== undefined && Number.isFinite(value) ? Math.max(0, value) : undefined }
            : vendor
        )
      );
    },
    [vendors, onUpdate]
  );

  const toggleChecklistItem = useCallback(
    (id: string, index: number) => {
      onUpdate(
        vendors.map((vendor) => {
          if (vendor.id !== id || !vendor.checklist) return vendor;
          const checklist = vendor.checklist.map((item, itemIndex) =>
            itemIndex === index ? { ...item, completed: !item.completed } : item
          );
          return { ...vendor, checklist };
        })
      );
    },
    [vendors, onUpdate]
  );

  const handleDelete = useCallback(
    (id: string) => {
      onUpdate(vendors.filter((vendor) => vendor.id !== id));
      setPendingRemove(null);
    },
    [vendors, onUpdate]
  );

  const handleAddVendor = useCallback(() => {
    if (!newVendor.category.trim()) return;
    const created: VendorEntry = {
      id: `vendor-custom-${Date.now()}`,
      category: newVendor.category.trim(),
      status: 'researching',
      vendorName: newVendor.vendorName.trim() || undefined,
      vendorContact: newVendor.vendorContact.trim() || undefined,
    };
    onUpdate([...vendors, created]);
    setNewVendor({ category: '', vendorName: '', vendorContact: '' });
    setShowAddVendor(false);
  }, [newVendor, vendors, onUpdate]);

  const quoteTotal = vendors.reduce((sum, vendor) => sum + (vendor.quoteAmount ?? 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card card-body">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="section-title">🤝 Vendor checklist</h3>
            <p className="text-sm text-slate-500">
              A sourcing workspace you control. No vendor is contacted or booked by this app.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowAddVendor((open) => !open)}
              className="btn btn-secondary btn-sm"
              aria-expanded={showAddVendor}
            >
              + Add vendor
            </button>
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                disabled={isRegenerating}
                className="btn btn-ghost btn-sm"
                aria-label="Regenerate vendor checklist"
              >
                {isRegenerating ? <span className="spinner" aria-hidden="true" /> : '🔄'} Regenerate
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="p-3 bg-indigo-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-indigo-900">{vendors.length}</p>
            <p className="text-xs text-indigo-700 font-medium">Vendor categories</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-900">{booked}</p>
            <p className="text-xs text-green-700 font-medium">Booked / done</p>
          </div>
          <div className={`p-3 rounded-lg text-center ${researching > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
            <p className={`text-2xl font-bold ${researching > 0 ? 'text-amber-900' : 'text-slate-600'}`}>{researching}</p>
            <p className={`text-xs font-medium ${researching > 0 ? 'text-amber-700' : 'text-slate-500'}`}>Still researching</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg text-center">
            <p className="text-lg font-bold text-slate-900">{formatCurrency(quoteTotal, currency)}</p>
            <p className="text-xs text-slate-600 font-medium">{withQuotes} user-entered quote{withQuotes === 1 ? '' : 's'}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter vendors by status">
          {(['all', ...Object.keys(STATUS_LABEL)] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status as VendorEntry['status'] | 'all')}
              className={`btn btn-sm ${filterStatus === status ? 'btn-primary' : 'btn-ghost'}`}
              aria-pressed={filterStatus === status}
            >
              {status === 'all' ? 'All' : STATUS_LABEL[status as VendorEntry['status']]}
              {status !== 'all' && (
                <span className="ml-1 text-xs opacity-70">
                  ({vendors.filter((vendor) => vendor.status === status).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {showAddVendor && (
        <div className="card card-body animate-fade-in">
          <h4 className="font-semibold text-slate-800 mb-3">New vendor entry</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="new-vendor-cat" className="label">Category <span aria-hidden="true">*</span></label>
              <input
                type="text"
                id="new-vendor-cat"
                className="input-field"
                value={newVendor.category}
                onChange={(event) => setNewVendor({ ...newVendor, category: event.target.value })}
                placeholder="e.g. Photography"
                maxLength={100}
                required
              />
            </div>
            <div>
              <label htmlFor="new-vendor-name" className="label">Vendor name (optional)</label>
              <input
                type="text"
                id="new-vendor-name"
                className="input-field"
                value={newVendor.vendorName}
                onChange={(event) => setNewVendor({ ...newVendor, vendorName: event.target.value })}
                placeholder="Only if you already have a candidate"
                maxLength={200}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="new-vendor-contact" className="label">Contact you recorded (optional)</label>
              <input
                type="text"
                id="new-vendor-contact"
                className="input-field"
                value={newVendor.vendorContact}
                onChange={(event) => setNewVendor({ ...newVendor, vendorContact: event.target.value })}
                placeholder="Name, phone or email"
                maxLength={200}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={handleAddVendor}
              className="btn btn-primary btn-sm"
              disabled={!newVendor.category.trim()}
            >
              Add vendor
            </button>
            <button type="button" onClick={() => setShowAddVendor(false)} className="btn btn-ghost btn-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {vendors.length > 1 && (
        <details className="card card-body">
          <summary className="cursor-pointer font-semibold text-slate-800">
            Compare vendor quotes
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm" aria-label="Vendor comparison">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th scope="col" className="py-2 pr-3">Category</th>
                  <th scope="col" className="py-2 pr-3">Vendor</th>
                  <th scope="col" className="py-2 pr-3">Status</th>
                  <th scope="col" className="py-2 pr-3">Sourcing deadline</th>
                  <th scope="col" className="py-2 pr-3 text-right">Quote</th>
                </tr>
              </thead>
              <tbody>
                {[...vendors]
                  .sort((a, b) => a.category.localeCompare(b.category))
                  .map((vendor) => (
                    <tr key={vendor.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3">{vendor.category}</td>
                      <td className="py-2 pr-3">{vendor.vendorName ?? 'Not chosen yet'}</td>
                      <td className="py-2 pr-3">{STATUS_LABEL[vendor.status]}</td>
                      <td className="py-2 pr-3">{vendor.sourcingDeadline ?? '—'}</td>
                      <td className="py-2 pr-3 text-right">
                        {vendor.quoteAmount !== undefined
                          ? formatCurrency(vendor.quoteAmount, currency)
                          : 'No quote entered'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Quotes are values you recorded. They are not verified market prices or confirmed availability.
          </p>
        </details>
      )}

      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-center text-slate-600 py-8">No vendors match this filter.</p>
        )}

        {filtered.map((vendor) => {
          const completedItems = vendor.checklist?.filter((item) => item.completed).length ?? 0;
          return (
            <div key={vendor.id} className="card p-4 border-l-4 border-l-indigo-300">
              <div className="flex flex-wrap items-start gap-3">
                <span className="text-2xl" aria-hidden="true">{iconFor(vendor.category)}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-slate-900">
                      {vendor.vendorName || vendor.category}
                    </h4>
                    <span className="text-xs text-slate-500">{vendor.category}</span>
                    <span className={`badge ${STATUS_CLASS[vendor.status]}`}>
                      {STATUS_LABEL[vendor.status]}
                    </span>
                  </div>

                  {vendor.importance && (
                    <p className="text-sm text-slate-600 mt-1">{vendor.importance}</p>
                  )}

                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                    {vendor.sourcingDeadline && <span>📅 Source by <time dateTime={vendor.sourcingDeadline}>{vendor.sourcingDeadline}</time></span>}
                    {vendor.budgetRange && <span>💸 {vendor.budgetRange}</span>}
                    {vendor.quoteAmount !== undefined && <span>💰 Your quote: {formatCurrency(vendor.quoteAmount, currency)}</span>}
                    {vendor.checklist?.length ? (
                      <span>✅ {completedItems}/{vendor.checklist.length} checks complete</span>
                    ) : null}
                  </div>

                  {vendor.questionsToAsk && vendor.questionsToAsk.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-indigo-700">
                        Questions to ask ({vendor.questionsToAsk.length})
                      </summary>
                      <ul className="mt-1 list-disc pl-5 text-xs text-slate-600 space-y-0.5">
                        {vendor.questionsToAsk.map((question) => (
                          <li key={question}>{question}</li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {vendor.requiredDeliverables && vendor.requiredDeliverables.length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs font-medium text-indigo-700">
                        Required deliverables ({vendor.requiredDeliverables.length})
                      </summary>
                      <ul className="mt-1 list-disc pl-5 text-xs text-slate-600 space-y-0.5">
                        {vendor.requiredDeliverables.map((deliverable) => (
                          <li key={deliverable}>{deliverable}</li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {vendor.checklist && vendor.checklist.length > 0 && (
                    <fieldset className="mt-2">
                      <legend className="text-xs font-medium text-slate-700 mb-1">Booking checklist</legend>
                      <ul className="space-y-1">
                        {vendor.checklist.map((item, index) => (
                          <li key={`${vendor.id}-${index}`}>
                            <label className="flex items-start gap-2 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={item.completed}
                                onChange={() => toggleChecklistItem(vendor.id, index)}
                                className="mt-0.5"
                              />
                              <span className={item.completed ? 'line-through text-slate-500' : ''}>
                                {item.item}
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </fieldset>
                  )}

                  {vendor.backupPlan && (
                    <p className="mt-2 text-xs text-slate-600">
                      <strong>Backup:</strong> {vendor.backupPlan}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1 flex-shrink-0 items-end">
                  <label htmlFor={`vendor-status-${vendor.id}`} className="sr-only">
                    Status for {vendor.vendorName || vendor.category}
                  </label>
                  <select
                    id={`vendor-status-${vendor.id}`}
                    value={vendor.status}
                    onChange={(event) =>
                      handleStatusChange(vendor.id, event.target.value as VendorEntry['status'])
                    }
                    className="text-xs border rounded px-1 py-1"
                  >
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setEditingId(editingId === vendor.id ? null : vendor.id)}
                    className="text-xs text-indigo-700 hover:underline"
                    aria-expanded={editingId === vendor.id}
                  >
                    {editingId === vendor.id ? 'Close' : 'Edit details'}
                  </button>
                  {pendingRemove === vendor.id ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleDelete(vendor.id)}
                        className="text-xs text-red-700 font-semibold hover:underline"
                      >
                        Confirm remove
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingRemove(null)}
                        className="text-xs text-slate-500 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPendingRemove(vendor.id)}
                      className="text-xs text-slate-500 hover:text-red-700 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {editingId === vendor.id && (
                <div className="mt-3 pt-3 border-t border-slate-200 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`vname-${vendor.id}`} className="label">Vendor name</label>
                    <input
                      type="text"
                      id={`vname-${vendor.id}`}
                      className="input-field text-sm"
                      value={vendor.vendorName ?? ''}
                      onChange={(event) => handleTextField(vendor.id, 'vendorName', event.target.value)}
                      placeholder="Only if already chosen"
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <label htmlFor={`vcontact-${vendor.id}`} className="label">Contact you recorded</label>
                    <input
                      type="text"
                      id={`vcontact-${vendor.id}`}
                      className="input-field text-sm"
                      value={vendor.vendorContact ?? ''}
                      onChange={(event) => handleTextField(vendor.id, 'vendorContact', event.target.value)}
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <label htmlFor={`vquote-${vendor.id}`} className="label">Quote amount ({currency})</label>
                    <input
                      type="number"
                      id={`vquote-${vendor.id}`}
                      className="input-field text-sm"
                      value={vendor.quoteAmount ?? ''}
                      min={0}
                      step="0.01"
                      onChange={(event) =>
                        handleQuoteAmount(vendor.id, event.target.value === '' ? undefined : Number(event.target.value))
                      }
                      placeholder="Enter a quote you received"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor={`vnotes-${vendor.id}`} className="label">Notes</label>
                    <textarea
                      id={`vnotes-${vendor.id}`}
                      className="input-field text-sm"
                      rows={2}
                      value={vendor.notes ?? ''}
                      onChange={(event) => handleTextField(vendor.id, 'notes', event.target.value)}
                      placeholder="Decisions, contact notes, questions asked…"
                      maxLength={1000}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-500 text-center">
        Festiva AI does not search, contact, book or pay vendors. Names and quotes appear only when you enter them.
      </p>
    </div>
  );
}
