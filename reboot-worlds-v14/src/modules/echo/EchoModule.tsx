/**
 * Echo module — two states:
 *
 *   1. Browse — projects float as holographic nodes in a sphere. The user
 *      picks one to enter the Echo environment.
 *   2. Environment — the selected project's "digital consciousness" opens
 *      with a cinematic dissolve. See EchoEnvironment.tsx.
 *
 * The City module can also deep-link into the environment by setting
 * `selectedProjectId` and switching the mode to `echo`.
 *
 * Fully independent: imports only shared types + stores, never City/Network/
 * Graveyard internals.
 */
import { useMemo, useRef, useState, useCallback, Suspense, useEffect } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Html, Float } from '@react-three/drei'
import * as THREE from 'three'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X, ArrowRight } from 'lucide-react'
import { useProjects } from '@/stores/auth'
import { useUI } from '@/stores/ui'
import { CATEGORY_THEME, DISTRICT_MAP, type Project } from '@/types/project'
import { EchoEnvironment } from './EchoEnvironment'

// ---- Browse state: spherical node galaxy ------------------------------- //

interface BrowseNode {
  project: Project
  position: [number, number, number]
}

function planBrowse(projects: Project[]): BrowseNode[] {
  return projects.map((p, i) => {
    const phi = Math.acos(-1 + (2 * (i + 0.5)) / projects.length)
    const theta = Math.sqrt(projects.length * Math.PI) * phi
    const r = 6 + (p.momentum / 100) * 14
    return {
      project: p,
      position: [
        r * Math.cos(theta) * Math.sin(phi),
        r * Math.sin(theta) * Math.sin(phi),
        r * Math.cos(phi),
      ] as [number, number, number],
    }
  })
}

function BrowseNodeMesh({
  node,
  hovered,
  onHover,
  onSelect,
}: {
  node: BrowseNode
  hovered: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}) {
  const theme = CATEGORY_THEME[node.project.category]
  const ref = useRef<THREE.Mesh>(null)
  const scale = 0.4 + (node.project.momentum / 100) * 0.8

  useFrame((state) => {
    if (ref.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2 + node.project.momentum) * 0.05
      ref.current.scale.setScalar(scale * pulse * (hovered ? 1.4 : 1))
    }
  })

  return (
    <group position={node.position}>
      <Float speed={1.5} floatIntensity={0.8} rotationIntensity={0.3}>
        <mesh
          ref={ref}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation()
            onHover(node.project.id)
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            onHover(null)
            document.body.style.cursor = 'auto'
          }}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation()
            onSelect(node.project.id)
          }}
        >
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial
            color="#000000"
            emissive={theme.emissive}
            emissiveIntensity={hovered ? 2.5 : 1.5}
            wireframe
            transparent
            opacity={0.85}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshBasicMaterial color={theme.emissive} transparent opacity={0.6} />
        </mesh>
      </Float>

      {hovered && (
        <Html position={[0, 1.6, 0]} center distanceFactor={14}>
          <div className="glass-strong px-md py-sm rounded-lg whitespace-nowrap pointer-events-none gpu">
            <div className="text-xs font-medium text-text">{node.project.name}</div>
            <div className="text-[10px] text-text-secondary mt-0.5 flex items-center gap-1.5">
              <span style={{ color: theme.emissive }}>{DISTRICT_MAP[node.project.category].shortName}</span>
              <span>·</span>
              <span>Momentum {node.project.momentum}</span>
            </div>
            <div className="text-[10px] text-primary mt-1 flex items-center gap-1">
              Click to enter Echo <ArrowRight size={10} />
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

function ConnectionLines({ nodes }: { nodes: BrowseNode[] }) {
  const geometry = useMemo(() => {
    const positions: number[] = []
    const byId = new Map(nodes.map((n) => [n.project.id, n]))
    for (const n of nodes) {
      for (const connId of n.project.connections) {
        const other = byId.get(connId)
        if (other) {
          positions.push(...n.position, ...other.position)
        }
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geo
  }, [nodes])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#3DD8FF" transparent opacity={0.2} />
    </lineSegments>
  )
}

// ---- Browse view ------------------------------------------------------- //

function EchoBrowse({ onEnter }: { onEnter: (id: string) => void }) {
  const all = useProjects((s) => s.projects)
  const loading = useProjects((s) => s.loading)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const nodes = useMemo(() => planBrowse(all), [all])

  if (loading && all.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="font-mono text-xs text-text-secondary animate-pulse-soft">Initializing Echo...</div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 bg-gradient-to-b from-[#04060a] to-[#080b14]">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="absolute top-lg left-1/2 -translate-x-1/2 z-20 glass px-lg py-sm rounded-lg flex items-center gap-sm"
      >
        <Sparkles size={14} className="text-primary" />
        <span className="text-xs text-text-secondary">
          Echo · Select a project to enter its digital consciousness
        </span>
      </motion.div>

      <Canvas
        dpr={[1, 1.8]}
        camera={{ position: [0, 0, 45], fov: 50 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[0, 0, 0]} intensity={0.5} color="#3DD8FF" distance={50} />

        <Suspense fallback={null}>
          <ConnectionLines nodes={nodes} />
          {nodes.map((n) => (
            <BrowseNodeMesh
              key={n.project.id}
              node={n}
              hovered={hoveredId === n.project.id}
              onHover={setHoveredId}
              onSelect={onEnter}
            />
          ))}
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom
          enableRotate
          minDistance={20}
          maxDistance={80}
          enableDamping
          dampingFactor={0.08}
          autoRotate
          autoRotateSpeed={0.4}
        />
      </Canvas>
    </div>
  )
}

// ---- Dissolve transition overlay --------------------------------------- //

function DissolveOverlay({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 z-40 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, transparent 0%, #04060a 60%, #020304 100%)' }}
        >
          {/* Escaping particles */}
          {Array.from({ length: 40 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-primary"
              style={{
                left: '50%',
                top: '50%',
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1, 0.5],
                x: (Math.random() - 0.5) * 600,
                y: (Math.random() - 0.5) * 600,
              }}
              transition={{ duration: 2, delay: i * 0.02, ease: 'easeOut' }}
            />
          ))}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 1, 0], scale: [0.8, 1.2, 1.5] }}
            transition={{ duration: 2, ease: 'easeOut' }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-primary/40"
            style={{ boxShadow: '0 0 60px rgba(61,216,255,0.3)' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ---- Main EchoModule --------------------------------------------------- //

export function EchoModule() {
  const all = useProjects((s) => s.projects)
  const selectedProjectId = useUI((s) => s.selectedProjectId)
  const selectProject = useUI((s) => s.selectProject)

  // `entering` = we're playing the dissolve transition into the environment.
  const [entering, setEntering] = useState(false)
  const [envProject, setEnvProject] = useState<Project | null>(null)

  // If City deep-linked us with a selectedProjectId, enter the environment
  // for that project directly.
  useEffect(() => {
    if (selectedProjectId && !envProject && !entering) {
      const p = all.find((x) => x.id === selectedProjectId)
      if (p) {
        setEntering(true)
        // The dissolve plays, then the environment mounts.
        const t = setTimeout(() => {
          setEnvProject(p)
          setEntering(false)
        }, 1800)
        return () => clearTimeout(t)
      }
    }
  }, [selectedProjectId, all, envProject, entering])

  const handleEnter = useCallback((id: string) => {
    const p = all.find((x) => x.id === id)
    if (!p) return
    selectProject(id)
    setEntering(true)
    const t = setTimeout(() => {
      setEnvProject(p)
      setEntering(false)
    }, 1800)
    return () => clearTimeout(t)
  }, [all, selectProject])

  const handleExit = useCallback(() => {
    setEnvProject(null)
    selectProject(null)
  }, [selectProject])

  // Environment view
  if (envProject) {
    return <EchoEnvironment project={envProject} onExit={handleExit} />
  }

  // Browse view (+ dissolve overlay when entering)
  return (
    <>
      <EchoBrowse onEnter={handleEnter} />
      <DissolveOverlay visible={entering} />
    </>
  )
}
