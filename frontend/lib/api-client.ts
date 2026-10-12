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
  unit_label: string;
  units_produced: string;
  defective_units: string;
  good_units: string;
  default_units_covered_scope: 'all' | 'overhead_only';
  total_cost: string;
  unit_cost: string;
  cash_total_cost: string;
  economic_total_cost: string;
  cash_unit_cost: string;
  economic_unit_cost: string;
  cost_view: 'cash' | 'economic';
  break_even_units: string | null;
  break_even_ready: boolean;
  is_loss_making: boolean;
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
    itemized_total: string;
    economic_itemized_total: string;
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
      quantity: string;
      unit?: string;
      unit_price: string;
      amount: string;
      fixed_amount: string;
      variable_amount: string;
      units_covered: string;
      cost_per_unit: string;
      kind: string;
      pinned: boolean;
      is_imputed: boolean;
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
    .filter(([, bucket]) => !bucket.isNone && (
      bucket.totalSpent.trim() !== ''
      || bucket.items.some((item) =>
        item.name.trim()
        && (
          item.amount.trim()
          || ['units', 'periods'].includes(item.details?.depreciation_method ?? '')
        ),
      )
    ))
    .map(([key, bucket]) => ({
      type: key,
      label: bucketLabel(key),
      declared_total: bucket.totalSpent.trim()
        ? normalizeDecimalInput(bucket.totalSpent, locale)
        : '0',
      units_covered: bucket.unitsCovered.trim()
        ? normalizeDecimalInput(bucket.unitsCovered, locale)
        : undefined,
      level: bucket.items.length === 0
        ? 1
        : bucket.items.some((item) =>
          item.isImputed || Object.values(item.details ?? {}).some((value) => value.trim()),
        )
          ? 3
          : 2,
      hidden: false,
      items: bucket.items
        .filter((item) =>
          item.name.trim() !== ''
          && (
            item.amount.trim() !== ''
            || ['units', 'periods'].includes(item.details?.depreciation_method ?? '')
          ),
        )
        .map((item) => ({
          name: item.name.trim(),
          quantity: item.purchaseQuantity?.trim()
            ? normalizeDecimalInput(item.purchaseQuantity, locale)
            : '1',
          ...(item.purchaseUnit?.trim() ? { unit: item.purchaseUnit.trim() } : {}),
          ...(item.amount.trim()
            ? { amount: normalizeDecimalInput(item.amount, locale) }
            : {}),
          units_covered: item.unitsCovered.trim()
            ? normalizeDecimalInput(item.unitsCovered, locale)
            : undefined,
          is_imputed: item.isImputed ?? false,
          details: Object.fromEntries(
            Object.entries(item.details ?? {})
              .filter(([detailKey, value]) =>
                value.trim() !== ''
                && !(
                  detailKey === 'amortization_units'
                  && item.details?.amortization_method === 'none'
                ),
              )
              .map(([detailKey, value]) => [
                detailKey,
                detailKey.endsWith('_percentage')
                  || detailKey.endsWith('_amount')
                  || detailKey.endsWith('_units')
                  || detailKey.endsWith('_price')
                  || detailKey.endsWith('_measure')
                  ? normalizeDecimalInput(value, locale)
                  : value,
              ]),
          ),
        })),
    }));

  return {
    unit_label: draft.unitLabel.trim(),
    units_produced: normalizeDecimalInput(draft.unitsProduced, locale),
    defective_units: draft.defectiveUnits.trim()
      ? normalizeDecimalInput(draft.defectiveUnits, locale)
      : '0',
    default_units_covered_scope: draft.defaultUnitsCoveredScope,
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

  const send = (token?: string) => {
    const requestHeaders = new Headers(headers);
    if (token) requestHeaders.set('Authorization', `Bearer ${token}`);
    return fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: requestHeaders,
    });
  };

  let response: Response;
  if (authenticated) {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new ApiError('Authentication required', 401);
    }
    response = await send(session.access_token);
    if (response.status === 401) {
      const {
        data: { session: refreshedSession },
      } = await supabase.auth.refreshSession();
      if (refreshedSession?.access_token) {
        response = await send(refreshedSession.access_token);
      }
    }
  } else {
    response = await send();
  }

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
        unit_label: draft.unitLabel.trim(),
        basis: draft.productionBasis,
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

    const endpoint = `${API_BASE}/cost-sheets/versions/${versionId}/export/${format}`;
    let response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (response.status === 401) {
      const {
        data: { session: refreshedSession },
      } = await supabase.auth.refreshSession();
      if (refreshedSession?.access_token) {
        response = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${refreshedSession.access_token}` },
        });
      }
    }
    if (!response.ok) {
      const responseBody = (await response.json().catch(() => null)) as
        | { detail?: string; message?: string }
        | null;
      throw new ApiError(
        responseBody?.detail || responseBody?.message || response.statusText,
        response.status,
      );
    }
    return response.blob();
  })();
}
