/**
 * City module — the primary Reboot experience.
 *
 * Projects are placed on a curved planet surface. Each district occupies
 * a sector of the planet with its own biome terrain. Buildings stand
 * upright relative to the planet surface normal.
 */
import { useMemo } from 'react'
import { useProjects } from '@/stores/auth'
import { useUI as useUIStore } from '@/stores/ui'
import type { Project } from '@/types/project'
import { CATEGORY_THEME, DISTRICT_MAP } from '@/types/project'
import { CityVisualization } from './CityVisualization'

export interface CityProject extends Project {
  /** World position on the planet surface. */
  position: [number, number, number]
  /** Surface normal at this point (for orienting buildings). */
  normal: [number, number, number]
  /** District sector angle (radians). */
  sectorAngle: number
  /** District sector width (radians). */
  sectorWidth: number
}

const PLANET_RADIUS = 60

/**
 * Place projects on planet surface grouped by district sector.
 * Each district gets a wedge of the planet. Within each wedge,
 * buildings are arranged in concentric arcs.
 */
function planPlanet(projects: Project[]): CityProject[] {
  const districts = new Map<string, Project[]>()
  for (const p of projects) {
    const list = districts.get(p.category) ?? []
    list.push(p)
    districts.set(p.category, list)
  }

  const districtIds = [...districts.keys()]
  const result: CityProject[] = []
  const sectorWidth = (Math.PI * 2) / Math.max(districtIds.length, 1)

  districtIds.forEach((districtId, di) => {
    const sectorCenter = di * sectorWidth
    const districtProjects = districts.get(districtId)!

    districtProjects.forEach((p, pi) => {
      // Arrange in arcs within the sector: rows radiate outward
      const cols = 3
      const col = pi % cols
      const row = Math.floor(pi / cols)

      // Angular offset within sector (spread across 70% of sector width)
      const angularFrac = (col - (cols - 1) / 2) / cols
      const angle = sectorCenter + angularFrac * sectorWidth * 0.7

      // Latitude rows fan north from the equator belt so every building sits
      // ON the sphere surface (a flat equatorial ring inside PLANET_RADIUS
      // would be buried inside the planet). Small per-project jitter for a
      // natural look.
      const latDeg = 2.5 + row * 4.2 + ((p.id.charCodeAt(0) % 7) - 3) * 0.25
      const lat = (latDeg * Math.PI) / 180
      const r = PLANET_RADIUS + 0.4

      const x = Math.cos(lat) * Math.cos(angle) * r
      const y = Math.sin(lat) * r
      const z = Math.cos(lat) * Math.sin(angle) * r

      // Surface normal points radially outward from planet center
      const len = Math.sqrt(x * x + y * y + z * z)
      const nx = x / len
      const ny = y / len
      const nz = z / len

      result.push({
        ...p,
        position: [x, y, z],
        normal: [nx, ny, nz],
        sectorAngle: sectorCenter,
        sectorWidth: sectorWidth * 0.7,
      })
    })
  })

  return result
}

export function useCityData(): { projects: CityProject[]; loading: boolean } {
  const all = useProjects((s) => s.projects)
  const loading = useProjects((s) => s.loading)
  const categoryFilter = useUIStore((s) => s.categoryFilter)
  const statusFilter = useUIStore((s) => s.statusFilter)
  const sortFilter = useUIStore((s) => s.sortFilter)

  const filtered = useMemo(() => {
    let list = all
    if (categoryFilter) list = list.filter((p) => p.category === categoryFilter)
    if (statusFilter) list = list.filter((p) => p.status === statusFilter)
    const sorted = [...list]
    switch (sortFilter) {
      case 'newest':
        sorted.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        break
      case 'trending':
        sorted.sort((a, b) => b.followers - a.followers)
        break
      case 'revived':
        sorted.sort((a, b) => Number(b.status === 'reviving') - Number(a.status === 'reviving'))
        break
      case 'abandoned':
        sorted.sort((a, b) => Number(b.status === 'abandoned') - Number(a.status === 'abandoned'))
        break
    }
    return sorted
  }, [all, categoryFilter, statusFilter, sortFilter])

  const cityProjects = useMemo(() => planPlanet(filtered), [filtered])
  return { projects: cityProjects, loading }
}

export function CityModule() {
  const { projects, loading } = useCityData()
  if (loading && projects.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="font-mono text-xs text-text-secondary animate-pulse-soft">
          Loading world...
        </div>
      </div>
    )
  }
  return <CityVisualization projects={projects} />
}

export { PLANET_RADIUS }
