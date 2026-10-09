import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import * as THREE from 'three'
import type { CitySceneProps } from '../CityWorldModule'
import { CityTower, CityLinks, FillerSkyline, PortalRing, makeTowerDNA, seeded, type CityPalette } from './cityKit'

const PALETTE: CityPalette = {
  accent: '#FFB547',
  secondary: '#B44DFF',
  ground: '#140d0a',
  gridCell: '#4a3412',
  gridSection: '#8a5a1f',
  body: '#241726',
  fillerEmissive: '#3a2450',
}

/** Central hex arena with a floating trophy and pulsing ring. */
function Arena() {
  const trophy = useRef<THREE.Group>(null)
  const ring = useRef<THREE.MeshBasicMaterial>(null)
  const light = useRef<THREE.PointLight>(null)
  useFrame((state, delta) => {
    if (trophy.current) {
      trophy.current.rotation.y += delta * 0.8
      trophy.current.position.y = 12 + Math.sin(state.clock.elapsedTime * 1.2) * 0.6
    }
    if (ring.current) ring.current.opacity = 0.4 + Math.abs(Math.sin(state.clock.elapsedTime * 2.4)) * 0.35
    if (light.current) light.current.intensity = 2.4 + Math.sin(state.clock.elapsedTime * 2.4) * 1
  })
  return (
    <group>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[13, 14, 1, 6]} />
        <meshStandardMaterial color="#1d1424" emissive={PALETTE.accent} emissiveIntensity={0.25} metalness={0.4} roughness={0.5} flatShading />
      </mesh>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[13.6, 14.6, 64]} />
        <meshBasicMaterial ref={ring} color={PALETTE.accent} transparent opacity={0.5} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <group ref={trophy} position={[0, 12, 0]}>
        <mesh>
          <dodecahedronGeometry args={[2.2, 0]} />
          <meshBasicMaterial color={PALETTE.secondary} wireframe transparent opacity={0.7} toneMapped={false} />
        </mesh>
        <mesh>
          <boxGeometry args={[1.2, 1.2, 1.2]} />
          <meshBasicMaterial color={PALETTE.accent} toneMapped={false} />
        </mesh>
      </group>
      <pointLight ref={light} position={[0, 10, 0]} intensity={2.4} distance={80} color={PALETTE.accent} />
    </group>
  )
}

/** Floating score screens around the arena, orange and purple. */
function ScoreScreen({ index }: { index: number }) {
  const mesh = useRef<THREE.Group>(null)
  const cfg = useMemo(
    () => ({
      angle: (index / 6) * Math.PI * 2 + seeded(`ss${index}`, 1) * 0.4,
      rad: 24 + seeded(`ss${index}`, 2) * 6,
      y: 10 + seeded(`ss${index}`, 3) * 7,
      sp: 0.4 + seeded(`ss${index}`, 4) * 0.5,
    }),
    [index],
  )
  useFrame((state) => {
    if (mesh.current) mesh.current.position.y = cfg.y + Math.sin(state.clock.elapsedTime * cfg.sp + index) * 0.7
  })
  return (
    <group ref={mesh} position={[Math.cos(cfg.angle) * cfg.rad, cfg.y, Math.sin(cfg.angle) * cfg.rad]} rotation={[0, -cfg.angle + Math.PI, 0]}>
      <mesh>
        <planeGeometry args={[5.4, 3]} />
        <meshBasicMaterial color={index % 2 === 0 ? PALETTE.accent : PALETTE.secondary} transparent opacity={0.3} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh>
        <boxGeometry args={[5.8, 3.4, 0.12]} />
        <meshBasicMaterial color={PALETTE.accent} wireframe transparent opacity={0.5} />
      </mesh>
    </group>
  )
}

/** Spawn pads on the ground, glowing in sequence. */
function SpawnPads() {
  const mats = useRef<THREE.MeshBasicMaterial[]>([])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    mats.current.forEach((m, i) => {
      if (m) m.opacity = 0.15 + Math.max(0, Math.sin(t * 1.5 - i * 0.7)) * 0.45
    })
  })
  return (
    <group>
      {Array.from({ length: 6 }, (_, i) => {
        const a = seeded(`sp${i}`, 1) * Math.PI * 2
        const rad = 17 + seeded(`sp${i}`, 2) * 13
        return (
          <mesh key={i} position={[Math.cos(a) * rad, 0.05, Math.sin(a) * rad]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1, 1.5, 32]} />
            <meshBasicMaterial ref={(m) => { if (m) mats.current[i] = m }} color={PALETTE.secondary} transparent opacity={0.3} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        )
      })}
    </group>
  )
}

export function GamingCity({ projects, selectedId, onSelect }: CitySceneProps) {
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
      <Arena />
      <SpawnPads />
      {projects.map((p, i) => (
        <CityTower key={p.id} project={p} dna={towers[i]} palette={PALETTE} cap="cube" hovered={hoveredId === p.id} selected={selectedId === p.id} onHover={setHoveredId} onSelect={onSelect} />
      ))}
      {tops.length > 0 && <CityLinks points={tops} accent={PALETTE.accent} targetY={9} />}
      <FillerSkyline palette={PALETTE} count={60} seed="gs" />
      {Array.from({ length: 6 }, (_, i) => (
        <ScoreScreen key={i} index={i} />
      ))}
      <PortalRing accent={PALETTE.accent} />
      <pointLight position={[0, 30, 0]} intensity={2} distance={130} color={PALETTE.secondary} />
    </group>
  )
}

export default GamingCity
