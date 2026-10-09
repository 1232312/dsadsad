/**
 * EchoEnvironment — the immersive per-project "digital consciousness."
 *
 * When a project is opened in Echo, the city dissolves and this scene takes
 * over: a rotating holographic core at center, 15 neural nodes orbiting it,
 * animated energy lines connecting every node to the core, a subtle grid
 * floor, and floating particles. Clicking a node rotates the neural system
 * so that node moves to the front and its content expands in an HTML overlay
 * panel.
 *
 * Self-contained: receives a `Project` and an `onExit` callback. Knows nothing
 * about City/Network/Graveyard.
 */
import { Suspense, useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html, Float } from '@react-three/drei'
import * as THREE from 'three'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  ArrowLeft,
  Zap,
  TrendingUp,
  AlertTriangle,
  Activity,
  Users,
  Code,
  DollarSign,
  Calendar,
  Rocket,
  BarChart3,
  Image as ImageIcon,
  MessageSquare,
  User,
  Compass,
} from 'lucide-react'
import type { Project } from '@/types/project'
import { DISTRICT_MAP, CATEGORY_THEME } from '@/types/project'
import {
  NEURAL_NODES,
  NODE_MAP,
  getNodeContent,
  echoVoiceLine,
  type NodeId,
  type NodeContent,
  type KeyValueRow,
  type TimelineMilestone,
  type FailureDiagnosis,
  type AnalysisSection,
  type RoadmapMilestone,
  type MetricBar,
} from './echoData'

// ---- 3D layout helpers ------------------------------------------------- //

const ORBIT_RADIUS = 7
const NODE_COUNT = NEURAL_NODES.length

/** Evenly distribute nodes on a circle in the XZ plane, slightly raised. */
function nodePosition(index: number, rotationY: number): [number, number, number] {
  const angle = (index / NODE_COUNT) * Math.PI * 2 + rotationY
  const y = Math.sin(index * 1.3) * 1.5
  return [Math.cos(angle) * ORBIT_RADIUS, y, Math.sin(angle) * ORBIT_RADIUS]
}

// ---- Holographic core -------------------------------------------------- //

function HolographicCore({ color }: { color: string }) {
  const innerRef = useRef<THREE.Mesh>(null)
  const outerRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const particleRef = useRef<THREE.Points>(null)

  const particles = useMemo(() => {
    const count = 80
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 1.5 + Math.random() * 2
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geo
  }, [])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    if (innerRef.current) {
      innerRef.current.rotation.y = t * 0.5
      innerRef.current.rotation.x = t * 0.3
      const pulse = 1 + Math.sin(t * 1.5) * 0.08
      innerRef.current.scale.setScalar(pulse)
    }
    if (outerRef.current) {
      outerRef.current.rotation.y = -t * 0.2
      outerRef.current.rotation.z = t * 0.15
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.6
      ringRef.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.4) * 0.2
    }
    if (particleRef.current) {
      particleRef.current.rotation.y = t * 0.1
    }
  })

  return (
    <group>
      {/* Inner glowing core */}
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[1.2, 1]} />
        <meshStandardMaterial
          color="#000000"
          emissive={color}
          emissiveIntensity={1.8}
          wireframe
          transparent
          opacity={0.7}
        />
      </mesh>
      {/* Solid inner glow */}
      <mesh>
        <sphereGeometry args={[0.5, 24, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
      {/* Outer shell */}
      <mesh ref={outerRef}>
        <sphereGeometry args={[2, 16, 16]} />
        <meshStandardMaterial
          color="#000000"
          emissive={color}
          emissiveIntensity={0.4}
          wireframe
          transparent
          opacity={0.15}
        />
      </mesh>
      {/* Orbiting ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[3, 0.03, 8, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} />
      </mesh>
      {/* Orbiting particles */}
      <points ref={particleRef} geometry={particles}>
        <pointsMaterial color={color} size={0.08} transparent opacity={0.6} sizeAttenuation />
      </points>
    </group>
  )
}

// ---- Neural node mesh -------------------------------------------------- //

interface NeuralNodeProps {
  def: (typeof NEURAL_NODES)[number]
  index: number
  orbitRotation: number
  active: boolean
  hovered: boolean
  onHover: (id: NodeId | null) => void
  onClick: (id: NodeId) => void
}

function NeuralNode({ def, index, orbitRotation, active, hovered, onHover, onClick }: NeuralNodeProps) {
  const position = nodePosition(index, orbitRotation)
  const ref = useRef<THREE.Mesh>(null)
  const haloRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (ref.current) {
      const t = state.clock.elapsedTime
      const pulse = 1 + Math.sin(t * 1.2 + index) * 0.06
      const target = active ? 1.6 : hovered ? 1.3 : 1
      const current = ref.current.scale.x
      ref.current.scale.setScalar(current + (target * pulse - current) * 0.1)
    }
    if (haloRef.current) {
      haloRef.current.rotation.z = state.clock.elapsedTime * 0.3
    }
  })

  return (
    <group position={position}>
      <Float speed={1.2} floatIntensity={0.5} rotationIntensity={0.2}>
        <mesh
          ref={ref}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation()
            onHover(def.id)
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            onHover(null)
            document.body.style.cursor = 'auto'
          }}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation()
            onClick(def.id)
          }}
        >
          <octahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial
            color="#000000"
            emissive={def.color}
            emissiveIntensity={active ? 2.5 : hovered ? 2 : 1.2}
            wireframe
            transparent
            opacity={0.8}
          />
        </mesh>
        {/* Solid center */}
        <mesh>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshBasicMaterial color={def.color} transparent opacity={active ? 0.9 : 0.6} />
        </mesh>
        {/* Halo ring when active or hovered */}
        {(active || hovered) && (
          <mesh ref={haloRef} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.8, 0.02, 8, 32]} />
            <meshBasicMaterial color={def.color} transparent opacity={0.5} />
          </mesh>
        )}
      </Float>

      {/* Label */}
      {(hovered || active) && (
        <Html position={[0, 1, 0]} center distanceFactor={10} occlude={false}>
          <div
            className="font-mono text-[10px] uppercase tracking-[0.15em] whitespace-nowrap pointer-events-none gpu px-sm py-1 rounded glass-strong"
            style={{ color: def.color }}
          >
            {def.label}
          </div>
        </Html>
      )}
    </group>
  )
}

// ---- Energy lines from core to each node ------------------------------- //

function EnergyLines({ orbitRotation, activeId, hoveredId }: { orbitRotation: number; activeId: NodeId | null; hoveredId: NodeId | null }) {
  const geometry = useMemo(() => {
    const positions: number[] = []
    NEURAL_NODES.forEach((def, i) => {
      const pos = nodePosition(i, orbitRotation)
      // Line from core (0,0,0) to node
      positions.push(0, 0, 0, ...pos)
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geo
  }, [orbitRotation])

  // We use vertex colors so active/hovered lines brighten.
  const colorAttr = useMemo(() => {
    const colors: number[] = []
    NEURAL_NODES.forEach((def) => {
      const c = new THREE.Color(def.color)
      const isHighlight = activeId === def.id || hoveredId === def.id
      const intensity = isHighlight ? 1 : 0.2
      // Two vertices per line segment (core + node)
      colors.push(c.r * intensity, c.g * intensity, c.b * intensity, c.r * intensity, c.g * intensity, c.b * intensity)
    })
    return new THREE.Float32BufferAttribute(colors, 3)
  }, [activeId, hoveredId])

  useEffect(() => {
    geometry.setAttribute('color', colorAttr)
  }, [geometry, colorAttr])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial vertexColors transparent opacity={0.6} />
    </lineSegments>
  )
}

// ---- Grid floor + ambient particles ------------------------------------ //

function GridFloor() {
  return (
    <group position={[0, -5, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshBasicMaterial color="#06080C" transparent opacity={0.6} />
      </mesh>
      <gridHelper args={[60, 30, '#0f1820', '#0a1018']} />
    </group>
  )
}

function AmbientParticles({ count = 200 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null)
  const geo = useMemo(() => {
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return g
  }, [count])

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.02
    }
  })

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color="#3DD8FF" size={0.05} transparent opacity={0.3} sizeAttenuation />
    </points>
  )
}

// ---- Orbit controller -------------------------------------------------- //
// Rotates the entire neural node system so the active node moves to the
// front (closest to camera). Smoothly eases.

function OrbitController({ activeIndex, orbitRef }: { activeIndex: number; orbitRef: React.MutableRefObject<number> }) {
  useFrame((_, delta) => {
    // Target rotation puts the active node at angle 0 (front).
    const target = -(activeIndex / NODE_COUNT) * Math.PI * 2
    const current = orbitRef.current
    // Shortest-path angular interpolation
    let diff = target - current
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    orbitRef.current = current + diff * Math.min(1, delta * 2)
  })
  return null
}

// ---- Content panel (HTML overlay) -------------------------------------- //

const NODE_ICONS: Record<NodeId, typeof Compass> = {
  overview: Compass,
  timeline: Calendar,
  founder: User,
  technology: Code,
  funding: DollarSign,
  community: Users,
  roadmap: Rocket,
  users: Users,
  growth: TrendingUp,
  aiAnalysis: Activity,
  failures: AlertTriangle,
  revival: Zap,
  metrics: BarChart3,
  media: ImageIcon,
  comments: MessageSquare,
}

function ContentPanel({
  nodeId,
  project,
  voiceLine,
  onClose,
}: {
  nodeId: NodeId
  project: Project
  voiceLine: string
  onClose: () => void
}) {
  const def = NODE_MAP[nodeId]
  const content = useMemo(() => getNodeContent(nodeId, project), [nodeId, project])
  const Icon = NODE_ICONS[nodeId]

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, filter: 'blur(12px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: 30, filter: 'blur(12px)' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="absolute top-lg right-lg w-[380px] max-w-[calc(100vw-2rem)] max-h-[calc(100%-6rem)] z-30 overflow-y-auto"
    >
      <div className="glass-strong rounded-lg p-lg" style={{ borderColor: `${def.color}40` }}>
        {/* Header */}
        <div className="flex items-start justify-between mb-lg">
          <div className="flex items-center gap-md">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center border"
              style={{ borderColor: `${def.color}40`, background: `${def.color}10` }}
            >
              <Icon size={16} style={{ color: def.color }} />
            </div>
            <div>
              <h3 className="text-base font-medium text-text">{def.label}</h3>
              <div className="text-[10px] font-mono text-text-secondary">{project.name}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Echo voice line */}
        <div className="mb-lg px-md py-sm rounded-lg border border-primary/20 bg-primary/5 flex items-center gap-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-soft" />
          <span className="font-mono text-[11px] text-primary">{voiceLine}</span>
        </div>

        {/* Content */}
        <ContentBody content={content} color={def.color} project={project} />
      </div>
    </motion.div>
  )
}

function ContentBody({ content, color, project }: { content: NodeContent; color: string; project: Project }) {
  switch (content.kind) {
    case 'keyValues':
      return <KeyValuesView rows={content.rows} />
    case 'timeline':
      return <TimelineView milestones={content.milestones} color={color} />
    case 'failures':
      return <FailuresView diagnoses={content.diagnoses} />
    case 'analysis':
      return <AnalysisView sections={content.sections} color={color} />
    case 'roadmap':
      return <RoadmapView milestones={content.milestones} color={color} />
    case 'metrics':
      return (
        <div className="space-y-md">
          <div className="space-y-md">
            {content.bars.map((b) => (
              <MetricBarView key={b.label} bar={b} />
            ))}
          </div>
          <div className="pt-md border-t border-border/40">
            <KeyValuesView rows={content.rows} />
          </div>
        </div>
      )
    case 'revive':
      return <ReviveView project={project} color={color} />
    case 'media':
      return (
        <div className="text-center py-xl">
          <ImageIcon size={32} className="mx-auto text-text-secondary/40 mb-md" />
          <p className="text-xs text-text-secondary">No media available for this project.</p>
        </div>
      )
    case 'comments':
      return (
        <div className="text-center py-xl">
          <MessageSquare size={32} className="mx-auto text-text-secondary/40 mb-md" />
          <p className="text-xs text-text-secondary">No community comments yet.</p>
        </div>
      )
  }
}

function KeyValuesView({ rows }: { rows: KeyValueRow[] }) {
  return (
    <div className="space-y-md">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between py-1 border-b border-border/20 last:border-0">
          <span className="text-xs text-text-secondary">{row.label}</span>
          <span
            className="text-xs font-mono"
            style={{ color: row.color ?? '#F8F8F8' }}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function MetricBarView({ bar }: { bar: MetricBar }) {
  const pct = Math.min(100, (bar.value / bar.max) * 100)
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-text-secondary">{bar.label}</span>
        <span className="text-[11px] font-mono" style={{ color: bar.color }}>
          {bar.value.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-border/60 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: bar.color, boxShadow: `0 0 8px ${bar.color}` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  )
}

function TimelineView({ milestones, color }: { milestones: TimelineMilestone[]; color: string }) {
  return (
    <div className="space-y-md">
      {milestones.map((m, i) => (
        <div key={m.id} className="flex gap-md">
          {/* Vertical line + dot */}
          <div className="flex flex-col items-center">
            <div
              className="w-2.5 h-2.5 rounded-full border-2"
              style={{
                borderColor: m.reached ? color : '#252C35',
                backgroundColor: m.reached ? color : 'transparent',
                boxShadow: m.reached ? `0 0 6px ${color}` : 'none',
              }}
            />
            {i < milestones.length - 1 && (
              <div
                className="w-[2px] flex-1 min-h-[20px]"
                style={{ background: m.reached ? `${color}40` : '#252C35' }}
              />
            )}
          </div>
          {/* Content */}
          <div className="flex-1 pb-md">
            <div className="flex items-center gap-sm">
              <span className={`text-xs font-medium ${m.reached ? 'text-text' : 'text-text-secondary'}`}>
                {m.label}
              </span>
              {m.year && (
                <span className="text-[10px] font-mono text-text-secondary">{m.year}</span>
              )}
            </div>
            <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">{m.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function FailuresView({ diagnoses }: { diagnoses: FailureDiagnosis[] }) {
  const severityColors: Record<string, string> = {
    low: '#FFB547',
    medium: '#FFB547',
    high: '#FF5959',
    critical: '#FF5959',
  }
  return (
    <div className="space-y-md">
      {diagnoses.map((d, i) => (
        <motion.div
          key={d.problem}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08, duration: 0.4 }}
          className="p-md rounded-lg border bg-card/40"
          style={{ borderColor: `${severityColors[d.severity]}30` }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-text">{d.problem}</span>
            <span
              className="text-[10px] font-mono uppercase px-sm py-0.5 rounded"
              style={{ color: severityColors[d.severity], background: `${severityColors[d.severity]}15` }}
            >
              {d.severity}
            </span>
          </div>
          <p className="text-[11px] text-text-secondary leading-relaxed mb-sm">{d.explanation}</p>
          <div className="pt-sm border-t border-border/20">
            <span className="text-[10px] font-mono uppercase tracking-wider text-success">Recovery</span>
            <p className="text-[11px] text-text-secondary leading-relaxed mt-0.5">{d.recovery}</p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function AnalysisView({ sections, color }: { sections: AnalysisSection[]; color: string }) {
  return (
    <div className="space-y-lg">
      {sections.map((s, i) => (
        <motion.div
          key={s.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.4 }}
        >
          <div className="label-mono mb-sm" style={{ color }}>{s.title}</div>
          <ul className="space-y-sm">
            {s.items.map((item, j) => (
              <li key={j} className="text-[11px] text-text-secondary leading-relaxed flex gap-sm">
                <span style={{ color }}>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      ))}
    </div>
  )
}

function RoadmapView({ milestones, color }: { milestones: RoadmapMilestone[]; color: string }) {
  return (
    <div className="space-y-md">
      {milestones.map((m, i) => (
        <div key={m.id} className="flex items-center gap-md">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center border text-[10px] font-mono"
            style={{
              borderColor: m.completed ? `${color}60` : '#252C35',
              background: m.completed ? `${color}15` : 'transparent',
              color: m.completed ? color : '#8E96A5',
              boxShadow: m.completed ? `0 0 10px ${color}30` : 'none',
            }}
          >
            {i + 1}
          </div>
          <div className="flex-1">
            <span className={`text-xs ${m.completed ? 'text-text' : 'text-text-secondary'}`}>{m.label}</span>
            <div className="text-[10px] font-mono" style={{ color: m.completed ? color : '#8E96A5' }}>
              {m.completed ? 'Completed' : 'Holographic'}
            </div>
          </div>
          {i < milestones.length - 1 && (
            <div className="w-6 h-[2px]" style={{ background: m.completed ? `${color}40` : '#252C35' }} />
          )}
        </div>
      ))}
    </div>
  )
}

function ReviveView({ project, color }: { project: Project; color: string }) {
  const isReviving = project.status === 'reviving'
  return (
    <div className="text-center py-md">
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-lg border-2"
        style={{ borderColor: color, boxShadow: `0 0 20px ${color}40` }}
      >
        <Zap size={28} style={{ color }} />
      </motion.div>
      <p className="text-sm text-text mb-sm">
        {isReviving ? 'Revival In Progress' : 'Initiate Revival'}
      </p>
      <p className="text-xs text-text-secondary mb-lg leading-relaxed">
        {isReviving
          ? 'This project is currently being revived by the community. Construction drones are active.'
          : 'Begin the cinematic revival sequence. The building will reconstruct floor by floor.'}
      </p>
      <button
        className="w-full py-2.5 rounded-lg text-sm font-medium border transition-all duration-300"
        style={{
          borderColor: `${color}60`,
          background: `${color}10`,
          color,
        }}
      >
        {isReviving ? 'Revival Active' : 'Begin Revival'}
      </button>
    </div>
  )
}

// ---- Main environment -------------------------------------------------- //

export function EchoEnvironment({ project, onExit }: { project: Project; onExit: () => void }) {
  const theme = CATEGORY_THEME[project.category]
  const district = DISTRICT_MAP[project.category]
  const [activeNode, setActiveNode] = useState<NodeId | null>('overview')
  const [hoveredNode, setHoveredNode] = useState<NodeId | null>(null)
  const orbitRef = useRef(0)
  const [voiceLine, setVoiceLine] = useState('')

  const activeIndex = useMemo(
    () => NEURAL_NODES.findIndex((n) => n.id === activeNode),
    [activeNode],
  )

  // Update Echo voice line when active node changes.
  useEffect(() => {
    if (activeNode) {
      setVoiceLine(echoVoiceLine(activeNode, project))
    }
  }, [activeNode, project])

  const handleNodeClick = useCallback((id: NodeId) => {
    setActiveNode(id)
  }, [])

  return (
    <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, #080b14 0%, #04060a 70%, #020304 100%)' }}>
      {/* Top bar — project name + exit */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-lg py-md"
      >
        <div className="flex items-center gap-md">
          <button
            onClick={onExit}
            className="flex items-center gap-sm text-xs text-text-secondary hover:text-text transition-colors"
          >
            <ArrowLeft size={14} /> Return to City
          </button>
        </div>
        <div className="flex items-center gap-md">
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse-soft"
            style={{ backgroundColor: theme.emissive }}
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: theme.emissive }}>
            {district.shortName}
          </span>
          <span className="text-sm font-medium text-text">{project.name}</span>
        </div>
        <button
          onClick={onExit}
          className="text-text-secondary hover:text-text transition-colors"
        >
          <X size={18} />
        </button>
      </motion.div>

      {/* 3D Scene */}
      <Canvas
        dpr={[1, 1.8]}
        camera={{ position: [0, 3, 16], fov: 50 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={0.2} />
        <pointLight position={[0, 0, 0]} intensity={0.8} color={theme.emissive} distance={20} />

        <Suspense fallback={null}>
          <GridFloor />
          <AmbientParticles count={150} />

          <HolographicCore color={theme.emissive} />

          <EnergyLines
            orbitRotation={orbitRef.current}
            activeId={activeNode}
            hoveredId={hoveredNode}
          />

          {NEURAL_NODES.map((def, i) => (
            <NeuralNode
              key={def.id}
              def={def}
              index={i}
              orbitRotation={orbitRef.current}
              active={activeNode === def.id}
              hovered={hoveredNode === def.id}
              onHover={setHoveredNode}
              onClick={handleNodeClick}
            />
          ))}

          <OrbitController activeIndex={activeIndex >= 0 ? activeIndex : 0} orbitRef={orbitRef} />
        </Suspense>
      </Canvas>

      {/* Bottom hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.6 }}
        className="absolute bottom-lg left-1/2 -translate-x-1/2 z-20 flex items-center gap-md text-xs text-text-secondary"
      >
        <span className="font-mono">Click a node to explore</span>
        <span className="text-border">·</span>
        <span className="font-mono">Hover to preview</span>
      </motion.div>

      {/* Content panel */}
      <AnimatePresence mode="wait">
        {activeNode && (
          <ContentPanel
            key={activeNode}
            nodeId={activeNode}
            project={project}
            voiceLine={voiceLine}
            onClose={() => setActiveNode(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
