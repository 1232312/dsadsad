import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import * as THREE from 'three'
import type { CitySceneProps } from '../CityWorldModule'
import { CityTower, FillerSkyline, PortalRing, makeTowerDNA, seeded, type CityPalette } from './cityKit'

const PALETTE: CityPalette = {
  accent: '#FF5959',
  secondary: '#7a4a4a',
  ground: '#0a0808',
  gridCell: '#2a1215',
  gridSection: '#4a1a1a',
  body: '#141014',
  fillerEmissive: '#1a0e10',
}

/** Cracked fallen monument with scattered debris. */
function BrokenMonument() {
  return (
    <group>
      <mesh position={[0, 3.2, 0]} rotation={[0.16, 0.3, 0.22]}>
        <boxGeometry args={[3.4, 7, 1.4]} />
        <meshStandardMaterial color="#1a1216" emissive={PALETTE.accent} emissiveIntensity={0.08} metalness={0.3} roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[4.4, 0.7, 3]} />
        <meshStandardMaterial color="#160f13" roughness={0.9} />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => {
        const a = seeded(`db${i}`, 1) * Math.PI * 2
        const r = 2 + seeded(`db${i}`, 2) * 4
        return (
          <mesh key={i} position={[Math.cos(a) * r, seeded(`db${i}`, 3) * 0.4, Math.sin(a) * r]} rotation={[seeded(`db${i}`, 4), seeded(`db${i}`, 5), seeded(`db${i}`, 6)]}>
            <boxGeometry args={[0.5 + seeded(`db${i}`, 7), 0.3 + seeded(`db${i}`, 8) * 0.5, 0.4 + seeded(`db${i}`, 9) * 0.4]} />
            <meshStandardMaterial color="#181016" roughness={0.95} flatShading />
          </mesh>
        )
      })}
    </group>
  )
}

/** Circle of leaning standing stones. */
function StandingStones() {
  return (
    <group>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 10, 1.6 + (i % 3) * 0.4, Math.sin(a) * 10]} rotation={[0, -a, (seeded(`st${i}`, 1) - 0.5) * 0.5]}>
            <boxGeometry args={[1, 3.2 + seeded(`st${i}`, 2) * 2, 0.7]} />
            <meshStandardMaterial color="#171017" emissive={PALETTE.accent} emissiveIntensity={0.05} roughness={0.95} flatShading />
          </mesh>
        )
      })}
    </group>
  )
}

/** Flickering broken neon rings on the ground. */
function BrokenNeon() {
  const mats = useRef<THREE.MeshBasicMaterial[]>([])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    mats.current.forEach((m, i) => {
      if (!m) return
      // dying flicker: mostly off, stutters of light
      m.opacity = Math.sin(t * 13 + i * 4) > 0.85 ? 0.5 : Math.sin(t * 2.1 + i) > 0.4 ? 0.12 : 0.03
    })
  })
  return (
    <group>
      {Array.from({ length: 4 }, (_, i) => {
        const a = seeded(`bn${i}`, 1) * Math.PI * 2
        const r = 14 + seeded(`bn${i}`, 2) * 14
        return (
          <mesh key={i} position={[Math.cos(a) * r, 0.05, Math.sin(a) * r]} rotation={[-Math.PI / 2, 0, seeded(`bn${i}`, 3) * 3]}>
            <torusGeometry args={[1.6 + seeded(`bn${i}`, 4), 0.09, 6, 40]} />
            <meshBasicMaterial ref={(m) => { if (m) mats.current[i] = m }} color={PALETTE.accent} transparent opacity={0.1} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        )
      })}
    </group>
  )
}

/** Faint spirit wisps that drift between the stones. */
function Wisp({ index }: { index: number }) {
  const mesh = useRef<THREE.Mesh>(null)
  const cfg = useMemo(
    () => ({
      r: 8 + seeded(`wp${index}`, 1) * 14,
      y: 1.4 + seeded(`wp${index}`, 2) * 2.4,
      sp: 0.08 + seeded(`wp${index}`, 3) * 0.12,
      ph: seeded(`wp${index}`, 4) * Math.PI * 2,
    }),
    [index],
  )
  useFrame((state) => {
    if (!mesh.current) return
    const a = state.clock.elapsedTime * cfg.sp + cfg.ph
    mesh.current.position.set(Math.cos(a) * cfg.r, cfg.y + Math.sin(state.clock.elapsedTime * 0.8 + index) * 0.5, Math.sin(a) * cfg.r)
  })
  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[0.16, 8, 8]} />
      <meshBasicMaterial color={PALETTE.accent} transparent opacity={0.35} toneMapped={false} />
    </mesh>
  )
}

export function GraveyardCity({ projects, selectedId, onSelect }: CitySceneProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const towers = useMemo(() => projects.map((p, i) => makeTowerDNA(p, i, projects.length)), [projects])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[320, 320]} />
        <meshStandardMaterial color={PALETTE.ground} roughness={0.95} metalness={0.1} />
      </mesh>
      <Grid position={[0, 0.02, 0]} args={[100, 100]} cellSize={4} cellThickness={0.5} cellColor={PALETTE.gridCell} sectionSize={20} sectionThickness={0.8} sectionColor={PALETTE.gridSection} fadeDistance={120} fadeStrength={2} infiniteGrid />
      <BrokenMonument />
      <StandingStones />
      <BrokenNeon />
      {Array.from({ length: 5 }, (_, i) => (
        <Wisp key={i} index={i} />
      ))}
      {/* abandoned projects lean dark here; revived ones already start to glow */}
      {projects.map((p, i) => (
        <CityTower key={p.id} project={p} dna={towers[i]} palette={PALETTE} cap="none" hovered={hoveredId === p.id} selected={selectedId === p.id} onHover={setHoveredId} onSelect={onSelect} />
      ))}
      <FillerSkyline palette={PALETTE} count={50} seed="gy" />
      <PortalRing accent={PALETTE.accent} />
      <pointLight position={[0, 12, 0]} intensity={1.1} distance={55} color={PALETTE.accent} />
    </group>
  )
}

export default GraveyardCity
