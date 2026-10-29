import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LineItemDraft {
  id: string;
  name: string;
  amount: string;
  unitsCovered: string;
  purchaseQuantity?: string;
  purchaseUnit?: string;
  details?: Record<string, string>;
  isImputed?: boolean;
}

export interface BucketDraft {
  totalSpent: string;
  unitsCovered: string;
  isNone: boolean;
  items: LineItemDraft[];
}

export interface GuestDraft {
  productName: string;
  kind: 'product' | 'service';
  unitLabel: string;
  productionBasis: '' | 'batch' | 'monthly';
  unitsProduced: string;
  defectiveUnits: string;
  defaultUnitsCoveredScope: '' | 'all' | 'overhead_only';
  currencyCode: string;
  currencyOverridden: boolean;
  pricingType: 'markup' | 'margin';
  pricingPercentage: string;
  buckets: Record<string, BucketDraft>;
  sheetId?: string;
  versionId?: string;
  versionNumber?: number;
  workspaceId?: string;
}

interface CalculatorState {
  draft: GuestDraft;
  hydrated: boolean;
  setupCollapsed: boolean;
  setSetupCollapsed: (collapsed: boolean) => void;
  updateDraft: (updates: Partial<GuestDraft>) => void;
  updateBucket: (key: string, updates: Partial<BucketDraft>) => void;
  setHydrated: (hydrated: boolean) => void;
  resetDraft: () => void;
  loadDraft: (draft: GuestDraft) => void;
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  markClean: () => void;
  resetCount: number;
}

const initialDraft: GuestDraft = {
  productName: '',
  kind: 'product',
  unitLabel: '',
  productionBasis: 'monthly',
  unitsProduced: '',
  defectiveUnits: '',
  defaultUnitsCoveredScope: 'all',
  currencyCode: 'LKR',
  currencyOverridden: false,
  pricingType: 'markup',
  pricingPercentage: '30',
  buckets: {},
};

const emptyBucket: BucketDraft = {
  totalSpent: '',
  unitsCovered: '',
  isNone: false,
  items: [],
};

function migrateDraft(persistedState: unknown): Partial<CalculatorState> {
  if (!persistedState || typeof persistedState !== 'object') {
    return { draft: initialDraft, setupCollapsed: false };
  }

  const state = persistedState as { draft?: Partial<GuestDraft>; setupCollapsed?: boolean };
  const oldBuckets = state.draft?.buckets as
    | Record<string, Partial<BucketDraft> & { key?: string }>
    | undefined;
  const buckets: Record<string, BucketDraft> = {};

  for (const [key, bucket] of Object.entries(oldBuckets ?? {})) {
    buckets[key] = {
      ...emptyBucket,
      ...bucket,
      items: Array.isArray(bucket.items) ? bucket.items : [],
    };
  }

  const draft = {
    ...initialDraft,
    ...state.draft,
    buckets,
  };
  if (draft.unitLabel === 'unit') draft.unitLabel = '';
  if (!draft.productionBasis) draft.productionBasis = 'monthly';
  if (!draft.defaultUnitsCoveredScope) draft.defaultUnitsCoveredScope = 'all';

  const isComplete = Boolean(
    draft.productName.trim() &&
    draft.unitLabel.trim() &&
    Number(draft.unitsProduced.trim()) > 0,
  );

  const setupCollapsed = isComplete && (typeof state.setupCollapsed === 'boolean'
    ? state.setupCollapsed
    : true);

  return { draft, setupCollapsed };
}

export function syncMonthlyUnitsInBuckets(
  buckets: Record<string, BucketDraft>,
  prevUnits: string,
  newUnits: string,
): Record<string, BucketDraft> {
  const prevTrimmed = prevUnits.trim();
  const newTrimmed = newUnits.trim();
  if (prevTrimmed === newTrimmed) return buckets;

  const nextBuckets: Record<string, BucketDraft> = {};
  const newNum = parseFloat(newTrimmed);
  const isValidNewNum = !isNaN(newNum) && newNum > 0;

  for (const [key, bucket] of Object.entries(buckets)) {
    let nextBucketUnitsCovered = bucket.unitsCovered;

    // Bucket unitsCovered updates if:
    // 1. It is the overhead bucket (overhead by definition matches monthly production output), OR
    // 2. It matched the previous monthly units, OR
    // 3. It was empty
    const isOverhead = key === 'overhead';
    const isTransport = key === 'transport';
    const isLabor = key === 'labor';

    if (
      isOverhead ||
      bucket.unitsCovered.trim() === prevTrimmed ||
      bucket.unitsCovered.trim() === ''
    ) {
      nextBucketUnitsCovered = newUnits;
    }

    const nextItems = bucket.items.map((item) => {
      let nextItemUnitsCovered = item.unitsCovered;
      let nextDetails = item.details ? { ...item.details } : undefined;
      let nextAmount = item.amount;
      let nextPurchaseQuantity = item.purchaseQuantity;

      const isRecipe = item.details?.method === 'recipe';

      // If item is not recipe-based and its coverage was linked to monthly units:
      if (!isRecipe) {
        if (
          isOverhead ||
          item.unitsCovered.trim() === prevTrimmed ||
          item.unitsCovered.trim() === ''
        ) {
          nextItemUnitsCovered = newUnits;
        }
      }

      // Special cases:
      // 1. Labor piece rate: quantity produced in this period equals monthly units
      if (isLabor && item.details?.labor_method === 'piece_rate') {
        const pieceRateVal = parseFloat(item.details?.piece_rate || '0');
        if (item.purchaseQuantity?.trim() === prevTrimmed || !item.purchaseQuantity?.trim()) {
          nextPurchaseQuantity = newUnits;
        }
        if (!isNaN(pieceRateVal) && pieceRateVal > 0 && isValidNewNum) {
          nextAmount = (pieceRateVal * newNum).toFixed(2).replace(/\.00$/, '');
        }
      }

      // 2. Outbound transport per package rate: total delivery for batch = rate * units
      if (isTransport && item.details?.direction === 'outbound') {
        const scope = (item.details?.delivery_scope as 'unit' | 'batch') ?? (item.details?.unit_rate ? 'unit' : 'unit');
        if (scope === 'unit' && item.details?.unit_rate) {
          const unitRate = parseFloat(item.details.unit_rate);
          if (!isNaN(unitRate) && unitRate > 0 && isValidNewNum) {
            nextAmount = (unitRate * newNum).toFixed(2).replace(/\.00$/, '');
          }
        }
      }

      return {
        ...item,
        unitsCovered: nextItemUnitsCovered,
        amount: nextAmount,
        purchaseQuantity: nextPurchaseQuantity,
        details: nextDetails,
      };
    });

    nextBuckets[key] = {
      ...bucket,
      unitsCovered: nextBucketUnitsCovered,
      items: nextItems,
    };
  }

  return nextBuckets;
}

export const useCalculatorStore = create<CalculatorState>()(
  persist(
    (set) => ({
      draft: initialDraft,
      hydrated: false,
      setupCollapsed: false,
      setSetupCollapsed: (setupCollapsed) => set({ setupCollapsed }),
      updateDraft: (updates) =>
        set((state) => {
          let baseBuckets = updates.buckets ?? state.draft.buckets;
          if (
            updates.unitsProduced !== undefined &&
            updates.unitsProduced.trim() !== state.draft.unitsProduced.trim()
          ) {
            baseBuckets = syncMonthlyUnitsInBuckets(
              baseBuckets,
              state.draft.unitsProduced,
              updates.unitsProduced,
            );
          }
          return {
            draft: {
              ...state.draft,
              ...updates,
              buckets: baseBuckets,
            },
          };
        }),
      updateBucket: (key, updates) =>
        set((state) => ({
          draft: {
            ...state.draft,
            buckets: {
              ...state.draft.buckets,
              [key]: {
                ...emptyBucket,
                ...state.draft.buckets[key],
                ...updates,
              },
            },
          },
        })),
      setHydrated: (hydrated) => set({ hydrated }),
      resetDraft: () =>
        set((state) => ({
          draft: initialDraft,
          setupCollapsed: false,
          isDirty: false,
          resetCount: (state.resetCount || 0) + 1,
        })),
      loadDraft: (draft) =>
        set((state) => ({
          draft,
          setupCollapsed: Boolean(
            draft.productName.trim() &&
            draft.unitLabel.trim() &&
            Number(draft.unitsProduced.trim()) > 0,
          ),
          isDirty: false,
          resetCount: (state.resetCount || 0) + 1,
        })),
      isDirty: false,
      setIsDirty: (isDirty) => set({ isDirty }),
      markClean: () => set({ isDirty: false }),
      resetCount: 0,
    }),
    {
      name: 'truemargin-guest-draft',
      version: 3,
      skipHydration: true,
      migrate: migrateDraft,
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);
