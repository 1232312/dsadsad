/**
 * City atmosphere — ambient decoration for Reboot City.
 *
 * Inspired by mauriciopoppe/Three.js-City (road networks, traffic, camera) and
 * YusufEminoglu/planx_3d_city (grid streets, varied building shapes, urban
 * furniture, merged geometry). Pushed to a cyberpunk extreme.
 */
import { useMemo, useRef, useLayoutEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles, Cloud, Float, Billboard, Text, Stars } from '@react-three/drei'
import * as THREE from 'three'

// ---- Sky dome with gradient shader ------------------------------------- //

export function SkyDome() {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color('#02040a') },
        midColor: { value: new THREE.Color('#0a0e1f') },
        horizonColor: { value: new THREE.Color('#102a3a') },
        glowColor: { value: new THREE.Color('#3DD8FF') },
        time: { value: 0 },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 horizonColor;
        uniform vec3 glowColor;
        uniform float time;
        varying vec3 vWorldPos;
        void main() {
          vec3 dir = normalize(vWorldPos);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.4, h));
          col = mix(col, topColor, smoothstep(0.4, 0.9, h));
          // horizon glow band
          float band = exp(-abs(dir.y - 0.02) * 8.0);
          col += glowColor * band * 0.15;
          // subtle aurora shimmer
          float aurora = sin(dir.x * 3.0 + time * 0.3) * sin(dir.z * 2.0 + time * 0.2) * 0.5 + 0.5;
          aurora *= smoothstep(0.05, 0.25, h) * smoothstep(0.5, 0.25, h);
          col += vec3(0.0, 0.3, 0.5) * aurora * 0.08;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  }, [])

  useFrame((state) => {
    material.uniforms.time.value = state.clock.elapsedTime
  })

  return (
    <mesh material={material}>
      <sphereGeometry args={[400, 32, 32]} />
    </mesh>
  )
}

// ---- Central Reboot Tower — multi-tier + antenna ----------------------- //

function TowerCore() {
  const heartRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const ring1 = useRef<THREE.Mesh>(null)
  const ring2 = useRef<THREE.Mesh>(null)
  const ring3 = useRef<THREE.Mesh>(null)
  const beaconRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (heartRef.current) heartRef.current.scale.setScalar(1 + Math.sin(t * 2.2) * 0.07)
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.08 + Math.sin(t * 1.5) * 0.04
    }
    if (ring1.current) ring1.current.rotation.z = t * 0.3
    if (ring2.current) { ring2.current.rotation.z = -t * 0.4; ring2.current.rotation.x = Math.PI / 3 }
    if (ring3.current) { ring3.current.rotation.z = t * 0.25; ring3.current.rotation.y = Math.PI / 4 }
    if (beaconRef.current) {
      const mat = beaconRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.5 + Math.sin(t * 4) * 0.5
    }
  })

  return (
    <group>
      {/* Tiered base platform */}
      <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[8, 8, 0.4, 32]} />
        <meshStandardMaterial color="#0d111a" roughness={0.4} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[7.6, 8, 64]} />
        <meshBasicMaterial color="#3DD8FF" transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[6, 7, 0.3, 32]} />
        <meshStandardMaterial color="#0a0e16" roughness={0.3} metalness={0.85} />
      </mesh>

      {/* Tier 1 — wide base section */}
      <mesh position={[0, 5, 0]}>
        <cylinderGeometry args={[2.2, 3.0, 9, 6, 1, true]} />
        <meshStandardMaterial color="#0a1020" roughness={0.1} metalness={0.9} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 5, 0]}>
        <cylinderGeometry args={[2.22, 3.02, 9, 6, 1, true]} />
        <meshBasicMaterial color="#3DD8FF" transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Tier 1 neon trim */}
      <mesh position={[0, 9.5, 0]}>
        <cylinderGeometry args={[2.25, 2.25, 0.12, 6]} />
        <meshBasicMaterial color="#3DD8FF" />
      </mesh>

      {/* Tier 2 — middle section, narrower */}
      <mesh position={[0, 14.5, 0]}>
        <cylinderGeometry args={[1.5, 2.2, 10, 6, 1, true]} />
        <meshStandardMaterial color="#0a1020" roughness={0.1} metalness={0.9} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 14.5, 0]}>
        <cylinderGeometry args={[1.52, 2.22, 10, 6, 1, true]} />
        <meshBasicMaterial color="#FFB547" transparent opacity={0.07} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 19.5, 0]}>
        <cylinderGeometry args={[1.55, 1.55, 0.12, 6]} />
        <meshBasicMaterial color="#FFB547" />
      </mesh>

      {/* Tier 3 — top spire section */}
      <mesh position={[0, 22, 0]}>
        <cylinderGeometry args={[0.8, 1.5, 5, 6, 1, true]} />
        <meshStandardMaterial color="#0a1020" roughness={0.1} metalness={0.9} transparent opacity={0.65} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 22, 0]}>
        <cylinderGeometry args={[0.82, 1.52, 5, 6, 1, true]} />
        <meshBasicMaterial color="#3DD8FF" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Antenna spire */}
      <mesh position={[0, 27.5, 0]}>
        <cylinderGeometry args={[0.08, 0.3, 6, 8]} />
        <meshStandardMaterial color="#1a2030" roughness={0.2} metalness={0.9} />
      </mesh>
      {/* Beacon on top */}
      <mesh ref={beaconRef} position={[0, 31, 0]}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshBasicMaterial color="#ff2244" transparent opacity={0.8} />
      </mesh>
      <pointLight position={[0, 31, 0]} color="#ff2244" intensity={2} distance={30} />

      {/* Glowing heart inside tier 2 */}
      <mesh ref={heartRef} position={[0, 14.5, 0]}>
        <sphereGeometry args={[1.2, 16, 16]} />
        <meshStandardMaterial color="#ff4488" emissive="#ff2266" emissiveIntensity={2.5} transparent opacity={0.85} />
      </mesh>
      <mesh ref={glowRef} position={[0, 14.5, 0]}>
        <sphereGeometry args={[3, 16, 16]} />
        <meshBasicMaterial color="#ff2266" transparent opacity={0.1} depthWrite={false} />
      </mesh>

      {/* Light pillars */}
      <mesh position={[0, 24.5, 0]}>
        <cylinderGeometry args={[0.1, 1.0, 10, 12, 1, true]} />
        <meshBasicMaterial color="#3DD8FF" transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 14.5, 0]}>
        <cylinderGeometry args={[0.15, 0.8, 14, 12, 1, true]} />
        <meshBasicMaterial color="#3DD8FF" transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Orbit rings at different tiers */}
      <mesh ref={ring1} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[5, 0.06, 8, 64]} />
        <meshBasicMaterial color="#3DD8FF" transparent opacity={0.35} />
      </mesh>
      <mesh ref={ring2} position={[0, 16, 0]}>
        <torusGeometry args={[4, 0.05, 8, 64]} />
        <meshBasicMaterial color="#FFB547" transparent opacity={0.3} />
      </mesh>
      <mesh ref={ring3} position={[0, 22, 0]}>
        <torusGeometry args={[2.5, 0.04, 8, 64]} />
        <meshBasicMaterial color="#3DD8FF" transparent opacity={0.3} />
      </mesh>

      {/* Particles */}
      <Sparkles count={40} scale={12} size={2} speed={0.25} color="#3DD8FF" opacity={0.4} position={[0, 10, 0]} />
      <Sparkles count={20} scale={8} size={1.5} speed={0.3} color="#FFB547" opacity={0.3} position={[0, 18, 0]} />

      {/* Lights */}
      <pointLight position={[0, 14.5, 0]} color="#ff2266" intensity={1.5} distance={35} />
      <pointLight position={[0, 5, 0]} color="#3DD8FF" intensity={0.8} distance={50} />
    </group>
  )
}

export function RebootTower() {
  return (
    <group>
      <TowerCore />
      <Billboard position={[0, 24, 0]}>
        <Text
          fontSize={2.4}
          color="#FFFFFF"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.06}
          outlineColor="#3DD8FF"
          outlineOpacity={0.7}
        >
          REBOOT
        </Text>
      </Billboard>
    </group>
  )
}

// ---- Grid road network -------------------------------------------------- //

export function RoadGrid({ halfExtent = 70, cellSize = 14 }: { halfExtent?: number; cellSize?: number }) {
  const roads = useMemo(() => {
    const lines: { pos: [number, number, number]; size: [number, number] }[] = []
    const count = Math.floor((halfExtent * 2) / cellSize)
    for (let i = 0; i <= count; i++) {
      const pos = -halfExtent + i * cellSize
      // Roads along X
      lines.push({ pos: [0, 0.02, pos], size: [halfExtent * 2 + cellSize, 1.8] })
      // Roads along Z
      lines.push({ pos: [pos, 0.02, 0], size: [1.8, halfExtent * 2 + cellSize] })
    }
    return lines
  }, [halfExtent, cellSize])

  return (
    <group>
      {roads.map((r, i) => (
        <mesh key={i} position={r.pos} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={r.size} />
          <meshStandardMaterial color="#0c1219" roughness={0.7} metalness={0.3} transparent opacity={0.85} />
        </mesh>
      ))}
      {/* Neon center lines — thin glowing strips on main avenues */}
      {roads.filter((_, i) => i % 2 === 0).map((r, i) => (
        <mesh key={`neon-${i}`} position={[r.pos[0], 0.03, r.pos[2]]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[r.size[0] > r.size[1] ? r.size[0] : 0.08, r.size[1] > r.size[0] ? r.size[1] : 0.08]} />
          <meshBasicMaterial color="#3DD8FF" transparent opacity={0.1} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

// ---- Animated traffic cars on the grid ----------------------------------- //

interface CarData {
  axis: 'x' | 'z'
  lane: number
  pos: number
  speed: number
  color: string
}

export function TrafficSystem({ count = 30 }: { count?: number }) {
  const CELL = 14
  const HALF = 70
  const cars = useMemo<CarData[]>(() => {
    const colors = ['#3DD8FF', '#FFB547', '#FFB547', '#3BFF91', '#FF5C8A']
    return Array.from({ length: count }, (_, i) => ({
      axis: i % 2 === 0 ? 'x' : 'z',
      lane: -HALF + Math.floor(Math.random() * 11) * CELL,
      pos: -HALF + Math.random() * HALF * 2,
      speed: (4 + Math.random() * 8) * (Math.random() > 0.5 ? 1 : -1),
      color: colors[i % colors.length],
    }))
  }, [count])

  const refs = useRef<(THREE.Group | null)[]>([])

  useFrame((_, delta) => {
    cars.forEach((c, i) => {
      c.pos += c.speed * delta
      if (c.pos > HALF) c.pos = -HALF
      if (c.pos < -HALF) c.pos = HALF
      const g = refs.current[i]
      if (g) {
        if (c.axis === 'x') {
          g.position.set(c.pos, 0.35, c.lane)
          g.rotation.y = c.speed > 0 ? Math.PI / 2 : -Math.PI / 2
        } else {
          g.position.set(c.lane, 0.35, c.pos)
          g.rotation.y = c.speed > 0 ? 0 : Math.PI
        }
      }
    })
  })

  return (
    <group>
      {cars.map((c, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el }}>
          <mesh>
            <boxGeometry args={[1.2, 0.4, 0.6]} />
            <meshStandardMaterial color={c.color} roughness={0.3} metalness={0.7} emissive={c.color} emissiveIntensity={0.4} />
          </mesh>
          {/* Headlight glow */}
          <mesh position={[0, 0, 0.35]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial color="#fff8e0" />
          </mesh>
          {/* Tail light */}
          <mesh position={[0, 0, -0.35]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshBasicMaterial color="#ff3333" />
          </mesh>
          {/* Light trail behind car */}
          <mesh position={[0, 0, -0.8]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.15, 1.2]} />
            <meshBasicMaterial color={c.color} transparent opacity={0.25} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---- Sweeping searchlights from tower ----------------------------------- //

export function Searchlights() {
  const lights = useMemo(
    () => [
      { baseAngle: 0, speed: 0.3, color: '#3DD8FF' },
      { baseAngle: Math.PI * 0.67, speed: -0.25, color: '#FFB547' },
      { baseAngle: Math.PI * 1.33, speed: 0.35, color: '#FFB547' },
    ],
    [],
  )

  const refs = useRef<(THREE.Group | null)[]>([])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    lights.forEach((l, i) => {
      const g = refs.current[i]
      if (g) {
        g.rotation.y = l.baseAngle + Math.sin(t * l.speed) * 0.6
        const cone = g.children[0] as THREE.Mesh
        if (cone) {
          const mat = cone.material as THREE.MeshBasicMaterial
          mat.opacity = 0.04 + Math.abs(Math.sin(t * l.speed * 2)) * 0.03
        }
      }
    })
  })

  return (
    <group position={[0, 30, 0]}>
      {lights.map((l, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el }}>
          <mesh position={[0, -15, 0]}>
            <coneGeometry args={[8, 30, 16, 1, true]} />
            <meshBasicMaterial color={l.color} transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---- Rain particle system ----------------------------------------------- //

export function Rain({ count = 2000 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 200
      arr[i * 3 + 1] = Math.random() * 80
      arr[i * 3 + 2] = (Math.random() - 0.5) * 200
    }
    return arr
  }, [count])

  useFrame((_, delta) => {
    if (!ref.current) return
    const pos = ref.current.geometry.attributes.position as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] -= delta * 25
      if (arr[i * 3 + 1] < 0) {
        arr[i * 3 + 1] = 80
        arr[i * 3] = (Math.random() - 0.5) * 200
        arr[i * 3 + 2] = (Math.random() - 0.5) * 200
      }
    }
    pos.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#3DD8FF" size={0.15} transparent opacity={0.3} sizeAttenuation />
    </points>
  )
}

// ---- Data streams rising from buildings --------------------------------- //

export function DataStreams({ count = 40 }: { count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const streams = useMemo(
    () => Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 120,
      z: (Math.random() - 0.5) * 120,
      speed: 3 + Math.random() * 5,
      offset: Math.random() * 20,
    })),
    [count],
  )

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    streams.forEach((s, i) => {
      const y = ((t * s.speed + s.offset) % 30)
      dummy.position.set(s.x, y, s.z)
      dummy.scale.set(0.5, 3, 0.5)
      dummy.updateMatrix()
      ref.current!.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#3DD8FF" transparent opacity={0.15} depthWrite={false} />
    </instancedMesh>
  )
}

// ---- District ground glow zones ----------------------------------------- //

interface DistrictZone { angle: number; color: string }

export function DistrictGroundGlow({ zones }: { zones: DistrictZone[] }) {
  return (
    <group position={[0, 0.04, 0]}>
      {zones.map((z, i) => {
        const r = 38
        return (
          <mesh key={i} position={[Math.cos(z.angle) * r, 0, Math.sin(z.angle) * r]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[10, 32]} />
            <meshBasicMaterial color={z.color} transparent opacity={0.06} depthWrite={false} />
          </mesh>
        )
      })}
    </group>
  )
}

// ---- Drones ------------------------------------------------------------- //

interface DroneData { angle: number; radius: number; speed: number; height: number; color: string }

export function Drones() {
  const colors = ['#3DD8FF', '#FFB547', '#FFB547']
  const drones = useMemo<DroneData[]>(
    () => Array.from({ length: 8 }, (_, i) => ({
      angle: (i / 8) * Math.PI * 2,
      radius: 50 + i * 7,
      speed: 0.04 + i * 0.01,
      height: 25 + i * 3,
      color: colors[i % 3],
    })),
    [],
  )
  const refs = useRef<(THREE.Group | null)[]>([])

  useFrame((_, delta) => {
    drones.forEach((d, i) => {
      d.angle += d.speed * delta
      const g = refs.current[i]
      if (g) g.position.set(Math.cos(d.angle) * d.radius, d.height, Math.sin(d.angle) * d.radius)
    })
  })

  return (
    <group>
      {drones.map((d, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el }}>
          <mesh>
            <boxGeometry args={[0.3, 0.12, 0.3]} />
            <meshBasicMaterial color={d.color} />
          </mesh>
          <pointLight color={d.color} intensity={0.25} distance={4} />
        </group>
      ))}
    </group>
  )
}

// ---- Hover traffic on highway ring -------------------------------------- //

export function HoverTraffic() {
  const RADIUS = 52
  const COUNT = 8
  const refs = useRef<(THREE.Group | null)[]>([])

  useFrame((_, delta) => {
    refs.current.forEach((g, i) => {
      if (!g) return
      const data = g.userData as { angle: number }
      data.angle += 0.2 * delta
      const a = data.angle
      g.position.set(Math.cos(a) * RADIUS, 8, Math.sin(a) * RADIUS)
      g.rotation.y = -a + Math.PI / 2
    })
  })

  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 8, 0]}>
        <ringGeometry args={[RADIUS - 0.25, RADIUS + 0.25, 128]} />
        <meshBasicMaterial color="#3DD8FF" transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {Array.from({ length: COUNT }).map((_, i) => (
        <group key={i} ref={(el) => { if (el) { el.userData = { angle: (i / COUNT) * Math.PI * 2 }; refs.current[i] = el } }}>
          <mesh>
            <boxGeometry args={[0.5, 0.2, 1.0]} />
            <meshStandardMaterial color="#3DD8FF" emissive="#3DD8FF" emissiveIntensity={0.5} roughness={0.3} metalness={0.7} />
          </mesh>
          <mesh position={[0, 0, 0.6]}>
            <sphereGeometry args={[0.1, 6, 6]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---- Animated building windows ------------------------------------------ //

const windowTextureCache = new Map<string, THREE.CanvasTexture>()

function makeWindowTexture(emissive: string, seed: number): THREE.CanvasTexture {
  const key = `${emissive}-${seed}`
  const cached = windowTextureCache.get(key)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = 128; canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#04060a'; ctx.fillRect(0, 0, 128, 256)
  const cols = 4, rows = 8
  const cellW = 128 / cols, cellH = 256 / rows
  let s = seed * 9301 + 49297
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rand() > 0.5
      ctx.fillStyle = lit ? emissive : '#0a0d14'
      ctx.globalAlpha = lit ? 0.45 + rand() * 0.4 : 1
      ctx.fillRect(c * cellW + 2, r * cellH + 3, cellW - 4, cellH - 6)
    }
  }
  ctx.globalAlpha = 1
  const tex = new THREE.CanvasTexture(canvas); tex.needsUpdate = true
  windowTextureCache.set(key, tex)
  return tex
}

export function BuildingWindows({
  emissive,
  seed,
  width = 1,
  height = 1,
}: {
  emissive: string
  seed: number
  width?: number
  height?: number
}) {
  const tex = useMemo(() => makeWindowTexture(emissive, seed), [emissive, seed])
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  useFrame((state) => {
    if (matRef.current) matRef.current.opacity = 0.7 + Math.sin(state.clock.elapsedTime * 0.5 + seed) * 0.1
  })
  return (
    <group>
      <mesh position={[0, 0, width / 2 + 0.025]}>
        <planeGeometry args={[width * 0.78, height * 0.78]} />
        <meshBasicMaterial ref={matRef} map={tex} transparent opacity={0.75} depthWrite={false} />
      </mesh>
      <mesh position={[width / 2 + 0.025, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[width * 0.78, height * 0.78]} />
        <meshBasicMaterial map={tex} transparent opacity={0.52} depthWrite={false} />
      </mesh>
    </group>
  )
}

// ---- Varied background skyline ------------------------------------------ //

export function VariedSkyline({ count = 500 }: { count?: number }) {
  const buildingsRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const data = useMemo(() => {
    return Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2
      const r = 85 + Math.random() * 90
      const x = Math.cos(angle) * r
      const z = Math.sin(angle) * r
      const height = Math.pow(Math.random(), 2.5) * 70 + 10
      const w = 3 + Math.random() * 6
      return { x, z, height, w }
    })
  }, [count])

  useLayoutEffect(() => {
    if (!buildingsRef.current) return
    data.forEach((b, i) => {
      dummy.position.set(b.x, b.height / 2, b.z)
      dummy.scale.set(b.w, b.height, b.w)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      buildingsRef.current!.setMatrixAt(i, dummy.matrix)
    })
    buildingsRef.current.instanceMatrix.needsUpdate = true
  }, [data, dummy])

  return (
    <group>
      <instancedMesh ref={buildingsRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#0a0d14" roughness={0.85} metalness={0.5} />
      </instancedMesh>
    </group>
  )
}

// ---- Floating clouds ---------------------------------------------------- //

export function FloatingClouds() {
  return (
    <group position={[0, 55, 0]}>
      <Cloud position={[-40, 4, -30]} speed={0.15} opacity={0.05} color="#3DD8FF" segments={16} bounds={[28, 3, 28]} />
      <Cloud position={[45, 8, 20]} speed={0.12} opacity={0.04} color="#FFB547" segments={16} bounds={[28, 3, 28]} />
      <Cloud position={[0, -4, 50]} speed={0.14} opacity={0.04} color="#3DD8FF" segments={14} bounds={[30, 3, 30]} />
    </group>
  )
}

// ---- Stars -------------------------------------------------------------- //

export function NightStars() {
  return <Stars radius={380} depth={60} count={1800} factor={4} saturation={0} fade speed={0.4} />
}
