import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LineItemDraft {
  id: string;
  name: string;
  amount: string;
  unitsCovered: string;
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
  unitsProduced: string;
  defectiveUnits: string;
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
}

const initialDraft: GuestDraft = {
  productName: '',
  kind: 'product',
  unitLabel: 'unit',
  unitsProduced: '',
  defectiveUnits: '',
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

  return {
    draft: {
      ...initialDraft,
      ...state.draft,
      buckets,
    },
  };
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
      resetDraft: () => set({ draft: initialDraft }),
    }),
    {
      name: 'truemargin-guest-draft',
      version: 1,
      skipHydration: true,
      migrate: migrateDraft,
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);
