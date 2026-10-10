import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Bucket {
  key: string;
  totalSpent: string;
  unitsCovered?: string;
  isNone: boolean;
}

export interface GuestDraft {
  productName: string;
  unitsProduced: string;
  buckets: Record<string, Bucket>;
}

interface CalculatorState {
  draft: GuestDraft;
  updateDraft: (updates: Partial<GuestDraft>) => void;
  updateBucket: (key: string, updates: Partial<Bucket>) => void;
  resetDraft: () => void;
}

const initialDraft: GuestDraft = {
  productName: '',
  unitsProduced: '',
  buckets: {}
};

export const useCalculatorStore = create<CalculatorState>()(
  persist(
    (set) => ({
      draft: initialDraft,
      updateDraft: (updates) => set((state) => ({ 
        draft: { ...state.draft, ...updates } 
      })),
      updateBucket: (key, updates) => set((state) => ({
        draft: {
          ...state.draft,
          buckets: {
            ...state.draft.buckets,
            [key]: { ...state.draft.buckets[key], ...updates }
          }
        }
      })),
      resetDraft: () => set({ draft: initialDraft })
    }),
    {
      name: 'truemargin-guest-draft',
      // skip hydration on server
      skipHydration: true,
    }
  )
);
