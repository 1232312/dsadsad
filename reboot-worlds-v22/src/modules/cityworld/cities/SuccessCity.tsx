import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import * as THREE from 'three'
import type { CitySceneProps } from '../CityWorldModule'
import { CityTower, CityLinks, FillerSkyline, PortalRing, makeTowerDNA, type CityPalette } from './cityKit'

const PALETTE: CityPalette = {
  accent: '#FFD27A',
  secondary: '#FFF8E8',
  ground: '#0d0f1a',
  gridCell: '#3a3512',
  gridSection: '#6a5a1f',
  body: '#1a1a20',
  fillerEmissive: '#40381a',
}

/** Golden monument: obelisk, laurel rings, and a star topper. */
function GoldenMonument() {
  const laurel1 = useRef<THREE.Mesh>(null)
  const laurel2 = useRef<THREE.Mesh>(null)
  const star = useRef<THREE.Mesh>(null)
  useFrame((state, delta) => {
    if (laurel1.current) laurel1.current.rotation.z += delta * 0.5
    if (laurel2.current) laurel2.current.rotation.z -= delta * 0.35
    if (star.current) {
      star.current.rotation.y += delta * 0.9
      star.current.position.y = 26.5 + Math.sin(state.clock.elapsedTime * 1.1) * 0.5
    }
  })
  return (
    <group>
      <mesh position={[0, 12, 0]}>
        <cylinderGeometry args={[0.9, 2, 24, 4]} />
        <meshStandardMaterial color={PALETTE.body} emissive={PALETTE.accent} emissiveIntensity={0.55} metalness={0.7} roughness={0.25} flatShading />
      </mesh>
      <mesh ref={laurel1} position={[0, 14, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[4.4, 0.13, 8, 48]} />
        <meshBasicMaterial color={PALETTE.accent} toneMapped={false} />
      </mesh>
      <mesh ref={laurel2} position={[0, 19, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.2, 0.11, 8, 48]} />
        <meshBasicMaterial color={PALETTE.secondary} toneMapped={false} />
      </mesh>
      <mesh ref={star} position={[0, 26.5, 0]}>
        <octahedronGeometry args={[1.2, 0]} />
        <meshBasicMaterial color={PALETTE.secondary} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 24, 0]} intensity={2.6} distance={90} color={PALETTE.accent} />
    </group>
  )
}

/** Rotating celebration spotlights. */
function Spotlights() {
  const g = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (g.current) g.current.rotation.y += delta * 0.12
  })
  return (
    <group ref={g}>
      {Array.from({ length: 4 }, (_, i) => {
        const a = (i / 4) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 13, 14, Math.sin(a) * 13]} rotation={[0.16, 0, -Math.cos(a - Math.PI / 2) * 0.18]}>
            <cylinderGeometry args={[0.22, 0.5, 30, 6, 1, true]} />
            <meshBasicMaterial color={i % 2 === 0 ? PALETTE.accent : PALETTE.secondary} transparent opacity={0.16} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        )
      })}
    </group>
  )
}

/** Hovering celebration banners around the monument. */
function Banner({ index }: { index: number }) {
  const mesh = useRef<THREE.Group>(null)
  const cfg = useMemo(() => {
    const angle = (index / 6) * Math.PI * 2
    return { angle, rad: 22, y: 11 + (index % 3) * 4 }
  }, [index])
  useFrame((state) => {
    if (mesh.current) mesh.current.position.y = cfg.y + Math.sin(state.clock.elapsedTime * 0.7 + index) * 0.5
  })
  return (
    <group ref={mesh} position={[Math.cos(cfg.angle) * cfg.rad, cfg.y, Math.sin(cfg.angle) * cfg.rad]} rotation={[0, -cfg.angle + Math.PI, 0]}>
      <mesh>
        <planeGeometry args={[3.4, 5]} />
        <meshBasicMaterial color={index % 2 === 0 ? PALETTE.accent : PALETTE.secondary} transparent opacity={0.2} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh>
        <boxGeometry args={[3.7, 5.3, 0.1]} />
        <meshBasicMaterial color={PALETTE.accent} wireframe transparent opacity={0.4} />
      </mesh>
    </group>
  )
}

export function SuccessCity({ projects, selectedId, onSelect }: CitySceneProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const towers = useMemo(() => projects.map((p, i) => makeTowerDNA(p, i, projects.length)), [projects])
  const tops = useMemo(() => towers.map((t) => new THREE.Vector3(t.pos[0], t.height + 1.2, t.pos[2])), [towers])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[320, 320]} />
        <meshStandardMaterial color={PALETTE.ground} roughness={0.85} metalness={0.3} />
      </mesh>
      <Grid position={[0, 0.02, 0]} args={[100, 100]} cellSize={4} cellThickness={0.6} cellColor={PALETTE.gridCell} sectionSize={20} sectionThickness={1} sectionColor={PALETTE.gridSection} fadeDistance={160} fadeStrength={2} infiniteGrid />
      <GoldenMonument />
      <Spotlights />
      {Array.from({ length: 6 }, (_, i) => (
        <Banner key={i} index={i} />
      ))}
      {projects.map((p, i) => (
        <CityTower key={p.id} project={p} dna={towers[i]} palette={PALETTE} cap="spire" hovered={hoveredId === p.id} selected={selectedId === p.id} onHover={setHoveredId} onSelect={onSelect} />
      ))}
      {tops.length > 0 && <CityLinks points={tops} accent={PALETTE.accent} targetY={13} />}
      <FillerSkyline palette={PALETTE} count={70} seed="sc" heightScale={1.7} />
      <PortalRing accent={PALETTE.accent} />
      <pointLight position={[0, 32, 0]} intensity={1.6} distance={140} color={PALETTE.accent} />
    </group>
  )
}

export default SuccessCity
