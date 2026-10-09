import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Project } from '@/types/project'

/** Per-city palette driving every shared element below. */
export interface CityPalette {
  accent: string
  secondary: string
  ground: string
  gridCell: string
  gridSection: string
  body: string
  fillerEmissive: string
}

export function seeded(key: string, salt = 0): number {
  let h = 2166136261
  const s = `${key}:${salt}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

export interface TowerDNA {
  pos: [number, number, number]
  height: number
  width: number
  angle: number
}

export function makeTowerDNA(project: Project, index: number, total: number, ring = 0): TowerDNA {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 + seeded(project.id, 0) * 0.6
  const rad = 13 + ring + seeded(project.id, 1) * 15
  const height = 5 + project.stage * 3.4 + seeded(project.id, 2) * 5
  const width = 2 + seeded(project.id, 3) * 1.8
  return { pos: [Math.cos(angle) * rad, 0, Math.sin(angle) * rad], height, width, angle }
}

export type TowerCap = 'spire' | 'cube' | 'dome' | 'none'

/**
 * Palette-driven project tower. The project's live status shapes the
 * structure: abandoned towers lean and go dark, decaying neon flickers,
 * reviving towers wear scaffolding and a construction ring, alive
 * towers shine.
 */
export function CityTower({
  project,
  dna,
  palette,
  cap = 'spire',
  hovered,
  selected,
  onHover,
  onSelect,
}: {
  project: Project
  dna: TowerDNA
  palette: CityPalette
  cap?: TowerCap
  hovered: boolean
  selected: boolean
  onHover: (id: string | null) => void
  onSelect: (p: Project) => void
}) {
  const group = useRef<THREE.Group>(null)
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null)
  const status = project.status
  const tilt = useMemo(
    () => (status === 'abandoned' ? 0.05 + seeded(project.id, 7) * 0.09 : status === 'decaying' ? 0.02 : 0),
    [status, project.id],
  )
  const baseGlow = selected
    ? 1.15
    : hovered
      ? 0.9
      : status === 'reviving'
        ? 0.75
        : status === 'alive'
          ? 0.55
          : status === 'decaying'
            ? 0.4
            : 0.12
  useFrame((state, delta) => {
    if (!group.current) return
    const t = hovered || selected ? 1.06 : 1
    group.current.scale.lerp(new THREE.Vector3(t, t, t), delta * 6)
    if (bodyMat.current) {
      if (status === 'decaying') {
        bodyMat.current.emissiveIntensity = baseGlow * (0.55 + Math.abs(Math.sin(state.clock.elapsedTime * 6 + dna.angle * 5)) * 0.6)
      } else {
        bodyMat.current.emissiveIntensity = baseGlow
      }
    }
  })
  return (
    <group
      ref={group}
      position={dna.pos}
      rotation={[0, 0, tilt]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        onSelect(project)
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        onHover(project.id)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        onHover(null)
        document.body.style.cursor = 'auto'
      }}
    >
      <mesh position={[0, dna.height / 2, 0]}>
        <boxGeometry args={[dna.width, dna.height, dna.width]} />
        <meshStandardMaterial
          ref={bodyMat}
          color={palette.body}
          emissive={palette.accent}
          emissiveIntensity={baseGlow}
          transparent
          opacity={0.85}
          metalness={0.65}
          roughness={0.25}
        />
      </mesh>
      <mesh position={[0, dna.height / 2, 0]}>
        <boxGeometry args={[dna.width * 1.08, dna.height * 1.01, dna.width * 1.08]} />
        <meshBasicMaterial
          color={palette.accent}
          wireframe
          transparent
          opacity={status === 'abandoned' ? 0.05 : hovered || selected ? 0.35 : 0.14}
        />
      </mesh>
      {status !== 'abandoned' && cap !== 'none' && (
        <>
          {cap === 'spire' && (
            <>
              <mesh position={[0, dna.height + 1.3, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 2.4, 6]} />
                <meshBasicMaterial color={palette.accent} toneMapped={false} />
              </mesh>
              <mesh position={[0, dna.height + 2.7, 0]}>
                <sphereGeometry args={[0.2, 10, 10]} />
                <meshBasicMaterial color={palette.secondary} toneMapped={false} />
              </mesh>
            </>
          )}
          {cap === 'cube' && (
            <mesh position={[0, dna.height + 0.9, 0]}>
              <boxGeometry args={[0.55, 0.55, 0.55]} />
              <meshBasicMaterial color={palette.secondary} toneMapped={false} />
            </mesh>
          )}
          {cap === 'dome' && (
            <mesh position={[0, dna.height, 0]}>
              <sphereGeometry args={[Math.max(0.5, dna.width * 0.35), 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshBasicMaterial color={palette.secondary} toneMapped={false} />
            </mesh>
          )}
        </>
      )}
      {status === 'reviving' && (
        <>
          <mesh position={[0, dna.height * 0.55, 0]} rotation={[Math.PI / 2.6, 0, 0]}>
            <torusGeometry args={[dna.width * 1.35, 0.06, 6, 32]} />
            <meshBasicMaterial color="#FFB547" toneMapped={false} />
          </mesh>
          {[
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].map(([sx, sz], i) => (
            <mesh key={i} position={[(sx * dna.width) / 1.5, (dna.height * 1.1) / 2, (sz * dna.width) / 1.5]}>
              <cylinderGeometry args={[0.04, 0.04, dna.height * 1.1, 5]} />
              <meshStandardMaterial color="#8a6a3a" roughness={0.7} metalness={0.3} />
            </mesh>
          ))}
        </>
      )}
      {selected && (
        <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[dna.width * 0.9, dna.width * 1.2, 32]} />
          <meshBasicMaterial color={palette.accent} transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

/** Pulsing links between the project towers and the city's heart. */
export function CityLinks({ points, accent, targetY }: { points: THREE.Vector3[]; accent: string; targetY: number }) {
  const mat = useRef<THREE.LineBasicMaterial>(null)
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const arr = new Float32Array(points.length * 6)
    points.forEach((p, i) => {
      arr[i * 6] = p.x
      arr[i * 6 + 1] = p.y
      arr[i * 6 + 2] = p.z
      arr[i * 6 + 3] = 0
      arr[i * 6 + 4] = targetY
      arr[i * 6 + 5] = 0
    })
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    return g
  }, [points, targetY])
  useFrame((state) => {
    if (mat.current) mat.current.opacity = 0.16 + Math.abs(Math.sin(state.clock.elapsedTime * 1.6)) * 0.2
  })
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial ref={mat} color={accent} transparent opacity={0.22} />
    </lineSegments>
  )
}

/** Instanced ambient skyline — cheap density that is not clickable. */
export function FillerSkyline({
  palette,
  count,
  seed,
  heightScale = 1,
}: {
  palette: CityPalette
  count: number
  seed: string
  heightScale?: number
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = ref.current
    if (!m) return
    const d = new THREE.Object3D()
    for (let i = 0; i < count; i++) {
      const a = seeded(`${seed}${i}`, 1) * Math.PI * 2
      const rad = 30 + seeded(`${seed}${i}`, 2) * 42
      const h = (3 + seeded(`${seed}${i}`, 3) * 10) * heightScale
      d.position.set(Math.cos(a) * rad, h / 2, Math.sin(a) * rad)
      d.scale.set(1.6 + seeded(`${seed}${i}`, 4) * 1.6, h, 1.6 + seeded(`${seed}${i}`, 4) * 1.6)
      d.rotation.set(0, seeded(`${seed}${i}`, 5) * Math.PI, 0)
      d.updateMatrix()
      m.setMatrixAt(i, d.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  }, [count, seed, heightScale])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={palette.body} emissive={palette.fillerEmissive} emissiveIntensity={0.35} metalness={0.4} roughness={0.5} />
    </instancedMesh>
  )
}

/** The glowing portal the camera flies through during the intro. */
export function PortalRing({ accent }: { accent: string }) {
  const glow = useRef<THREE.MeshBasicMaterial>(null)
  useFrame((state) => {
    if (glow.current) glow.current.opacity = 0.16 + Math.abs(Math.sin(state.clock.elapsedTime * 2)) * 0.12
  })
  return (
    <group position={[0, 20, -55]}>
      <mesh>
        <torusGeometry args={[4.6, 0.5, 12, 64]} />
        <meshStandardMaterial color="#12303f" emissive={accent} emissiveIntensity={1.3} metalness={0.3} roughness={0.3} />
      </mesh>
      <mesh>
        <circleGeometry args={[4.3, 48]} />
        <meshBasicMaterial ref={glow} color={accent} transparent opacity={0.2} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {[-5.4, 5.4].map((x) => (
        <mesh key={x} position={[x, -10.5, 0]}>
          <cylinderGeometry args={[0.3, 0.4, 21, 8]} />
          <meshStandardMaterial color="#0d1d2e" emissive={accent} emissiveIntensity={0.3} metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
    </group>
  )
}
