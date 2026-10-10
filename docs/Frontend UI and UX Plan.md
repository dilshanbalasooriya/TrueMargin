# Unit Cost Calculation SaaS: Frontend Plan v3 (Next.js)

Version 3. Written against Backend Plan v3, which stays the source of truth. Replaces Frontend Plan v2 (Nuxt). Section 21 lists what changed.

## 1. Decisions and assumptions

| Topic | Decision | Status |
| :-- | :-- | :-- |
| Framework | Next.js (App Router), TypeScript strict | Confirmed |
| Where the math runs | Only in the FastAPI service. The browser never calculates costs, prices or reconciliation | Confirmed |
| Live recalculation | Debounced call to the backend, about 300 ms after typing stops | Confirmed |
| Guests | Anonymous, rate-limited calls to the same endpoint | Confirmed |
| Buckets | Six: Material, Labor, Transport, Overhead, Machinery, Custom Fees | Confirmed |
| Launch languages | English and Sinhala. Tamil later | Confirmed |
| Data layer | Supabase Auth for identity only. All sheet, version and library reads and writes go through FastAPI | Recommended, please confirm (Section 11) |
| Deliverable of this step | This plan. API contract and prototype follow after sign-off | Confirmed |

## 2. Principles

1. **Not another Excel sheet.** A guided wizard, one plain question per bucket.
2. **Conversational, not academic.** No accounting jargon in any language.
3. **Progressive disclosure.** Level 1 first, Level 2 and Level 3 only on request.
4. **Mobile-first.** Most users are on phones. Thumb-friendly, no hover-only features.
5. **Correct by construction.** The UI guides entry, but the server decides what is valid.
6. **The backend is the only calculator.** No formula is duplicated in the frontend. Every number on screen comes from a server response.
7. **Never pass off a stale number as current.** If a response is outdated or failed, the UI says so.

## 3. Architecture

| Concern | Choice |
| :-- | :-- |
| Framework | Next.js App Router, React, TypeScript strict |
| UI | Tailwind CSS with shadcn/ui (Radix primitives). Replaces Nuxt UI |
| Server state | TanStack Query (compute, sheets, versions, libraries) |
| Client state | Zustand with the persist middleware (guest draft, working copies, UI state) |
| Forms | React Hook Form with Zod, for input shape only (is this a number), never business rules |
| API types | Generated from the FastAPI OpenAPI schema (openapi-typescript). CI fails when the schema and the client drift |
| Money | Decimal strings end to end. decimal.js only to parse typed input and format output. No float arithmetic on money, and no summing in the browser |
| i18n | next-intl |
| Theme | next-themes (light, dark) |
| Auth | @supabase/ssr |
| Charts | Recharts donut and bar, lazy-loaded |
| Quality | Vitest, Playwright, axe, Sentry, web-vitals |

**Rendering split.** Marketing and landing pages are server-rendered per locale for SEO. The calculator is a client-heavy page. Saved-sheet pages are authenticated and load through TanStack Query.

**Request path.** Browser to FastAPI directly, with a Bearer token when logged in and none for guests. The browser does not proxy compute calls through Next.js, to avoid an extra hop on every keystroke.

## 4. Compute flow

### 4.1 What the UI sends and needs back

The client sends the whole sheet state on every compute call (stateless, so guests need no server session): sheet setup, six buckets with declared totals, units covered, line items and their pinned flags, pricing inputs, and the cash or economic view.

The server response must carry, so the frontend never derives anything:

- Per bucket: effective total, cost per unit, reconciliation state (none, matched, below, exceed), the system Unallocated line when it exists, and the itemized total.
- Overwrite info when items exceed the declared total (new total and the old declared value).
- Total unit cost, cash and economic variants, and each bucket's share.
- Pricing: price before tax, tax amount, price including tax, equivalent markup or margin, profit per unit, total profit, break-even units, and percentage-of-price fees solved by the price step.
- Warnings and errors as stable codes with parameters, never as English sentences (Section 13).
- A partial flag when some buckets are still unanswered.

### 4.2 Behavior rules

- **Debounce:** trailing, 300 ms after the last edit. Flush immediately on blur, step change and before Save.
- **Cancel and order:** each call carries a sequence number and an AbortController. Only the latest response is applied.
- **While waiting:** keep the last good numbers on screen, dimmed, with a small spinner. Show a skeleton only before the first result. Never blank the dashboard.
- **Unparsable input:** do not call the server. Show an inline hint and keep the last numbers.
- **422 validation errors:** map each issue code and field path to the right input with a taught message.
- **429 rate limit:** show a calm banner, honor Retry-After, retry once automatically, and keep the entries untouched.
- **5xx or network failure:** keep the last numbers marked 'out of date', show 'Can't reach the calculator. Your entries are safe on this device', and retry with backoff. When the browser is offline, say so.
- **Save always recomputes on the server**, so the saved snapshot never depends on the last live response.

### 4.3 Latency and hosting

The backend plan's 'recalculation under 100 ms' assumed an in-browser engine and no longer holds. Proposed replacement: server compute p95 of 200 ms or less, and updated numbers visible about 500 ms after typing stops on a mid-range mobile connection. Host the API in a region close to users (Mumbai or Singapore for Sri Lanka). To be confirmed with the backend.

### 4.4 Guest abuse control

The frontend sends a random anonymous session ID header, kept in local storage, so the backend can rate-limit per session as well as per IP. Recommended: the backend supports an optional bot-challenge token (for example Cloudflare Turnstile) on guest calls, so the frontend can add it if abuse appears.

## 5. Buckets and templates

- The frontend never hard-codes bucket order or labels. It loads the template (industry or service type) from the backend.
- A bucket config has: key, label key, question key, order, hidden flag, default starter lines, and unit label defaults.
- The six keys are material, labor, transport, overhead, machinery, custom\_fees. Custom Fees exists at every level and in every template unless a template hides it.
- Services rename and reorder through the template (for example Material shown as Supplies, Labor first). Hidden buckets are not rendered, are sent as hidden, and are excluded from the 'all buckets answered' check.
- **Custom Fees split:** fixed and per-unit fees live in the bucket. Percentage-of-price fees (marketplace commission, payment gateway) appear in the pricing panel because the backend solves them there to avoid circular logic. One-time amortized fees arrive at Level 3.

**Bucket answer states:** unanswered, zero-confirmed (the user tapped **None**), and has amount. A blank is never treated as zero.

## 6. Level 1: Quick Cost screen

One short screen, nothing expanded, about 2 minutes.

1. Product or service name and unit label (optional). Unit label defaults come from the template.
2. **Units produced** (top-level, drives every default).
3. **Defective units** (optional, reduces good units).
4. Six bucket cards in template order. Each shows a plain question, a **Total spent** field and a **Units covered** field that defaults to the good units (placeholder only, so most users type just the amount), a **None** button, and a **Break this down** action.
5. Pricing panel: markup or margin toggle and percentage.

**None behavior:** the button reads 'I don't have \[bucket\] costs', sets the bucket to zero-confirmed, shows a green check and a small Change link.

**Partial results:** the dashboard shows results as soon as one bucket is answered, with a line such as '2 buckets still to answer'. Final-looking totals are labeled partial until all visible buckets are answered.

## 7. Level 2: Itemized Cost

Trigger: **Break this down**. The Level 1 amount becomes the declared total. Starter lines come from the template (for example Raw Material 1, Raw Material 2, Packaging) and are overwritten, not deleted.

Line item fields: name, amount, units covered. A toggle switches amount to quantity times unit price (needed for the Materials Library). When it is on, the client sends quantity and unit price and the server returns the amount, so the browser does no multiplication.

### 7.1 Reconciliation UX

The server returns the state for each bucket. The UI only renders it.

| State | What the user sees |
| :-- | :-- |
| No items | Nothing extra |
| Match | Green bar and a 'Fully itemized' mark |
| Items below declared | An automatic **Unallocated** line for the gap, editable and deletable |
| Items exceed declared | Inline banner: 'Your items add up to X, higher than the Y you entered. Bucket total updated to X.' with **Undo** |

Rules:

- **Unallocated line:** keep, rename and edit (it becomes a real line and is sent as pinned), or delete. Delete needs a one-tap confirmation, then the declared total is set to the itemized total returned by the server.
- **Untouched vs pinned:** an untouched Unallocated line is server-generated and follows changes. Once edited, the client sends pinned and it stops adjusting. A small pinned badge shows.
- **Undo:** restores the previous working state from a client-side history stack (last 20 steps). The old declared value also stays in saved version history.
- **Different units covered:** when line units differ from the bucket's, the bar switches to cost per final unit with an info popover that explains why. The Unallocated line is still shown as an amount at the bucket's units covered, as the server returns it.
- Every bucket shows the declared-versus-itemized bar at a glance.

Libraries (Materials, Workers) and templates plug in here in Phase 3.

## 8. Level 3: Precision Cost

- A gear icon on each line opens that line's advanced fields (wastage %, scrap recovery, depreciation, statutory contributions, allocation, amortization).
- The frontend keeps a registry from backend method key (for example machinery.straight\_line\_time) to a hand-built form component. Forms are built per method in v1; schema-driven forms are a later option.
- Gear and methods are hidden until the backend reports the method as available (capabilities endpoint or feature flag), so Phase 1 to 3 users never see dead controls.
- Imputed costs (owner or family pay) are labeled 'imputed (not cash)' everywhere. Method results reconcile with the same Section 7.1 rules.
- Every complex field has a tap-friendly help popover.

## 9. Dashboard and pricing

**Layout:** pinned right panel on desktop. On mobile, a bottom sheet that collapses to a bar showing unit cost and selling price, and expands on tap.

**Contents:** donut chart with legend by bucket, total unit cost, cash or economic toggle, pricing panel, profit per unit and in total, break-even units, what-if sliders.

**Pricing rules (UI):**

- Toggle labeled 'Markup (added on top of cost)' and 'Margin (share of the selling price that is profit)'.
- Live two-way display of the equivalent value, supplied by the server.
- Margin input restricted below 100% in the UI and rejected by the server.
- Optional tax step: price before tax, tax amount and price including tax.
- **Loss flag:** if the price is below the full economic cost once imputed costs are counted, show a clear warning (the 'ah-ha' moment).

**What-if panel:** sliders for volume, material price and wages. They are temporary overrides sent as part of the compute request, never saved, with a Reset control. The sliders do no math.

## 10. Cost sheet lifecycle and client state

### 10.1 Stores

- **guestDraft:** one draft, persisted to local storage, with a schema version and migrations.
- **workingCopies:** unsaved edits of open sheets, keyed by sheet ID, each storing its base version ID.
- Handle storage quota and disabled-storage errors with a visible notice rather than silent loss.
- On logout, clear working copies and the anonymous session ID, so a shared phone does not leak data.

### 10.2 Flows

1. **Guest:** full use of all levels, one active draft. The login wall appears (as an overlay modal over the numbers) on Save, Download, Add new product, or History.
2. **Login and import:** the draft is sent to the API, which recomputes and stores it as Version 1. The guest draft is cleared only after a success response. If server totals differ from what the guest last saw (engine update, rounding), show a short note.
3. **OAuth redirects:** Google sign-in leaves the page. The draft already lives in local storage and the pending action (Save) resumes on return.
4. **Reopen and edit:** the screen shows live change against the saved version.
5. **Save:** **Save as new version** with an optional change note, or **Save as new product** (copy).
6. **History:** version list with unit cost, note and date. Compare any two versions bucket by bucket. **Restore** creates a new version.
7. **Concurrency:** Save sends the base version ID. If the server answers 409 (a newer version exists, perhaps from another device), show: Save on top as a new version, Save as new product, or Discard my edits.
8. **Session expiry:** on 401, refresh once, then show the login modal without losing state.

## 11. Auth and data access (recommendation)

**Recommended:** Supabase Auth issues sessions. FastAPI validates the JWT and is the only thing that reads or writes sheets, versions, libraries and plan data. The frontend never queries Postgres directly. Row Level Security stays enabled as defence in depth.

**Why:**

1. Saves must be recomputed on the server, so the write path is the API anyway.
2. Plan limits, watermarked exports and billing must be enforced server-side.
3. One contract and one authorization layer, instead of the same rules in RLS and in the API.
4. Reads return effective totals that only the engine can produce.

**Cost:** more endpoints and no free direct reads or realtime. Acceptable at launch. Revisit only if list pages become slow.

**Details:** @supabase/ssr keeps the session in cookies. Server-rendered pages forward the token. The client sends it as a Bearer header. Email link or one-time code and Google sign-in at launch. Roles (owner, editor, viewer) hide actions in the UI, but only the server enforces them. A workspace switcher sits in the avatar menu; one workspace per user at launch unless decided otherwise.

## 12. Plans, limits and exports

- Limits (saved sheets, history depth, libraries) are enforced by the server. The UI handles 402 or 403 responses with an upgrade dialog that names the limit.
- Guests cannot download PDF or CSV. The login wall appears instead.
- Free plan exports are watermarked; Pro exports are clean. The server generates the file and the frontend downloads it from a signed URL.
- Every export and the app footer show the disclaimer: costing aid only, not accounting, tax or legal advice.
- Whether Unallocated lines show in customer-facing exports is an open decision (Section 22).

## 13. Internationalization (English and Sinhala at launch)

- **Routing:** English at the root, Sinhala under /si, with hreflang tags. Tamil can be added later without restructuring.
- **Strings:** all copy lives in message files with stable keys. No text in components.
- **Server messages:** the backend returns codes plus parameters. The frontend maps them to translated copy. English text from the server is never displayed.
- **Sinhala style:** colloquial, conversational, no textbook accounting terms. A glossary of approved plain terms is agreed before translation, and a native reviewer signs off every release that changes copy.
- **Layout:** Sinhala text is longer and needs line-height room. Test every screen in both languages. Use a Sinhala-capable font (for example Noto Sans Sinhala through next/font).
- **Numbers and currency:** Intl formatting by locale and workspace currency (Rs. for Sri Lanka). Parse typed numbers with the locale's separators.
- **Language switch:** EN and සිංහල toggle in the navbar, keeping the current page and unsaved state.

## 14. Design system and accessibility

- **Look:** clean, professional and trustworthy. White and slate with one standard blue for primary actions. No neon or glow effects.
- **Navbar:** logo, language toggle, theme toggle, avatar with a dropdown for workspaces and settings.
- **Help:** every complex input has a help icon. On touch devices it opens on tap (a popover), because hover does not exist there. Same plain-language text as hover.
- **Inputs:** numeric fields use text inputs with a decimal keyboard and locale parsing, not browser number spinners.
- **Controls:** standard accessible sliders, toggles and dialogs from Radix.
- **Accessibility:** WCAG 2.1 AA basics, visible focus, 44 px touch targets, screen-reader announcements when totals update, never colour alone for state (green, amber and blue states also carry text or icons).
- **Dark mode:** supported from day one through design tokens.

## 15. Performance and offline

- Page load under 3 seconds on a mid-range mobile connection. Code-split the chart, the history views and Level 3 forms.
- Calculation needs the network, so true offline calculation is not possible. When offline, entries still save to the device and the UI explains that totals will refresh on reconnect. Offline mode as a product feature stays an open decision.
- PWA install and caching of the app shell come after launch.

## 16. Security and privacy

- Only the public Supabase key reaches the browser. No service keys, ever.
- Strict CORS and a Content Security Policy. Sanitize any rendered user text, since product names and notes appear in exports.
- Anonymous session IDs carry no personal data.
- Data export and deletion on request, surfaced in settings.
- Rate-limit and bot-challenge hooks on guest compute (Section 4.4).

## 17. Analytics and monitoring

- Funnel events: first calculation, first Break this down, login wall shown, login completed, first saved sheet, second version.
- Track compute latency, error rate and 429 rate per release.
- Sentry for errors with the sheet ID and request ID (no personal or financial values in logs).
- Core Web Vitals.

## 18. Testing

- **Contract tests** against the OpenAPI schema, with a mock server for frontend work before the backend is ready.
- **Golden cases:** the backend's worked examples (below, matching and above reconciliation, rice and oil units example, markup and margin) become shared fixtures. Playwright checks that the UI renders exactly what the server returns for each.
- **Race and failure tests:** rapid typing, out-of-order responses, 429, 5xx, offline, expired session, 409 on save.
- **Quality gates:** unit tests for stores and migrations, accessibility checks (axe), visual checks in both languages and both themes, and missing-translation checks in CI.

## 19. Repository layout and roadmap

Suggested layout: app (routes by locale), features (calculator, sheets, history, pricing, libraries), components (shared UI), lib (api client, generated types, formatting), messages (en, si), stores, tests.

The roadmap follows the backend phases and assumes one to two developers.

| Phase | Frontend scope |
| :-- | :-- |
| 0. Foundations (1 to 2 weeks) | OpenAPI contract and mock server, repo and CI, design tokens, i18n scaffolding, auth skeleton, compute client with debounce, cancel and ordering, golden fixtures |
| 1. Level 1 (2 to 3 weeks) | Six-bucket screen, None flow, dashboard, markup and margin pricing, guest draft, rate-limit and error states, English and Sinhala copy |
| 2. Save and sign-in (2 to 3 weeks) | Login modal and OAuth return, draft import, my-sheets list, working copies, versions with notes, history, compare, restore, conflict handling |
| 3. Level 2 (4 to 5 weeks) | Break this down, line items, full reconciliation UX, libraries, templates |
| 4. Level 3 (4 to 6 weeks) | Method forms per bucket, imputed labels, capability gating |
| 5. Reports and plans (2 to 3 weeks) | Export downloads, plan limit dialogs, billing UI, onboarding |
| 6. Growth | Tamil, team workspaces, more country presets |

## 20. What this plan requires from the backend

These must be agreed before Phase 0 ends:

1. A published OpenAPI schema and a stable /compute contract (Section 4.1), including reconciliation state, Unallocated line, equivalent markup or margin and partial flag.
2. Money as decimal strings. Stable error and warning codes with parameters.
3. Rate-limit responses with Retry-After, and an anonymous session header.
4. Template, capabilities and method-availability endpoints.
5. Save endpoints with base version ID and 409 conflict responses, plus draft import.
6. Signed URLs for exports.

**Corrections needed in Backend Plan v3 so both documents agree:**

- Section 11 and Section 8.1 say the engine runs in the browser. It runs only in the FastAPI service, and the browser calls it.
- Section 11 names Supabase Edge Functions and 'React or Next.js'. These become FastAPI and Next.js. Edge Functions are no longer the engine or the export host.
- Section 12 sets recalculation under 100 ms. Replace it with the API latency budget in Section 4.3.
- Section 11 says Supabase Row Level Security protects the data. Keep it, but state that FastAPI is the only data client.

## 21. Changes from Frontend Plan v2

1. Nuxt replaced by Next.js, with the equivalent libraries (Section 3).
2. The compute flow now has rules for cancellation, ordering, stale display, rate limits and offline (Section 4).
3. Money handled as decimal strings, with no math in the browser.
4. The six buckets are explicit, including Custom Fees and the percentage-of-price fee split.
5. Backend codes translated on the frontend, never server English text.
6. Tooltips work on touch devices.
7. Concurrency, session expiry, OAuth return and logout cleanup added.
8. Data-layer recommendation and backend requirements added (Sections 11 and 20).

## 22. Open questions

1. Confirm the data-layer recommendation in Section 11.
2. Server-side drafts for cross-device editing, or browser-only drafts at launch?
3. Should Unallocated lines appear in customer-facing exports or be merged into the bucket total?
4. Which industry and service templates first, and which statutory presets (Sri Lanka first)?
5. Free-plan limits (saved sheets, versions) and guest rate limits.
6. One workspace per user at launch, or team workspaces from day one?
7. API hosting region and the compute latency target (Section 4.3).
8. Bot-challenge on guest calls from day one, or only if abuse appears?
9. Offline use as a product feature?

**Recommended next step:** confirm Sections 11 and 20, then write the /compute API contract with the three reconciliation worked examples as fixtures, and rebuild the prototype against a mock of that contract.
