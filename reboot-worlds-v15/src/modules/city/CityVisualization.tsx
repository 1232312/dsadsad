/**
 * CityVisualization — the planet-based 3D renderer for the City module.
 *
 * Projects sit on a curved planet surface. Buildings are oriented to the
 * surface normal so they stand "up" relative to the planet. The camera
 * orbits the planet. District biomes, life particles, and construction
 * drones make the world feel alive.
 */
import { useMemo, useRef, useState, useCallback, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, AdaptiveDpr, Html, Float } from '@react-three/drei'
import * as THREE from 'three'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Activity, Users, TrendingUp, Zap, Award, Sliders, Crown, Shield,
  Lightbulb, RefreshCw, UserCheck, Bot, X, ChevronRight,
} from 'lucide-react'
import {
  DISTRICT_MAP,
  CATEGORY_THEME,
  computeAwards,
  type ProjectCategory,
  type ProjectStatus,
  type AwardType,
} from '@/types/project'
import type { CityProject } from './CityModule'
import { PLANET_RADIUS } from './CityModule'
import { useUI } from '@/stores/ui'
import { CustomizationPanel } from '@/components/CustomizationPanel'
import {
  PlanetBody,
  DistrictBiome,
  LifeParticles,
  ConstructionDrones,
  PlanetStars,
} from './PlanetWorld'
import { WorldLife } from './WorldLife'
import { CityGlow, LitWindows } from './CityGlow'
import { EffectComposer, Bloom } from '@react-three/postprocessing'

// ---- Building DNA + surreal architecture -------------------------------- //

interface BuildingProps {
  project: CityProject
  hovered: boolean
  selected: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}

type BuildingFamily = 'tower' | 'data' | 'arena' | 'fragments' | 'monument'

interface BuildingDNA {
  family: BuildingFamily
  height: number
  width: number
  segments: number
  orbiters: number
  color: string
  coreScale: number
  missingMiddle: boolean
  floating: boolean
}

function buildingDNA(project: CityProject, color: string): BuildingDNA {
  const seed = project.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const families: BuildingFamily[] = project.category === 'AI'
    ? ['data', 'data', 'monument']
    : project.category === 'Gaming'
      ? ['arena', 'fragments', 'arena']
      : project.category === 'Creator' || project.category === 'IdeaHub'
        ? ['fragments', 'monument', 'fragments']
        : project.category === 'Robotics' || project.category === 'Space'
          ? ['tower', 'monument', 'data']
          : ['tower', 'fragments', 'data']
  const isAbandoned = project.status === 'abandoned' || project.status === 'decaying'
  const isReviving = project.status === 'reviving'
  const scale = project.status === 'alive' && project.stage >= 4 ? 1.22 : 1
  return {
    family: families[seed % families.length],
    height: (4 + project.stage * 2.4) * scale,
    width: 1.8 + (seed % 3) * 0.35,
    segments: 2 + (seed % 3),
    orbiters: isAbandoned ? 1 : isReviving ? 3 : 2 + (seed % 3),
    color: isAbandoned ? '#FF5959' : color,
    coreScale: project.stage >= 5 ? 1.45 : isReviving ? 1.1 : 0.8,
    missingMiddle: isAbandoned || (project.failureReason?.toLowerCase().includes('fund') ?? false),
    floating: isReviving || project.stage >= 5,
  }
}

function NeonNode({ position, color, size = 0.14 }: { position: [number, number, number]; color: string; size?: number }) {
  return (
    <mesh position={position}>
      <octahedronGeometry args={[size, 0]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

function FloatingFragment({ position, color, size, speed = 1 }: {
  position: [number, number, number]
  color: string
  size: [number, number, number]
  speed?: number
}) {
  return (
    <Float speed={speed} floatIntensity={0.35} rotationIntensity={0.25}>
      <mesh position={position}>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#111827" emissive={color} emissiveIntensity={0.55} metalness={0.55} roughness={0.45} />
        <edgesGeometry args={[undefined, 0]}>
          <lineBasicMaterial color={color} transparent opacity={0.75} />
        </edgesGeometry>
      </mesh>
    </Float>
  )
}

/**
 * Orient a group so its Y axis aligns with the surface normal.
 */
function alignToNormal(normal: [number, number, number]): [number, number, number] {
  const up = new THREE.Vector3(0, 1, 0)
  const n = new THREE.Vector3(...normal).normalize()
  const axis = new THREE.Vector3().crossVectors(up, n)
  const angle = up.angleTo(n)
  if (axis.lengthSq() < 0.0001) return [0, 0, 0]
  axis.normalize()
  const quat = new THREE.Quaternion().setFromAxisAngle(axis, angle)
  const euler = new THREE.Euler().setFromQuaternion(quat)
  return [euler.x, euler.y, euler.z]
}

function SurrealBuilding({ project, hovered, selected, onHover, onSelect }: BuildingProps) {
  const theme = CATEGORY_THEME[project.category]
  const customizations = useUI((s) => s.customizations)
  const custom = customizations[project.id]
  const dna = useMemo(() => buildingDNA(project, custom?.color ?? theme.emissive), [project, custom?.color, theme.emissive])
  const height = dna.height * (custom?.height ?? 1)
  const color = custom?.color ?? dna.color
  const groupRef = useRef<THREE.Group>(null)
  const structureRef = useRef<THREE.Group>(null)
  const glowRef = useRef<THREE.MeshStandardMaterial>(null)

  const rotation = useMemo(() => alignToNormal(project.normal), [project.normal])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    if (groupRef.current) {
      const liftTarget = hovered ? 0.55 : 0
      const currentLift = groupRef.current.userData.lift ?? 0
      const newLift = currentLift + (liftTarget - currentLift) * Math.min(1, delta * 5)
      groupRef.current.userData.lift = newLift
      // Apply lift along normal direction
      groupRef.current.position.set(
        project.position[0] + project.normal[0] * newLift,
        project.position[1] + project.normal[1] * newLift,
        project.position[2] + project.normal[2] * newLift,
      )
    }
    if (structureRef.current) {
      structureRef.current.rotation.z = Math.sin(t * 0.32 + project.id.length) * (dna.floating ? 0.018 : 0.008)
      structureRef.current.scale.setScalar(1 + Math.sin(t * 0.55 + project.id.length) * 0.008)
    }
    if (glowRef.current) {
      glowRef.current.emissiveIntensity = (custom?.glowIntensity ?? 1.2) + Math.sin(t * (project.status === 'reviving' ? 4 : 0.8)) * (project.status === 'abandoned' ? 0.16 : 0.3)
    }
  })

  const bodyMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#111827',
    roughness: project.status === 'abandoned' ? 0.95 : 0.48,
    metalness: 0.55,
    emissive: color,
    emissiveIntensity: 0.12,
  }), [color, project.status])

  const platformPositions: [number, number, number][] = [
    [-dna.width * 1.8, height * 0.3, 0],
    [dna.width * 1.65, height * 0.55, 0.4],
    [-dna.width * 1.25, height * 0.84, -0.5],
  ]

  const onPointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    onHover(project.id)
    document.body.style.cursor = 'pointer'
  }

  return (
    <group ref={groupRef} position={project.position} rotation={rotation}>
      {/* Base platform */}
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[dna.width * 1.1, dna.width * 1.3, 0.3, 8]} />
        <meshStandardMaterial color="#080c14" metalness={0.75} roughness={0.65} />
      </mesh>

      {/* Ground glow disc */}
      <mesh position={[0, -0.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[dna.width * 1.65, 8]} />
        <meshBasicMaterial color={color} transparent opacity={hovered || selected ? 0.28 : 0.08} depthWrite={false} />
      </mesh>

      <group ref={structureRef}>
        {dna.family === 'tower' && (
          <>
            {Array.from({ length: dna.segments }).map((_, index) => {
              const y = dna.missingMiddle && index === 1 ? height * 0.72 : (index + 0.5) * (height / dna.segments)
              const segH = dna.missingMiddle && index === 1 ? height * 0.13 : height / dna.segments - 0.18
              return (
                <mesh key={index} position={[index % 2 === 0 ? 0 : dna.width * 0.2, y, 0]} material={bodyMaterial}
                  onPointerOver={onPointerOver} onPointerOut={() => onHover(null)}
                  onClick={(event) => { event.stopPropagation(); onSelect(project.id) }}>
                  <boxGeometry args={[dna.width * (index === 1 ? 0.82 : 1), segH, dna.width * (index === 1 ? 0.82 : 1)]} />
                  <edgesGeometry args={[undefined, 0]}><lineBasicMaterial color={color} /></edgesGeometry>
                </mesh>
              )
            })}
            <mesh position={[0, height * 0.5, dna.width / 2 + 0.03]}>
              <planeGeometry args={[dna.width * 0.72, height * 0.58]} />
              <meshBasicMaterial color={color} transparent opacity={0.15} />
            </mesh>
          </>
        )}

        {dna.family === 'data' && (
          <>
            <mesh position={[0, height * 0.42, 0]} material={bodyMaterial}
              onPointerOver={onPointerOver} onPointerOut={() => onHover(null)}
              onClick={(event) => { event.stopPropagation(); onSelect(project.id) }}>
              <icosahedronGeometry args={[dna.width * dna.coreScale, 1]} />
              <edgesGeometry args={[undefined, 0]}><lineBasicMaterial color={color} /></edgesGeometry>
            </mesh>
            {Array.from({ length: 5 }).map((_, index) => {
              const angle = (index / 5) * Math.PI * 2
              return <NeonNode key={index} position={[Math.cos(angle) * dna.width * 1.7, height * (0.25 + (index % 3) * 0.2), Math.sin(angle) * dna.width * 1.7]} color={color} size={index === 0 ? 0.2 : 0.12} />
            })}
            {[0.25, 0.55, 0.85].map((ratio, index) => (
              <mesh key={index} position={[0, height * ratio, 0]} rotation={[Math.PI / 2, 0, index * 0.5]}>
                <torusGeometry args={[dna.width * (0.8 + index * 0.18), 0.025, 6, 24]} />
                <meshBasicMaterial color={color} transparent opacity={0.55} />
              </mesh>
            ))}
          </>
        )}

        {dna.family === 'arena' && (
          <>
            <mesh position={[0, height * 0.22, 0]} material={bodyMaterial}
              onPointerOver={onPointerOver} onPointerOut={() => onHover(null)}
              onClick={(event) => { event.stopPropagation(); onSelect(project.id) }}>
              <cylinderGeometry args={[dna.width * 1.35, dna.width * 1.5, height * 0.45, 8]} />
              <edgesGeometry args={[undefined, 0]}><lineBasicMaterial color={color} /></edgesGeometry>
            </mesh>
            <mesh position={[0, height * 0.46, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[dna.width * 1.15, 0.08, 6, 8]} />
              <meshBasicMaterial color={color} transparent opacity={0.7} />
            </mesh>
            {platformPositions.map((position, index) => <FloatingFragment key={index} position={position} color={color} size={[0.8, 0.22, 1.7]} />)}
          </>
        )}

        {dna.family === 'fragments' && (
          <>
            <mesh position={[0, height * 0.28, 0]} material={bodyMaterial}
              onPointerOver={onPointerOver} onPointerOut={() => onHover(null)}
              onClick={(event) => { event.stopPropagation(); onSelect(project.id) }}>
              <boxGeometry args={[dna.width * 0.9, height * 0.55, dna.width * 0.9]} />
              <edgesGeometry args={[undefined, 0]}><lineBasicMaterial color={color} /></edgesGeometry>
            </mesh>
            {platformPositions.map((position, index) => <FloatingFragment key={index} position={[position[0], position[1] + 1, position[2]]} color={color} size={[0.7 + index * 0.2, 0.55, 0.7]} speed={1.2} />)}
            <mesh position={[0, height * 0.84, 0]} rotation={[0.2, 0.5, 0.15]}>
              <octahedronGeometry args={[dna.width * 0.65]} />
              <meshBasicMaterial color={color} wireframe transparent opacity={0.75} />
            </mesh>
          </>
        )}

        {dna.family === 'monument' && (
          <>
            <mesh position={[0, height * 0.34, 0]} material={bodyMaterial}
              onPointerOver={onPointerOver} onPointerOut={() => onHover(null)}
              onClick={(event) => { event.stopPropagation(); onSelect(project.id) }}>
              <cylinderGeometry args={[dna.width * 0.8, dna.width * 1.2, height * 0.7, 6]} />
              <edgesGeometry args={[undefined, 0]}><lineBasicMaterial color={color} /></edgesGeometry>
            </mesh>
            <mesh position={[0, height * 0.8, 0]}>
              <sphereGeometry args={[dna.width * dna.coreScale, 12, 8]} />
              <meshStandardMaterial ref={glowRef} color="#05070c" emissive={color} emissiveIntensity={1.3} />
            </mesh>
          </>
        )}

        {dna.floating && platformPositions.slice(0, dna.orbiters).map((position, index) => (
          <FloatingFragment key={`orbit-${index}`} position={[position[0] * 1.3, position[1] + 1.4, position[2] * 1.3]} color={color} size={[0.45, 0.35, 0.9]} speed={0.8 + index * 0.2} />
        ))}

        {project.status === 'reviving' && Array.from({ length: 4 }).map((_, index) => (
          <mesh key={`repair-${index}`} position={[Math.cos(index * 1.57) * dna.width * 1.15, height * (0.18 + index * 0.16), Math.sin(index * 1.57) * dna.width * 1.15]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial color="#3DD8FF" />
          </mesh>
        ))}

        {(dna.family === 'tower' || dna.family === 'fragments') && (
          <LitWindows
            width={dna.width * (dna.family === 'fragments' ? 0.9 : 1)}
            height={dna.family === 'fragments' ? height * 0.55 : height}
            color={color}
            seed={project.id}
            occupancy={project.status === 'abandoned' ? 0.1 : project.status === 'reviving' ? 0.3 : 0.52}
          />
        )}
      </group>

      {hovered && (
        <Html position={[0, height + 1.4, 0]} center distanceFactor={18} occlude={false}>
          <div className="glass-strong px-md py-sm rounded-lg whitespace-nowrap pointer-events-none gpu">
            <div className="text-xs font-medium text-text">{project.name}</div>
            <div className="text-[10px] text-text-secondary mt-0.5 flex items-center gap-1.5">
              <span style={{ color }}>{dna.family}</span><span>·</span><span className="capitalize">{project.status}</span>
            </div>
            <div className="text-[10px] text-text-secondary mt-0.5">{project.failureReason ?? 'Still becoming something.'}</div>
          </div>
        </Html>
      )}
    </group>
  )
}

// ---- Reboot Monument at planet north pole ------------------------------- //

function RebootMonument() {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!ref.current) return
    ref.current.rotation.y = state.clock.elapsedTime * 0.08
  })
  return (
    <group ref={ref} position={[0, PLANET_RADIUS + 5, 0]}>
      <mesh position={[0, 2.5, 0]}>
        <torusGeometry args={[4.5, 0.18, 6, 28, Math.PI * 1.55]} />
        <meshBasicMaterial color="#3DD8FF" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 4.8, 0]}>
        <icosahedronGeometry args={[1.2, 1]} />
        <meshStandardMaterial color="#05070c" emissive="#3DD8FF" emissiveIntensity={2.2} wireframe />
      </mesh>
      <mesh position={[0, 4.8, 0]}>
        <octahedronGeometry args={[0.42, 0]} />
        <meshBasicMaterial color="#3DD8FF" />
      </mesh>
      <FloatingFragment position={[-4, 3, 0]} color="#3DD8FF" size={[1.6, 0.5, 0.8]} speed={0.7} />
      <FloatingFragment position={[3.6, 6, 0.8]} color="#FF5959" size={[0.8, 1.4, 0.7]} speed={0.9} />
      <FloatingFragment position={[1.5, 1.8, -3.2]} color="#3BFF91" size={[0.7, 0.7, 1.5]} speed={1.1} />
      <pointLight position={[0, 4.8, 0]} color="#3DD8FF" intensity={1.5} distance={18} />
      <Html position={[0, 8, 0]} center distanceFactor={24} occlude={false}>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary whitespace-nowrap pointer-events-none">Reboot Core</div>
      </Html>
    </group>
  )
}

// ---- Camera controller -------------------------------------------------- //

function CameraRig({
  focusTarget,
  controlsEnabled,
}: {
  focusTarget: [number, number, number] | null
  controlsEnabled: boolean
}) {
  const { camera } = useThree()
  const targetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 38, 118))
  const lookRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0))

  useFrame((_, delta) => {
    if (!focusTarget || controlsEnabled) return
    targetRef.current.set(
      focusTarget[0] + 6,
      focusTarget[1] + 8,
      focusTarget[2] + 10,
    )
    lookRef.current.set(focusTarget[0], focusTarget[1] + 2, focusTarget[2])
    camera.position.lerp(targetRef.current, Math.min(1, delta * 1.6))
    const desiredDir = lookRef.current.clone().sub(camera.position).normalize()
    const currentLook = new THREE.Vector3()
    camera.getWorldDirection(currentLook)
    const newDir = currentLook.lerp(desiredDir, Math.min(1, delta * 1.6))
    camera.lookAt(camera.position.clone().add(newDir))
  })

  return null
}

// ---- District labels on planet surface --------------------------------- //

function DistrictMarkers({ projects }: { projects: CityProject[] }) {
  const seen = useMemo(() => {
    const map = new Map<string, CityProject>()
    for (const p of projects) {
      if (!map.has(p.category)) map.set(p.category, p)
    }
    return [...map.values()]
  }, [projects])

  return (
    <group>
      {seen.map((p) => {
        const theme = CATEGORY_THEME[p.category]
        const district = DISTRICT_MAP[p.category]
        const r = PLANET_RADIUS + 0.5
        const x = Math.cos(p.sectorAngle) * r
        const z = Math.sin(p.sectorAngle) * r
        return (
          <group key={p.category} position={[x, 0, z]}>
            <Html position={[0, 3, 0]} center distanceFactor={45} occlude={false}>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] whitespace-nowrap pointer-events-none"
                style={{ color: theme.emissive }}>
                {district.shortName}
              </div>
            </Html>
          </group>
        )
      })}
    </group>
  )
}

// ---- Detail panel (selected project) ---------------------------------- //

const AWARD_ICONS_CITY: Record<AwardType, typeof Zap> = {
  revival: Zap,
  milestone: TrendingUp,
  legend: Crown,
  survivor: Shield,
  community: Users,
  innovator: Lightbulb,
  comeback: RefreshCw,
  founder: UserCheck,
}

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bg: string }> = {
  alive: { label: 'Alive', color: '#3BFF91', bg: 'rgba(59,255,145,0.1)' },
  reviving: { label: 'Reviving', color: '#3DD8FF', bg: 'rgba(61,216,255,0.1)' },
  decaying: { label: 'Decaying', color: '#FFB547', bg: 'rgba(255,181,71,0.1)' },
  abandoned: { label: 'Abandoned', color: '#FF5959', bg: 'rgba(255,89,89,0.1)' },
}

function ProjectDetail({ project, onClose }: { project: CityProject; onClose: () => void }) {
  const district = DISTRICT_MAP[project.category]
  const theme = CATEGORY_THEME[project.category]
  const setMode = useUI((s) => s.setMode)
  const startCustomizing = useUI((s) => s.startCustomizing)
  const statusCfg = STATUS_CONFIG[project.status]
  const awards = useMemo(() => computeAwards(project), [project])
  return (
    <motion.div
      initial={{ opacity: 0, x: 40, filter: 'blur(8px)' }}
      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, x: 40, filter: 'blur(8px)' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute top-lg right-lg w-[340px] max-w-[calc(100vw-2rem)] z-30"
    >
      <div className="glass-strong p-lg rounded-lg overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${theme.emissive}, transparent)` }} />
        <div className="flex items-start justify-between mb-md">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-sm mb-1">
              <span className="px-sm py-0.5 rounded-md text-[10px] font-mono font-medium" style={{ color: statusCfg.color, backgroundColor: statusCfg.bg }}>{statusCfg.label}</span>
              <span className="label-mono" style={{ color: theme.emissive }}>{district.shortName}</span>
            </div>
            <h3 className="text-lg font-medium text-text">{project.name}</h3>
            <p className="text-xs text-text-secondary mt-1">{project.tagline}</p>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text transition-colors text-sm shrink-0 ml-sm">✕</button>
        </div>
        <div className="mb-md">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-text-secondary">Momentum</span>
            <span className="text-xs font-mono text-text">{project.momentum}</span>
          </div>
          <MomentumBar value={project.momentum} color={theme.emissive} />
        </div>
        <div className="grid grid-cols-2 gap-md mb-md">
          <Stat label="Stage" value={`${project.stage}/5`} />
          <Stat label="Followers" value={project.followers.toLocaleString()} />
        </div>
        {project.description && <p className="text-xs text-text-secondary leading-relaxed mb-md">{project.description}</p>}
        {awards.length > 0 && (
          <div className="mb-md">
            <div className="label-mono mb-2 flex items-center gap-1"><Award size={11} /> Awards</div>
            <div className="flex flex-wrap gap-sm">
              {awards.map((a) => {
                const Icon = AWARD_ICONS_CITY[a.type]
                return (
                  <div key={a.type} className="flex items-center gap-1.5 px-sm py-1 rounded-md border border-border/40 bg-card/60" title={a.description}>
                    <Icon size={12} style={{ color: theme.emissive }} />
                    <span className="text-[10px] font-mono text-text">{a.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {project.failureReason && (
          <div className="p-md rounded-lg border border-error/30 bg-error/5 mb-md">
            <div className="label-mono text-error mb-1">Why it ended</div>
            <p className="text-xs text-text-secondary leading-relaxed">{project.failureReason}</p>
          </div>
        )}
        <div className="flex items-center gap-sm flex-wrap">
          {project.tags.map((t) => (
            <span key={t} className="px-sm py-1 rounded-md text-[10px] font-mono text-text-secondary bg-card/60 border border-border/40">{t}</span>
          ))}
        </div>
        <div className="mt-lg pt-md border-t border-border/40 flex items-center justify-between text-xs text-text-secondary">
          <span>Founded {project.foundedYear}</span>
          {project.failureYear && <span>Ended {project.failureYear}</span>}
          <span>by {project.founder}</span>
        </div>
        <div className="mt-lg flex gap-sm">
          <button onClick={() => startCustomizing(project.id)} className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-border/60 bg-card/60 text-text hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 flex items-center justify-center gap-2">
            <Sliders size={14} /> Customize
          </button>
          <button onClick={() => setMode('echo')} className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-all duration-300 flex items-center justify-center gap-2">
            <Sparkles size={14} /> Echo
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-secondary">{label}</div>
      <div className="text-sm font-mono text-text mt-0.5">{value}</div>
    </div>
  )
}

function MomentumBar({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="h-1.5 rounded-full bg-card/80 overflow-hidden">
      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="h-full rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
    </div>
  )
}

// ---- Stats overlay ------------------------------------------------------ //

function CityStatsOverlay({ projects }: { projects: CityProject[] }) {
  const alive = projects.filter((p) => p.status === 'alive').length
  const reviving = projects.filter((p) => p.status === 'reviving').length
  const abandoned = projects.filter((p) => p.status === 'abandoned').length
  const totalFollowers = projects.reduce((sum, p) => sum + p.followers, 0)
  const stats = [
    { icon: Activity, label: 'Active', value: alive + reviving, color: '#3DD8FF' },
    { icon: Users, label: 'Followers', value: totalFollowers.toLocaleString(), color: '#3DD8FF' },
    { icon: TrendingUp, label: 'Reviving', value: reviving, color: '#3BFF91' },
    { icon: Zap, label: 'Abandoned', value: abandoned, color: '#FF5959' },
  ]
  return (
    <div className="absolute top-lg left-lg z-20 flex flex-col gap-sm">
      <div className="glass px-md py-sm rounded-lg flex items-center gap-md">
        {stats.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1.5">
            {i > 0 && <span className="w-px h-4 bg-border/40" />}
            <s.icon size={13} style={{ color: s.color }} />
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-text-secondary leading-none">{s.label}</span>
              <span className="text-xs font-mono text-text leading-none mt-0.5">{s.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- AI Guide overlay --------------------------------------------------- //

const GUIDE_LINES = [
  'Welcome to Reboot. This planet is built from abandoned ideas.',
  'Each structure is a project — its shape tells its story.',
  'Hover over a building to see what it was. Click to dive deeper.',
  'Reviving projects have drones rebuilding them. Watch closely.',
  'The red districts are graveyards. The bright ones still live.',
  'Try Echo mode to explore a project\'s digital consciousness.',
]

export function AIGuide() {
  const [visible, setVisible] = useState(true)
  const [lineIndex, setLineIndex] = useState(0)
  const [typing, setTyping] = useState('')
  const [showText, setShowText] = useState(false)

  useEffect(() => {
    if (!visible) return
    const startDelay = setTimeout(() => setShowText(true), 1500)
    return () => clearTimeout(startDelay)
  }, [visible])

  useEffect(() => {
    if (!showText) return
    const fullLine = GUIDE_LINES[lineIndex]
    let charIndex = 0
    const interval = setInterval(() => {
      if (charIndex >= fullLine.length) {
        clearInterval(interval)
        return
      }
      charIndex++
      setTyping(fullLine.slice(0, charIndex))
    }, 30)
    return () => clearInterval(interval)
  }, [showText, lineIndex])

  useEffect(() => {
    if (!showText) return
    const advance = setTimeout(() => {
      if (lineIndex < GUIDE_LINES.length - 1) {
        setLineIndex((i) => i + 1)
      }
    }, 5000)
    return () => clearTimeout(advance)
  }, [showText, lineIndex, typing])

  if (!visible) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.5 }}
      className="absolute bottom-2xl left-2xl z-30 max-w-[340px]"
    >
      <div className="glass-strong p-md rounded-xl flex items-start gap-md">
        <div className="shrink-0 w-10 h-10 rounded-lg border border-primary/30 bg-primary/10 flex items-center justify-center relative">
          <Bot size={18} className="text-primary" />
          <motion.div
            className="absolute inset-0 rounded-lg border border-primary/20"
            animate={{ opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-sm mb-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-primary">Reboot AI</span>
            <button
              onClick={() => setLineIndex((i) => Math.min(i + 1, GUIDE_LINES.length - 1))}
              className="text-text-secondary hover:text-text transition-colors"
            >
              <ChevronRight size={12} />
            </button>
          </div>
          <p className="text-xs text-text leading-relaxed min-h-[32px]">
            {showText ? typing : <span className="text-text-secondary/40">Initializing...</span>}
            {showText && typing.length === GUIDE_LINES[lineIndex].length && (
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="inline-block w-1.5 h-3 bg-primary ml-0.5 align-middle"
              />
            )}
          </p>
          {/* Progress dots */}
          <div className="flex gap-1 mt-sm">
            {GUIDE_LINES.map((_, i) => (
              <div
                key={i}
                className="w-1 h-1 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: i === lineIndex ? '#3DD8FF' : i < lineIndex ? '#3DD8FF44' : '#ffffff20',
                  width: i === lineIndex ? '12px' : '4px',
                }}
              />
            ))}
          </div>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="shrink-0 text-text-secondary hover:text-text transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </motion.div>
  )
}

// ---- District biomes wrapper ------------------------------------------- //

function BiomesLayer({ projects }: { projects: CityProject[] }) {
  const biomes = useMemo(() => {
    const seen = new Map<string, { sectorAngle: number; sectorWidth: number; category: ProjectCategory; projects: CityProject[] }>()
    for (const p of projects) {
      const existing = seen.get(p.category)
      if (existing) {
        existing.projects.push(p)
      } else {
        seen.set(p.category, {
          sectorAngle: p.sectorAngle,
          sectorWidth: p.sectorWidth,
          category: p.category,
          projects: [p],
        })
      }
    }
    return [...seen.values()]
  }, [projects])

  return (
    <group>
      {biomes.map((b) => (
        <DistrictBiome key={b.category} {...b} />
      ))}
    </group>
  )
}

// ---- Main visualization ------------------------------------------------ //

export function CityVisualization({ projects }: { projects: CityProject[] }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [focusTarget, setFocusTarget] = useState<[number, number, number] | null>(null)
  const selectProject = useUI((s) => s.selectProject)
  const selectedProjectId = useUI((s) => s.selectedProjectId)

  const selected = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  )

  const onSelect = useCallback(
    (id: string) => {
      const p = projects.find((x) => x.id === id)
      if (p) {
        selectProject(id)
        setFocusTarget([p.position[0], p.position[1] + 3, p.position[2]])
      }
    },
    [projects, selectProject],
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFocusTarget(null)
        selectProject(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectProject])

  return (
    <div className="absolute inset-0">
      <CityStatsOverlay projects={projects} />
      <AIGuide />
      <Canvas
        shadows={false}
        dpr={[1, 1.8]}
        camera={{ position: [0, 26, 124], fov: 50, near: 0.1, far: 1200 }}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      >
        <color attach="background" args={['#03050a']} />
        <fog attach="fog" args={['#050810', 260, 700]} />

        <ambientLight intensity={0.9} />
        <hemisphereLight args={['#9bc4ff', '#1a2a1a', 0.9]} />
        <directionalLight position={[60, 80, 140]} intensity={1.6} color="#cfe2ff" />
        <pointLight position={[0, PLANET_RADIUS + 20, 0]} intensity={0.4} color="#3DD8FF" distance={200} />

        <Suspense fallback={null}>
          <PlanetStars count={1000} />
          <PlanetBody />
          <RebootMonument />
          <BiomesLayer projects={projects} />
          <LifeParticles projects={projects} />
          <ConstructionDrones projects={projects} />
          <WorldLife projects={projects} />
          <CityGlow projects={projects} />
          <DistrictMarkers projects={projects} />
          {projects.map((p) => (
            <SurrealBuilding
              key={p.id}
              project={p}
              hovered={hoveredId === p.id}
              selected={selectedProjectId === p.id}
              onHover={setHoveredId}
              onSelect={onSelect}
            />
          ))}
        </Suspense>

        <CameraRig focusTarget={focusTarget} controlsEnabled={focusTarget === null} />
        <OrbitControls
          enabled={focusTarget === null}
          enablePan
          enableZoom
          enableRotate
          minDistance={70}
          maxDistance={200}
          maxPolarAngle={Math.PI / 1.8}
          enableDamping
          dampingFactor={0.08}
          target={[0, 0, 0]}
        />
        <AdaptiveDpr pixelated />
        <EffectComposer>
          <Bloom mipmapBlur intensity={1.05} luminanceThreshold={0.32} luminanceSmoothing={0.25} radius={0.8} />
        </EffectComposer>
      </Canvas>

      {projects.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="glass px-lg py-md rounded-lg">
            <div className="font-mono text-xs text-text-secondary text-center">No projects match this filter.</div>
            <button
              onClick={() => {
                useUI.getState().setCategoryFilter(null)
                useUI.getState().setStatusFilter(null)
              }}
              className="mt-sm w-full text-xs text-primary hover:text-primary/80 transition-colors"
            >
              Clear filters
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {selected && <ProjectDetail project={selected} onClose={() => selectProject(null)} />}
      </AnimatePresence>

      {selected && (
        <CustomizationPanel projectId={selected.id} projectName={selected.name} />
      )}
    </div>
  )
}
