/**
 * Graveyard module — the entry point of Reboot.
 *
 * ALL projects are shown here as tombstones/towers in a dark foggy field.
 * Abandoned projects are broken; alive ones glow faintly as "survivors."
 * Focus is on revival: each project shows why it failed and offers a Revive
 * action. Awards and badges are displayed per project.
 */
import { useMemo, useRef, useState, useCallback, Suspense } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html, Float, OrbitControls, AdaptiveDpr } from '@react-three/drei'
import * as THREE from 'three'
import { motion, AnimatePresence } from 'framer-motion'
import { Skull, X, Zap, Award, TrendingUp, Crown, Shield, Users, Lightbulb, RefreshCw, UserCheck } from 'lucide-react'
import { useProjects } from '@/stores/auth'
import { useUI } from '@/stores/ui'
import { CATEGORY_THEME, STATUS_BADGES, computeAwards, type Project, type AwardType } from '@/types/project'

const AWARD_ICONS: Record<AwardType, typeof Zap> = {
  revival: Zap,
  milestone: TrendingUp,
  legend: Crown,
  survivor: Shield,
  community: Users,
  innovator: Lightbulb,
  comeback: RefreshCw,
  founder: UserCheck,
}

interface Grave {
  project: Project
  position: [number, number, number]
}

function planGraveyard(projects: Project[]): Grave[] {
  const cols = 8
  return projects.map((p, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    return {
      project: p,
      position: [(col - cols / 2) * 5, 0, row * 6] as [number, number, number],
    }
  })
}

function Tombstone({ grave, hovered, onHover, onSelect }: {
  grave: Grave
  hovered: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}) {
  const theme = CATEGORY_THEME[grave.project.category]
  const isAbandoned = grave.project.status === 'abandoned'
  const isReviving = grave.project.status === 'reviving'
  const isAlive = grave.project.status === 'alive'
  const statusBadge = STATUS_BADGES[grave.project.status]

  const ref = useRef<THREE.Group>(null)
  const innerRef = useRef<THREE.Group>(null)

  const glowMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#000',
        emissive: new THREE.Color(isAbandoned ? '#FF5959' : theme.emissive),
        emissiveIntensity: isAlive ? 0.8 : 0.5,
      }),
    [isAbandoned, theme.emissive, isAlive],
  )

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    if (isReviving) {
      glowMat.emissiveIntensity = 1.5 + Math.sin(t * 4) * 0.8
    } else if (isAbandoned) {
      glowMat.emissiveIntensity = Math.random() > 0.98 ? 0.1 : 0.35
    } else if (isAlive) {
      // Gentle breathing for survivors
      glowMat.emissiveIntensity = 0.7 + Math.sin(t * 0.8 + grave.position[0] * 0.1) * 0.15
    }
    // Subtle sway for all
    if (innerRef.current) {
      innerRef.current.rotation.z = Math.sin(t * 0.3 + grave.position[0] * 0.05) * 0.01
    }
  })

  const h = isAbandoned ? 2.5 : Math.max(3, grave.project.stage * 1.5 + 1)
  const w = 1.8

  return (
    <group ref={ref} position={grave.position}>
      {/* Base */}
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[w * 1.3, 0.3, w * 1.3]} />
        <meshStandardMaterial color="#08080c" roughness={0.9} metalness={0.1} />
      </mesh>

      <group ref={innerRef}>
        {/* Main body */}
        <mesh
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation()
            onHover(grave.project.id)
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            onHover(null)
            document.body.style.cursor = 'auto'
          }}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation()
            onSelect(grave.project.id)
          }}
        >
          <boxGeometry args={[w, h, w]} />
          <meshStandardMaterial
            color={isAbandoned ? '#08080c' : '#10141e'}
            roughness={isAbandoned ? 0.95 : 0.4}
            metalness={isAbandoned ? 0.1 : 0.7}
          />
          <edgesGeometry args={[undefined, 0]}>
            <lineBasicMaterial color={isAbandoned ? '#2a0808' : '#1a2030'} />
          </edgesGeometry>
        </mesh>

        {/* Glow strip — front face */}
        <mesh material={glowMat} position={[0, 0, w / 2 + 0.01]}>
          <planeGeometry args={[w * 0.06, h * 0.8]} />
        </mesh>

        {/* Broken top for abandoned */}
        {isAbandoned && (
          <mesh position={[0.3, h / 2 - 0.2, 0.2]} rotation={[0.3, 0.4, 0.2]} material={glowMat}>
            <boxGeometry args={[1, 0.6, 1]} />
          </mesh>
        )}

        {/* Crown for alive/surviving */}
        {!isAbandoned && grave.project.stage >= 4 && (
          <mesh material={glowMat} position={[0, h / 2 + 0.3, 0]}>
            <boxGeometry args={[w * 0.4, 0.3, w * 0.4]} />
          </mesh>
        )}
      </group>

      {/* Status ground glow */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[w * 0.6, w * 0.75, 32]} />
        <meshBasicMaterial color={statusBadge.color} transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Reviving beacon */}
      {isReviving && (
        <Float speed={2} floatIntensity={1}>
          <mesh position={[0, h + 1.5, 0]}>
            <sphereGeometry args={[0.25, 16, 16]} />
            <meshBasicMaterial color={theme.emissive} transparent opacity={0.7} />
          </mesh>
        </Float>
      )}

      {hovered && (
        <Html position={[0, h + 1.5, 0]} center distanceFactor={20}>
          <div className="glass-strong px-md py-sm rounded-lg whitespace-nowrap pointer-events-none gpu">
            <div className="text-xs font-medium text-text">{grave.project.name}</div>
            <div className="text-[10px] mt-0.5 flex items-center gap-1.5">
              <span style={{ color: statusBadge.color }}>{statusBadge.label}</span>
              {grave.project.failureYear && (
                <>
                  <span className="text-text-secondary">·</span>
                  <span className="text-text-secondary">Died {grave.project.failureYear}</span>
                </>
              )}
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

function GraveyardGround() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#040406" roughness={1} metalness={0} />
      </mesh>
      <gridHelper args={[300, 60, '#0a0a12', '#06060a']} position={[0, 0.01, 0]} />
    </group>
  )
}

function GraveyardStats({ projects }: { projects: Project[] }) {
  const abandoned = projects.filter((p) => p.status === 'abandoned').length
  const reviving = projects.filter((p) => p.status === 'reviving').length
  const alive = projects.filter((p) => p.status === 'alive').length
  const decaying = projects.filter((p) => p.status === 'decaying').length

  const stats = [
    { label: 'Total', value: projects.length, color: '#f8f8f8' },
    { label: 'Abandoned', value: abandoned, color: '#FF5959' },
    { label: 'Reviving', value: reviving, color: '#3DD8FF' },
    { label: 'Alive', value: alive, color: '#3BFF91' },
    { label: 'Decaying', value: decaying, color: '#FFB547' },
  ]

  return (
    <div className="absolute top-lg left-lg z-20">
      <div className="glass px-md py-sm rounded-lg flex items-center gap-md">
        {stats.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1.5">
            {i > 0 && <span className="w-px h-4 bg-border/40" />}
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-text-secondary leading-none">{s.label}</span>
              <span className="text-xs font-mono leading-none mt-0.5" style={{ color: s.color }}>{s.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function GraveyardDetail({ project, onClose }: { project: Project; onClose: () => void }) {
  const theme = CATEGORY_THEME[project.category]
  const statusBadge = STATUS_BADGES[project.status]
  const setMode = useUI((s) => s.setMode)
  const selectProject = useUI((s) => s.selectProject)
  const awards = useMemo(() => computeAwards(project), [project])

  return (
    <motion.div
      initial={{ opacity: 0, x: 40, filter: 'blur(8px)' }}
      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, x: 40, filter: 'blur(8px)' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute top-lg right-lg w-[340px] max-w-[calc(100vw-2rem)] z-30 max-h-[calc(100vh-4rem)] overflow-y-auto"
    >
      <div className="glass-strong p-lg rounded-lg border-error/30">
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${statusBadge.color}, transparent)` }} />

        <div className="flex items-start justify-between mb-md">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-sm mb-1">
              <span
                className="px-sm py-0.5 rounded-md text-[10px] font-mono font-medium"
                style={{ color: statusBadge.color, backgroundColor: `${statusBadge.color}1a` }}
              >
                {statusBadge.label}
              </span>
              <span className="label-mono" style={{ color: theme.emissive }}>
                {project.category}
              </span>
            </div>
            <h3 className="text-lg font-medium text-text">{project.name}</h3>
            <p className="text-xs text-text-secondary mt-1">{project.tagline}</p>
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text transition-colors shrink-0 ml-sm"
          >
            <X size={16} />
          </button>
        </div>

        {/* Awards */}
        {awards.length > 0 && (
          <div className="mb-md">
            <div className="label-mono mb-2 flex items-center gap-1">
              <Award size={11} /> Awards
            </div>
            <div className="flex flex-wrap gap-sm">
              {awards.map((a) => {
                const Icon = AWARD_ICONS[a.type]
                return (
                  <div
                    key={a.type}
                    className="flex items-center gap-1.5 px-sm py-1 rounded-md border border-border/40 bg-card/60"
                    title={a.description}
                  >
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

        <p className="text-xs text-text-secondary leading-relaxed mb-md">{project.description}</p>

        <div className="grid grid-cols-2 gap-md mb-md">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-secondary">Stage</div>
            <div className="text-sm font-mono text-text mt-0.5">{project.stage}/5</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-secondary">Followers</div>
            <div className="text-sm font-mono text-text mt-0.5">{project.followers.toLocaleString()}</div>
          </div>
        </div>

        <div className="flex items-center gap-sm flex-wrap mb-lg">
          {project.tags.map((t) => (
            <span
              key={t}
              className="px-sm py-1 rounded-md text-[10px] font-mono text-text-secondary bg-card/60 border border-border/40"
            >
              {t}
            </span>
          ))}
        </div>

        <div className="pt-md border-t border-border/40 flex items-center justify-between text-xs text-text-secondary mb-lg">
          <span>Founded {project.foundedYear}</span>
          {project.failureYear && <span>Died {project.failureYear}</span>}
          <span>by {project.founder}</span>
        </div>

        <button
          onClick={() => {
            selectProject(project.id)
            setMode('city')
          }}
          className="w-full btn-primary py-2.5 rounded-lg text-sm flex items-center justify-center gap-2"
        >
          <Zap size={14} /> Revive Project
        </button>
      </div>
    </motion.div>
  )
}

export function GraveyardModule() {
  const all = useProjects((s) => s.projects)
  const loading = useProjects((s) => s.loading)
  const selectProject = useUI((s) => s.selectProject)
  const selectedProjectId = useUI((s) => s.selectedProjectId)
  const setMode = useUI((s) => s.setMode)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Show ALL projects in the graveyard
  const graves = useMemo(() => planGraveyard(all), [all])
  const selected = useMemo(
    () => all.find((p) => p.id === selectedProjectId) ?? null,
    [all, selectedProjectId],
  )

  const onSelect = useCallback((id: string) => selectProject(id), [selectProject])

  if (loading && all.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="font-mono text-xs text-text-secondary animate-pulse-soft">Entering Graveyard...</div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 bg-gradient-to-b from-[#020203] to-[#06060a]">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="absolute top-lg left-1/2 -translate-x-1/2 z-20 glass px-lg py-sm rounded-lg flex items-center gap-sm"
      >
        <Skull size={14} className="text-error" />
        <span className="text-xs text-text-secondary">
          The Graveyard · {all.length} projects · every idea deserves a second chance
        </span>
      </motion.div>

      <GraveyardStats projects={all} />

      {/* Navigate to city */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-lg right-lg z-20"
      >
        <button
          onClick={() => setMode('city')}
          className="btn-primary px-lg py-sm rounded-lg text-xs flex items-center gap-2"
        >
          Enter City →
        </button>
      </motion.div>

      <Canvas
        dpr={[1, 1.6]}
        camera={{ position: [0, 22, 35], fov: 55 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#040406']} />
        <fog attach="fog" args={['#040406', 25, 90]} />
        <ambientLight intensity={0.12} />
        <directionalLight position={[10, 25, 10]} intensity={0.25} color="#ff5555" />
        <pointLight position={[0, 15, 0]} intensity={0.3} color="#3DD8FF" distance={60} />

        <Suspense fallback={null}>
          <GraveyardGround />
          {graves.map((g) => (
            <Tombstone
              key={g.project.id}
              grave={g}
              hovered={hoveredId === g.project.id}
              onHover={setHoveredId}
              onSelect={onSelect}
            />
          ))}
        </Suspense>

        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minDistance={10}
          maxDistance={80}
          maxPolarAngle={Math.PI / 2.2}
          enableDamping
          dampingFactor={0.08}
          target={[0, 0, 0]}
        />
        <AdaptiveDpr pixelated />
      </Canvas>

      <AnimatePresence>
        {selected && <GraveyardDetail project={selected} onClose={() => selectProject(null)} />}
      </AnimatePresence>
    </div>
  )
}
