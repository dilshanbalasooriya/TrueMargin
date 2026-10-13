import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
  isExpanded: boolean;
  mobileOpen: boolean;
  toggleExpanded: () => void;
  setExpanded: (expanded: boolean) => void;
  setMobileOpen: (open: boolean) => void;
  toggleMobileOpen: () => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isExpanded: false,
      mobileOpen: false,
      toggleExpanded: () => set((state) => ({ isExpanded: !state.isExpanded })),
      setExpanded: (isExpanded) => set({ isExpanded }),
      setMobileOpen: (mobileOpen) => set({ mobileOpen }),
      toggleMobileOpen: () => set((state) => ({ mobileOpen: !state.mobileOpen })),
    }),
    {
      name: 'truemargin-sidebar-state',
      partialize: (state) => ({ isExpanded: state.isExpanded }),
    },
  ),
);
