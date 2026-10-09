# Unit Cost Pricing SaaS

## Tech Stack Architecture
* **Frontend:** Nuxt 3 (Vue.js), Pinia (State Management), TailwindCSS
* **Backend Engine:** FastAPI (Python), Pydantic (Data Validation)
* **Database & Auth:** Supabase (PostgreSQL, Row Level Security, GoTrue Auth)

## Development To-Do List

### 1. Database & Auth (Supabase)
- [ ] Enable **Anonymous Sign-ins** in Supabase Auth settings.
- [ ] Create core PostgreSQL tables (`Estimates`, `Overhead_Pools`).
- [ ] Setup a `JSONB` column to store the nested pricing tree structure.
- [ ] Write Row Level Security (RLS) policies to ensure users (both anon and registered) can only access their own data via `auth.uid()`.
- [ ] Create a database cron job to delete abandoned anonymous records older than 30 days.

### 2. Backend Engine (FastAPI)
- [ ] Scaffold the FastAPI application.
- [ ] Create a dependency to validate Supabase JWTs attached to requests.
- [ ] Define strict Pydantic models for the 4 pillars (Materials, Labor, Transport, Overhead).
- [ ] Build the bottom-up calculation logic (summing nested JSON sub-items up to parent totals).

### 3. Frontend UI/UX (Nuxt 3)
- [ ] Scaffold Nuxt 3 with `@nuxtjs/supabase` and Pinia.
- [ ] Build the **Unified Accordion UI** (Progressive disclosure for Levels 1, 2, and 3).
- [ ] Implement the reactive logic: Auto-override manual parent inputs when detailed child items are added.
- [ ] Build the real-time **Estimate Confidence Score** meter (Low for manual entries, High for detailed itemization).

### 4. Product-Led Growth (PLG) Flow
- [ ] Trigger `supabase.auth.signInAnonymously()` seamlessly when a guest loads the app.
- [ ] Sync real-time pricing data to the database using the anonymous `uid`.
- [ ] Build the conversion wall UI (Prompt login when they click "Save," "Export PDF," or "Advanced Settings").
- [ ] Test the automatic conversion of an anonymous account to a permanent email/password account.