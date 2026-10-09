import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import * as THREE from 'three'
import type { CitySceneProps } from '../CityWorldModule'
import { CityTower, CityLinks, FillerSkyline, PortalRing, makeTowerDNA, seeded, type CityPalette } from './cityKit'

const PALETTE: CityPalette = {
  accent: '#3BFF91',
  secondary: '#2BE8C8',
  ground: '#081410',
  gridCell: '#12402a',
  gridSection: '#1f8a5a',
  body: '#0a2018',
  fillerEmissive: '#14402a',
}

/** The Great Library — a stepped ziggurat with glowing seams and a beacon. */
function LibraryZiggurat() {
  const beacon = useRef<THREE.MeshBasicMaterial>(null)
  useFrame((state) => {
    if (beacon.current) beacon.current.opacity = 0.6 + Math.abs(Math.sin(state.clock.elapsedTime * 1.8)) * 0.4
  })
  const steps: [number, number][] = [
    [16, 2],
    [12, 2],
    [8.5, 2],
    [5, 2],
  ]
  return (
    <group>
      {steps.map(([w, h], i) => (
        <group key={i}>
          <mesh position={[0, 1 + i * 2, 0]}>
            <boxGeometry args={[w, h, w]} />
            <meshStandardMaterial color={PALETTE.body} emissive={PALETTE.accent} emissiveIntensity={0.35} metalness={0.5} roughness={0.35} flatShading />
          </mesh>
          <mesh position={[0, 1 + i * 2, 0]}>
            <boxGeometry args={[w * 1.01, h * 1.02, w * 1.01]} />
            <meshBasicMaterial color={PALETTE.accent} wireframe transparent opacity={0.2} />
          </mesh>
          <mesh position={[0, 2 + i * 2, 0]}>
            <boxGeometry args={[w * 0.98, 0.25, w * 0.98]} />
            <meshBasicMaterial color={PALETTE.secondary} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 9.2, 0]}>
        <sphereGeometry args={[0.7, 12, 12]} />
        <meshBasicMaterial ref={beacon} color="#d8ffe9" transparent opacity={0.8} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 10, 0]} intensity={2.4} distance={80} color={PALETTE.accent} />
    </group>
  )
}

/** Books orbiting the library in a slow halo. */
function KnowledgeHalo() {
  const g = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (g.current) g.current.rotation.y += delta * 0.25
  })
  return (
    <group ref={g} position={[0, 14, 0]}>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 6.5, 0, Math.sin(a) * 6.5]} rotation={[0, -a, 0]}>
            <boxGeometry args={[1.4, 0.25, 0.8]} />
            <meshStandardMaterial color={PALETTE.body} emissive={PALETTE.accent} emissiveIntensity={0.7} />
          </mesh>
        )
      })}
    </group>
  )
}

/** Floating information displays facing the library. */
function InfoDisplay({ index }: { index: number }) {
  const mesh = useRef<THREE.Group>(null)
  const cfg = useMemo(
    () => ({
      angle: (index / 8) * Math.PI * 2 + seeded(`id${index}`, 1) * 0.3,
      rad: 22 + seeded(`id${index}`, 2) * 10,
      y: 8 + seeded(`id${index}`, 3) * 8,
      sp: 0.4 + seeded(`id${index}`, 4) * 0.5,
    }),
    [index],
  )
  useFrame((state) => {
    if (mesh.current) mesh.current.position.y = cfg.y + Math.sin(state.clock.elapsedTime * cfg.sp + index) * 0.6
  })
  return (
    <group ref={mesh} position={[Math.cos(cfg.angle) * cfg.rad, cfg.y, Math.sin(cfg.angle) * cfg.rad]} rotation={[0, -cfg.angle + Math.PI, 0]}>
      <mesh>
        <planeGeometry args={[3.6, 2.2]} />
        <meshBasicMaterial color={PALETTE.secondary} transparent opacity={0.28} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh>
        <boxGeometry args={[4, 2.6, 0.12]} />
        <meshBasicMaterial color={PALETTE.accent} wireframe transparent opacity={0.45} />
      </mesh>
    </group>
  )
}

/** Quiet grove domes scattered between the towers. */
function GroveDomes() {
  return (
    <group>
      {Array.from({ length: 10 }, (_, i) => {
        const a = seeded(`gr${i}`, 1) * Math.PI * 2
        const rad = 20 + seeded(`gr${i}`, 2) * 24
        const r = 0.8 + seeded(`gr${i}`, 3) * 0.8
        return (
          <mesh key={i} position={[Math.cos(a) * rad, 0, Math.sin(a) * rad]}>
            <sphereGeometry args={[r, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={PALETTE.body} emissive={PALETTE.accent} emissiveIntensity={0.3} transparent opacity={0.5} roughness={0.5} />
          </mesh>
        )
      })}
    </group>
  )
}

export function EducationCity({ projects, selectedId, onSelect }: CitySceneProps) {
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
      <LibraryZiggurat />
      <KnowledgeHalo />
      <GroveDomes />
      {projects.map((p, i) => (
        <CityTower key={p.id} project={p} dna={towers[i]} palette={PALETTE} cap="dome" hovered={hoveredId === p.id} selected={selectedId === p.id} onHover={setHoveredId} onSelect={onSelect} />
      ))}
      {tops.length > 0 && <CityLinks points={tops} accent={PALETTE.accent} targetY={10} />}
      <FillerSkyline palette={PALETTE} count={60} seed="es" />
      {Array.from({ length: 8 }, (_, i) => (
        <InfoDisplay key={i} index={i} />
      ))}
      <PortalRing accent={PALETTE.accent} />
      <pointLight position={[-20, 26, -10]} intensity={1.6} distance={120} color={PALETTE.secondary} />
    </group>
  )
}

export default EducationCity
