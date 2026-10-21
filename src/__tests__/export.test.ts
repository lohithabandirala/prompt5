import { budgetToCsv, escapeCsvCell } from '@/lib/export/csv';
import { buildIcsFile, escapeIcsText, foldIcsLine, toIcsDate } from '@/lib/export/ics';
import { buildPlanReportHtml, escapeHtml } from '@/lib/export/report';
import { sanitizeFilename } from '@/lib/export/download';
import { buildPlanFromAI } from '@/lib/plan/build-plan';
import type { SavedEvent } from '@/lib/schemas/event-plan';
import { validAIPlan, validInput } from './fixtures/ai-plan';

function savedEvent(): SavedEvent {
  const input = validInput();
  const plan = buildPlanFromAI(validAIPlan(), input);
  return {
    id: 'event-1',
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    input,
    plan,
  };
}

describe('CSV export', () => {
  it('escapes commas and double quotes per RFC 4180', () => {
    expect(escapeCsvCell('Venue, garden')).toBe('"Venue, garden"');
    expect(escapeCsvCell('Say "hello"')).toBe('"Say ""hello"""');
    expect(escapeCsvCell('line one\nline two')).toBe('"line one\nline two"');
  });

  it('neutralises spreadsheet formula injection', () => {
    expect(escapeCsvCell('=cmd()')).toBe("'=cmd()");
    expect(escapeCsvCell('+SUM(A1)')).toBe("'+SUM(A1)");
    expect(escapeCsvCell('-2+3')).toBe("'-2+3");
    expect(escapeCsvCell('@import')).toBe("'@import");
  });

  it('leaves numbers machine-readable', () => {
    expect(escapeCsvCell(1234.5)).toBe('1234.5');
    expect(escapeCsvCell(Number.NaN)).toBe('');
    expect(escapeCsvCell(null)).toBe('');
  });

  it('exports every category, a total row and a UTF-8 BOM', () => {
    const event = savedEvent();
    const csv = budgetToCsv(event.plan!, event.input.currency);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Category,Allocation %');
    expect(csv).toContain('TOTAL');
    expect(csv).toContain('Illustrative planning estimates');
    expect(csv.split('\r\n')).toHaveLength(event.plan!.budgetCategories.length + 2);
  });

  it('can omit the BOM for tests and machine pipelines', () => {
    const event = savedEvent();
    expect(budgetToCsv(event.plan!, event.input.currency, false).startsWith('\uFEFF')).toBe(false);
  });

  it('neutralises formula injection from user notes', () => {
    const event = savedEvent();
    event.plan!.budgetCategories[0].notes = '=HYPERLINK("https://evil.example")';
    const csv = budgetToCsv(event.plan!, event.input.currency, false);

    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toContain("\n=HYPERLINK");
  });
});

describe('ICS export', () => {
  it('escapes RFC 5545 special characters', () => {
    expect(escapeIcsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('folds long content lines', () => {
    const folded = foldIcsLine(`DESCRIPTION:${'x'.repeat(200)}`);
    const lines = folded.split('\r\n');
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0].length).toBeLessThanOrEqual(75);
    expect(lines.slice(1).every((line) => line.startsWith(' '))).toBe(true);
  });

  it('converts calendar dates and rejects invalid ones', () => {
    expect(toIcsDate('2026-03-05')).toBe('20260305');
    expect(toIcsDate('2026-02-30')).toBeNull();
  });

  it('produces a calendar with the event and one reminder per dated task', () => {
    const event = savedEvent();
    const ics = buildIcsFile(event.plan!, event.input, new Date('2026-01-01T00:00:00Z'));

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('DTSTART;VALUE=DATE:');
    expect(ics.split('BEGIN:VEVENT')).toHaveLength(
      event.plan!.timelineTasks.filter((task) => task.dueDate).length + 2
    );
    expect(ics).toContain('\r\n');
  });

  it('uses stable UIDs across exports', () => {
    const event = savedEvent();
    const first = buildIcsFile(event.plan!, event.input, new Date('2026-01-01T00:00:00Z'));
    const second = buildIcsFile(event.plan!, event.input, new Date('2026-02-01T00:00:00Z'));

    const uids = (value: string) => value.match(/UID:[^\r\n]+/g);
    expect(uids(first)).toEqual(uids(second));
  });

  it('escapes untrusted event names', () => {
    const event = savedEvent();
    event.plan!.eventName = 'Party, games; fun';
    const ics = buildIcsFile(event.plan!, event.input);

    expect(ics).toContain('Party\\, games\\; fun');
  });
});

describe('printable report', () => {
  it('escapes HTML metacharacters', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    );
    expect(escapeHtml("' & < >")).toBe('&#39; &amp; &lt; &gt;');
  });

  it('never emits raw model or user markup', () => {
    const event = savedEvent();
    event.plan!.eventName = '<script>alert(1)</script>';
    event.plan!.eventSummary = '<img src=x onerror=alert(2)>';
    event.plan!.celebrationIdeas[0].title = '</h1><script>bad()</script>';
    event.input.additionalNotes = '<svg onload=alert(3)>';

    const html = buildPlanReportHtml(event);

    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<svg/i);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(2)&gt;');
  });

  it('contains the major planning sections and a disclaimer', () => {
    const html = buildPlanReportHtml(savedEvent());

    expect(html).toContain('Budget');
    expect(html).toContain('Preparation timeline');
    expect(html).toContain('Vendors');
    expect(html).toContain('Celebration ideas');
    expect(html).toContain('Event-day run sheet');
    expect(html).toContain('not a quotation');
  });

  it('handles an event without a plan', () => {
    const event = savedEvent();
    delete event.plan;
    expect(buildPlanReportHtml(event)).toContain('No plan has been generated');
  });
});

describe('filename sanitisation', () => {
  it('removes path separators and control characters', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('etcpasswd');
    expect(sanitizeFilename('my:event*plan?')).toBe('myeventplan');
    expect(sanitizeFilename('   ')).toBe('event-plan');
    expect(sanitizeFilename('a'.repeat(200))).toHaveLength(80);
  });
});
