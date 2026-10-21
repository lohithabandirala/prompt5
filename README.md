# Festiva AI

Festiva AI is a production-oriented celebration planning assistant for weddings, birthdays and community events. A short wizard collects the event brief; a server-side Gemini call turns it into a theme, exact budget, preparation timeline, vendor checklist, celebration ideas and event-day run sheet. Every section can be edited afterwards and stays internally consistent.

There is **no demo fixture and no silent fallback**. When the provider is not configured or the model response is invalid, the app reports the failure and saves nothing.

---

## 1. Overview

The app covers the full planning loop:

1. Describe the event (date, location, budget, guest count, style, dietary and accessibility needs, traditions and goals).
2. Generate a structured plan through `/api/plan`.
3. Review and edit every section.
4. Regenerate one section without losing edits in the others.
5. Save the plan in the browser, reload it later, export it, or delete it after confirmation.

The planner is deliberately conservative about facts it cannot know: it does not invent vendor names, contact details, ratings, confirmed availability or quotations.

## 2. Features

- **Brief wizard** with per-step validation and short-notice guidance.
- **Theme and concept** section generated from the full brief.
- **Budget planner** with planned, quoted and actual amounts, category status, contingency reserve, over-budget warnings, and deterministic rebalancing that always sums exactly to the total.
- **Preparation timeline** with dependencies, due dates computed in application code, phases, priorities, status tracking, custom tasks and short-notice normalisation.
- **Vendor checklist** with questions to ask, deliverables, deadlines, backup plans and notes. No vendor is presented as real, available or contacted.
- **Celebration ideas** with save/discard filters and estimated cost ranges.
- **Event-day run sheet** with chronological entries, responsibility assignments and conflict warnings.
- **Selective regeneration** for theme, budget, timeline, vendors, ideas or run sheet. Generated fields merge into the existing plan; user edits such as saved ideas and task status are preserved.
- **Persistence** in `localStorage` with runtime schema validation and a 50-plan limit.
- **Exports**: printable planning report (HTML), budget CSV, and calendar ICS file.
- **Accessible interactions**: labelled controls, keyboard tab navigation, focus-trapped confirmation dialog, live-region status messages and visible focus states.
- **Security controls** at every boundary: request schemas, field/size limits, fixed-window rate limiting, provider timeouts, bounded retries, safe error mapping and restrictive response headers.

## 3. Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 |
| Validation | Zod 4 |
| AI provider | Google Gemini via `@google/generative-ai` |
| Unit/integration tests | Jest 30, Testing Library, jsdom |
| End-to-end tests | Playwright + Chromium |
| Persistence | Versioned, validated `localStorage` |

## 4. Prerequisites

- Node.js 20 or newer.
- npm 10 or newer.
- A Gemini API key for real generation.
- Chromium via Playwright for the end-to-end suite.

## 5. Setup

```bash
npm install
cp .env.example .env.local
# edit .env.local and set GEMINI_API_KEY
npm run dev
```

Open <http://localhost:3000>.

For the end-to-end suite only, install the browser once:

```bash
npx playwright install chromium
```

## 6. Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Server-side Gemini credential. Never exposed to the browser. |
| `GEMINI_MODEL` | No | Model identifier. Defaults to `gemini-3.8-flash`. Retired 2.0 Flash IDs are migrated to the default and logged. |
| `GEMINI_API_BASE_URL` | No | Approved gateway/proxy base URL. Also used by Playwright to point the real API routes at a local deterministic mock. |

`.env.example` documents the same variables. `.env*` files other than `.env.example` are git-ignored.

## 7. Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run build` | Production build. |
| `npm start` | Serve the production build. |
| `npm run lint` | ESLint, including React hooks rules. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm test` | Unit, API, security and component tests. |
| `npm run test:watch` | Jest watch mode. |
| `npm run test:coverage` | Jest with V8 coverage. |
| `npm run test:e2e` | Playwright journey and accessibility tests. Starts the app and mock provider automatically. |
| `npm run smoke:gemini -- <url>` | Opt-in live-provider smoke test against a running server with a real key. |

## 8. Architecture

```text
src/
  app/
    page.tsx              Client orchestrator: wizard, plan tabs, save/regenerate flows
    layout.tsx            Metadata, header/footer shell, skip link
    globals.css           Tailwind theme, focus styles, print styles
    api/
      plan/route.ts       Validated generation endpoint
      regenerate/route.ts Validated single-section regeneration endpoint
      health/route.ts     Configuration/readiness probe (no secrets)
  components/             Wizard, plan sections, dashboard, settings, dialogs, exports
  lib/
    ai/                   Gemini client, prompts, validation, retries, error mapping
    api/                  Browser fetch wrapper with cancellation and safe errors
    budget/               Minor-unit allocation, reconciliation and reconciliation maths
    export/               CSV, ICS, HTML report, download and print helpers
    persistence/          Validated localStorage read/write
    plan/                 Plan assembly, merge rules, regeneration context
    schemas/              Shared Zod schemas for requests, plans and persistence
    security/             Request parsing, rate limiting and response headers
    timeline/             Timezone-free calendar arithmetic and scheduling
```

The client, API routes, persistence layer and model output all use the same Zod schemas. A plan that cannot be validated on the server is never stored or rendered.

## 9. AI integration

- **Server-only credential.** `GEMINI_API_KEY` is read in a route handler module; it is never sent to the client.
- **One retry only.** Transient provider or format failures are attempted twice in total, with a short delay. Authentication failures are not retried.
- **Hard timeout.** Each model call is aborted after 25 seconds.
- **Strict output validation.** The response must parse as JSON and pass the full plan schema. Wrong keys, impossible percentages, malformed dates or missing sections are rejected.
- **Prompt-injection awareness.** Event content is placed inside an `<event_data>` block and explicitly labelled as untrusted data. System instructions prohibit role changes, secret disclosure, tool use, browsing, bookings, payments and fabricated vendor facts.
- **Honest failures.** Error codes include `NOT_CONFIGURED`, `VALIDATION_FAILED`, `RATE_LIMITED`, `AUTH_FAILED`, `UNAVAILABLE`, `TIMEOUT`, `EMPTY_RESPONSE`, `INVALID_JSON`, `SCHEMA_VALIDATION_FAILED` and `GENERATION_FAILED`. Provider diagnostics and stacks are not returned to the browser.

`GEMINI_API_BASE_URL` exists for approved gateways and the Playwright mock. It does not change the validation or UI behaviour.

## 10. Budget calculation

All arithmetic is performed on integer minor units (`Math.round(amount * 10^precision)`) and converted back once, avoiding floating-point drift.

- The generated percentages are converted to exact amounts using proportional allocation plus a **largest-remainder pass**, so allocations sum to the total.
- Displayed percentages are recomputed from the amounts, so they also sum to exactly 100.
- `planned`, `quoted` and `actual` values are distinct. Effective spend uses actual when present, otherwise quoted, otherwise planned.
- Editing one category's allocation **protects that value** and adjusts the other categories: contingency first, then largest-first. If the edited value exceeds the budget, it is clamped to the total and the others fall to zero.
- `validateBudgetTotal` verifies exact equality and reports the real difference.
- Over-budget and allocation-mismatch warnings are explicit, not cosmetic.

## 11. Timeline and run sheet

- Calendar dates are stored as timezone-free `YYYY-MM-DD` strings.
- Day arithmetic is performed in UTC, so a deadline cannot shift by a day when the browser timezone changes or daylight saving starts.
- The application computes each task's due date from the event date and `daysBeforeEvent`; the model only supplies relative offsets.
- Dependencies are resolved and missing dependencies are removed rather than dangled.
- Events less than 14 days away are normalised to short-notice tasks with offsets inside the remaining window.
- Overdue state ignores completed and cancelled tasks.
- The run sheet is ordered chronologically and warns about overlapping entries and the same responsible person being double-booked.

## 12. Persistence and exports

**Persistence**

- Key: `festiva-ai-events`.
- Every stored record is re-validated with `SavedEventSchema` on read. Corrupt or hand-edited records are discarded.
- The list is sorted by last update and capped at 50 events.
- Writes report quota/private-mode failures; the UI tells the user to export before leaving.
- Data is browser-local. It is not synced, backed up or visible on another device.

**Exports**

| Export | Format | Contents |
| --- | --- | --- |
| Planning report | HTML download, print-ready | Full plan, budget summary, timeline, vendors, ideas, run sheet, assumptions and questions |
| Budget | CSV | Category, allocation %, planned/quoted/actual amounts, status, totals |
| Calendar | ICS | Event date plus preparation deadlines as all-day entries |

Download helpers create a real Blob URL and revoke it after use. HTML export escapes all user and model strings; CSV and ICS apply format-specific escaping and line folding.

## 13. Security and privacy

- Zod validation on request bodies, query data, persistence data and provider output.
- Request body size limits and per-field length limits; malformed JSON is rejected.
- Fixed-window rate limiting per client (10 requests per minute by default) for generation endpoints.
- Provider calls use a 25-second abort, a bounded retry count and no unbounded loops.
- Errors are mapped to user-safe messages; stacks and raw provider diagnostics stay server-side.
- Security headers: CSP, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP and no `X-Powered-By`.
- React renders all model/user text as escaped text. No `dangerouslySetInnerHTML` is used for plan content.
- API keys are never logged, returned or included in client bundles.
- No analytics, tracking pixels or third-party scripts are included.

## 14. Accessibility

The interface aims to follow WCAG 2.2 AA practices:

- Semantic landmarks, one `h1`, skip link and logical heading order.
- Every input has a programmatic label; errors use `aria-invalid` and `aria-describedby`.
- Plan tabs implement the ARIA tab pattern with arrow-key, Home and End navigation.
- The destructive-action dialog has `role="dialog"`, `aria-modal`, an accessible name/description, focus trapping, Escape handling and focus restoration.
- Status and error messages use live regions; loading is announced in text, not colour alone.
- Visible focus rings, keyboard-reachable controls and reduced-motion support.
- Responsive layout without horizontal scrolling at mobile widths.

This has not been independently audited with assistive-technology users or a formal VPAT. Automated WCAG 2 A/AA checks run in `e2e/accessibility.spec.ts` with axe-core and cover the dashboard, wizard, generated plan, budget tab and confirmation dialog. Automated checks cannot detect every WCAG issue; see Limitations.

## 15. Testing

```bash
npm test                 # unit, API, security and component tests
npm run test:coverage    # coverage report in coverage/
npm run test:e2e         # Playwright journey tests
```

Coverage includes:

- **Unit:** budget allocation/reconciliation, timeline arithmetic, plan assembly, merge rules, CSV/ICS/report escaping, persistence validation, rate limiting.
- **API integration:** `/api/plan` and `/api/regenerate` success, validation, rate-limit, missing-key, provider-error and invalid-output paths.
- **Security:** oversized bodies, malformed JSON, prompt-injection-shaped input, secret/stack leakage and schema handling.
- **Component:** wizard validation, budget editing, timeline statuses, ideas save/discard, dashboard actions, focus-trapped dialog, and inert rendering of `<script>`/`onerror` strings.
- **End-to-end:** full generation journey, budget display, idea save + regeneration merge, real CSV download, reload persistence, settings deletion, provider failure, invalid model output and past-date blocking.
- **Accessibility:** axe-core scans of the dashboard, wizard steps, generated plan, budget tab and confirmation dialog against WCAG 2 A/AA rules.

The Playwright suite runs the **real** Next.js routes with `GEMINI_API_BASE_URL` pointed at `e2e/mock-gemini-server.mjs`. This makes the tests deterministic and offline-safe, but it is not a live-Gemini integration test. Before deployment, run one real smoke test against a server holding a genuine key:

```bash
npm run build
npm start
# in another terminal:
npm run smoke:gemini -- http://localhost:3000
```

## 16. Limitations and deployment

### Known limitations

- **Browser-only persistence.** There is no account system, database or cross-device sync. Clearing site data deletes the plans.
- **In-memory rate limiter.** It is per server process. On multi-instance/serverless deployments each instance has its own window; use a shared store such as Redis for billing-grade quotas.
- **CSP allows `'unsafe-inline'`** because the current architecture relies on Next.js inline bootstrap scripts. `'unsafe-eval'` is granted only in development. A nonce/hash-based production policy is recommended and must be re-tested before rollout.
- **No vendor verification.** Vendor entries are planning prompts, not real businesses. The app makes no availability, price, rating or contact claims.
- **Model variability.** Even with strict schemas and low temperature, wording and recommendations vary between runs. Budget amounts and dates are recomputed by the app, but prose is not fact-checked.
- **Regeneration is section-scoped.** It does not re-plan dependencies across every section automatically; the user remains responsible for cross-section consistency.
- **Localisation.** The interface is English-only. Currency formatting supports the currencies in the shared schema, with their configured minor-unit precision.
- **Accessibility is best-practice, not certified.** Automated axe-core checks cover key views, but a formal audit and manual screen-reader testing remain outstanding.
- **No automated live-provider test.** CI would need a real key or a contract test against an approved gateway.

### Deployment

The app uses Next.js route handlers, so deploy it to a Node-capable host (or a platform that supports server functions), not a purely static export.

1. Set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) in the hosting environment.
2. Run `npm run build` and start with `npm start`, or use the platform's Next.js adapter.
3. Serve over HTTPS; the CSP includes `upgrade-insecure-requests`.
4. Replace the in-memory rate limiter or run a single instance.
5. Verify `/api/health` reports the intended model/configuration without exposing secrets.
6. Smoke-test one real generation, one regeneration, each export and a page reload.
