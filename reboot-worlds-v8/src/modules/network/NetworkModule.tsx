/**
 * Network module — projects as connected nodes, relationships as edges.
 *
 * Layout is computed once with a simple radial grouping by category, then
 * relaxed a few iterations with a repulsion / spring model for readability.
 * The visualization is a 3D graph with glowing edges. Fully independent.
 */
import { useMemo, useRef, useState, useCallback, Suspense } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import { motion, AnimatePresence } from 'framer-motion'
import { Network as NetworkIcon, X } from 'lucide-react'
import { useProjects } from '@/stores/auth'
import { useUI } from '@/stores/ui'
import { CATEGORY_THEME, DISTRICT_MAP, type Project } from '@/types/project'

interface NetNode {
  project: Project
  position: [number, number, number]
}

/** Radial-by-category initial layout + a few relaxation iterations. */
function layoutNetwork(projects: Project[]): { nodes: NetNode[]; edges: [number, number][] } {
  const byCategory = new Map<string, Project[]>()
  for (const p of projects) {
    const list = byCategory.get(p.category) ?? []
    list.push(p)
    byCategory.set(p.category, list)
  }
  const cats = [...byCategory.keys()]
  const positions = new Map<string, [number, number, number]>()

  // Initial: each category gets a sector; projects spread within it.
  cats.forEach((cat, ci) => {
    const sectorAngle = (ci / cats.length) * Math.PI * 2
    const list = byCategory.get(cat)!
    list.forEach((p, pi) => {
      const localAngle = sectorAngle + (pi / list.length) * (Math.PI * 2 / cats.length)
      const r = 14 + (p.stage / 5) * 10
      positions.set(p.id, [Math.cos(localAngle) * r, (pi % 3 - 1) * 4, Math.sin(localAngle) * r])
    })
  })

  // Build edge list from connections.
  const idIndex = new Map(projects.map((p, i) => [p.id, i]))
  const edges: [number, number][] = []
  projects.forEach((p, i) => {
    for (const connId of p.connections) {
      const j = idIndex.get(connId)
      if (j !== undefined && j > i) edges.push([i, j])
    }
  })

  // Relax: repulsion between all nodes + spring along edges.
  const pos = projects.map((p) => positions.get(p.id)!.slice() as [number, number, number])
  const iterations = 40
  for (let it = 0; it < iterations; it++) {
    const forces = projects.map(() => [0, 0, 0] as [number, number, number])
    // Repulsion
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const dx = pos[i][0] - pos[j][0]
        const dy = pos[i][1] - pos[j][1]
        const dz = pos[i][2] - pos[j][2]
        const d2 = dx * dx + dy * dy + dz * dz + 0.01
        const f = 8 / d2
        const d = Math.sqrt(d2)
        forces[i][0] += (dx / d) * f
        forces[i][1] += (dy / d) * f
        forces[i][2] += (dz / d) * f
        forces[j][0] -= (dx / d) * f
        forces[j][1] -= (dy / d) * f
        forces[j][2] -= (dz / d) * f
      }
    }
    // Springs
    for (const [a, b] of edges) {
      const dx = pos[b][0] - pos[a][0]
      const dy = pos[b][1] - pos[a][1]
      const dz = pos[b][2] - pos[a][2]
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01
      const target = 12
      const f = (d - target) * 0.1
      forces[a][0] += (dx / d) * f
      forces[a][1] += (dy / d) * f
      forces[a][2] += (dz / d) * f
      forces[b][0] -= (dx / d) * f
      forces[b][1] -= (dy / d) * f
      forces[b][2] -= (dz / d) * f
    }
    // Apply
    for (let i = 0; i < pos.length; i++) {
      pos[i][0] += forces[i][0] * 0.5
      pos[i][1] += forces[i][1] * 0.5
      pos[i][2] += forces[i][2] * 0.5
    }
  }

  const nodes = projects.map((p, i) => ({ project: p, position: pos[i] }))
  return { nodes, edges }
}

function NetNodeMesh({
  node,
  hovered,
  onHover,
  onSelect,
}: {
  node: NetNode
  hovered: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}) {
  const theme = CATEGORY_THEME[node.project.category]
  const ref = useRef<THREE.Mesh>(null)
  const scale = 0.5 + (node.project.stage / 5) * 0.8

  useFrame((state) => {
    if (ref.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.5 + node.project.stage) * 0.06
      ref.current.scale.setScalar(scale * pulse * (hovered ? 1.5 : 1))
    }
  })

  return (
    <group position={node.position}>
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
        <sphereGeometry args={[1, 20, 20]} />
        <meshStandardMaterial
          color={theme.emissive}
          emissive={theme.emissive}
          emissiveIntensity={hovered ? 1.2 : 0.6}
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>
      {hovered && (
        <Html position={[0, 2, 0]} center distanceFactor={18}>
          <div className="glass-strong px-md py-sm rounded-lg whitespace-nowrap pointer-events-none gpu">
            <div className="text-xs font-medium text-text">{node.project.name}</div>
            <div className="text-[10px] text-text-secondary mt-0.5">
              {DISTRICT_MAP[node.project.category].shortName} · Stage {node.project.stage}
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

function Edges({ nodes, edges }: { nodes: NetNode[]; edges: [number, number][] }) {
  const geometry = useMemo(() => {
    const positions: number[] = []
    for (const [a, b] of edges) {
      positions.push(...nodes[a].position, ...nodes[b].position)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geo
  }, [nodes, edges])

  if (edges.length === 0) return null
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#3DD8FF" transparent opacity={0.35} />
    </lineSegments>
  )
}

export function NetworkModule() {
  const all = useProjects((s) => s.projects)
  const loading = useProjects((s) => s.loading)
  const selectProject = useUI((s) => s.selectProject)
  const selectedProjectId = useUI((s) => s.selectedProjectId)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const { nodes, edges } = useMemo(() => layoutNetwork(all), [all])
  const selected = useMemo(
    () => all.find((p) => p.id === selectedProjectId) ?? null,
    [all, selectedProjectId],
  )

  const onSelect = useCallback((id: string) => selectProject(id), [selectProject])

  if (loading && all.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="font-mono text-xs text-text-secondary animate-pulse-soft">Mapping Network...</div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 bg-gradient-to-b from-[#06080c] to-[#0a0e16]">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="absolute top-lg left-1/2 -translate-x-1/2 z-20 glass px-lg py-sm rounded-lg flex items-center gap-sm"
      >
        <NetworkIcon size={14} className="text-primary" />
        <span className="text-xs text-text-secondary">
          Network · {all.length} projects · {edges.length} connections
        </span>
      </motion.div>

      <Canvas
        dpr={[1, 1.8]}
        camera={{ position: [0, 20, 50], fov: 50 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[0, 30, 0]} intensity={0.4} color="#3DD8FF" distance={80} />

        <Suspense fallback={null}>
          <Edges nodes={nodes} edges={edges} />
          {nodes.map((n) => (
            <NetNodeMesh
              key={n.project.id}
              node={n}
              hovered={hoveredId === n.project.id}
              onHover={setHoveredId}
              onSelect={onSelect}
            />
          ))}
        </Suspense>

        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minDistance={20}
          maxDistance={100}
          enableDamping
          dampingFactor={0.08}
          autoRotate
          autoRotateSpeed={0.3}
        />
      </Canvas>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-2xl left-1/2 -translate-x-1/2 z-20 w-[380px] max-w-[calc(100vw-2rem)]"
          >
            <div className="glass-strong p-lg rounded-lg">
              <div className="flex items-start justify-between mb-md">
                <div>
                  <div
                    className="label-mono mb-1"
                    style={{ color: CATEGORY_THEME[selected.category].emissive }}
                  >
                    {DISTRICT_MAP[selected.category].name}
                  </div>
                  <h3 className="text-lg font-medium text-text">{selected.name}</h3>
                  <p className="text-xs text-text-secondary mt-1">{selected.tagline}</p>
                </div>
                <button
                  onClick={() => selectProject(null)}
                  className="text-text-secondary hover:text-text transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex items-center gap-md text-xs text-text-secondary">
                <span>Stage {selected.stage}/5</span>
                <span>·</span>
                <span>{selected.connections.length} connections</span>
                <span>·</span>
                <span>{selected.followers.toLocaleString()} followers</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
