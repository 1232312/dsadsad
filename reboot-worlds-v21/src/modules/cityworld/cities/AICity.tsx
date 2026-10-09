import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import * as THREE from 'three'
import type { Project } from '@/types/project'
import type { CitySceneProps } from '../CityWorldModule'

const ACCENT = '#3DD8FF'

function seeded(key: string, salt = 0): number {
  let h = 2166136261
  const s = `${key}:${salt}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

interface TowerDNA {
  pos: [number, number, number]
  height: number
  width: number
}

function makeTowerDNA(project: Project, index: number, total: number): TowerDNA {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 + seeded(project.id, 0) * 0.6
  const rad = 13 + seeded(project.id, 1) * 15
  const height = 5 + project.stage * 3.4 + seeded(project.id, 2) * 5
  const width = 2 + seeded(project.id, 3) * 1.8
  return { pos: [Math.cos(angle) * rad, 0, Math.sin(angle) * rad], height, width }
}

function HoloTower({
  project,
  dna,
  hovered,
  selected,
  onHover,
  onSelect,
}: {
  project: Project
  dna: TowerDNA
  hovered: boolean
  selected: boolean
  onHover: (id: string | null) => void
  onSelect: (p: Project) => void
}) {
  const group = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (!group.current) return
    const target = hovered || selected ? 1.06 : 1
    group.current.scale.lerp(new THREE.Vector3(target, target, target), delta * 6)
  })
  const glow = selected ? 1.1 : hovered ? 0.85 : 0.45
  return (
    <group
      ref={group}
      position={dna.pos}
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
          color="#0b1826"
          emissive={ACCENT}
          emissiveIntensity={glow}
          transparent
          opacity={0.82}
          metalness={0.7}
          roughness={0.22}
        />
      </mesh>
      <mesh position={[0, dna.height / 2, 0]}>
        <boxGeometry args={[dna.width * 1.08, dna.height * 1.01, dna.width * 1.08]} />
        <meshBasicMaterial color={ACCENT} wireframe transparent opacity={hovered || selected ? 0.35 : 0.14} />
      </mesh>
      <mesh position={[0, dna.height + 1.3, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2.4, 6]} />
        <meshBasicMaterial color="#7FF3FF" toneMapped={false} />
      </mesh>
      <mesh position={[0, dna.height + 2.7, 0]}>
        <sphereGeometry args={[0.2, 10, 10]} />
        <meshBasicMaterial color="#bff4ff" toneMapped={false} />
      </mesh>
      {selected && (
        <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[dna.width * 0.9, dna.width * 1.2, 32]} />
          <meshBasicMaterial color="#7FF3FF" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

function NeuralLinks({ points }: { points: THREE.Vector3[] }) {
  const mat = useRef<THREE.LineBasicMaterial>(null)
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const arr = new Float32Array(points.length * 6)
    points.forEach((p, i) => {
      arr[i * 6] = p.x
      arr[i * 6 + 1] = p.y
      arr[i * 6 + 2] = p.z
      arr[i * 6 + 3] = 0
      arr[i * 6 + 4] = 13
      arr[i * 6 + 5] = 0
    })
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    return g
  }, [points])
  useFrame((state) => {
    if (mat.current) mat.current.opacity = 0.16 + Math.abs(Math.sin(state.clock.elapsedTime * 1.6)) * 0.2
  })
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial ref={mat} color={ACCENT} transparent opacity={0.22} />
    </lineSegments>
  )
}

function AiCore() {
  const ring1 = useRef<THREE.Mesh>(null)
  const ring2 = useRef<THREE.Mesh>(null)
  useFrame((state, delta) => {
    if (ring1.current) ring1.current.rotation.z += delta * 0.6
    if (ring2.current) {
      ring2.current.rotation.x = Math.PI / 2 + Math.sin(state.clock.elapsedTime * 0.5) * 0.35
      ring2.current.rotation.y += delta * 0.3
    }
  })
  return (
    <group>
      <mesh position={[0, 11, 0]}>
        <cylinderGeometry args={[1.3, 2.4, 22, 8]} />
        <meshStandardMaterial color="#0c1a2a" emissive={ACCENT} emissiveIntensity={0.5} metalness={0.7} roughness={0.3} flatShading />
      </mesh>
      <mesh ref={ring1} position={[0, 15, 0]} rotation={[Math.PI / 2.2, 0, 0]}>
        <torusGeometry args={[5.2, 0.16, 8, 56]} />
        <meshBasicMaterial color="#7FF3FF" toneMapped={false} />
      </mesh>
      <mesh ref={ring2} position={[0, 20, 0]}>
        <torusGeometry args={[3.6, 0.12, 8, 40]} />
        <meshBasicMaterial color="#bff4ff" toneMapped={false} />
      </mesh>
      <mesh position={[0, 23.5, 0]}>
        <sphereGeometry args={[0.6, 12, 12]} />
        <meshBasicMaterial color="#e6fbff" toneMapped={false} />
      </mesh>
      <pointLight position={[0, 24, 0]} intensity={3} distance={90} color={ACCENT} />
    </group>
  )
}

function FillerSkyline() {
  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = ref.current
    if (!m) return
    const d = new THREE.Object3D()
    for (let i = 0; i < 70; i++) {
      const a = seeded(`fs${i}`, 1) * Math.PI * 2
      const rad = 30 + seeded(`fs${i}`, 2) * 42
      const h = 3 + seeded(`fs${i}`, 3) * 10
      d.position.set(Math.cos(a) * rad, h / 2, Math.sin(a) * rad)
      d.scale.set(1.6 + seeded(`fs${i}`, 4) * 1.6, h, 1.6 + seeded(`fs${i}`, 4) * 1.6)
      d.rotation.set(0, seeded(`fs${i}`, 5) * Math.PI, 0)
      d.updateMatrix()
      m.setMatrixAt(i, d.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  }, [])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 70]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#0a1424" emissive="#14384a" emissiveIntensity={0.35} metalness={0.4} roughness={0.5} />
    </instancedMesh>
  )
}

function Platform({ index }: { index: number }) {
  const mesh = useRef<THREE.Mesh>(null)
  const cfg = useMemo(
    () => ({
      x: (seeded(`pf${index}`, 1) - 0.5) * 56,
      z: (seeded(`pf${index}`, 2) - 0.5) * 56,
      y: 9 + seeded(`pf${index}`, 3) * 13,
      r: 2 + seeded(`pf${index}`, 4) * 2.2,
      sp: 0.5 + seeded(`pf${index}`, 5) * 0.5,
    }),
    [index],
  )
  useFrame((state) => {
    if (mesh.current) mesh.current.position.y = cfg.y + Math.sin(state.clock.elapsedTime * cfg.sp + index) * 0.8
  })
  return (
    <mesh ref={mesh} position={[cfg.x, cfg.y, cfg.z]}>
      <cylinderGeometry args={[cfg.r, cfg.r * 0.65, 0.35, 10]} />
      <meshStandardMaterial color="#0d1d2e" emissive={ACCENT} emissiveIntensity={0.35} metalness={0.5} roughness={0.4} />
    </mesh>
  )
}

function DataGlyph({ index }: { index: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const cfg = useMemo(
    () => ({
      x: (seeded(`dg${index}`, 1) - 0.5) * 48,
      y: 17 + seeded(`dg${index}`, 2) * 12,
      z: (seeded(`dg${index}`, 3) - 0.5) * 48,
      s: 1.2 + seeded(`dg${index}`, 4) * 1.6,
      sp: (seeded(`dg${index}`, 5) - 0.5) * 0.6,
    }),
    [index],
  )
  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.rotation.y += delta * cfg.sp
    ref.current.rotation.x += delta * cfg.sp * 0.6
  })
  return (
    <mesh ref={ref} position={[cfg.x, cfg.y, cfg.z]}>
      <icosahedronGeometry args={[cfg.s, 0]} />
      <meshBasicMaterial color={ACCENT} wireframe transparent opacity={0.28} />
    </mesh>
  )
}

function Portal() {
  const glow = useRef<THREE.MeshBasicMaterial>(null)
  useFrame((state) => {
    if (glow.current) glow.current.opacity = 0.16 + Math.abs(Math.sin(state.clock.elapsedTime * 2)) * 0.12
  })
  return (
    <group position={[0, 20, -55]}>
      <mesh>
        <torusGeometry args={[4.6, 0.5, 12, 64]} />
        <meshStandardMaterial color="#12303f" emissive="#7FF3FF" emissiveIntensity={1.3} metalness={0.3} roughness={0.3} />
      </mesh>
      <mesh>
        <circleGeometry args={[4.3, 48]} />
        <meshBasicMaterial ref={glow} color="#bff4ff" transparent opacity={0.2} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {[-5.4, 5.4].map((x) => (
        <mesh key={x} position={[x, -10.5, 0]}>
          <cylinderGeometry args={[0.3, 0.4, 21, 8]} />
          <meshStandardMaterial color="#0d1d2e" emissive={ACCENT} emissiveIntensity={0.3} metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

export function AICity({ projects, selectedId, onSelect }: CitySceneProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const towers = useMemo(() => projects.map((p, i) => makeTowerDNA(p, i, projects.length)), [projects])
  const tops = useMemo(
    () => towers.map((t) => new THREE.Vector3(t.pos[0], t.height + 1.2, t.pos[2])),
    [towers],
  )
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[320, 320]} />
        <meshStandardMaterial color="#070f1a" roughness={0.9} metalness={0.2} />
      </mesh>
      <Grid
        position={[0, 0.02, 0]}
        args={[100, 100]}
        cellSize={4}
        cellThickness={0.6}
        cellColor="#12384a"
        sectionSize={20}
        sectionThickness={1}
        sectionColor="#1f6a8a"
        fadeDistance={160}
        fadeStrength={2}
        infiniteGrid
      />
      <AiCore />
      {projects.map((p, i) => (
        <HoloTower
          key={p.id}
          project={p}
          dna={towers[i]}
          hovered={hoveredId === p.id}
          selected={selectedId === p.id}
          onHover={setHoveredId}
          onSelect={onSelect}
        />
      ))}
      {tops.length > 0 && <NeuralLinks points={tops} />}
      <FillerSkyline />
      {Array.from({ length: 8 }, (_, i) => (
        <Platform key={i} index={i} />
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <DataGlyph key={i} index={i} />
      ))}
      <Portal />
    </group>
  )
}

export default AICity
