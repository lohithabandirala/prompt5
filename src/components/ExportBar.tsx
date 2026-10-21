'use client';

import { useState } from 'react';
import type { SavedEvent } from '@/lib/schemas/event-plan';
import { budgetToCsv } from '@/lib/export/csv';
import { buildIcsFile } from '@/lib/export/ics';
import { buildPlanReportHtml } from '@/lib/export/report';
import { downloadFile } from '@/lib/export/download';
import { printHtmlDocument } from '@/lib/export/print';

interface ExportBarProps {
  event: SavedEvent;
}

/**
 * Real export controls. Every button produces a downloadable or printable
 * artifact; none of them are decorative.
 */
export default function ExportBar({ event }: ExportBarProps) {
  const [status, setStatus] = useState('');

  if (!event.plan) return null;
  const plan = event.plan;
  const baseName = plan.eventName.replace(/\s+/g, '-').toLowerCase();

  const handleReport = () => {
    const ok = downloadFile(
      buildPlanReportHtml(event),
      `${baseName}-planning-report.html`,
      'text/html'
    );
    setStatus(ok ? 'Planning report downloaded as HTML.' : 'Could not start the download.');
  };

  const handleCsv = () => {
    const ok = downloadFile(
      budgetToCsv(plan, event.input.currency),
      `${baseName}-budget.csv`,
      'text/csv'
    );
    setStatus(ok ? 'Budget CSV downloaded.' : 'Could not start the download.');
  };

  const handleIcs = () => {
    const ok = downloadFile(
      buildIcsFile(plan, event.input),
      `${baseName}-preparation.ics`,
      'text/calendar'
    );
    setStatus(ok ? 'Calendar file downloaded. Import it into your calendar app.' : 'Could not start the download.');
  };

  const handlePrint = () => {
    const ok = printHtmlDocument(buildPlanReportHtml(event));
    setStatus(ok ? 'Print dialog opened for the full planning report.' : 'Printing is not available in this browser.');
  };

  return (
    <div className="flex flex-wrap items-center gap-2 no-print">
      <button type="button" onClick={handlePrint} className="btn btn-ghost btn-sm">
        🖨️ Print report
      </button>
      <button type="button" onClick={handleReport} className="btn btn-ghost btn-sm">
        📄 Report HTML
      </button>
      <button type="button" onClick={handleCsv} className="btn btn-ghost btn-sm">
        📊 Budget CSV
      </button>
      <button type="button" onClick={handleIcs} className="btn btn-ghost btn-sm">
        📅 Calendar ICS
      </button>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
