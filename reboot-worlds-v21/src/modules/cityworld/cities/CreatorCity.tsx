import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import * as THREE from 'three'
import type { CitySceneProps } from '../CityWorldModule'
import { CityTower, CityLinks, FillerSkyline, PortalRing, makeTowerDNA, seeded, type CityPalette } from './cityKit'

const PALETTE: CityPalette = {
  accent: '#FF4DD8',
  secondary: '#4D8CFF',
  ground: '#12081a',
  gridCell: '#3a1250',
  gridSection: '#6a2a8a',
  body: '#1a1024',
  fillerEmissive: '#3a1a50',
}

/** Nested animation-reel rings around a magenta core. */
function StudioRings() {
  const g = useRef<THREE.Group>(null)
  useFrame((state, delta) => {
    if (!g.current) return
    g.current.rotation.y += delta * 0.4
    g.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.4) * 0.25
  })
  return (
    <group>
      <mesh position={[0, 9, 0]}>
        <sphereGeometry args={[1.6, 14, 14]} />
        <meshBasicMaterial color={PALETTE.accent} toneMapped={false} />
      </mesh>
      <group ref={g} position={[0, 9, 0]}>
        <mesh>
          <torusGeometry args={[4.2, 0.14, 8, 56]} />
          <meshBasicMaterial color={PALETTE.accent} toneMapped={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2.4, 0, 0]}>
          <torusGeometry args={[5.6, 0.12, 8, 56]} />
          <meshBasicMaterial color={PALETTE.secondary} toneMapped={false} />
        </mesh>
        <mesh rotation={[Math.PI / 1.8, 0.5, 0]}>
          <torusGeometry args={[7, 0.1, 8, 56]} />
          <meshBasicMaterial color={PALETTE.accent} toneMapped={false} />
        </mesh>
      </group>
      <pointLight position={[0, 11, 0]} intensity={2.2} distance={80} color={PALETTE.accent} />
    </group>
  )
}

/** Impossible stairway rising into the sky and stopping mid-air. */
function ImpossibleStairs() {
  const g = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (g.current) g.current.rotation.y += delta * 0.15
  })
  return (
    <group ref={g} position={[16, 0, -12]}>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[Math.sin(i * 0.8) * 2.4, 1.5 + i * 1.7, Math.cos(i * 0.8) * 2.4]} rotation={[0, i * 0.8, 0.06]}>
          <boxGeometry args={[3.2, 0.4, 1.4]} />
          <meshStandardMaterial color={PALETTE.body} emissive={i % 2 === 0 ? PALETTE.accent : PALETTE.secondary} emissiveIntensity={0.5} metalness={0.4} roughness={0.35} />
        </mesh>
      ))}
    </group>
  )
}

/** Drifting wireframe paint blobs. */
function PaintBlob({ index }: { index: number }) {
  const mesh = useRef<THREE.Mesh>(null)
  const cfg = useMemo(
    () => ({
      x: (seeded(`pb${index}`, 1) - 0.5) * 52,
      y: 12 + seeded(`pb${index}`, 2) * 12,
      z: (seeded(`pb${index}`, 3) - 0.5) * 52,
      s: 1 + seeded(`pb${index}`, 4) * 1.6,
      sp: 0.2 + seeded(`pb${index}`, 5) * 0.5,
    }),
    [index],
  )
  useFrame((state, delta) => {
    if (!mesh.current) return
    mesh.current.rotation.y += delta * cfg.sp
    mesh.current.rotation.z += delta * cfg.sp * 0.6
    mesh.current.position.y = cfg.y + Math.sin(state.clock.elapsedTime * cfg.sp + index * 2) * 0.8
  })
  return (
    <mesh ref={mesh} position={[cfg.x, cfg.y, cfg.z]}>
      <icosahedronGeometry args={[cfg.s, 0]} />
      <meshBasicMaterial color={index % 2 === 0 ? PALETTE.accent : PALETTE.secondary} wireframe transparent opacity={0.45} />
    </mesh>
  )
}

export function CreatorCity({ projects, selectedId, onSelect }: CitySceneProps) {
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
      <StudioRings />
      <ImpossibleStairs />
      {Array.from({ length: 6 }, (_, i) => (
        <PaintBlob key={i} index={i} />
      ))}
      {projects.map((p, i) => (
        <CityTower key={p.id} project={p} dna={towers[i]} palette={PALETTE} cap="cube" hovered={hoveredId === p.id} selected={selectedId === p.id} onHover={setHoveredId} onSelect={onSelect} />
      ))}
      {tops.length > 0 && <CityLinks points={tops} accent={PALETTE.accent} targetY={9} />}
      <FillerSkyline palette={PALETTE} count={55} seed="cs" />
      <PortalRing accent={PALETTE.accent} />
      <pointLight position={[-18, 28, 12]} intensity={1.6} distance={120} color={PALETTE.secondary} />
    </group>
  )
}

export default CreatorCity
