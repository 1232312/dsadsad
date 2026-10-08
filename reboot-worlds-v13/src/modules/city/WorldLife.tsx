/**
 * WorldLife — roads, traffic, nature, and wildlife for the Reboot planet.
 *
 * Three ideas drive this module:
 *
 * 1. CONNECTION. Districts were isolated islands; now a glowing boulevard
 *    ring circles the planet, radial avenues branch to every district
 *    boundary, and light-traffic streams along them (density scaled by the
 *    real follower counts of the projects in the world).
 *
 * 2. NATURE HEALS. Abandoned and decaying projects are not just ruins —
 *    moss, vines, and low-poly trees reclaim them, growing taller the longer
 *    the project has been gone (driven by failure_year). Reviving projects
 *    grow a glowing seedling of rebirth on their roof.
 *
 * 3. LIFE. Birds circle the planet, fireflies drift through the overgrowth,
 *    and street lamps line the boulevard. The world breathes.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import type { CityProject } from './CityModule'

// Local copy to avoid a CityVisualization -> WorldLife -> CityModule import
// cycle (CityModule already imports CityVisualization). Keep in sync.
const PLANET_RADIUS = 60

// ---- shared helpers ----------------------------------------------------- //

/** Deterministic pseudo-random from a string seed + index. */
function seeded(seed: string, index: number): number {
  let h = 2166136261 ^ (seed.charCodeAt(0) + index * 37)
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h = (h ^ (h >>> 15)) >>> 0
  return (h % 10000) / 10000
}

/** Years a project has been abandoned/decaying (drives growth size). */
function growthYears(p: CityProject): number {
  if (p.failureYear && p.failureYear > 0) return Math.max(1, 2026 - p.failureYear)
  return 2
}

/** Same height formula as buildingDNA in CityVisualization (custom scale = 1). */
function buildingHeight(p: CityProject): number {
  const scale = p.status === 'alive' && p.stage >= 4 ? 1.22 : 1
  return (4 + p.stage * 2.4) * scale
}

/** Same width formula as buildingDNA. */
function buildingWidth(p: CityProject): number {
  const seed = p.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return 1.8 + (seed % 3) * 0.35
}

/** Orient a group so its local Y axis aligns with the planet surface normal. */
function alignToNormal(normal: [number, number, number]): [number, number, number] {
  const up = new THREE.Vector3(0, 1, 0)
  const n = new THREE.Vector3(...normal).normalize()
  const axis = new THREE.Vector3().crossVectors(up, n)
  const angle = up.angleTo(n)
  if (axis.lengthSq() < 0.0001) return [0, 0, 0]
  axis.normalize()
  const quat = new THREE.Quaternion().setFromAxisAngle(axis, angle)
  const euler = new THREE.Euler().setFromQuaternion(quat)
  return [euler.x, euler.y, euler.z]
}

// ---- 1. Roads + traffic ------------------------------------------------- //
//
// All road geometry wraps the planet SURFACE (a sphere of radius
// PLANET_RADIUS centred on the origin). A flat ring in the equator plane at
// radius < PLANET_RADIUS would be buried inside the planet, so every road
// element is projected onto or just above the sphere.

const R_SURFACE = PLANET_RADIUS + 0.25 // boulevard ring plane, just above the equator
const LAT_TOP = (14.5 * Math.PI) / 180 // latitude of the northern collector ring

/** Point on a sphere of the given radius, from equatorial angle + latitude. */
function spherePoint(angle: number, lat: number, radius: number): [number, number, number] {
  return [
    Math.cos(lat) * Math.cos(angle) * radius,
    Math.sin(lat) * radius,
    Math.cos(lat) * Math.sin(angle) * radius,
  ]
}

/** Unit radial (surface "up") direction at an angle/latitude. */
function radialAt(angle: number, lat: number): THREE.Vector3 {
  return new THREE.Vector3(...spherePoint(angle, lat, 1)).normalize()
}

/** Unit meridian tangent (points north) at an angle/latitude. */
function meridianTangentAt(angle: number, lat: number): THREE.Vector3 {
  return new THREE.Vector3(
    -Math.sin(lat) * Math.cos(angle),
    Math.cos(lat),
    -Math.sin(lat) * Math.sin(angle),
  ).normalize()
}

/** Quaternion rotating the +Y axis onto `dir`. */
function quatFromY(dir: THREE.Vector3): [number, number, number, number] {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
  return [q.x, q.y, q.z, q.w]
}

/** Quaternion rotating the +Z axis onto `dir` (for flat pads/discs). */
function quatFromZ(dir: THREE.Vector3): [number, number, number, number] {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)
  return [q.x, q.y, q.z, q.w]
}

/**
 * A road band wrapping the planet: a short open-ended cylinder just above the
 * sphere surface. Unlike a torus in the equator plane (which is edge-on and
 * invisible from a near-equator camera), a surface band is visible from any
 * angle.
 */
function RoadBand({ radius, y, height, color = '#0b1220', emissive }: {
  radius: number
  y: number
  height: number
  color?: string
  emissive?: string
}) {
  return (
    <mesh position={[0, y, 0]}>
      <cylinderGeometry args={[radius, radius, height, 96, 1, true]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissive ? 0.6 : 0}
        roughness={0.9}
        metalness={0.2}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

/** A thin glowing stripe running along the middle of a road band. */
function GlowStripe({ radius, y, color, opacity }: {
  radius: number
  y: number
  color: string
  opacity: number
}) {
  return (
    <mesh position={[0, y, 0]}>
      <cylinderGeometry args={[radius, radius, 0.16, 96, 1, true]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} />
    </mesh>
  )
}

/** Road pad where a meridian avenue meets a ring. */
function JunctionPad({ angle, lat }: { angle: number; lat: number }) {
  const q = useMemo(() => quatFromZ(radialAt(angle, lat)), [angle, lat])
  return (
    <mesh position={spherePoint(angle, lat, PLANET_RADIUS + 0.17)} quaternion={q}>
      <circleGeometry args={[0.45, 12]} />
      <meshBasicMaterial color="#3DD8FF" transparent opacity={0.18} />
    </mesh>
  )
}

/** A meridian avenue running from the equator ring up to the north ring. */
function Avenue({ angle }: { angle: number }) {
  const midLat = LAT_TOP / 2
  const length = (PLANET_RADIUS + 0.2) * LAT_TOP
  const center = spherePoint(angle, midLat, PLANET_RADIUS + 0.2)
  const q = useMemo(() => quatFromY(meridianTangentAt(angle, midLat)), [angle])
  const dashQ = (lat: number) => quatFromY(meridianTangentAt(angle, lat))

  return (
    <group>
      {/* Dark road surface, lying along the meridian */}
      <mesh position={center} quaternion={q}>
        <cylinderGeometry args={[0.2, 0.2, length, 6]} />
        <meshStandardMaterial color="#0b1220" roughness={0.9} metalness={0.2} />
      </mesh>
      {/* Dashed neon center line */}
      {Array.from({ length: 5 }).map((_, i) => {
        const lat = (LAT_TOP / 5) * (i + 0.5)
        return (
          <mesh
            key={i}
            position={spherePoint(angle, lat, PLANET_RADIUS + 0.26)}
            quaternion={dashQ(lat)}
          >
            <cylinderGeometry args={[0.05, 0.05, length / 10, 4]} />
            <meshBasicMaterial color="#3DD8FF" transparent opacity={0.7} />
          </mesh>
        )
      })}
      <JunctionPad angle={angle} lat={0.015} />
      <JunctionPad angle={angle} lat={LAT_TOP - 0.015} />
    </group>
  )
}

/** A small street lamp along the boulevard, standing on the sphere surface. */
function StreetLamp({ angle }: { angle: number }) {
  const q = useMemo(() => quatFromY(radialAt(angle, 0)), [angle])
  return (
    <group position={spherePoint(angle, 0, PLANET_RADIUS + 0.4)} quaternion={q}>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.9, 4]} />
        <meshStandardMaterial color="#1a2436" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshBasicMaterial color="#FFD8A0" />
      </mesh>
    </group>
  )
}

// ---- Traffic -------------------------------------------------------- //

interface TrafficDot {
  path: 'ring' | 'avenue'
  angle: number // equatorial angle
  offset: number // 0..1 phase along path
  speed: number // fraction per second
  color: THREE.Color
}

/**
 * Instanced traffic — glowing dots streaming along the rings and meridian
 * avenues. Dot count scales with total followers across all projects ("use
 * all the data"): busier worlds get busier roads.
 */
function Traffic({ projects }: { projects: CityProject[] }) {
  const dots: TrafficDot[] = useMemo(() => {
    const totalFollowers = projects.reduce((s, p) => s + p.followers, 0)
    const busyness = THREE.MathUtils.clamp(totalFollowers / 20000, 0.4, 1.6)

    const sectorWidth = (Math.PI * 2) / Math.max(13, 1)
    const avenueAngles = Array.from({ length: 13 }, (_, i) => i * sectorWidth + sectorWidth / 2)
    const palette = ['#3DD8FF', '#FFB547', '#3BFF91', '#FF7EB6', '#8FA8FF']

    const list: TrafficDot[] = []
    const ringCount = Math.round(16 * busyness)
    for (let i = 0; i < ringCount; i++) {
      list.push({
        path: 'ring',
        angle: (i / ringCount) * Math.PI * 2,
        offset: seeded('ring', i),
        speed: (0.02 + seeded('ringspeed', i) * 0.02) * (i % 2 === 0 ? 1 : -1),
        color: new THREE.Color(palette[i % palette.length]),
      })
    }
    avenueAngles.forEach((a, ai) => {
      const count = 2 + (ai % 2)
      for (let i = 0; i < count; i++) {
        list.push({
          path: 'avenue',
          angle: a,
          offset: seeded(`av${ai}`, i),
          speed: (0.06 + seeded(`avspeed${ai}`, i) * 0.05) * (i % 2 === 0 ? 1 : -1),
          color: new THREE.Color(palette[(ai + i) % palette.length]),
        })
      }
    })
    return list
  }, [projects])

  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Paint per-dot colors once dots exist.
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    dots.forEach((d, i) => mesh.setColorAt(i, d.color))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [dots])

  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const t = state.clock.elapsedTime
    const R_DOT = PLANET_RADIUS + 0.35
    dots.forEach((d, i) => {
      const phase = ((d.offset + t * d.speed) % 1 + 1) % 1
      if (d.path === 'ring') {
        const a = d.angle + phase * Math.PI * 2 * Math.sign(d.speed)
        dummy.position.set(...spherePoint(a, 0, R_DOT))
      } else {
        const lat = phase * LAT_TOP * Math.sign(d.speed)
        dummy.position.set(...spherePoint(d.angle, lat, R_DOT))
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(dots.length, 1)]}>
      <sphereGeometry args={[0.16, 6, 6]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

export function RoadNetwork({ projects }: { projects: CityProject[] }) {
  const sectorWidth = (Math.PI * 2) / Math.max(13, 1)
  const avenueAngles = useMemo(
    () => Array.from({ length: 13 }, (_, i) => i * sectorWidth + sectorWidth / 2),
    [sectorWidth],
  )
  // Northern collector ring geometry (a band at latitude LAT_TOP)
  const northR = R_SURFACE * Math.cos(LAT_TOP)
  const northY = R_SURFACE * Math.sin(LAT_TOP)

  return (
    <group>
      {/* Main boulevard band at the equator, wrapping the planet surface */}
      <RoadBand radius={PLANET_RADIUS + 0.15} y={0} height={1.15} />
      <GlowStripe radius={PLANET_RADIUS + 0.16} y={0} color="#3DD8FF" opacity={0.55} />

      {/* Northern collector band bracketing the districts */}
      <RoadBand radius={northR} y={northY} height={0.95} />
      <GlowStripe radius={northR + 0.01} y={northY} color="#3DD8FF" opacity={0.3} />

      {/* Meridian avenues at every district boundary */}
      {avenueAngles.map((a, i) => (
        <Avenue key={`av-${i}`} angle={a} />
      ))}

      {/* Street lamps along the boulevard */}
      {Array.from({ length: 18 }).map((_, i) => (
        <StreetLamp key={`lamp-${i}`} angle={(i / 18) * Math.PI * 2} />
      ))}

      <Traffic projects={projects} />
    </group>
  )
}

// ---- 2. Nature reclaiming abandoned projects ----------------------------- //

function Tree({ position, scale, tint }: {
  position: [number, number, number]
  scale: number
  tint: string
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.05, 0.08, 0.6, 5]} />
        <meshStandardMaterial color="#2a1f14" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <coneGeometry args={[0.42, 0.75, 6]} />
        <meshStandardMaterial
          color="#1d5c38"
          emissive={tint}
          emissiveIntensity={0.18}
          roughness={0.85}
          flatShading
        />
      </mesh>
      <mesh position={[0, 1.35, 0]}>
        <coneGeometry args={[0.3, 0.6, 6]} />
        <meshStandardMaterial
          color="#237044"
          emissive={tint}
          emissiveIntensity={0.22}
          roughness={0.85}
          flatShading
        />
      </mesh>
    </group>
  )
}

/** A vine climbing a facade, with glowing leaf nodes. */
function Vine({ x, z, height, tint, seed }: {
  x: number
  z: number
  height: number
  tint: string
  seed: number
}) {
  const lean = (seed - 0.5) * 0.25
  return (
    <group>
      <mesh position={[x + lean * height * 0.5, height * 0.5, z]} rotation={[0, 0, lean]}>
        <cylinderGeometry args={[0.02, 0.03, height, 4]} />
        <meshStandardMaterial color="#1d5c38" emissive={tint} emissiveIntensity={0.25} />
      </mesh>
      {[0.3, 0.6, 0.85].map((r, i) => (
        <mesh key={i} position={[x + lean * height * r + 0.06, height * r, z + (i % 2 === 0 ? 0.05 : -0.05)]}>
          <octahedronGeometry args={[0.07, 0]} />
          <meshStandardMaterial color="#237044" emissive={tint} emissiveIntensity={0.6} flatShading />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Nature reclaiming one abandoned / decaying project.
 * Growth scales with years since failure — the longer a dream has been
 * gone, the more the forest moves in. Not a grave. A garden-in-waiting.
 */
function ReclaimedGround({ project }: { project: CityProject }) {
  const height = buildingHeight(project)
  const width = buildingWidth(project)
  const years = growthYears(project)
  const growth = 0.5 + Math.min(years, 6) / 6 // 0.5 .. 1.5
  const tint = '#3BFF91'
  const rotation = useMemo(() => alignToNormal(project.normal), [project.normal])

  const trees = useMemo(() => {
    const list: { pos: [number, number, number]; scale: number }[] = []
    const count = 2 + Math.floor(seeded(project.id, 0) * 3) // 2-4 trees
    for (let i = 0; i < count; i++) {
      const a = seeded(project.id, i + 1) * Math.PI * 2
      const dist = width * (0.9 + seeded(project.id, i + 9) * 0.9)
      list.push({
        pos: [Math.cos(a) * dist, 0, Math.sin(a) * dist],
        scale: growth * (0.7 + seeded(project.id, i + 17) * 0.6),
      })
    }
    return list
  }, [project.id, width, growth])

  const vines = useMemo(() => {
    const count = 3 + Math.floor(seeded(project.id, 40) * 3) // 3-5 vines
    return Array.from({ length: count }, (_, i) => ({
      x: (seeded(project.id, 50 + i) - 0.5) * width * 1.4,
      z: (seeded(project.id, 60 + i) - 0.5) * width * 1.4,
      h: height * (0.5 + seeded(project.id, 70 + i) * 0.45) * growth,
      seed: seeded(project.id, 80 + i),
    }))
  }, [project.id, width, height, growth])

  return (
    <group position={project.position} rotation={rotation}>
      {/* Moss patches around the base */}
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[
            (seeded(project.id, 90 + i) - 0.5) * width * 2,
            0.02,
            (seeded(project.id, 100 + i) - 0.5) * width * 2,
          ]}
          scale={[1, 0.25, 1]}
        >
          <sphereGeometry args={[0.35 + seeded(project.id, 110 + i) * 0.3, 8, 6]} />
          <meshStandardMaterial color="#173a26" emissive="#0f2a1a" emissiveIntensity={0.4} roughness={1} />
        </mesh>
      ))}

      {trees.map((t, i) => (
        <Tree key={`tree-${i}`} position={t.pos} scale={t.scale} tint={tint} />
      ))}

      {vines.map((v, i) => (
        <Vine key={`vine-${i}`} x={v.x} z={v.z} height={v.h} tint={tint} seed={v.seed} />
      ))}

      {/* Fireflies drifting through the overgrowth */}
      <Sparkles count={10} scale={[width * 2.4, height * 0.7, width * 2.4]} size={2.5} speed={0.25} color="#3BFF91" opacity={0.7} position={[0, height * 0.35, 0]} />
    </group>
  )
}

/**
 * A glowing seedling of rebirth on top of reviving projects —
 * the first shoot of a comeback.
 */
function RevivalSeedling({ project }: { project: CityProject }) {
  const ref = useRef<THREE.Group>(null)
  const height = buildingHeight(project)
  const rotation = useMemo(() => alignToNormal(project.normal), [project.normal])

  useFrame((state) => {
    if (!ref.current) return
    const s = 1 + Math.sin(state.clock.elapsedTime * 2.2) * 0.08
    ref.current.scale.setScalar(s)
    ref.current.rotation.y = state.clock.elapsedTime * 0.6
  })

  return (
    <group position={project.position} rotation={rotation}>
      <group ref={ref} position={[0, height + 0.35, 0]}>
        <mesh>
          <cylinderGeometry args={[0.03, 0.05, 0.5, 5]} />
          <meshStandardMaterial color="#2f8f5b" emissive="#3BFF91" emissiveIntensity={0.5} />
        </mesh>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * 0.14, 0.18, Math.sin(a) * 0.14]} rotation={[0.6, a, 0.9]}>
              <coneGeometry args={[0.09, 0.42, 4]} />
              <meshStandardMaterial color="#3BFF91" emissive="#3BFF91" emissiveIntensity={1.4} flatShading />
            </mesh>
          )
        })}
        <pointLight color="#3BFF91" intensity={0.6} distance={5} />
      </group>
      <Sparkles count={8} scale={[1.4, height * 0.8, 1.4]} size={2} speed={0.3} color="#3BFF91" opacity={0.8} position={[0, height * 0.5, 0]} />
    </group>
  )
}

// ---- 3. Wildlife: birds circling the planet ----------------------------- //

function Bird({ radius, height, speed, phase, tilt }: {
  radius: number
  height: number
  speed: number
  phase: number
  tilt: number
}) {
  const ref = useRef<THREE.Group>(null)
  const wingL = useRef<THREE.Mesh>(null)
  const wingR = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    const a = phase + t * speed
    ref.current.position.set(Math.cos(a) * radius, height + Math.sin(t * 0.8 + phase) * 1.5, Math.sin(a) * radius)
    ref.current.rotation.set(0, -(a + (speed > 0 ? Math.PI / 2 : -Math.PI / 2)), tilt)
    const flap = Math.sin(t * 9 + phase) * 0.55
    if (wingL.current) wingL.current.rotation.z = flap
    if (wingR.current) wingR.current.rotation.z = -flap
  })

  return (
    <group ref={ref}>
      {/* body */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.09, 0.45, 4]} />
        <meshStandardMaterial color="#dbe7ff" emissive="#8fb4ff" emissiveIntensity={0.35} flatShading />
      </mesh>
      {/* wings */}
      <mesh ref={wingL} position={[0.28, 0.02, 0]}>
        <boxGeometry args={[0.55, 0.02, 0.16]} />
        <meshStandardMaterial color="#c3d6ff" emissive="#8fb4ff" emissiveIntensity={0.3} flatShading />
      </mesh>
      <mesh ref={wingR} position={[-0.28, 0.02, 0]}>
        <boxGeometry args={[0.55, 0.02, 0.16]} />
        <meshStandardMaterial color="#c3d6ff" emissive="#8fb4ff" emissiveIntensity={0.3} flatShading />
      </mesh>
    </group>
  )
}

export function BirdFlock() {
  const birds = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        radius: PLANET_RADIUS + 4 + seeded('bird', i) * 14,
        height: 6 + seeded('bird', i + 10) * 22,
        speed: (0.05 + seeded('bird', i + 20) * 0.06) * (i % 2 === 0 ? 1 : -1),
        phase: seeded('bird', i + 30) * Math.PI * 2,
        tilt: (seeded('bird', i + 40) - 0.5) * 0.4,
      })),
    [],
  )
  return (
    <group>
      {birds.map((b, i) => (
        <Bird key={i} {...b} />
      ))}
    </group>
  )
}

// ---- Facade: the whole living layer -------------------------------------- //

/**
 * WorldLife — mount inside the City canvas. Renders roads + traffic, nature
 * reclaiming every abandoned/decaying project, seedlings on reviving ones,
 * and a bird flock circling the planet.
 */
export function WorldLife({ projects }: { projects: CityProject[] }) {
  const abandoned = useMemo(
    () => projects.filter((p) => p.status === 'abandoned' || p.status === 'decaying'),
    [projects],
  )
  const reviving = useMemo(() => projects.filter((p) => p.status === 'reviving'), [projects])

  return (
    <group>
      <RoadNetwork projects={projects} />
      {abandoned.map((p) => (
        <ReclaimedGround key={`nature-${p.id}`} project={p} />
      ))}
      {reviving.map((p) => (
        <RevivalSeedling key={`seed-${p.id}`} project={p} />
      ))}
      <BirdFlock />
    </group>
  )
}
