/**
 * CityGlow — the visual-density layer for the Reboot city.
 *
 * Techniques adapted from the reference repos:
 *  - LitWindows: instanced facade panes with a seeded "who's home" lit
 *    fraction (scena's highrise generator).
 *  - SkylineFiller: a background skyline of small instanced towers with a
 *    procedural emissive window-grid canvas texture (procedural-city's
 *    texture baking).
 *  - SkyLanes: tilted orbital traffic lanes with glowing craft + trails
 *    (futuristic-city's boid traffic).
 *  - Billboards: holographic ad planes with canvas-drawn neon text.
 *  - DistrictGlow: additive ground-glow decals under each district.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CityProject } from './CityModule'
import { CATEGORY_THEME } from '@/types/project'

const PLANET_RADIUS = 60

// ---- shared helpers ------------------------------------------------------ //

/** Point on a sphere of the given radius, from equatorial angle + latitude. */
function spherePoint(angle: number, lat: number, radius: number): [number, number, number] {
  return [
    Math.cos(lat) * Math.cos(angle) * radius,
    Math.sin(lat) * radius,
    Math.cos(lat) * Math.sin(angle) * radius,
  ]
}

function radialAt(angle: number, lat: number): THREE.Vector3 {
  return new THREE.Vector3(...spherePoint(angle, lat, 1)).normalize()
}

/** Quaternion aligning +Y with the surface normal at angle/latitude. */
function uprightQuat(angle: number, lat: number): THREE.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    radialAt(angle, lat),
  )
}

/** Small deterministic hash → 0..1. */
function seeded(key: string, index = 0): number {
  let h = 2166136261 ^ index
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i) + (h << 6) + (h >> 2)
  }
  h = Math.imul(h ^ (h >>> 15), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return ((h ^= h >>> 16) >>> 0) / 4294967296
}

function projectAngleLat(p: CityProject): { angle: number; lat: number } {
  const [x, y, z] = p.position
  const r = Math.sqrt(x * x + y * y + z * z) || 1
  return { angle: Math.atan2(z, x), lat: Math.asin(y / r) }
}

/** Arc distance on the planet between two angle/lat pairs, in world units. */
function arcUnits(a: { angle: number; lat: number }, b: { angle: number; lat: number }): number {
  const dLat = a.lat - b.lat
  let dAng = a.angle - b.angle
  while (dAng > Math.PI) dAng -= Math.PI * 2
  while (dAng < -Math.PI) dAng += Math.PI * 2
  const midLat = (a.lat + b.lat) / 2
  return PLANET_RADIUS * Math.sqrt(dLat * dLat + Math.cos(midLat) * dAng * dAng * 1.0)
}

// ---- 1. Lit windows (instanced facade panes) ----------------------------- //

interface WindowSlot {
  position: [number, number, number]
  rotY: number
}

export function LitWindows({ width, height, color, seed, occupancy = 0.5 }: {
  width: number
  height: number
  color: string
  seed: string
  occupancy?: number
}) {
  const floors = Math.max(3, Math.min(14, Math.round(height / 0.85)))
  const bays = Math.max(2, Math.round(width / 0.85))

  const { lit, dark, paneW, paneH } = useMemo(() => {
    const half = width / 2
    const slots: WindowSlot[] = []
    for (let f = 0; f < floors; f++) {
      const y = 0.5 + (f / floors) * (height - 1) + 0.35
      for (let i = 0; i < bays; i++) {
        const c = -half + ((i + 0.5) / bays) * width
        slots.push({ position: [c, y, half + 0.05], rotY: 0 })
        slots.push({ position: [c, y, -half - 0.05], rotY: Math.PI })
      }
      for (let i = 0; i < bays; i++) {
        const cz = -half + ((i + 0.5) / bays) * width
        slots.push({ position: [half + 0.05, y, cz], rotY: Math.PI / 2 })
        slots.push({ position: [-half - 0.05, y, cz], rotY: -Math.PI / 2 })
      }
    }
    const lit: WindowSlot[] = []
    const dark: WindowSlot[] = []
    slots.forEach((s, i) => (seeded(seed, i) < occupancy ? lit : dark).push(s))
    const paneW = (width / bays) * 0.52
    const paneH = Math.max(0.22, (height / floors) * 0.42)
    return { lit, dark, paneW, paneH }
  }, [width, height, seed, occupancy, floors, bays])

  const litRef = useRef<THREE.InstancedMesh>(null)
  const darkRef = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    const dummy = new THREE.Object3D()
    const fill = (mesh: THREE.InstancedMesh | null, slots: WindowSlot[], tint?: boolean) => {
      if (!mesh) return
      slots.forEach((s, i) => {
        dummy.position.set(...s.position)
        dummy.rotation.set(0, s.rotY, 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        if (tint) {
          // Mostly warm "home" light, some in the project's theme color.
          const warm = seeded(seed, i * 7 + 3) < 0.75
          mesh.setColorAt(i, new THREE.Color(warm ? '#ffdda6' : color))
        }
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    fill(litRef.current, lit, true)
    fill(darkRef.current, dark)
  }, [lit, dark, color, seed])

  if (lit.length === 0) return null

  return (
    <group>
      <instancedMesh ref={litRef} args={[undefined, undefined, lit.length]}>
        <boxGeometry args={[paneW, paneH, 0.05]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {dark.length > 0 && (
        <instancedMesh ref={darkRef} args={[undefined, undefined, dark.length]}>
          <boxGeometry args={[paneW, paneH, 0.05]} />
          <meshStandardMaterial color="#0e1725" roughness={0.4} metalness={0.6} />
        </instancedMesh>
      )}
    </group>
  )
}

// ---- 2. Background skyline (instanced filler towers) ---------------------- //

function makeWindowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#070b13'
  ctx.fillRect(0, 0, 128, 256)
  const cols = 5
  const rows = 12
  const cw = 128 / cols
  const ch = 256 / rows
  const palette = ['#9fe8ff', '#ffd9a0', '#c9f4ff', '#89b8ff']
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const on = seeded(`tw-${r}-${c}`, r * 31 + c) < 0.55
      ctx.fillStyle = on ? palette[Math.floor(seeded(`tc-${r}-${c}`, r + c * 7) * palette.length)] : '#101826'
      const pad = cw * 0.22
      ctx.fillRect(c * cw + pad, r * ch + pad * 0.8, cw - pad * 2, ch - pad * 1.6)
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function SkylineFiller({ projects }: { projects: CityProject[] }) {
  const tex = useMemo(() => makeWindowTexture(), [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#0b101c',
    emissiveMap: tex,
    emissive: '#ffffff',
    emissiveIntensity: 1.35,
    roughness: 0.85,
    metalness: 0.25,
  }), [tex])

  const ref = useRef<THREE.InstancedMesh>(null)
  const COUNT = 130

  const transforms = useMemo(() => {
    const projectSpots = projects.map(projectAngleLat)
    const list: { pos: THREE.Vector3; quat: THREE.Quaternion; scale: [number, number, number] }[] = []
    let attempts = 0
    while (list.length < COUNT && attempts < COUNT * 12) {
      attempts++
      const i = list.length + attempts * 13
      const angle = seeded('sf-a', i) * Math.PI * 2
      const lat = (1 + seeded('sf-l', i) * 12.5) * (Math.PI / 180)
      const spot = { angle, lat }
      // Keep clear of the hero buildings.
      if (projectSpots.some((p) => arcUnits(p, spot) < 5.2)) continue
      const w = 0.45 + seeded('sf-w', i) * 0.85
      const tall = seeded('sf-t', i) < 0.1
      const h = tall ? 4.5 + seeded('sf-h', i) * 3.5 : 0.9 + seeded('sf-h', i) * 2.6
      list.push({
        pos: new THREE.Vector3(...spherePoint(angle, lat, PLANET_RADIUS + h / 2 - 0.15)),
        quat: uprightQuat(angle, lat),
        scale: [w, h, w * (0.75 + seeded('sf-d', i) * 0.5)],
      })
    }
    return list
  }, [projects])

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    transforms.forEach((t, i) => {
      dummy.position.copy(t.pos)
      dummy.quaternion.copy(t.quat)
      dummy.scale.set(...t.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [transforms])

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(transforms.length, 1)]} material={material}>
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  )
}

// ---- 3. Sky lanes (tilted orbital traffic) ------------------------------- //

const LANES = [
  { radius: 74, tilt: (18 * Math.PI) / 180, node: (35 * Math.PI) / 180, count: 12, speed: 0.05 },
  { radius: 85, tilt: (-12 * Math.PI) / 180, node: (-60 * Math.PI) / 180, count: 10, speed: 0.038 },
  { radius: 96, tilt: (25 * Math.PI) / 180, node: (100 * Math.PI) / 180, count: 14, speed: 0.028 },
]

function SkyLane({ radius, tilt, node, count, speed }: {
  radius: number
  tilt: number
  node: number
  count: number
  speed: number
}) {
  const q = useMemo(
    () => new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, node, 0)),
    [tilt, node],
  )
  const crafts = useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      phase: seeded('lane', i),
      speed: speed * (0.75 + seeded('lanes', i) * 0.5) * (i % 3 === 0 ? -1 : 1),
      color: ['#3DD8FF', '#FFB547', '#FF7EB6', '#8FA8FF'][i % 4],
    })),
    [count, speed],
  )
  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const tangent = useMemo(() => new THREE.Vector3(), [])

  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const t = state.clock.elapsedTime
    crafts.forEach((c, i) => {
      const a = (c.phase + t * c.speed) * Math.PI * 2
      v.set(Math.cos(a) * radius, 0, Math.sin(a) * radius).applyQuaternion(q)
      tangent.set(-Math.sin(a), 0, Math.cos(a)).applyQuaternion(q).normalize()
      dummy.position.copy(v)
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    crafts.forEach((c, i) => mesh.setColorAt(i, new THREE.Color(c.color)))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [crafts])

  return (
    <group>
      {/* faint guide ring */}
      <mesh quaternion={q}>
        <torusGeometry args={[radius, 0.05, 4, 128]} />
        <meshBasicMaterial color="#3DD8FF" transparent opacity={0.1} />
      </mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, count]}>
        <boxGeometry args={[0.09, 0.09, 0.85]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

export function SkyLanes() {
  return (
    <group>
      {LANES.map((lane, i) => (
        <SkyLane key={i} {...lane} />
      ))}
    </group>
  )
}

// ---- 4. Holographic billboards ------------------------------------------- //

const SLOGANS = [
  'REBOOT YOUR WORLD',
  'STAY BUILDING',
  'JOIN THE MOVEMENT',
  'COMMUNITY POWERED',
  'THE FUTURE IS ALIVE',
  'SHIP YOUR DREAMS',
]

function makeBillboardTexture(text: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 512, 128)
  ctx.strokeStyle = color
  ctx.lineWidth = 4
  ctx.shadowColor = color
  ctx.shadowBlur = 22
  ctx.strokeRect(10, 10, 492, 108)
  ctx.font = 'bold 44px "Arial Black", Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.fillText(text.slice(0, 20), 256, 66)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function Billboard({ angle, lat, height, text, color, index }: {
  angle: number
  lat: number
  height: number
  text: string
  color: string
  index: number
}) {
  const tex = useMemo(() => makeBillboardTexture(text, color), [text, color])
  const materialRef = useRef<THREE.MeshBasicMaterial>(null)
  const quat = useMemo(() => {
    const q = uprightQuat(angle, lat)
    // After standing upright, spin around local Y so the face points
    // roughly toward the ring (visible while orbiting).
    const spin = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      -angle - Math.PI / 2 + (index % 2 === 0 ? 0.25 : -0.25),
    )
    return q.multiply(spin)
  }, [angle, lat, index])

  useFrame((state) => {
    const m = materialRef.current
    if (!m) return
    const t = state.clock.elapsedTime
    const flicker = (t * 2.7 + index * 3.1) % 17 < 0.35 ? 0.25 : 1
    m.opacity = (0.72 + Math.sin(t * 1.4 + index) * 0.12) * flicker
  })

  return (
    <mesh position={new THREE.Vector3(...spherePoint(angle, lat, PLANET_RADIUS + height))} quaternion={quat}>
      <planeGeometry args={[4.6, 1.15]} />
      <meshBasicMaterial
        ref={materialRef}
        map={tex}
        transparent
        opacity={0.8}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

export function Billboards({ projects }: { projects: CityProject[] }) {
  const boards = useMemo(() => {
    const top = [...projects].sort((a, b) => b.followers - a.followers).slice(0, 6)
    return top.map((p, i) => {
      const { angle, lat } = projectAngleLat(p)
      const theme = CATEGORY_THEME[p.category]
      const text = i % 2 === 0 ? p.name.toUpperCase().slice(0, 18) : SLOGANS[i % SLOGANS.length]
      return {
        key: p.id,
        angle,
        lat,
        height: 3.2 + (i % 3) * 1.4,
        text,
        color: theme.emissive,
        index: i,
      }
    })
  }, [projects])

  return (
    <group>
      {boards.map(({ key, ...b }) => (
        <Billboard key={key} {...b} />
      ))}
    </group>
  )
}

// ---- 5. District ground glow --------------------------------------------- //

function makeGlowTexture(color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 126)
  g.addColorStop(0, color)
  g.addColorStop(0.5, `${color}55`)
  g.addColorStop(1, '#00000000')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function DistrictGlow({ projects }: { projects: CityProject[] }) {
  const decals = useMemo(() => {
    const byCategory = new Map<string, { angle: number; lat: number }[]>()
    projects.forEach((p) => {
      const theme = CATEGORY_THEME[p.category]
      if (!byCategory.has(theme.emissive)) byCategory.set(theme.emissive, [])
      byCategory.get(theme.emissive)!.push(projectAngleLat(p))
    })
    return [...byCategory.entries()].map(([color, spots], i) => {
      const angle = spots.reduce((s, x) => s + x.angle, 0) / spots.length
      const lat = spots.reduce((s, x) => s + x.lat, 0) / spots.length
      return { key: `${color}-${i}`, angle, lat, color }
    })
  }, [projects])

  return (
    <group>
      {decals.map(({ key, ...d }) => (
        <DistrictGlowDecal key={key} {...d} />
      ))}
    </group>
  )
}

function DistrictGlowDecal({ angle, lat, color }: { angle: number; lat: number; color: string }) {
  const tex = useMemo(() => makeGlowTexture(color), [color])
  const quat = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      radialAt(angle, lat),
    ),
    [angle, lat],
  )
  return (
    <mesh position={new THREE.Vector3(...spherePoint(angle, lat, PLANET_RADIUS + 0.12))} quaternion={quat}>
      <planeGeometry args={[9, 9]} />
      <meshBasicMaterial map={tex} transparent opacity={0.34} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  )
}

// ---- top-level component -------------------------------------------------- //

export function CityGlow({ projects }: { projects: CityProject[] }) {
  return (
    <group>
      <SkylineFiller projects={projects} />
      <SkyLanes />
      <Billboards projects={projects} />
      <DistrictGlow projects={projects} />
    </group>
  )
}
