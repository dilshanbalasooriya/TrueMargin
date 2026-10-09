1. projects (The Master Container & Snapshot)
This table holds the high-level settings you defined in Steps 1, 2, and 5 of your user flow. When a user finalizes a quote, you simply set is_snapshot = true to lock it permanently.

id (UUID, Primary Key)

user_id (UUID, Foreign Key to Supabase Auth - Nullable for anonymous users)

session_id (String - Stores temporary ID for anonymous users before they sign up)

name (String - e.g., "Standard Web Audit")

business_type (String - Product, Service, Resell)

currency (String - e.g., "USD", "LKR")

target_margin_pct (Decimal - e.g., 40.0)

platform_fee_pct (Decimal - e.g., 3.0)

tax_pct (Decimal - e.g., 15.0)

final_unit_cost (Decimal - Computed by FastAPI and saved here)

final_selling_price (Decimal - Computed by FastAPI and saved here)

is_snapshot (Boolean - Default: false. Locks the record when saved as a final quote)

created_at / updated_at (Timestamps)

2. line_items (The Universal 3-Level Bucket Table)
Instead of making separate tables for Materials, Labor, and Machinery (which is a nightmare to query), use one table for all line items. You use the bucket_category column to group them on the Nuxt frontend, and a details (JSONB) column to store the completely different inputs of Level 2 and Level 3.

id (UUID, Primary Key)

project_id (UUID, Foreign Key to projects)

bucket_category (String - Material, Labor, Transport, Overhead, Machinery, Subcontractor)

name (String - e.g., "Cotton Fabric" or "Senior Dev")

input_level (Integer - 1, 2, or 3. Tells the UI how far to expand the row)

base_cost (Decimal - The calculated baseline cost before L3 modifiers)

final_item_cost (Decimal - The exact total for this row, calculated by FastAPI)

details (JSONB - This is the secret weapon. See below.)