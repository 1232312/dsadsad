import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import * as THREE from 'three'
import type { CitySceneProps } from '../CityWorldModule'
import { CityTower, CityLinks, FillerSkyline, PortalRing, makeTowerDNA, type CityPalette } from './cityKit'

const PALETTE: CityPalette = {
  accent: '#4DD8FF',
  secondary: '#F8F8F8',
  ground: '#0a1218',
  gridCell: '#123a4a',
  gridSection: '#1f6a8a',
  body: '#dceef5',
  fillerEmissive: '#14405a',
}

/** Clean research spire with rotating halos and a hologram cross. */
function ResearchSpire() {
  const h1 = useRef<THREE.Mesh>(null)
  const h2 = useRef<THREE.Mesh>(null)
  const h3 = useRef<THREE.Mesh>(null)
  const cross = useRef<THREE.Group>(null)
  useFrame((state, delta) => {
    if (h1.current) h1.current.rotation.z += delta * 0.5
    if (h2.current) h2.current.rotation.z -= delta * 0.35
    if (h3.current) h3.current.rotation.z += delta * 0.2
    if (cross.current) {
      cross.current.rotation.y += delta * 0.6
      cross.current.position.y = 23 + Math.sin(state.clock.elapsedTime * 0.9) * 0.5
    }
  })
  return (
    <group>
      <mesh position={[0, 10, 0]}>
        <cylinderGeometry args={[1.4, 2, 20, 12]} />
        <meshStandardMaterial color="#e8f4f8" emissive={PALETTE.accent} emissiveIntensity={0.35} metalness={0.3} roughness={0.25} />
      </mesh>
      <mesh ref={h1} position={[0, 8, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.4, 0.09, 6, 48]} />
        <meshBasicMaterial color={PALETTE.accent} toneMapped={false} />
      </mesh>
      <mesh ref={h2} position={[0, 13, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[4.3, 0.09, 6, 48]} />
        <meshBasicMaterial color={PALETTE.secondary} toneMapped={false} />
      </mesh>
      <mesh ref={h3} position={[0, 18, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[5.2, 0.09, 6, 48]} />
        <meshBasicMaterial color={PALETTE.accent} toneMapped={false} />
      </mesh>
      <group ref={cross} position={[0, 23, 0]}>
        <mesh>
          <boxGeometry args={[2.6, 0.7, 0.7]} />
          <meshBasicMaterial color={PALETTE.secondary} transparent opacity={0.85} toneMapped={false} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.7, 2.6, 0.7]} />
          <meshBasicMaterial color={PALETTE.secondary} transparent opacity={0.85} toneMapped={false} />
        </mesh>
      </group>
      <pointLight position={[0, 22, 0]} intensity={2.4} distance={80} color={PALETTE.accent} />
    </group>
  )
}

/** Soft floating care domes drifting above the district. */
function CareDome({ index }: { index: number }) {
  const mesh = useRef<THREE.Mesh>(null)
  const cfg = useMemo(
    () => ({
      a: (index / 5) * Math.PI * 2 + index,
      rad: 20 + index * 3.2,
      y: 11 + (index % 3) * 3.5,
    }),
    [index],
  )
  useFrame((state) => {
    if (mesh.current) mesh.current.position.y = cfg.y + Math.sin(state.clock.elapsedTime * 0.6 + index) * 0.9
  })
  return (
    <mesh ref={mesh} position={[Math.cos(cfg.a) * cfg.rad, cfg.y, Math.sin(cfg.a) * cfg.rad]}>
      <sphereGeometry args={[1.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color="#e8f4f8" emissive={PALETTE.accent} emissiveIntensity={0.4} transparent opacity={0.35} roughness={0.2} side={THREE.DoubleSide} />
    </mesh>
  )
}

export function HealthCity({ projects, selectedId, onSelect }: CitySceneProps) {
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
      <ResearchSpire />
      {Array.from({ length: 5 }, (_, i) => (
        <CareDome key={i} index={i} />
      ))}
      {projects.map((p, i) => (
        <CityTower key={p.id} project={p} dna={towers[i]} palette={PALETTE} cap="dome" hovered={hoveredId === p.id} selected={selectedId === p.id} onHover={setHoveredId} onSelect={onSelect} />
      ))}
      {tops.length > 0 && <CityLinks points={tops} accent={PALETTE.accent} targetY={13} />}
      <FillerSkyline palette={PALETTE} count={55} seed="hs" />
      <PortalRing accent={PALETTE.accent} />
      <pointLight position={[0, 34, 0]} intensity={1.4} distance={140} color="#cfeef8" />
    </group>
  )
}

export default HealthCity
