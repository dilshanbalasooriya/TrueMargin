import { createClient } from '@/lib/supabase/client';
import { normalizeDecimalInput, parseDecimalInput } from '@/lib/numbers';
import type { BucketDraft, GuestDraft, LineItemDraft } from '@/store/useCalculatorStore';

export function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;
  }
  return 'http://localhost:8000/api/v1';
}

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
  seller_paid_delivery_per_unit: string;
  customer_paid_delivery_per_unit: string;
  break_even_units: string | null;
  break_even_ready: boolean;
  is_loss_making: boolean;
  pricing_type: 'markup' | 'margin';
  pricing_percentage: string;
  suggested_price: string;
  suggested_product_price: string;
  suggested_delivered_price: string;
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
      details?: Record<string, string>;
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

export function isCalculableLineItem(item: LineItemDraft, locale = 'en'): boolean {
  if (!item.name?.trim()) return false;

  const depMethod = item.details?.depreciation_method;
  if (depMethod === 'units') {
    const purchase = parseDecimalInput(item.details?.purchase_price ?? '', locale);
    const lifetime = parseDecimalInput(item.details?.lifetime_units ?? '', locale);
    const salvage = item.details?.salvage_value?.trim()
      ? parseDecimalInput(item.details.salvage_value, locale)
      : 0;
    if (purchase === null || purchase < 0 || lifetime === null || lifetime <= 0) return false;
    if (salvage === null || salvage < 0 || salvage > purchase) return false;
    return true;
  }
  if (depMethod === 'periods') {
    const purchase = parseDecimalInput(item.details?.purchase_price ?? '', locale);
    const periods = parseDecimalInput(item.details?.useful_life_periods ?? '', locale);
    const salvage = item.details?.salvage_value?.trim()
      ? parseDecimalInput(item.details.salvage_value, locale)
      : 0;
    if (purchase === null || purchase < 0 || periods === null || periods <= 0) return false;
    if (salvage === null || salvage < 0 || salvage > purchase) return false;
    return true;
  }

  // Non-depreciation item (direct cost, rental, labor, materials, overhead, etc.)
  const amount = parseDecimalInput(item.amount, locale);
  return amount !== null && amount >= 0;
}

export function buildCalculationRequest(draft: GuestDraft, locale = 'en') {
  const buckets = Object.entries(draft.buckets)
    .filter(([, bucket]) => !bucket.isNone && (
      bucket.totalSpent.trim() !== ''
      || bucket.items.some((item) => isCalculableLineItem(item, locale))
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
        .filter((item) => isCalculableLineItem(item, locale))
        .map((item) => {
          const depMethod = item.details?.depreciation_method ?? 'none';
          return {
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
            ...(item.details?.cost_behavior
              ? { cost_behavior: item.details.cost_behavior as 'variable' | 'fixed' }
              : {}),
            details: {
              ...Object.fromEntries(
                Object.entries(item.details ?? {})
                  .filter(([detailKey, value]) =>
                    value.trim() !== ''
                    && !(
                      detailKey === 'amortization_units'
                      && item.details?.amortization_method === 'none'
                    )
                    && !(
                      (detailKey === 'lifetime_units' || detailKey === 'useful_life_periods')
                      && depMethod === 'none'
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
              ...(key === 'material' ? { source_item_id: item.id } : {}),
            },
          };
        }),
    }));

  return {
    unit_label: draft.unitLabel.trim() || 'unit',
    units_produced: normalizeDecimalInput(draft.unitsProduced, locale),
    defective_units: draft.defectiveUnits.trim()
      ? normalizeDecimalInput(draft.defectiveUnits, locale)
      : '0',
    default_units_covered_scope: draft.defaultUnitsCoveredScope || 'all',
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
    return fetch(`${getApiBase()}${endpoint}`, {
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

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }

  const text = await response.text();
  if (!text || text.trim() === '') {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined as T;
  }
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
  registration?: { display_name?: string; currency?: string; country?: string },
): Promise<UserProfile> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const metadata = session?.user.user_metadata ?? {};
  const syncData = registration ?? {
    ...(typeof metadata.display_name === 'string' ? { display_name: metadata.display_name } : {}),
    ...(typeof metadata.currency === 'string' ? { currency: metadata.currency.toUpperCase() } : {}),
    ...(typeof metadata.country === 'string' ? { country: metadata.country } : {}),
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
  changeNote?: string,
): Promise<CostSheet | SavedVersion> {
  const calculationData = buildCalculationRequest(draft, locale);

  if (draft.sheetId) {
    return fetchApi<SavedVersion>(
      `/cost-sheets/${draft.sheetId}/versions`,
      {
        method: 'POST',
        body: JSON.stringify({
          change_note: changeNote?.trim() ? changeNote.trim() : undefined,
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
  locale = 'en',
): Promise<Blob> {
  return (async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new ApiError('Authentication required', 401);
    }

    const endpoint = `${getApiBase()}/cost-sheets/versions/${versionId}/export/${format}?locale=${encodeURIComponent(locale)}`;
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

export interface SheetVersionDetail {
  id: string;
  sheet_id: string;
  version_number: number;
  unit_cost: string;
  currency_code: string;
  created_at: string;
  unit_label: string;
  units_produced?: string;
  defective_units?: string;
  pricing_type: 'markup' | 'margin';
  pricing_percentage: string;
  suggested_price?: string;
  suggested_product_price?: string;
  suggested_delivered_price?: string;
  default_units_covered_scope?: 'all' | 'overhead_only';
  seller_paid_delivery_per_unit?: string;
  customer_paid_delivery_per_unit?: string;
  bucket_breakdown: Array<{
    type: string;
    label: string;
    level: number;
    hidden: boolean;
    declared_total: string;
    effective_total: string;
    units_covered: string;
    cost_per_unit: string;
    items: Array<{
      name: string;
      quantity?: string;
      unit?: string;
      amount: string;
      units_covered: string;
      is_imputed?: boolean;
      details?: Record<string, string>;
    }>;
  }>;
}

export interface SheetVersionSummary {
  id: string;
  version_number: number;
  change_note?: string | null;
  units_produced: string | number;
  defective_units: string | number;
  good_units: string | number;
  total_cost: string | number;
  unit_cost: string | number;
  currency_code: string;
  created_at: string;
}

export function listSheetVersions(sheetId: string): Promise<SheetVersionSummary[]> {
  return fetchApi<SheetVersionSummary[]>(
    `/cost-sheets/${sheetId}/versions`,
    {},
    true,
  );
}

export function getVersionDetail(versionId: string): Promise<SheetVersionDetail> {
  return fetchApi<SheetVersionDetail>(
    `/cost-sheets/versions/${versionId}`,
    {},
    true,
  );
}

export function deleteCostSheet(sheetId: string, permanent = false): Promise<void> {
  return fetchApi<void>(
    `/cost-sheets/${sheetId}?permanent=${permanent}`,
    { method: 'DELETE' },
    true,
  );
}

export function loadSheetVersionIntoDraft(
  sheet: CostSheet,
  detail: SheetVersionDetail,
): GuestDraft {
  const buckets: Record<string, BucketDraft> = {};
  for (const b of detail.bucket_breakdown || []) {
    buckets[b.type] = {
      totalSpent: b.declared_total ? String(b.declared_total) : '',
      unitsCovered: b.units_covered ? String(b.units_covered) : '',
      isNone: b.hidden || false,
      items: (b.items || []).map((item) => ({
        id: item.details?.source_item_id || crypto.randomUUID(),
        name: item.name || '',
        amount: item.amount ? String(item.amount) : '',
        unitsCovered: item.units_covered ? String(item.units_covered) : '',
        purchaseQuantity: item.quantity ? String(item.quantity) : undefined,
        purchaseUnit: item.unit || undefined,
        isImputed: item.is_imputed,
        details: item.details ?? {},
      })),
    };
  }

  return {
    productName: sheet.name,
    kind: sheet.kind,
    unitLabel: sheet.unit_label,
    productionBasis: (sheet.basis as '' | 'batch' | 'monthly') || 'batch',
    unitsProduced: detail.units_produced ? String(detail.units_produced) : '',
    defectiveUnits: detail.defective_units ? String(detail.defective_units) : '',
    defaultUnitsCoveredScope: detail.default_units_covered_scope || 'all',
    currencyCode: detail.currency_code || 'LKR',
    currencyOverridden: true,
    pricingType: detail.pricing_type || 'markup',
    pricingPercentage: detail.pricing_percentage ? String(detail.pricing_percentage) : '30',
    buckets,
    sheetId: sheet.id,
    versionId: detail.id,
    versionNumber: detail.version_number,
    workspaceId: sheet.workspace_id,
  };
}
