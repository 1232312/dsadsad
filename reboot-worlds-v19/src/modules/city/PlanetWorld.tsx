/**
 * PlanetWorld — the planet surface, district biomes, and living elements.
 *
 * The planet is a large sphere. Districts occupy angular sectors, each with
 * unique terrain features (crystals, ruins, platforms, data forests). Life
 * particles flow between buildings, construction drones hover near reviving
 * projects, and the atmosphere shimmers.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles, Float } from '@react-three/drei'
import * as THREE from 'three'
import { CATEGORY_THEME, DISTRICT_MAP, type ProjectCategory } from '@/types/project'
import { PLANET_RADIUS, type CityProject } from './CityModule'

// ---- Planet body -------------------------------------------------------- //

export function PlanetBody() {
  const ref = useRef<THREE.Mesh>(null)

  return (
    <group>
      {/* Atmosphere glow shell */}
      <mesh scale={1.08}>
        <sphereGeometry args={[PLANET_RADIUS, 48, 32]} />
        <meshBasicMaterial color="#3DD8FF" transparent opacity={0.04} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <mesh scale={1.04}>
        <sphereGeometry args={[PLANET_RADIUS, 48, 32]} />
        <meshBasicMaterial color="#3DD8FF" transparent opacity={0.06} side={THREE.BackSide} depthWrite={false} />
      </mesh>

      {/* Planet surface */}
      <mesh ref={ref}>
        <sphereGeometry args={[PLANET_RADIUS, 64, 48]} />
        <meshStandardMaterial
          color="#080d18"
          roughness={0.85}
          metalness={0.3}
          emissive="#0a1828"
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* Latitude grid lines on surface for a "digital planet" feel */}
      <PlanetGrid />

      {/* Equator glow ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[PLANET_RADIUS * 1.01, 0.08, 4, 128]} />
        <meshBasicMaterial color="#3DD8FF" transparent opacity={0.15} />
      </mesh>
    </group>
  )
}

function PlanetGrid() {
  const lines = useMemo(() => {
    const items: { pos: [number, number, number]; rot: [number, number, number]; radius: number }[] = []
    // Latitude rings
    for (let i = 1; i < 6; i++) {
      const lat = (i / 6) * Math.PI - Math.PI / 2
      const r = Math.cos(lat) * PLANET_RADIUS * 1.002
      const y = Math.sin(lat) * PLANET_RADIUS * 1.002
      items.push({
        pos: [0, y, 0],
        rot: [Math.PI / 2, 0, 0],
        radius: r,
      })
    }
    return items
  }, [])

  return (
    <group>
      {lines.map((l, i) => (
        <mesh key={`lat-${i}`} position={l.pos} rotation={l.rot}>
          <ringGeometry args={[l.radius - 0.05, l.radius, 64]} />
          <meshBasicMaterial color="#1a3448" transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      {/* Longitude lines */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2
        return (
          <mesh key={`lon-${i}`} rotation={[0, angle, 0]}>
            <torusGeometry args={[PLANET_RADIUS * 1.002, 0.03, 4, 48, Math.PI]} />
            <meshBasicMaterial color="#1a3448" transparent opacity={0.15} />
          </mesh>
        )
      })}
    </group>
  )
}

// ---- District biomes --------------------------------------------------- //

interface BiomeProps {
  sectorAngle: number
  sectorWidth: number
  category: ProjectCategory
  projects: CityProject[]
}

export function DistrictBiome({ sectorAngle, sectorWidth, category, projects }: BiomeProps) {
  const theme = CATEGORY_THEME[category]
  const district = DISTRICT_MAP[category]
  const isGraveyard = category === 'Graveyard'
  const isAI = category === 'AI'
  const isGaming = category === 'Gaming'
  const isSpace = category === 'Space'
  const isRobotics = category === 'Robotics'

  // District border ring on planet surface
  const borderPositions = useMemo(() => {
    const pts: [number, number, number][] = []
    const r = PLANET_RADIUS * 1.01
    const steps = 16
    for (let i = 0; i <= steps; i++) {
      const a = sectorAngle - sectorWidth / 2 + (i / steps) * sectorWidth
      pts.push([Math.cos(a) * r, 0, Math.sin(a) * r])
    }
    return pts
  }, [sectorAngle, sectorWidth])

  return (
    <group>
      {/* District ground glow — a translucent arc on the surface */}
      <mesh position={[Math.cos(sectorAngle) * PLANET_RADIUS * 0.97, 0, Math.sin(sectorAngle) * PLANET_RADIUS * 0.97]}>
        <circleGeometry args={[PLANET_RADIUS * 0.35, 24, sectorAngle - sectorWidth / 2, sectorWidth]} />
        <meshBasicMaterial color={theme.emissive} transparent opacity={0.05} depthWrite={false} />
      </mesh>

      {/* District border line */}
      {borderPositions.map((p, i) => {
        if (i === 0) return null
        const prev = borderPositions[i - 1]
        const mid: [number, number, number] = [(p[0] + prev[0]) / 2, (p[1] + prev[1]) / 2, (p[2] + prev[2]) / 2]
        const dist = Math.sqrt((p[0] - prev[0]) ** 2 + (p[2] - prev[2]) ** 2)
        const angle = Math.atan2(p[2] - prev[2], p[0] - prev[0])
        return (
          <mesh key={i} position={mid} rotation={[0, -angle, 0]}>
            <boxGeometry args={[dist, 0.04, 0.04]} />
            <meshBasicMaterial color={theme.emissive} transparent opacity={0.3} />
          </mesh>
        )
      })}

      {/* Biome-specific terrain features */}
      {isGraveyard && <GraveyardBiome sectorAngle={sectorAngle} color={theme.emissive} />}
      {isAI && <AIBiome sectorAngle={sectorAngle} color={theme.emissive} />}
      {isGaming && <GamingBiome sectorAngle={sectorAngle} color={theme.emissive} />}
      {isSpace && <SpaceBiome sectorAngle={sectorAngle} color={theme.emissive} />}
      {isRobotics && <RoboticsBiome sectorAngle={sectorAngle} color={theme.emissive} />}

      {/* Sparkles for atmosphere */}
      <Sparkles
        count={8}
        scale={20}
        size={2}
        speed={0.15}
        color={theme.emissive}
        opacity={0.3}
        position={[Math.cos(sectorAngle) * PLANET_RADIUS * 0.95, 2, Math.sin(sectorAngle) * PLANET_RADIUS * 0.95]}
      />
    </group>
  )
}

function surfacePos(angle: number, radialOffset: number, height: number): [number, number, number] {
  const r = PLANET_RADIUS + height
  const a = angle
  return [Math.cos(a) * r + radialOffset, height, Math.sin(a) * r + radialOffset]
}

function GraveyardBiome({ sectorAngle, color }: { sectorAngle: number; color: string }) {
  return (
    <group position={[Math.cos(sectorAngle) * PLANET_RADIUS, 0, Math.sin(sectorAngle) * PLANET_RADIUS]}>
      {/* Broken pillars */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i - 1.5) * 0.08
        const r = PLANET_RADIUS + 0.3
        return (
          <mesh key={i} position={[Math.cos(sectorAngle + a) * r - Math.cos(sectorAngle) * PLANET_RADIUS, 0.3 + i * 0.2, Math.sin(sectorAngle + a) * r - Math.sin(sectorAngle) * PLANET_RADIUS]}>
            <boxGeometry args={[0.3, 0.5 + (i % 2) * 0.4, 0.3]} />
            <meshStandardMaterial color="#1a1010" emissive={color} emissiveIntensity={0.05} roughness={0.95} />
          </mesh>
        )
      })}
    </group>
  )
}

function AIBiome({ sectorAngle, color }: { sectorAngle: number; color: string }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.1
  })
  return (
    <group position={[Math.cos(sectorAngle) * PLANET_RADIUS, 0, Math.sin(sectorAngle) * PLANET_RADIUS]}>
      <group ref={ref}>
        {/* Data crystal clusters */}
        {[0, 1, 2].map((i) => {
          const a = (i - 1) * 0.06
          return (
            <Float key={i} speed={1 + i * 0.3} floatIntensity={0.3}>
              <mesh position={[Math.cos(sectorAngle + a) * 0.5, 1.5, Math.sin(sectorAngle + a) * 0.5]}>
                <octahedronGeometry args={[0.4 + i * 0.1]} />
                <meshStandardMaterial color="#05070c" emissive={color} emissiveIntensity={0.6} wireframe />
              </mesh>
            </Float>
          )
        })}
      </group>
    </group>
  )
}

function GamingBiome({ sectorAngle, color }: { sectorAngle: number; color: string }) {
  return (
    <group position={[Math.cos(sectorAngle) * PLANET_RADIUS, 0, Math.sin(sectorAngle) * PLANET_RADIUS]}>
      {/* Floating platforms */}
      {[0, 1, 2].map((i) => (
        <Float key={i} speed={0.8 + i * 0.2} floatIntensity={0.4}>
          <mesh position={[Math.cos(sectorAngle + (i - 1) * 0.05) * 0.6, 0.8 + i * 0.6, Math.sin(sectorAngle + (i - 1) * 0.05) * 0.6]}>
            <boxGeometry args={[1.2, 0.15, 1.2]} />
            <meshStandardMaterial color="#111827" emissive={color} emissiveIntensity={0.3} metalness={0.5} roughness={0.5} />
          </mesh>
        </Float>
      ))}
    </group>
  )
}

function SpaceBiome({ sectorAngle, color }: { sectorAngle: number; color: string }) {
  return (
    <group position={[Math.cos(sectorAngle) * PLANET_RADIUS, 0, Math.sin(sectorAngle) * PLANET_RADIUS]}>
      {/* Launch tower silhouette */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.15, 0.3, 3, 6]} />
        <meshStandardMaterial color="#0d1828" emissive={color} emissiveIntensity={0.15} metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3.2, 0]}>
        <coneGeometry args={[0.12, 0.5, 6]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  )
}

function RoboticsBiome({ sectorAngle, color }: { sectorAngle: number; color: string }) {
  const armRef = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (armRef.current) armRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5) * 0.3
  })
  return (
    <group position={[Math.cos(sectorAngle) * PLANET_RADIUS, 0, Math.sin(sectorAngle) * PLANET_RADIUS]}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.6, 1, 0.6]} />
        <meshStandardMaterial color="#111827" metalness={0.8} roughness={0.3} emissive={color} emissiveIntensity={0.1} />
      </mesh>
      <mesh ref={armRef} position={[0.3, 1.2, 0]}>
        <boxGeometry args={[0.8, 0.15, 0.15]} />
        <meshStandardMaterial color="#0d1828" metalness={0.7} roughness={0.4} />
      </mesh>
    </group>
  )
}

// ---- Life particles (data motes flowing between buildings) ------------- //

export function LifeParticles({ projects }: { projects: CityProject[] }) {
  const ref = useRef<THREE.Points>(null)

  const { positions, velocities, colors } = useMemo(() => {
    const count = Math.min(150, projects.length * 8)
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const p = projects[i % projects.length]
      pos[i * 3] = p.position[0] + (Math.random() - 0.5) * 4
      pos[i * 3 + 1] = p.position[1] + Math.random() * 6
      pos[i * 3 + 2] = p.position[2] + (Math.random() - 0.5) * 4
      vel[i * 3] = (Math.random() - 0.5) * 0.5
      vel[i * 3 + 1] = 0.2 + Math.random() * 0.3
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.5
      const c = new THREE.Color(CATEGORY_THEME[p.category].emissive)
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }
    return { positions: pos, velocities: vel, colors: col }
  }, [projects])

  useFrame((_, delta) => {
    if (!ref.current) return
    const pos = ref.current.geometry.attributes.position as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    for (let i = 0; i < arr.length / 3; i++) {
      arr[i * 3] += velocities[i * 3] * delta
      arr[i * 3 + 1] += velocities[i * 3 + 1] * delta
      arr[i * 3 + 2] += velocities[i * 3 + 2] * delta
      // Reset when too high
      if (arr[i * 3 + 1] > 12) {
        const p = projects[i % projects.length]
        arr[i * 3] = p.position[0] + (Math.random() - 0.5) * 3
        arr[i * 3 + 1] = p.position[1]
        arr[i * 3 + 2] = p.position[2] + (Math.random() - 0.5) * 3
      }
    }
    pos.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={colors.length / 3} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.15} vertexColors transparent opacity={0.7} sizeAttenuation depthWrite={false} />
    </points>
  )
}

// ---- Construction drones near reviving projects ------------------------ //

export function ConstructionDrones({ projects }: { projects: CityProject[] }) {
  const reviving = projects.filter((p) => p.status === 'reviving')
  const refs = useRef<(THREE.Group | null)[]>([])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    reviving.forEach((_, i) => {
      const g = refs.current[i]
      if (!g) return
      const p = reviving[i]
      g.position.set(
        p.position[0] + Math.cos(t * 0.8 + i) * 2,
        p.position[1] + 2 + Math.sin(t * 1.2 + i) * 0.5,
        p.position[2] + Math.sin(t * 0.8 + i) * 2,
      )
    })
  })

  return (
    <group>
      {reviving.map((p, i) => (
        <group key={p.id} ref={(el) => { refs.current[i] = el }}>
          <mesh>
            <boxGeometry args={[0.2, 0.08, 0.2]} />
            <meshBasicMaterial color="#3DD8FF" />
          </mesh>
          <pointLight color="#3DD8FF" intensity={0.3} distance={3} />
        </group>
      ))}
    </group>
  )
}

// ---- Planet stars (deep space background) ------------------------------ //

export function PlanetStars({ count = 1200 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 300 + Math.random() * 100
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      arr[i * 3 + 2] = r * Math.cos(phi)
    }
    return arr
  }, [count])

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.005
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.8} transparent opacity={0.6} sizeAttenuation />
    </points>
  )
}
