import type { ProjectCategory } from '@/types/project'

/**
 * Categories that currently have a dedicated, explorable 3D city.
 * Phase 1: AI. Later phases add entries here plus a scene under cities/.
 * The sidebar reads this list to decide whether a district click enters
 * a city world or just applies a filter.
 */
export const CITY_CATEGORIES: ProjectCategory[] = ['AI']

/** Chip labels for the in-scene city selector. */
export const CITY_LABELS: Partial<Record<ProjectCategory, string>> = {
  AI: 'AI City',
}
