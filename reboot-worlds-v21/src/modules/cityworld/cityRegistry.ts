import type { ProjectCategory } from '@/types/project'

/**
 * Categories that currently have a dedicated, explorable 3D city.
 * Phase 1: AI. Later phases add entries here plus a scene under cities/.
 * The sidebar reads this list to decide whether a district click enters
 * a city world or just applies a filter.
 */
export const CITY_CATEGORIES: ProjectCategory[] = ['AI', 'Gaming', 'Education', 'Health', 'Creator', 'IdeaHub', 'Graveyard', 'Legend']

/** Chip labels for the in-scene city selector. */
export const CITY_LABELS: Partial<Record<ProjectCategory, string>> = {
  AI: 'AI City',
  Gaming: 'Gaming City',
  Education: 'Education City',
  Health: 'Health City',
  Creator: 'Creative City',
  IdeaHub: 'Revival City',
  Graveyard: 'Graveyard',
  Legend: 'Success City',
}

/** Per-city backdrop: clear color + fog band used by the shared canvas. */
export const CITY_ENV: Partial<Record<ProjectCategory, { bg: string; fogNear: number; fogFar: number }>> = {
  AI: { bg: '#050b14', fogNear: 70, fogFar: 210 },
  Gaming: { bg: '#0d0812', fogNear: 65, fogFar: 200 },
  Education: { bg: '#06120d', fogNear: 65, fogFar: 200 },
  Health: { bg: '#0a1218', fogNear: 60, fogFar: 190 },
  Creator: { bg: '#0f0818', fogNear: 60, fogFar: 190 },
  IdeaHub: { bg: '#0d0d08', fogNear: 60, fogFar: 190 },
  Graveyard: { bg: '#060508', fogNear: 45, fogFar: 170 },
  Legend: { bg: '#0d0f1a', fogNear: 65, fogFar: 200 },
}
