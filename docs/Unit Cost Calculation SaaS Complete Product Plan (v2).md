# Unit Cost Calculation SaaS: Complete Product Plan (v3)

Version 3. Reworks Level 1 around bucket totals, adds the reconciliation rule, saved versions and the Supabase architecture. Changes are listed in Section 15.

## 1. Product Summary

A web app that helps small and medium businesses that make products or deliver services find the true cost of producing one unit of a product or service, and price it correctly.

There are three levels. Each answers the same question (what does one unit really cost?) and adds precision:

- **Level 1, Quick Cost:** fill one amount per cost bucket (material, labor, transport, overhead, machinery, custom fees) plus units produced. No bucket needs expanding. About 2 minutes.
- **Level 2, Itemized Cost:** break any bucket into line items. The app reconciles the items against the Level 1 amount automatically (Section 4.3).
- **Level 3, Precision Cost:** accounting-grade methods per bucket (depreciation, statutory contributions, allocation rules, wastage), added later on the same data model.

**Core promise:** "Know what each unit really costs, and what to charge for it, with no accounting knowledge." Anyone can calculate; a free login is needed only to save and revise.

## 2. Target Users

- Home-based and micro producers (food, garments, crafts, cosmetics).
- Small and medium workshops, factories and kitchens with staff and machinery.
- Service businesses (salons, repair shops, print shops, catering, transport, tutoring) pricing a job, hour or session.
- Freelancers who need quick quotes.

Assumption: users have no accounting knowledge. Every term needs plain-language help text and sensible defaults.

## 3. Product Principles

1. **Simple first, deep on demand.** Progressive disclosure everywhere.
2. **Transparent math.** Every result shows its formula and breakdown.
3. **Correct by construction.** Validation prevents the usual costing mistakes (allocations not summing to 100%, mixing periods, markup vs margin confusion).
4. **Enter once, reuse forever.** Material prices, wage rates and templates are saved and reused.
5. **Configurable, not hard-coded.** Tax and statutory rates, currencies and defaults are settings.

## 4. Core Calculation Model

### 4.1 The Cost Sheet

A **Cost Sheet** is the unit of work: one product or service, one production basis, one set of costs. Users save it, reopen it and revise it over time.

- **Production basis:** a batch or run ("this run of 200 units") or a period ("March"). Both use the same engine: total cost divided by good units.
- **Unit label:** unit, piece, kg, litre, hour, job, session or trip. Services typically use job or hour.
- **Six buckets:** Material, Labor, Transport, Overhead, Machinery, Custom Fees. Industry templates can rename or hide buckets (a salon renames Material to Supplies and hides Machinery).
- **A level per bucket, not per sheet:** Material can be itemized (Level 2) while Labor stays a single amount (Level 1).
- **Every save creates a version** (Section 8.2).

### 4.2 Master formula

```latex
\text{Unit Cost} = \sum_{i} \frac{C_i}{U_i}
```

C = the cost of one input (at Level 1, a bucket's amount; at Level 2, a line item). U = the number of final units that input produced. Each input is divided by **its own units**, and the results are added. If the user does not enter U, it defaults to the sheet's good units (units produced minus defective units). When every input covers the same units, this equals total cost divided by good units.

Example, with each input covering a different number of packets:

| Input | Cost | Units it produced | Cost per unit |
| :-- | :-- | :-- | :-- |
| Rice, 100 kg | 24,000 | 8,000 packets | 3.00 |
| Oil, 50 L | 6,000 | 50,000 packets | 0.12 |
| **Unit cost** |  |  | **3.12** |

A bucket's cost per unit is the sum of its inputs' cost per unit, so the six bucket figures always add up to the unit cost.

### 4.3 Bucket value rule (reconciliation)

Every bucket has a **Declared Total** (the Level 1 amount the user typed) and optional **line items** (Level 2). The **Effective Total** is what the engine uses.

| Case | Condition | Effective total | What the user sees |
| :-- | :-- | :-- | :-- |
| No items | No lines entered | Declared total | Nothing extra |
| Items match | Sum of items = declared | Declared total | A green "fully itemized" mark |
| Items below | Sum of items < declared | Declared total | An automatic **Unallocated** line for the difference, shown as a hidden or unspecified cost |
| Items exceed | Sum of items > declared | Sum of items | A notice: "Your items add up to X, higher than the Y you entered. Bucket total updated to X." with undo |

Rules:

- The Unallocated line is a normal line the user can **keep, rename and edit (turn it into a real item), or delete**. Deleting it lowers the declared total to the sum of items, after a one-tap confirmation.
- While untouched, the Unallocated line recalculates as items change. Once the user edits it, it is pinned and stops adjusting.
- When items exceed the declared total, the declared total is overwritten by the sum. The old value stays in version history.
- Every bucket shows a small declared-vs-itemized bar so the gap is visible at a glance.
- The same rule applies at Level 3: method results (for example depreciation) count as items.

**Different units covered:** when inputs cover different unit counts (Section 4.2), reconciliation compares **cost per final unit**, not raw amounts. The bucket's declared cost per unit is its amount divided by its units covered. The items' cost per unit is the sum of each item's cost divided by its own units. The Unallocated line is the difference per unit, shown as an amount at the bucket's units covered.

### 4.4 Pricing formulas (corrected)

The v1 plan used Cost x (1 + M%) and called it margin. That is **markup**. The app supports both, labeled accurately:

```
Markup pricing:   Price = Unit Cost x (1 + Markup%)
Margin pricing:   Price = Unit Cost / (1 - Margin%)
```

Example: cost 100, markup 30% gives price 130 and an actual margin of 23.1%. For a 30% margin, price is 142.86.

UI requirements:

- Toggle labeled "Markup (added on top of cost)" vs "Margin (share of the selling price that is profit)".
- Live two-way display: whichever the user enters, show the equivalent value of the other.
- Margin input must be restricted to below 100%.
- Optional tax step: if VAT or sales tax applies, show price before tax, tax amount and price including tax.

## 5. Level 1: Quick Cost

**Goal:** every bucket filled, nothing expanded, done in about 2 minutes. Anyone can use it without an account; saving needs a login (Section 8.2).

**Inputs (one short screen)**

1. Product or service name and unit label (optional).
2. **Units produced:** the final count. It pre-fills the "units it produced" field of every bucket.
3. **Material:** amount spent and the units it produced.
4. **Labor:** amount paid and the units it produced.
5. **Transport:** amount spent and the units it produced.
6. **Overhead:** the share of rent, power, water and similar bills for this work, and the units it produced.
7. **Machinery:** cost of equipment wear, repair and use, and the units it produced.
8. **Custom fees:** any other charge, and the units it produced.
9. Pricing method (markup or margin) and percentage.

Each bucket row asks plain questions, such as "How much did you spend on materials, and how many units did that make?". The units field defaults to the final units produced, so most users type only the amount. Buckets can differ: 24,000 spent on rice that made 8,000 packets costs 3.00 per packet, while 6,000 spent on oil that made 50,000 packets costs 0.12 per packet. A bucket with no cost is confirmed with a **None** tap, so a blank is never mistaken for a forgotten bucket. Total spend is calculated and never typed separately.

**Outputs**

- Cost per unit for each bucket, total unit cost, share of each bucket.
- Suggested selling price, profit per unit, total expected profit, equivalent markup and margin.

**Going deeper:** each bucket row has a **Break this down** action. It opens the bucket's line items with the Level 1 amount as the declared total, and the reconciliation rule (Section 4.3) takes over.

**Role in the product:** acquisition funnel and the base of every sheet. Declared totals are always saved, even after details are added.

## 6. Level 2 and Level 3: Itemized and Precision Costing

### 6.1 How levels work per bucket

Level 2 breaks a bucket into line items. Level 3 adds accounting-grade methods to the same bucket. The user opens a level only where it matters to them.

| Bucket | Level 1 | Level 2 | Level 3 |
| :-- | :-- | :-- | :-- |
| Material | One total | Bill of materials lines, packaging | Wastage %, leftover and scrap recovery |
| Labor | One total | Per worker or task: salary, hourly, piece rate | Statutory contributions, bonuses, owner and family imputed pay |
| Transport | One total | Inbound and outbound lines | Allocation per shipment by weight, volume or units |
| Overhead | One total | Rent and utility lines with business-use share | Cost pools allocated by hours, units or custom % |
| Machinery | One total | Machine lines with maintenance | Depreciation (time or output based), salvage, maintenance reserve |
| Custom fees | One total | Named fees | Amortized one-time charges, percentage-of-price fees |

- Sections 6.2 to 6.9 describe the fields. Anything called "advanced" or "adjustment" there is Level 3 and is built after Level 2.
- Every Level 2 and Level 3 result reconciles against the Level 1 amount with the rule in Section 4.3.
- Each bucket stores a `method` key, so a Level 3 method is added to the engine without changing the database (Section 11).

### 6.2 Sheet setup

- Product name, unit of measure, SKU/notes.
- Production basis (batch or period) and units produced.
- Defective/wasted units (see Wastage).
- Optional: copy from last period.

### 6.3 Module A: Direct Materials

**Inputs**

- Bill of materials lines: item, quantity, unit, unit price (picked from the saved Materials Library or entered ad hoc).
- Packaging as a material line type (so it is never forgotten).
- Per-line optional **yield/wastage %** (e.g., 5% trim loss on fabric).

**Adjustments (collapsed under "Advanced Adjustments")**

- Usable leftover inventory value (carried to next period).
- Scrap/offcut recovery value.

**Formula**

```
Net Material Cost = Sum(line quantity x unit price x (1 + line wastage%))
                    - Usable Leftover Value
                    - Scrap Recovery Value
```

Validation: leftover and scrap together cannot exceed gross material spend.

### 6.4 Module B: Labor

**Direct labor methods (per worker or task):** monthly salary, hourly rate with hours, or piece rate with pieces.

**Hidden and statutory costs (under Advanced)**

- Employer statutory contributions (e.g., EPF 12% and ETF 3% in Sri Lanka), calculated from a country preset.
- Bonuses and allowances.
- **Owner imputed pay:** hours the owner works on this product multiplied by an imputed hourly rate.
- **Family/helper imputed pay:** same method for unpaid help.

**Guidance for imputed values:** prompt "What would you pay someone else to do this work?" with an editable default (for example the local market wage for a comparable worker, user-editable). The imputed amount is labeled clearly in reports as "imputed (not cash)" so users can see cash cost and full economic cost separately.

**Formula**

```
Real Labor Cost = Direct Wages + Employer Statutory Contributions + Bonuses
                  + Owner Imputed Value + Family Imputed Value
```

Note: statutory contributions apply only to eligible paid employees, not to imputed owner/family value unless the user explicitly marks it.

### 6.5 Module C: Machinery and Assets

**Inputs:** asset name, purchase price, salvage value, purchase date, and a depreciation basis.

**Depreciation basis (user chooses; defaults offered)**

1. **Time-based (default):** useful life in years. Monthly depreciation = (Price - Salvage) / (Years x 12). Allocated to products by machine hours or share %.
2. **Output-based:** lifetime unit capacity. Per-unit depreciation = (Price - Salvage) / Lifetime Units.

Lifetime unit capacity is something users rarely know, so time-based is the default, with typical useful-life suggestions by asset category.

**Maintenance reserve:** monthly amount or % of purchase price per year, spread over units.

**Formula (output-based)**

```
Machine Cost per Unit = (Purchase Price - Salvage Value) / Lifetime Unit Capacity
                        + Maintenance Reserve per Unit
```

Validation: salvage value must be below purchase price.

### 6.6 Module D: Transport and Distribution

- **Inbound freight:** added to material cost, allocated across the materials it delivered.
- **Outbound freight:** delivery cost allocated to products.
- **Shared shipments:** a single invoice split across products by weight, volume, unit count or custom %.
- Allocation method is chosen per cost pool, not hard-wired.

### 6.7 Module E: Overhead and Utilities

Shared costs are entered once as **Cost Pools** (rent, electricity, water, internet, software, insurance) and allocated to products.

**Allocation methods (kept deliberately simple; full Activity-Based Costing is out of scope)**

1. By units produced.
2. By labor hours.
3. By machine hours.
4. Custom percentage.

Validation: custom percentages across all products using the pool must total exactly 100%; the app blocks saving otherwise and shows the remainder.

**Business-use share:** for home-based businesses, an optional "% of this bill used for business" field (e.g., 30% of home electricity).

### 6.8 Module F: Custom Fees and One-Time Charges

- Per-unit fees, percentage-of-price fees (e.g., marketplace commission, payment gateway fees), and fixed fees.
- **Amortization:** a one-time cost (design, mold, certification) spread across a chosen number of units or months.

Note: percentage-of-price fees depend on the selling price, so they are applied in the pricing step as part of a price solver rather than the cost total, to avoid circular logic.

### 6.9 Wastage and Defects

Separate from scrap recovery:

- **Material wastage %** per line (Section 6.3).
- **Defect/reject rate** at product level, reducing good units in the denominator.

Results show "cost of waste" as its own line so users see what inefficiency costs.

## 7. Outputs and Reporting

- **Cost breakdown:** unit cost split by Material, Labor, Machinery, Transport, Overhead, Fees, with percentages.
- **Cash vs economic view:** toggle that includes or excludes imputed costs.
- **Pricing panel:** markup/margin toggle, tax handling, break-even units, profit per unit and per period.
- **Visual dashboard:** donut/bar chart of cost distribution and trend of unit cost by period.
- **What-if panel:** change volume, material price or wage and see the new unit cost instantly (no saving required).
- **Exports:** PDF cost sheet (printable quotation-ready summary) and CSV of line items.
- **Transparency:** each figure expands to show its formula and inputs.

## 8. Data Model (Core Entities)

Core tables in Postgres on Supabase. Every table carries `workspace_id` (directly or through its parent) so access rules stay simple.

| Table | Key columns |
| :-- | :-- |
| profiles | id (= auth.users id), display name, country, currency, rounding |
| workspaces | id, owner id, name, country, currency |
| workspace\_members | workspace id, user id, role (owner, editor, viewer) |
| cost\_sheets | id, workspace id, name, kind (product or service), unit label, basis (batch or period), period start and end, current version id, archived at |
| sheet\_versions | id, sheet id, version number, change note, units produced, defective units, totals snapshot (jsonb), created by, created at |
| buckets | id, version id, type, label, declared total, units covered, effective total, level, method, hidden |
| line\_items | id, bucket id, name, quantity, unit, unit price, amount, units covered, kind (user or system unallocated), pinned, sort order, details (jsonb) |
| materials, workers, assets, cost\_pools | Reusable libraries per workspace, with price history |
| rate\_presets | country, kind (EPF, ETF, tax), rate, effective from |
| templates | industry or service type, bucket labels, starter lines |

### 8.1 Design rules

- **Versions are immutable.** Each save inserts a new `sheet_versions` row with its own copy of buckets and line items. `cost_sheets.current_version_id` points to the latest.
- **Level 3 needs no new tables.** Method-specific inputs live in `line_items.details` (jsonb), validated by the engine's schema for that method.
- **Price snapshots:** line items store the price at entry time, so library price changes never rewrite history.
- **Money** is stored as numeric, never float; rounding happens at display and at defined engine points.
- **Row Level Security** on every table, based on workspace membership.
- **Versioned statutory rates** with effective dates.
- **The calculation engine is a pure function** (sheet in, breakdown out), shared by the browser and the server.

### 8.2 Saving, editing and versions

1. **Calculate without an account.** The draft is kept in browser storage.
2. **Save needs login.** Tapping Save opens sign-up or login (Supabase Auth). After login the draft is stored as version 1 of a new cost sheet.
3. **Reopen and change.** The user opens a saved sheet and edits values: a new material price, a new machine, a changed product, more units. The screen shows the live change against the saved version.
4. **Save again.** Choices: **Save as new version** (with an optional note such as "flour price up") or **Save as new product** (copies the sheet for a variant).
5. **History.** A list of versions with the unit cost at each, the note and the date. Any two versions can be compared bucket by bucket, showing what moved and by how much.
6. **Restore.** Restoring an old version creates a new version copied from it; nothing is overwritten.
7. **Safety net.** Unsaved edits to an open sheet are held in the browser so a closed tab does not lose work.

## 9. UX and Progressive Disclosure

1. Start with simple inputs; **"Advanced Accounting Adjustments"** sections expand per module.
2. **Presets and templates:** country statutory presets, industry templates (bakery, tailoring, candle-making, etc.) pre-fill common cost lines.
3. **Inline help:** one-sentence explanations and examples for every accounting term.
4. **Guided defaults:** imputed pay prompt, useful-life suggestions, business-use % hints.
5. **Validation messages that teach:** e.g., "Allocations total 90%. 10% is unassigned."
6. **Reuse everywhere:** Materials Library, Worker list, saved cost pools, **Copy from last period**, **Duplicate product**.
7. **Mobile-first layout:** many target users work from phones; wizard steps must be thumb-friendly.
8. **Localization:** currency, number formats, and language support designed in from the start (Sinhala and Tamil as later additions).

## 10. Monetization and Plans

Anyone can calculate without an account; saving needs a free login. Suggested starting structure (to be validated):

|  | Free | Pro |
| :-- | :-- | :-- |
| Quick Cost | Unlimited | Unlimited |
| Saved cost sheets | Limited number | Unlimited |
| Saved history | Latest period | Full history and trends |
| Materials Library | Limited | Unlimited |
| Export | Watermarked PDF | Clean PDF and CSV |
| Templates | Basic | All industry templates |

A higher team tier (multi-user, roles) can follow once demand is proven.

## 11. Technical Approach

- **Stack:** Supabase (Postgres, Auth, Row Level Security, Edge Functions, Storage) with a React or Next.js responsive web app, PWA-capable.
- **Auth:** Supabase Auth with email and Google sign-in. Calculating needs no login; saving does. The browser draft is written to the database after login as version 1.
- **Security:** Row Level Security enabled on every table, with policies that check workspace membership. The service role key is used only in server-side functions, never in the client.
- **Calculation engine:** one pure TypeScript package used in the browser (instant recalculation) and in an Edge Function on save. The server recomputes totals and writes the snapshot, so a client can never store tampered numbers.
- **Scaling to Level 3:** each bucket has a `method` key (for example `material.itemized`, `machinery.straight_line_time`). A method is a small module with an input schema, a calculate function and a reconciliation hook. New precision means a new method and form fields, with no database migration, because method inputs live in `line_items.details` (jsonb) and are versioned with the sheet.
- **Database practice:** migrations in version control, numeric types for money, indexes on workspace, sheet and version ids, soft delete through `archived_at`.
- **Exports:** PDF from an Edge Function or server route, and CSV from the version snapshot.
- **Analytics:** funnel from first calculation to login, first saved sheet, and second version.

## 12. Non-Functional Requirements

- **Accuracy:** engine covered by test cases verified against hand-worked spreadsheets.
- **Performance:** recalculation under 100 ms; page load under 3 seconds on mid-range mobile.
- **Security and privacy:** encrypted transport and storage; per-workspace data isolation; data export and deletion on request.
- **Accessibility:** WCAG 2.1 AA basics.
- **Disclaimer:** costing aid only, not accounting, tax or legal advice; shown in the app and on exports.
- **Auditability:** formula version stored with every saved snapshot.

## 13. Delivery Roadmap

**Phase 0: Foundations (1 to 2 weeks).** Supabase project, data model and RLS design, calculation specification with worked examples (one product, one service), cost-engine package with tests, Auth setup and CI.

**Phase 1: Level 1 Quick Cost (2 to 3 weeks).** Six-bucket screen, cost per unit per bucket, correct markup and margin pricing, no-account use with a browser draft.

**Phase 2: Save and sign-in (2 to 3 weeks).** Login, draft import, saved cost sheets, my-sheets list, reopen and edit, versions with change notes and history.

**Phase 3: Level 2 Itemized (4 to 5 weeks).** Break-down per bucket, line items, the reconciliation rule with the Unallocated line, material and worker libraries, industry and service templates.

**Phase 4: Level 3 Precision (4 to 6 weeks).** Methods per bucket: wastage and scrap, statutory and imputed labor, depreciation, cost pools and allocation, amortized fees; version compare and restore.

**Phase 5: Reports and plans (2 to 3 weeks).** PDF and CSV export, plan limits and billing, onboarding polish.

**Phase 6: Growth (ongoing).** Localization, team workspaces, more country presets.

Timelines assume one to two developers and should be adjusted after Phase 0.

## 14. Risks and Mitigations

| Risk | Mitigation |
| :-- | :-- |
| Data entry burden causes abandonment | Libraries, templates, copy-last-period, skippable steps, partial results always shown |
| Users enter wrong or guessed values | Defaults, help text, sanity warnings (e.g., unit cost far above or below typical) |
| Period and batch confusion | Single Product+Period model with a batch wrapper view |
| Allocation errors in shared costs | Mandatory 100% validation and visible unallocated remainder |
| Law changes to statutory rates | Versioned, editable presets with effective dates and a verify note |
| Users price products using wrong numbers | Transparent formulas, disclaimer, tested engine |
| Scope creep into full accounting | Explicit non-goals (below) |

### Non-goals (v1)

- Full Activity-Based Costing.
- General ledger, invoicing, payroll or inventory management.
- Tax filing or statutory reporting.
- Accounting software integrations (reconsider after launch).

## 15. Changes From Earlier Versions

### Version 3 (this version)

1. Level 1 asks for one amount in each of the six buckets, with none expanded, instead of one total spend. The total is calculated.
2. Added the reconciliation rule: itemized lines below the Level 1 amount create an editable Unallocated line; lines above it override the Level 1 amount (Section 4.3).
3. Replaced the two tiers with three levels set per bucket, so Level 3 arrives without schema changes.
4. Replaced Product + Period with the Cost Sheet, which uses a batch or a period basis.
5. Added support for services (unit labels, renameable and hideable buckets).
6. Calculating needs no account; saving needs login, and browser drafts import after sign-in.
7. Saved sheets are versioned with change notes, history, compare and restore.
8. Technical plan moved to Supabase (Postgres, Auth, RLS, Edge Functions).
9. Roadmap reordered so saving and sign-in come before itemized and precision levels.

### Version 2

Corrected markup and margin math, simple allocation methods with 100% validation, cost pools, time-based depreciation default, imputed labor guidance, versioned statutory rates, wastage, tax and rounding handling, reuse features and non-goals.

## 16. Open Decisions

1. Which countries and statutory presets at launch (Sri Lanka first)?
2. Free vs paid boundary: how many saved sheets and versions on the free plan.
3. Should Unallocated lines show in customer-facing exports, or be merged into the bucket total?
4. Which industry and service templates first, based on target-user interviews?
5. One workspace per user at launch, or team workspaces from day one?
6. Offline mode for users with unreliable connectivity?

**Recommended next step:** write the calculation specification with worked examples of the three reconciliation cases (items below, matching, above) and use them as cost-engine tests, then design the Supabase schema and RLS policies.
