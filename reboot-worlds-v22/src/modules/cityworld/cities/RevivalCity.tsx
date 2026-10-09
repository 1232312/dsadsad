import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import * as THREE from 'three'
import type { CitySceneProps } from '../CityWorldModule'
import { CityTower, CityLinks, FillerSkyline, PortalRing, makeTowerDNA, seeded, type CityPalette } from './cityKit'

const PALETTE: CityPalette = {
  accent: '#FFB547',
  secondary: '#3BFF91',
  ground: '#0d0f0a',
  gridCell: '#3a3a12',
  gridSection: '#6a5a1f',
  body: '#1a1a14',
  fillerEmissive: '#3a3a1a',
}

/** Construction drones circling the rebuild sites. */
function Drone({ index }: { index: number }) {
  const g = useRef<THREE.Group>(null)
  const rotors = useRef<THREE.Group>(null)
  const cfg = useMemo(
    () => ({
      r: 12 + seeded(`dr${index}`, 1) * 14,
      y: 7 + seeded(`dr${index}`, 2) * 8,
      sp: 0.25 + seeded(`dr${index}`, 3) * 0.35,
      ph: seeded(`dr${index}`, 4) * Math.PI * 2,
    }),
    [index],
  )
  useFrame((state, delta) => {
    if (!g.current) return
    const a = state.clock.elapsedTime * cfg.sp + cfg.ph
    g.current.position.set(Math.cos(a) * cfg.r, cfg.y + Math.sin(state.clock.elapsedTime * 0.9 + index) * 0.7, Math.sin(a) * cfg.r)
    g.current.rotation.y = -a
    if (rotors.current) rotors.current.rotation.y += delta * 22
  })
  return (
    <group ref={g}>
      <mesh>
        <boxGeometry args={[0.34, 0.12, 0.34]} />
        <meshStandardMaterial color="#2a2620" emissive={PALETTE.accent} emissiveIntensity={0.7} roughness={0.5} metalness={0.4} />
      </mesh>
      <group ref={rotors} position={[0, 0.14, 0]}>
        <mesh>
          <boxGeometry args={[0.5, 0.015, 0.04]} />
          <meshBasicMaterial color={PALETTE.secondary} toneMapped={false} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.5, 0.015, 0.04]} />
          <meshBasicMaterial color={PALETTE.secondary} toneMapped={false} />
        </mesh>
      </group>
      <mesh position={[0, -0.14, 0]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial color={PALETTE.accent} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Slow tower cranes at the district edge. */
function Crane({ index }: { index: number }) {
  const g = useRef<THREE.Group>(null)
  const cfg = useMemo(
    () => ({
      x: (seeded(`cr${index}`, 1) - 0.5) * 70,
      z: (seeded(`cr${index}`, 2) - 0.5) * 70,
      sp: 0.05 + seeded(`cr${index}`, 3) * 0.06,
    }),
    [index],
  )
  useFrame((_, delta) => {
    if (g.current) g.current.rotation.y += delta * cfg.sp
  })
  return (
    <group ref={g} position={[cfg.x, 0, cfg.z]}>
      <mesh position={[0, 9, 0]}>
        <boxGeometry args={[1.2, 18, 1.2]} />
        <meshStandardMaterial color="#2a2620" emissive={PALETTE.accent} emissiveIntensity={0.15} metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[4.5, 17.4, 0]}>
        <boxGeometry args={[11, 0.8, 0.8]} />
        <meshStandardMaterial color="#2a2620" emissive={PALETTE.accent} emissiveIntensity={0.15} metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[9, 15.5, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 4, 5]} />
        <meshBasicMaterial color={PALETTE.accent} toneMapped={false} />
      </mesh>
      <mesh position={[9, 13, 0]}>
        <boxGeometry args={[0.8, 1.2, 0.8]} />
        <meshStandardMaterial color="#3a3020" emissive={PALETTE.secondary} emissiveIntensity={0.3} />
      </mesh>
      <pointLight position={[0, 19, 0]} intensity={0.8} distance={30} color={PALETTE.accent} />
    </group>
  )
}

/** Fresh green shoots reclaiming the ground. */
function FreshGrowth() {
  return (
    <group>
      {Array.from({ length: 12 }, (_, i) => {
        const a = seeded(`fg${i}`, 1) * Math.PI * 2
        const r = 12 + seeded(`fg${i}`, 2) * 30
        const h = 0.6 + seeded(`fg${i}`, 3) * 0.9
        return (
          <group key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
            <mesh position={[0, h / 2, 0]}>
              <cylinderGeometry args={[0.04, 0.06, h, 5]} />
              <meshStandardMaterial color="#2a3a20" roughness={0.8} />
            </mesh>
            <mesh position={[0, h + 0.18, 0]}>
              <sphereGeometry args={[0.22, 8, 8]} />
              <meshBasicMaterial color={PALETTE.secondary} toneMapped={false} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

export function RevivalCity({ projects, selectedId, onSelect }: CitySceneProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const towers = useMemo(() => projects.map((p, i) => makeTowerDNA(p, i, projects.length)), [projects])
  const tops = useMemo(() => towers.map((t) => new THREE.Vector3(t.pos[0], t.height + 1.2, t.pos[2])), [towers])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[320, 320]} />
        <meshStandardMaterial color={PALETTE.ground} roughness={0.9} metalness={0.2} />
      </mesh>
      <Grid position={[0, 0.02, 0]} args={[100, 100]} cellSize={4} cellThickness={0.6} cellColor={PALETTE.gridCell} sectionSize={20} sectionThickness={1} sectionColor={PALETTE.gridSection} fadeDistance={160} fadeStrength={2} infiniteGrid />
      {Array.from({ length: 2 }, (_, i) => (
        <Crane key={i} index={i} />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <Drone key={i} index={i} />
      ))}
      <FreshGrowth />
      {projects.map((p, i) => (
        <CityTower key={p.id} project={p} dna={towers[i]} palette={PALETTE} cap="spire" hovered={hoveredId === p.id} selected={selectedId === p.id} onHover={setHoveredId} onSelect={onSelect} />
      ))}
      {tops.length > 0 && <CityLinks points={tops} accent={PALETTE.secondary} targetY={9} />}
      <FillerSkyline palette={PALETTE} count={55} seed="rv" />
      <PortalRing accent={PALETTE.accent} />
    </group>
  )
}

export default RevivalCity
