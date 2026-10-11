import { createClient } from '@/lib/supabase/client';
import { normalizeDecimalInput } from '@/lib/numbers';
import type { GuestDraft } from '@/store/useCalculatorStore';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface CalculationResult {
  units_produced: string;
  defective_units: string;
  good_units: string;
  total_cost: string;
  unit_cost: string;
  pricing_type: 'markup' | 'margin';
  pricing_percentage: string;
  suggested_price: string;
  profit_per_unit: string;
  total_expected_profit: string;
  equivalent_markup_or_margin: string;
  bucket_breakdown: Array<{
    type: string;
    label: string;
    level: number;
    hidden: boolean;
    declared_total: string;
    effective_total: string;
    units_covered: string;
    cost_per_unit: string;
    percentage_of_total: string;
    reconciliation_status:
      | 'no_items'
      | 'matched'
      | 'unallocated_added'
      | 'exceeded';
    items: Array<{
      name: string;
      amount: string;
      units_covered: string;
      cost_per_unit: string;
      kind: string;
      pinned: boolean;
    }>;
  }>;
}

export interface UserProfile {
  id: string;
  display_name: string;
  country: string | null;
  currency: string;
  rounding_preference: number;
  workspaces: Array<{
    id: string;
    name: string;
    role: string;
    country: string;
    currency: string;
  }>;
}

export interface CostSheet {
  id: string;
  workspace_id: string;
  name: string;
  kind: 'product' | 'service';
  unit_label: string;
  basis: string;
  current_version_id: string | null;
  current_version: {
    id: string;
    version_number: number;
    unit_cost: string;
    currency_code: string;
    created_at: string;
  } | null;
}

export interface SavedVersion {
  id: string;
  sheet_id: string;
  version_number: number;
  unit_cost: string;
  currency_code: string;
}

export function buildCalculationRequest(draft: GuestDraft, locale = 'en') {
  const buckets = Object.entries(draft.buckets)
    .filter(([, bucket]) =>
      bucket.isNone
      || bucket.totalSpent.trim() !== ''
      || bucket.items.some((item) => item.name.trim() && item.amount.trim()),
    )
    .map(([key, bucket]) => ({
      type: key,
      label: bucketLabel(key),
      declared_total: bucket.isNone ? '0' : normalizeDecimalInput(bucket.totalSpent, locale),
      units_covered: bucket.unitsCovered.trim()
        ? normalizeDecimalInput(bucket.unitsCovered, locale)
        : undefined,
      level: bucket.items.length > 0 ? 2 : 1,
      hidden: false,
      items: bucket.items
        .filter((item) => item.name.trim() !== '' && item.amount.trim() !== '')
        .map((item) => ({
          name: item.name.trim(),
          amount: normalizeDecimalInput(item.amount, locale),
          units_covered: item.unitsCovered.trim()
            ? normalizeDecimalInput(item.unitsCovered, locale)
            : undefined,
        })),
    }));

  return {
    units_produced: normalizeDecimalInput(draft.unitsProduced, locale),
    defective_units: draft.defectiveUnits.trim()
      ? normalizeDecimalInput(draft.defectiveUnits, locale)
      : '0',
    pricing_type: draft.pricingType,
    pricing_percentage: draft.pricingPercentage.trim()
      ? normalizeDecimalInput(draft.pricingPercentage, locale)
      : '0',
    buckets,
  };
}

function bucketLabel(key: string): string {
  const labels: Record<string, string> = {
    material: 'Materials',
    labor: 'Labor',
    transport: 'Transport',
    overhead: 'Overhead',
    machinery: 'Machinery',
    custom_fees: 'Custom fees',
  };
  return labels[key] ?? key;
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  authenticated = false,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (authenticated) {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new ApiError('Authentication required', 401);
    }
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const responseBody = (await response.json().catch(() => null)) as
      | { detail?: string; message?: string }
      | null;
    throw new ApiError(
      responseBody?.detail || responseBody?.message || response.statusText,
      response.status,
    );
  }

  return (await response.json()) as T;
}

export function calculateCostSheet(
  draft: GuestDraft,
  locale = 'en',
  signal?: AbortSignal,
): Promise<CalculationResult> {
  return fetchApi<CalculationResult>(
    '/calculation/compute',
    {
      method: 'POST',
      body: JSON.stringify(buildCalculationRequest(draft, locale)),
      signal,
    },
  );
}

export async function syncUserProfile(
  registration?: { display_name?: string; currency?: string },
): Promise<UserProfile> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const metadata = session?.user.user_metadata ?? {};
  const syncData = registration ?? {
    ...(typeof metadata.display_name === 'string' ? { display_name: metadata.display_name } : {}),
    ...(typeof metadata.currency === 'string' ? { currency: metadata.currency.toUpperCase() } : {}),
  };
  return fetchApi<UserProfile>(
    '/auth/sync',
    {
      method: 'POST',
      ...(Object.keys(syncData).length > 0 ? { body: JSON.stringify(syncData) } : {}),
    },
    true,
  );
}

export async function saveCostSheet(
  draft: GuestDraft,
  workspaceId: string,
  locale = 'en',
): Promise<CostSheet | SavedVersion> {
  const calculationData = buildCalculationRequest(draft, locale);

  if (draft.sheetId) {
    return fetchApi<SavedVersion>(
      `/cost-sheets/${draft.sheetId}/versions`,
      {
        method: 'POST',
        body: JSON.stringify({
          currency_code: draft.currencyCode,
          calculation_data: calculationData,
        }),
      },
      true,
    );
  }

  return fetchApi<CostSheet>(
    `/workspaces/${workspaceId}/cost-sheets`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: draft.productName.trim(),
        kind: draft.kind,
        unit_label: draft.unitLabel.trim() || 'unit',
        basis: 'batch',
        currency_code: draft.currencyCode,
        calculation_data: calculationData,
      }),
    },
    true,
  );
}

export function listCostSheets(workspaceId: string): Promise<CostSheet[]> {
  return fetchApi<CostSheet[]>(
    `/workspaces/${workspaceId}/cost-sheets`,
    {},
    true,
  );
}

export function downloadVersionReport(
  versionId: string,
  format: 'csv' | 'pdf',
): Promise<Blob> {
  return (async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new ApiError('Authentication required', 401);
    }

    const response = await fetch(
      `${API_BASE}/cost-sheets/versions/${versionId}/export/${format}`,
      { headers: { Authorization: `Bearer ${session.access_token}` } },
    );
    if (!response.ok) {
      throw new ApiError(response.statusText, response.status);
    }
    return response.blob();
  })();
}
