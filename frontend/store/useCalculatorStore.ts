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
  workspaceId?: string;
}

interface CalculatorState {
  draft: GuestDraft;
  hydrated: boolean;
  updateDraft: (updates: Partial<GuestDraft>) => void;
  updateBucket: (key: string, updates: Partial<BucketDraft>) => void;
  setHydrated: (hydrated: boolean) => void;
  resetDraft: () => void;
  loadDraft: (draft: GuestDraft) => void;
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  markClean: () => void;
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
    return { draft: initialDraft };
  }

  const state = persistedState as { draft?: Partial<GuestDraft> };
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
  if (!state.draft?.productionBasis) draft.productionBasis = '';
  if (!state.draft?.defaultUnitsCoveredScope) draft.defaultUnitsCoveredScope = '';

  return { draft };
}

export const useCalculatorStore = create<CalculatorState>()(
  persist(
    (set) => ({
      draft: initialDraft,
      hydrated: false,
      updateDraft: (updates) =>
        set((state) => ({ draft: { ...state.draft, ...updates } })),
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
      resetDraft: () => set({ draft: initialDraft, isDirty: false }),
      loadDraft: (draft) => set({ draft, isDirty: false }),
      isDirty: false,
      setIsDirty: (isDirty) => set({ isDirty }),
      markClean: () => set({ isDirty: false }),
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
