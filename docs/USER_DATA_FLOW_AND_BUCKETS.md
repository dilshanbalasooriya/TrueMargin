# How TrueMargin Collects and Uses Cost Data

This guide describes the user journey, what each cost bucket means, and how entered values travel through the system. It separates the **current implementation** from the **planned Level 2 and Level 3 experience** so users and developers can tell what works today.

## At a glance

TrueMargin is intended to help a business answer: **How much does one good unit, job, or service really cost, and what price should I charge?**

The user enters an output quantity and costs in six buckets. The calculation engine converts those costs into per-unit amounts, reconciles itemized details against bucket totals, and optionally calculates a suggested selling price. A saved cost sheet keeps a versioned snapshot.

| Level | User effort | What the level adds |
| --- | --- | --- |
| **1 — Quick Cost** | One total per bucket | Fast estimate from the six bucket totals |
| **2 — Itemized Cost** | Named lines inside selected buckets | Explains what makes up each total; compares lines with the bucket total |
| **3 — Precision Cost** | Extra method-specific details | Intended allocations and accounting adjustments, such as depreciation or wastage |

Levels are per bucket, not per sheet: a user could itemize materials and leave labor as a single amount.

## User journey

### Intended experience

1. Name the product or service and say how many units were produced. Optionally identify defective units.
2. Answer the six short bucket questions. A bucket can be marked as having no cost rather than left ambiguous.
3. See cost per unit and price guidance. Open **Break this down** only for buckets needing more detail.
4. Save by signing in. Further saves create versions, so historical calculations can be reviewed without overwriting them.

The design goal is progressive disclosure: plain-language questions and a quick result first; details, help, and advanced accounting fields only when requested.

### What the current screen does

The current page shows product/service name, units produced, and six cards with a **Total Spent** field and a “no costs” control. The draft is held in browser storage by Zustand. Signing in uses Supabase; saving then syncs the profile/workspace and sends the draft to FastAPI.

Some important planned behavior is not wired to this screen yet:

- The **Break this down** button has no handler and does not open line-item entry.
- The page does not call the public `/calculation/compute` endpoint for live calculations. The sidebar currently adds bucket amounts and labels their sum “Total Unit Cost”; it does not divide by units or show the backend’s full pricing result.
- The current draft UI does not collect defective units, units covered per bucket, pricing type/percentage, or line items.
- The save adapter currently sends Level 1 bucket totals only; it does not send line items or bucket units covered.

So the backend supports more than the current user interface exposes. The richer flow described below is the intended product behavior, not a claim that all controls are already available.

## What the user enters and what the backend receives

The calculation request is a complete, stateless calculation: production quantity, defective quantity, pricing type and percentage, plus a list of buckets. A bucket can carry its type and label, declared total, units covered, level, method, hidden flag, and line items. A line item can carry a name, quantity, unit, unit price or explicit amount, units covered, kind, pinned flag, and extra `details`.

The current calculation endpoint is `POST /api/v1/calculation/compute`. It validates that production is positive, defective units are non-negative and less than production, and a margin is below 100%. It returns good units, total and per-unit costs, bucket breakdowns, suggested price and profit metrics. It is public/stateless; saving is a separate authenticated operation.

### How the numbers are interpreted

- **Good units** = units produced − defective units.
- A bucket's units covered defaults to good units unless a positive bucket-specific quantity is supplied.
- A line's amount is its explicit amount when present; otherwise it is quantity × unit price.
- A line's units covered defaults to the bucket's units covered. Its cost per unit is amount ÷ units covered.
- The total unit cost is the sum of the visible buckets' cost per unit. Hidden buckets are skipped.
- Markup price = unit cost × (1 + markup%). Margin price = unit cost ÷ (1 − margin%). Profit per unit is price minus cost; total expected profit multiplies that by good units.

Money values use decimal types in the backend and are rounded to four decimal places in the calculation response.

## The six buckets, from the user's perspective

All buckets use the same calculation structure; the difference is what the user should include. The examples below describe the product intent. A bucket's total is the amount assigned to this product/service and production run or period—not necessarily the whole business bill.

| Bucket | Plain-language question and examples | Level 1 | Level 2 — intended detail | Level 3 — planned precision |
| --- | --- | --- | --- | --- |
| **Materials** (`material`) | What inputs go into making or delivering this? Ingredients, raw materials, parts, and packaging. | Enter one total spent. | Add a line per input, with name, quantity, unit, and unit price or amount. A reusable Materials Library is planned. | Per-line wastage/yield and, later, usable leftovers or scrap recovery. |
| **Labor** (`labor`) | What labor is directly needed to make or deliver it? Include paid production work. | Enter the labor total. | Add workers or tasks and their amounts; the plan includes hourly, monthly-salary, and piece-rate approaches. | Planned employer contributions where applicable, bonuses/allowances, and clearly labeled non-cash imputed owner/family labor. |
| **Transport** (`transport`) | What does it cost to bring inputs in or deliver the output? Fuel, courier, freight, delivery fees, and vehicle use. | Enter a transport total. | Separate inbound, outbound, or shipment costs into named lines. | Planned ways to divide shared shipments across products, such as by weight, volume, or unit count. |
| **Overhead** (`overhead`) | What shared business costs support this work? Rent, electricity, water, internet, insurance, and administration. | Enter the share assigned to this work—not automatically the entire bill. | Name the included overhead costs. | Planned cost pools, business-use share for mixed home/business bills, and allocation by units, labor hours, machine hours, or an explicit share. |
| **Machinery** (`machinery`) | What equipment cost is consumed by this work? Equipment use, wear, and maintenance. | Enter an amount for equipment use/maintenance. | Add machine or asset lines and their allocated amounts. | Planned time-based or output-based depreciation using purchase price, salvage value, useful life or lifetime capacity; include maintenance reserve. |
| **Custom Fees** (`custom_fees`, sent as a bucket type) | What relevant cost does not fit the other buckets? Examples include permits, platform/payment charges, or one-time setup costs. | Enter a total for other costs. | Name each fee and enter its amount. | Planned amortization for one-time costs. Fees calculated as a percentage of selling price belong in pricing because they depend on the price itself. |

For services, the same cost logic applies: the “unit” might be a job, hour, session, trip, or another chosen unit. The product plan allows bucket labels to be renamed or hidden for different business types; the current screen uses fixed labels.

## How the levels work

### Level 1 — Quick Cost

The user puts one declared total in each applicable bucket. The engine divides each bucket amount by its units covered (normally all good units) and adds the per-unit results. A bucket with no line items keeps its declared total as its effective total. In the plan, a **None** action distinguishes a confirmed zero from a forgotten blank; the current UI has a version of this control, but the save adapter omits buckets marked none.

### Level 2 — Itemized Cost

The user opens a bucket and names the things making up its Level 1 amount. The declared total remains the reference value:

| Line items compared with declared total | Engine behavior | Intended explanation to user |
| --- | --- | --- |
| No items | Uses the declared total (`no_items`) | Keep the quick estimate |
| Items equal total | Uses the total (`matched`) | The bucket is fully itemized |
| Items below total | Adds a system **Unallocated** line for the difference (`unallocated_added`) | Some cost is still not named |
| Items above total | Uses the sum of items (`exceeded`) | The itemized costs are higher than the estimate |

The current engine returns these statuses and creates the unallocated line when needed. The plan additionally describes allowing the user to rename/edit/pin or delete that line and undo an exceeded total; those controls are not present in the current page.

**Units caveat:** the product plan says reconciliation should compare cost per final unit when inputs cover different unit counts. The current engine compares item amounts with the declared total as raw amounts, then calculates per-unit results. Different units-covered values can therefore make current reconciliation differ from the plan.

### Level 3 — Precision Cost

The intended goal is to make less-obvious costs visible using extra values attached to a bucket or line. The data model has a generic `method` and JSON `details` field that can hold such inputs. Current calculation code does not apply depreciation, statutory contributions, wastage, allocation, amortization, or method-specific rules: setting a bucket to level 3 does not by itself perform a Level 3 calculation. These require future forms, validation, and calculation logic.

## Saving, history, and reusable data

When an authenticated user saves, the API recalculates the submitted data, creates a cost sheet and version 1 (or adds a later version), and stores a calculation snapshot plus related bucket and line-item records. A saved version includes inputs/output such as production counts, costs, bucket breakdown, pricing, and profit. The current version is referenced by the cost sheet; older versions remain available for history, comparison, and restore-as-new-version.

The data model also includes workspace-scoped reusable **materials**, **workers**, **assets**, and **cost pools**. Their APIs support listing, creating, and deleting library records. The current calculator page does not yet select these library items when collecting costs. Workspace roles control access: viewers can read; editors can change sheets/libraries; owners have the highest role and are required for permanent sheet deletion.

CSV and printable HTML/PDF-style exports are built from a saved version snapshot, not from the unsaved browser draft.

## What to take away

The intended user experience is: **start with six understandable totals → inspect only buckets that need explanation → add precision when useful → see unit cost and pricing → save a traceable version.** The backend already has the calculation contract, reconciliation, persistence/versioning, libraries, and exports. The current frontend mainly exposes the first data-entry step; live backend results, interactive itemization, and Level 3 methods still need to be connected or built.

## Source files

- Product intent: [product plan](./Unit%20Cost%20Calculation%20SaaS%20Complete%20Product%20Plan%20(v2).md) and [frontend plan](./Frontend%20UI%20and%20UX%20Plan.md).
- Current calculation contract and math: [calculation schema](../backend/app/schemas/calculation.py), [calculation service](../backend/app/services/calculation_service.py), and [calculation route](../backend/app/api/v1/routers/calculation.py).
- Persistence and storage shapes: [cost-sheet schema](../backend/app/schemas/cost_sheet.py), [cost-sheet service](../backend/app/services/cost_sheet_service.py), and [models](../backend/app/models/models.py).
- Current entry screen and draft mapping: [calculator page](../frontend/app/%5Blocale%5D/page.tsx), [bucket card](../frontend/components/calculator/BucketCard.tsx), [dashboard](../frontend/components/dashboard/DashboardPanel.tsx), [draft store](../frontend/store/useCalculatorStore.ts), and [API client](../frontend/lib/api-client.ts).
