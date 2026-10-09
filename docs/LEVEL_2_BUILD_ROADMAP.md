# TrueMargin Level 2 Build Roadmap

Internal execution plan derived from `Unit Cost Calculation SaaS Complete Product Plan (v2).md`.

## 1. Outcome and stopping point

Build a usable, mobile-friendly costing SaaS that lets a small business:

1. Create or calculate a Level 1 cost sheet.
2. Expand any cost bucket into Level 2 line items, leaving other buckets at Level 1.
3. See the Level 1 declared amount reconcile transparently with the itemized amount.
4. Understand the resulting unit cost and markup- or margin-based suggested price.
5. Sign in to save, reopen, and revise cost sheets without losing prior saved versions.

**The release ends when this workflow is reliable for both a simple product and a service. Stop at Level 2.** Do not start Level 3 methods as part of this delivery.

## 2. Scope boundary

### Build for the Level 2 release

- The Level 1 foundation needed to create a complete cost sheet: product/service name, unit, production basis, output units, six cost buckets, clear zero-cost confirmation, and live unit-cost/pricing results.
- Itemized breakdown per bucket; mixed levels are allowed on one sheet.
- Generic line-item entry with name, amount, units covered, and optional notes. Where appropriate, calculate amount from quantity × unit price.
- Level 2 bucket details:
  - **Materials:** bill-of-materials and packaging lines.
  - **Labor:** direct worker/task cost lines; support total amount, hourly rate × hours, and piece rate × pieces.
  - **Transport:** named inbound/outbound cost lines.
  - **Overhead:** named rent, utility, and similar cost lines; optionally record a business-use share as a simple percentage of that line.
  - **Machinery:** named machine and maintenance cost lines, without depreciation.
  - **Custom fees:** named, fixed cost lines.
- The full Level 1-to-Level 2 reconciliation behavior described in Section 4.
- Correct unit-cost breakdown and markup/margin pricing from the source plan.
- Sign-in, private saved sheets, reopen/edit, and immutable saved versions. A save must preserve enough inputs to reproduce its calculation.
- A small, deliberately limited starter set of product/service templates and reusable material/worker entries, only after the core workflow is stable.
- Responsive phone layout, plain-language labels, validation, and formula transparency.

### Explicitly defer

- Level 3 costing: material wastage/yield, leftover inventory and scrap recovery; statutory contributions and imputed owner/family labor; depreciation and asset-life calculations; shared cost pools and allocation methods; amortization; percentage-of-price fees and price solver.
- Full accounting, payroll, inventory management, invoicing, tax filing, accounting integrations, multi-user/team roles, subscriptions/billing, and paid-plan enforcement.
- PDF/CSV exports, trend dashboards, version comparison/restore, advanced what-if analysis, offline/PWA mode, localization, and broad template catalog.
- Unvalidated country-specific statutory or tax presets.

Do not implement a deferred feature merely because a field or table in the source plan anticipates it.

## 3. Product rules to settle before implementation

Record these as decisions in the product/design notes before building the calculation engine. The recommendations keep the first release understandable and testable.

1. **One unit basis per sheet:** record the sheet's good output units. Each bucket declared amount and each line item also has a positive `unitsCovered`; default it to the sheet's good units. Do not silently compare raw costs when the unit counts differ.
2. **Calculation precision:** use decimal-safe arithmetic for money and rates. Keep full calculation precision internally and round only for display and at explicitly documented boundaries.
3. **Line amount:** material quantity × unit price yields its amount; other cost lines may enter an amount directly. The calculated/entered amount is divided by that line's own `unitsCovered` to derive its contribution per final unit.
4. **Worker cost modes:** salary is the amount attributable to this sheet's production basis; hourly cost is rate × hours; piece-rate cost is rate × pieces. This is costing input, not payroll or statutory calculation.
5. **Defects:** allow a manually entered defective-unit count only if needed to define good output units consistently with the source formula. Defer defect-rate analysis and material wastage accounting.
6. **None vs blank:** a user must explicitly mark a bucket as having no cost; an empty, unconfirmed bucket remains incomplete.
7. **Authentication and persistence architecture:** choose one system of record before data-model work. The product plan proposes Supabase Auth/Postgres/RLS. The current frontend is Nuxt 4 with the Supabase module installed; the FastAPI backend is currently a minimal scaffold. Recommended default: Nuxt + Supabase, with server-side authoritative recalculation and RLS. Keep FastAPI only if there is a specific backend requirement; do not implement two competing persistence/auth paths.
8. **No user-facing financial advice:** describe output as a costing/pricing aid, show formulas, and include the product-plan disclaimer before public launch.

## 4. Reconciliation contract

Use one pure calculation function as the source of truth for the browser preview and server-side save. Model comparisons in **cost per final unit**, not by comparing raw amounts with different unit coverage.

For a bucket:

- `declaredRate = declaredAmount / declaredUnitsCovered`
- `itemizedRate = sum(lineAmount / lineUnitsCovered)` across user-authored cost lines
- If no item lines exist, the bucket contribution is `declaredRate`.
- If itemized and declared rates match within the chosen decimal precision, contribution is that rate and the bucket is fully itemized.
- If itemized rate is lower, contribution remains `declaredRate`; create/update an unallocated difference of `declaredRate - itemizedRate`.
- If itemized rate is higher, contribution becomes `itemizedRate`; the current declared amount is raised to the matching value at its declared unit basis. Show the prior value and offer undo before save.
- The total unit cost is the sum of the six bucket contributions. Pricing uses that total.

Unallocated-line behavior must be implemented as explicit state, not inferred from a display label:

- An untouched system line follows the difference as user lines change.
- Editing or renaming it converts it to a pinned, user-owned line; it no longer auto-adjusts.
- Deleting an unallocated line that would lower the declared bucket value requires confirmation; after confirmation, set the declared value to match the remaining items.
- Saving and reopening must preserve the declared value, user lines, and pinned/unpinned state so reconciliation reproduces the same result.

Before coding, resolve the source plan's wording on whether the generated unallocated line is hidden or shown as an unspecified cost. Recommended UI: show it in the expanded breakdown with a plain-language label and include it in cost totals; do not hide a cost from the user.

## 5. Build sequence and exit criteria

Work in order. A phase is complete only when its exit criteria pass; avoid building later UI on unverified calculation behavior.

### Phase 0 — Confirm scope and inspect the current app

**Deliver:** short agreed decisions for Section 3; a single architecture/system-of-record choice; a list of current app routes, styles, and existing data/auth setup.

**Actions**

- Confirm that Level 1 is included as the required entry path to Level 2, not a separate product launch.
- Confirm the six bucket definitions, bucket unit defaults, good-units rule, and reconciliation UI decisions.
- Inspect the current Nuxt/FastAPI/Supabase setup and determine what is already implemented; preserve useful work rather than recreating it.
- Decide whether the saved-sheet workflow requires login at first release (recommended: yes, in line with the source plan).

**Exit when:** no unresolved decision can change the central cost formula, persistence model, or Level 2 scope.

### Phase 1 — Write calculation examples and test the engine

**Deliver:** a typed cost-sheet input/output model, documented formula examples, and a pure calculation module with unit tests.

**Actions**

- Specify sheet and line-item fields, units, valid ranges, and the distinction between incomplete and explicitly zero-cost buckets.
- Implement the six bucket contributions, line amount derivation, good-unit validation, and markup/margin conversions.
- Implement the reconciliation contract, including an unallocated line and the items-exceed-declared undo state.
- Test equal unit coverage and different unit coverage; test rounding boundaries, zero/negative/invalid units, missing amounts, and empty item lists.
- Keep business math independent from UI, database, and framework code.

**Exit when:** hand-calculated examples produce expected results and every reconciliation state has automated tests. A reviewer can explain any displayed total from its inputs.

### Phase 2 — Establish persistence, ownership, and version snapshots

**Deliver:** migrations/schema, authentication and access rules, and save/load operations for Level 1 sheets.

**Actions**

- Model workspaces/ownership, cost sheets, immutable versions, buckets, and line items. Avoid adding Level 3-only tables or fields without a concrete Level 2 need.
- Define a version snapshot that preserves the exact user inputs, units, reconciliation state, calculation/formula version, and derived result for audit/display.
- Enforce per-user/workspace data isolation in the database, not only in the UI.
- Validate and recompute totals on the trusted server path before accepting a saved version; never trust client-submitted totals.
- Implement sign-in and a protected list/detail flow. If unauthenticated calculation is retained, save the browser draft through login without dropping line items.

**Exit when:** one user can save/reopen a sheet; a second user cannot read or modify it; editing and saving creates a new version rather than overwriting history; server and browser results agree.

### Phase 3 — Complete and verify the Level 1 workflow

**Deliver:** a usable cost-sheet setup and summary with the six Level 1 buckets.

**Actions**

- Build sheet identity, product/service unit label, batch/period basis, and units produced.
- Make bucket cost, units covered, and explicit None status clear and fast to enter.
- Show cost/unit by bucket, total unit cost, bucket shares, and suggested price using an accurately labeled markup or margin mode.
- Persist/reload drafts and handle invalid or incomplete fields with actionable messages.

**Exit when:** a user can complete, calculate, save, and reopen a Level 1 sheet on a phone; totals match the tested engine.

### Phase 4 — Add Level 2 itemization and reconciliation

**Deliver:** per-bucket expand/collapse itemization, mixed-level sheets, and reconciliation states.

**Actions**

- Add, edit, reorder, and remove line items without forcing the user to itemize every bucket.
- Implement appropriate entry controls for material quantity/unit/price, direct labor modes, and simple named amount lines for the other buckets.
- Display declared amount, itemized value, gap/status, and the calculated contribution in plain language.
- Implement the unallocated-line lifecycle, items-exceed notice/undo, and delete confirmation.
- Save/reopen/recalculate itemized versions; changing a source library price must not alter an existing saved version.

**Exit when:** all four reconciliation cases pass both engine and UI tests, including differing units covered; a mixed Level 1/Level 2 sheet totals correctly and retains its meaning after reload.

### Phase 5 — Explain results and add only essential reuse

**Deliver:** understandable result details and a small initial reuse/template set.

**Actions**

- Add expandable formula/input explanations for bucket and total unit costs.
- Include a small initial product template and a service template; templates prefill labels/examples only and do not silently add costs.
- Add minimal material/worker reuse only if it shortens real repeated entry. Snapshot price/rate values into the sheet at selection time.
- Add first-run help and examples for declared total, units covered, itemized amount, and unallocated amount.

**Exit when:** a first-time user can finish a product and a service example without financial/accounting terminology being unexplained, and reused values do not mutate saved history.

### Phase 6 — Reliability, privacy, and launch checks

**Deliver:** release candidate with automated coverage for calculations, persistence, and the primary user journey.

**Actions**

- Run a full test matrix: Level 1 only; one itemized bucket; all buckets itemized; below/match/above reconciliation; distinct unit coverage; product/service; anonymous-to-login draft transfer if supported; save/reopen/new version.
- Test phone-size layouts, keyboard operation, labels/errors, and readable number/currency formatting.
- Test access-control boundaries, server-side recalculation, validation of malformed input, and safe handling of secrets.
- Verify backups/migration process, error visibility, and the product disclaimer.
- Test with a small set of target users; fix comprehension or calculation blockers before adding optional polish.

**Exit when:** no known calculation/data-isolation blocker remains; the primary acceptance journey passes on desktop and mobile; test users can accurately explain their unit cost and any unallocated amount.

### Phase 7 — Release Level 2 and stop

Release only the Level 2 feature set. Monitor calculation failures, abandoned itemization, and user confusion around reconciliation. Fix defects and improve Level 2 usability, but keep Level 3 work in a separate future plan.

**Definition of done**

- A user can create a product or service cost sheet, itemize any subset of buckets, and see a correct unit cost and suggested price.
- Below/matching/above reconciliation, unequal units covered, pinned/unpinned unallocated lines, and confirmation flows behave as specified.
- Saved sheets reopen accurately and revisions preserve previous saved versions.
- Calculations are explained, inputs are validated, and user data is isolated.
- No Level 3 accounting methods, billing, or reporting promises are exposed as completed features.

## 6. Acceptance walkthroughs

Use these as release-blocking end-to-end scenarios:

1. **Simple product:** enter output units and six declared bucket amounts; mark unused buckets None; confirm each bucket and total unit cost and markup/margin price.
2. **Itemized below declared:** declare 100 cost for 10 units; add items totaling 60 for the same 10 units; confirm a 40 unallocated amount and unchanged bucket contribution.
3. **Itemized equal:** itemize the full declared amount; confirm no unallocated difference and a fully itemized state.
4. **Itemized above declared:** declare 100 for 10 units; add lines totaling 120; confirm the new effective contribution, old declared value notification, and undo behavior.
5. **Different units:** declare 24,000 for 8,000 units and itemize inputs with different `unitsCovered`; confirm reconciliation compares rates per final unit, not raw totals.
6. **Pinned unallocated:** edit/rename the generated line, change other lines, save/reopen, and confirm it stays pinned and is treated as an ordinary cost.
7. **Service:** create a service sheet with labor and transport itemized, other buckets left at Level 1; confirm unit label and mixed levels persist.
8. **Versioning and privacy:** save a sheet, revise a line and save again; confirm the older version is unchanged and a different account cannot access either version.

## 7. Main risks and controls

| Risk | Control |
| --- | --- |
| Scope expands into Level 3 | Enforce the explicit deferrals in Section 2; any proposed exception requires a separate scope decision. |
| Raw amounts are compared despite different unit coverage | Normalize to cost per final unit in the engine and test unequal-unit cases first. |
| Unallocated line creates confusing or changing totals | Make it visible, deterministic, explicitly pinned when edited, and covered by acceptance walkthroughs. |
| Client/server results diverge | Share a pure engine where practical; server recomputes and has parity tests. |
| Saved numbers drift after library edits | Snapshot selected prices/rates and preserve immutable versions. |
| Two backend paths or auth systems emerge | Select the source of truth in Phase 0; avoid duplicate APIs and persistence. |
| Too much setup reduces completion | Make itemization optional per bucket, offer defaults/templates, and keep basic entry usable without libraries. |
| Users mistake markup for margin | Label the mode and show both values using the specified formulas. |

## 8. Planning notes about the source document

- The referenced file is named `... (v2).md`, while its heading and change notes identify its contents as version 3. Confirm the canonical product-plan version before using it as a stakeholder reference.
- The source plan includes Level 1, Level 2, and Level 3 details in the same sections. Use the boundaries in this roadmap to avoid implementing advanced adjustments simply because they appear near Level 2 fields.
- The source's "unallocated" guidance alternates between hidden and visible presentation. This roadmap recommends showing it in the expanded breakdown because users need to see what makes up the effective cost.
