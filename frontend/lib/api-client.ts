import { createClient } from '@/lib/supabase/client';
import { GuestDraft } from '@/store/useCalculatorStore';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error("No active session found");
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  return response.json();
}

export async function syncUserProfile() {
  return fetchWithAuth('/auth/sync', { method: 'POST' });
}

export async function saveCostSheet(draft: GuestDraft, workspaceId: string) {
  // Map our simple draft to the complex backend CostSheetCreateRequest schema
  
  const buckets = Object.values(draft.buckets).map(b => ({
    type: b.key,
    label: b.key.charAt(0).toUpperCase() + b.key.slice(1),
    declared_total: parseFloat(b.totalSpent || "0"),
    level: 1,
    hidden: b.isNone,
    items: []
  })).filter(b => !b.hidden && b.declared_total > 0);

  const payload = {
    name: draft.productName || "Untitled Product",
    kind: "product",
    unit_label: "unit",
    basis: "batch",
    calculation_data: {
      units_produced: parseFloat(draft.unitsProduced || "1"),
      defective_units: 0.0,
      pricing_type: "markup",
      pricing_percentage: 0.0,
      buckets: buckets
    }
  };

  // If we already have a sheetId, we should create a new version (for simplicity, we'll just implement create first, or use a PUT if the backend supported it, but backend uses POST /cost-sheets/{sheet_id}/versions)
  if (draft.sheetId) {
    return fetchWithAuth(`/cost-sheets/${draft.sheetId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ calculation_data: payload.calculation_data })
    });
  }

  // Otherwise, create new sheet
  return fetchWithAuth(`/workspaces/${workspaceId}/cost-sheets`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
