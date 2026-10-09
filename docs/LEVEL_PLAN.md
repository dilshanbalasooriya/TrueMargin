# SaaS Pricing Engine Specification (Finalized MVP)

## 1. Core Architecture & Workflow
* **Frontend:** Nuxt 3 (Reactive 3-level progressive disclosure UI, Pinia state).
* **Backend Engine:** FastAPI (Handles complex recursive math, batch calculations, and Level 3 modifier roll-ups).
* **Database & Auth:** Supabase PostgreSQL with Anonymous-to-Registered conversion flow.
* **Versioning & Reports:** Costing calculations generate locked **snapshots/reports**. Users can duplicate and modify past quotes to create new cost versions without altering historical data.
* **Currency:** Single currency selected per project/quote.

---

## 2. The 3-Level Progressive Calculation Model

### Level 1: Quick Baseline
* **Goal:** Immediate unit price estimation with minimal friction.
* **Inputs:** Flat estimates (e.g., total material guess, rough labor hours, simple profit margin, flat tax/overhead).

### Level 2: Standard Formulas
* **Goal:** Standardized business math.
* **Inputs:** 
  * Bulk-to-unit material splits (e.g., buying 10kg for $50, using 200g).
  * Rate × Time for labor.
  * Monthly fixed overhead split across estimated monthly unit volume.
  * Standard shipping/transport fees.

### Level 3: Advanced Modifiers (Granular Accuracy)
* **Goal:** Professional-grade precision with backend automated aggregation.
* **Inputs:**
  * **Wastage / Yield:** Granular scrap/wastage percentages per raw material, automatically summed by the FastAPI backend.
  * **Logistics Breakdown:** Separated Inbound shipping (added to material landing cost) and Outbound shipping (added to final unit fulfillment).
  * **Labor Burdens:** Payroll taxes, insurance, or multi-step labor tracking.
  * **Equipment Depreciation:** CapEx machinery lifespan split or machine-hour operational costs.
  * **Line-Item Taxes & Tariffs:** Specific duties on imported components.