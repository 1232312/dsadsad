/**
 * Global UI store: the currently active mode and city-level view settings that
 * more than one module may want to read (e.g. selected project id). Kept
 * separate from auth/project data so modules stay decoupled.
 */
import { create } from 'zustand'
import type { ProjectCategory, ProjectStatus } from '@/types/project'

export type Mode = 'boot' | 'landing' | 'auth' | 'city' | 'network' | 'graveyard' | 'echo' | 'worlds' | 'cityworld'

export type SortFilter =
  | 'newest'
  | 'trending'
  | 'revived'
  | 'abandoned'
  | 'alphabetical'

export interface BuildingCustomization {
  color: string
  height: number
  style: 'standard' | 'spire' | 'pyramid' | 'dome' | 'crystal'
  glowIntensity: number
}

interface UIState {
  mode: Mode
  selectedProjectId: string | null
  categoryFilter: ProjectCategory | null
  statusFilter: ProjectStatus | null
  sortFilter: SortFilter
  searchQuery: string
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
  tutorialSeen: boolean
  customizingProjectId: string | null
  customizations: Record<string, BuildingCustomization>
  setMode: (m: Mode) => void
  selectProject: (id: string | null) => void
  setCategoryFilter: (c: ProjectCategory | null) => void
  setStatusFilter: (s: ProjectStatus | null) => void
  setSortFilter: (s: SortFilter) => void
  setSearchQuery: (q: string) => void
  setTimeOfDay: (t: UIState['timeOfDay']) => void
  setTutorialSeen: (seen: boolean) => void
  cityCategory: ProjectCategory | null
  enterCity: (category: ProjectCategory) => void
  exitCity: () => void
  startCustomizing: (id: string) => void
  stopCustomizing: () => void
  updateCustomization: (id: string, patch: Partial<BuildingCustomization>) => void
}

export const useUI = create<UIState>((set) => ({
  mode: 'boot',
  selectedProjectId: null,
  categoryFilter: null,
  statusFilter: null,
  sortFilter: 'newest',
  searchQuery: '',
  timeOfDay: 'night',
  tutorialSeen: false,
  customizingProjectId: null,
  customizations: {},
  setMode: (mode) => set({ mode }),
  cityCategory: null,
  enterCity: (category) => set({ cityCategory: category, categoryFilter: category, mode: 'cityworld', selectedProjectId: null }),
  exitCity: () => set({ mode: 'city', cityCategory: null, categoryFilter: null }),
  selectProject: (id) => set({ selectedProjectId: id }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setSortFilter: (sortFilter) => set({ sortFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setTimeOfDay: (timeOfDay) => set({ timeOfDay }),
  setTutorialSeen: (tutorialSeen) => set({ tutorialSeen }),
  startCustomizing: (id) => set({ customizingProjectId: id }),
  stopCustomizing: () => set({ customizingProjectId: null }),
  updateCustomization: (id, patch) =>
    set((state) => ({
      customizations: {
        ...state.customizations,
        [id]: { ...state.customizations[id], ...patch },
      },
    })),
}))
