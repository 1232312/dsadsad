/**
 * MiniatureWorlds — the Reboot "worlds inside a planet" scene.
 *
 * One large glowing planet shell with five cutaway windows. Through each
 * window a miniature diorama is visible: a futuristic city, a lush forest,
 * an icy tundra, a desert, and the abandoned world — which gradually lights
 * up as Reboot projects are revived.
 *
 * Craft techniques adapted from japanese-miniature-scenes:
 *  - soft radial-gradient sprite particles (snow, steam, fireflies, leaves)
 *  - rising steam puffs over warm water
 *  - cone-over-cone snow caps on stylized trees/spikes
 *  - toon materials for the diorama props
 *  - warm lantern and storefront glow as the heart of each scene
 * Shell and atmosphere from threejs-procedural-planets.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Float, Html, Lightformer, OrbitControls, Sparkles, Stars } from '@react-three/drei'
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useCityData } from './CityModule'
import type { CityProject } from './CityModule'

const R_SHELL = 60
const R_WORLD = 29
const DISC_R = 11
const WIN_PHI = 0.63
const WIN_THETA_START = 1.26
const WIN_THETA_END = 1.88

// ---- helpers ------------------------------------------------------------- //

function seeded(key: string, index = 0): number {
  let h = 2166136261 ^ index
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i) + (h << 6) + (h >> 2)
  }
  h = Math.imul(h ^ (h >>> 15), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return ((h ^= h >>> 16) >>> 0) / 4294967296
}

function onSphere(angle: number, lat: number, radius: number): THREE.Vector3 {
  return new THREE.Vector3(
    Math.cos(lat) * Math.cos(angle) * radius,
    Math.sin(lat) * radius,
    Math.cos(lat) * Math.sin(angle) * radius,
  )
}

/** Soft radial-gradient sprite (the repo's flake/paint technique). */
function makeSoftSprite(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.5, 'rgba(255,255,255,.7)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Window texture for instanced mini-towers (CityGlow technique). */
function makeWindowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#070b13'
  ctx.fillRect(0, 0, 64, 128)
  const cols = 4
  const rows = 10
  const cw = 64 / cols
  const ch = 128 / rows
  const palette = ['#9fe8ff', '#ffd9a0', '#c9f4ff', '#89b8ff']
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const on = seeded(`tw-${r}-${c}`, r * 31 + c) < 0.55
      ctx.fillStyle = on
        ? palette[Math.floor(seeded(`tc-${r}-${c}`, r + c * 7) * palette.length)]
        : '#101826'
      const pad = cw * 0.24
      ctx.fillRect(c * cw + pad, r * ch + pad * 0.8, cw - pad * 2, ch - pad * 1.6)
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

interface WindowSpec {
  phiCenter: number
}
const WINDOWS: WindowSpec[] = Array.from({ length: 6 }, (_, i) => ({
  phiCenter: (i / 5) * Math.PI * 2,
}))

const WORLD_ORDER = ['city', 'forest', 'ice', 'desert', 'ruins', 'zero'] as const
type WorldKind = (typeof WORLD_ORDER)[number]

const WORLD_META: Record<WorldKind, { name: string; color: string; desc: string }> = {
  city: {
    name: 'Neo District',
    color: '#3DD8FF',
    desc: 'Where revived ideas live and work. Every lit tower and window is a project that made it back — the hologram spire over the plaza is the idea currently in focus.',
  },
  forest: {
    name: 'Verdant Hollow',
    color: '#6BFFA8',
    desc: 'Ideas taking root again. New growth climbs the trees, the pond steams with fresh energy, and the fireflies are the small sparks that never quite died.',
  },
  ice: {
    name: 'Glass Tundra',
    color: '#9FD8FF',
    desc: 'Ideas preserved until their moment. Nothing here is dead — just dormant, kept under glass. The warm hut is the one project waiting to thaw first.',
  },
  desert: {
    name: 'Amber Reach',
    color: '#FFB547',
    desc: 'Ideas still searching for a spark. The campfire never goes out and the market stall stays open — abandoned, but the door is never locked.',
  },
  ruins: {
    name: 'The Fallen',
    color: '#FF5959',
    desc: 'The graveyard itself — the heart of Reboot. Dead towers relight, the cracks shift from red to cyan, and the REBOOT sign steadies as you revive more projects.',
  },
  zero: {
    name: 'Land of Zero',
    color: '#B8CCE0',
    desc: 'The archive of unseen posts — inhabited now. Archivists tend the podiums, a lamplighter warms the waiting lights, and the last courier rides the ring line past Zero Gate and the Unread Library. Every zero-view post waits, unseen not unloved. Revive one and its light comes on.',
  },
}

// ---- particles ------------------------------------------------------------ //

type MoteMode = 'bob' | 'fall' | 'rise'

/**
 * Ambient particles above a diorama disc, with soft sprite texture.
 *  bob  — gentle float (fireflies, dust motes)
 *  fall — drifting down and wrapping (snow, leaves)
 *  rise — floating up and wrapping (embers)
 */
function Motes({ count, color, size, speed, spreadY, mode = 'bob', opacity = 0.8, sway = 0.35 }: {
  count: number
  color: string
  size: number
  speed: number
  spreadY: number
  mode?: MoteMode
  opacity?: number
  sway?: number
}) {
  const ref = useRef<THREE.Points>(null)
  const sprite = useMemo(() => makeSoftSprite(), [])
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: (seeded('mx', i) - 0.5) * DISC_R * 1.7,
        y: 0.5 + seeded('my', i) * spreadY,
        z: (seeded('mz', i) - 0.5) * DISC_R * 1.7,
        phase: seeded('mp', i) * Math.PI * 2,
        rate: 0.6 + seeded('mr', i) * 0.8,
      })),
    [count, spreadY],
  )
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(seeds.map((s) => [s.x, s.y, s.z]).flat(), 3),
    )
    return geo
  }, [seeds])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const pos = ref.current?.geometry.attributes.position as THREE.BufferAttribute | undefined
    if (!pos) return
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i]
      let y = s.y
      if (mode === 'bob') {
        y += Math.sin(t * speed * s.rate + s.phase) * 0.6
      } else if (mode === 'fall') {
        y = 0.2 + ((s.y + spreadY - ((t * speed * s.rate) % spreadY)) % spreadY)
      } else if (mode === 'rise') {
        y = 0.2 + (((t * speed * s.rate) % spreadY) + s.y * 0.15) % spreadY
      }
      pos.setXYZ(
        i,
        s.x + Math.sin(t * speed * 0.6 + s.phase) * sway,
        y,
        s.z + Math.cos(t * speed * 0.4 + s.phase) * sway * 0.6,
      )
    }
    pos.needsUpdate = true
  })

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        color={color}
        size={size}
        map={sprite}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

/** One rising steam puff (mountain-onsen technique). */
function SteamPuff({ delay, x, z }: { delay: number; x: number; z: number }) {
  const ref = useRef<THREE.Sprite>(null)
  const mat = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: makeSoftSprite(),
        color: '#dfeeff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )
  useFrame((state) => {
    const cycle = 3.2
    const t = (state.clock.elapsedTime + delay) % cycle
    const p = t / cycle
    if (ref.current) {
      ref.current.position.set(x + Math.sin(p * 6 + delay) * 0.25, 0.2 + p * 3.2, z)
      const s = 0.6 + p * 1.7
      ref.current.scale.set(s, s, 1)
      mat.opacity = 0.4 * Math.sin(p * Math.PI)
    }
  })
  return <sprite ref={ref} material={mat} />
}

function Steam({ x, z, count = 9 }: { x: number; z: number; count?: number }) {
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <SteamPuff key={i} delay={(i / count) * 3.2} x={x + seeded('sx', i) * 0.8 - 0.4} z={z + seeded('sz', i) * 0.8 - 0.4} />
      ))}
    </group>
  )
}

/** A string of tiny glowing lanterns slung between two poles. */
function LanternString({ from, to, color, height = 1.6, count = 5 }: {
  from: [number, number]
  to: [number, number]
  color: string
  height?: number
  count?: number
}) {
  return (
    <group>
      {[[from[0], from[1]], [to[0], to[1]]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.8, z]}>
          <cylinderGeometry args={[0.04, 0.05, 1.6, 5]} />
          <meshStandardMaterial color="#2a2f3a" roughness={0.7} />
        </mesh>
      ))}
      {Array.from({ length: count }, (_, i) => {
        const t = (i + 1) / (count + 1)
        const x = from[0] + (to[0] - from[0]) * t
        const z = from[1] + (to[1] - from[1]) * t
        const sag = Math.sin(t * Math.PI) * height
        return (
          <group key={`l-${i}`} position={[x, 1.5 - sag * 0.3, z]}>
            <mesh>
              <sphereGeometry args={[0.12, 8, 8]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
            <pointLight color={color} intensity={0.7} distance={3.2} />
          </group>
        )
      })}
    </group>
  )
}

// ---- world contents (local space: disc top at y = 0, radius DISC_R) ------ //

function CityWorld() {
  const tex = useMemo(() => makeWindowTexture(), [])
  const towerMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#0b101c',
        emissiveMap: tex,
        emissive: '#ffffff',
        emissiveIntensity: 1.5,
        roughness: 0.8,
      }),
    [tex],
  )
  const ref = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    let i = 0
    for (let ring = 0; ring < 3; ring++) {
      const count = 7 + ring * 5
      const rad = 1.6 + ring * 2.7
      for (let k = 0; k < count && i < 26; k++) {
        const a = (k / count) * Math.PI * 2 + ring * 0.35
        const h = 1.4 + seeded(`ch-${i}`, i) * (2.6 - ring * 0.5)
        const w = 0.55 + seeded(`cw-${i}`, i) * 0.4
        dummy.position.set(Math.cos(a) * rad, h / 2, Math.sin(a) * rad)
        dummy.scale.set(w, h, w * (0.7 + seeded(`cd-${i}`, i) * 0.6))
        dummy.rotation.set(0, seeded(`cr-${i}`, i) * 0.5, 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(i++, dummy.matrix)
      }
    }
    mesh.count = i
    mesh.instanceMatrix.needsUpdate = true
  }, [])

  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, 26]} material={towerMat}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      {/* wet-gloss plaza reflecting the neon */}
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.1, 4.7, 48]} />
        <meshBasicMaterial color="#3DD8FF" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.4, 24]} />
        <meshBasicMaterial color="#3DD8FF" transparent opacity={0.25} />
      </mesh>
      {/* hologram spire over the plaza */}
      <mesh position={[0, 3.4, 0]}>
        <coneGeometry args={[0.9, 5.5, 6, 1, true]} />
        <meshBasicMaterial color="#3DD8FF" transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 5.6, 0]}>
        <octahedronGeometry args={[0.55, 0]} />
        <meshBasicMaterial color="#3DD8FF" toneMapped={false} />
      </mesh>
      {/* warm noodle-stall: the one warm heart of the neon district */}
      <group position={[-6.2, 0, 4.6]} rotation={[0, 0.7, 0]}>
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[1.9, 1.1, 1.3]} />
          <meshStandardMaterial color="#1a2233" roughness={0.6} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.55, 0.67]}>
          <planeGeometry args={[1.55, 0.62]} />
          <meshBasicMaterial color="#FFD9A0" toneMapped={false} />
        </mesh>
        <mesh position={[0, 1.18, 0]} rotation={[-0.35, 0, 0]}>
          <planeGeometry args={[2.2, 0.85]} />
          <meshStandardMaterial color="#7a3040" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
        <pointLight position={[0, 0.8, 1.4]} intensity={3} distance={4.5} color="#FFD9A0" />
      </group>
      <LanternString from={[-7.6, 6.4]} to={[-3.4, 7.8]} color="#FFB547" />
      <Motes count={26} color="#3DD8FF" size={0.2} speed={1.1} spreadY={2.6} opacity={0.7} />
    </group>
  )
}

function ForestWorld() {
  const trunks = useRef<THREE.InstancedMesh>(null)
  const canopies = useRef<THREE.InstancedMesh>(null)
  const caps = useRef<THREE.InstancedMesh>(null)
  const COUNT = 30

  useEffect(() => {
    const dummy = new THREE.Object3D()
    const trees = Array.from({ length: COUNT }, (_, i) => {
      const a = seeded('fa', i) * Math.PI * 2
      const rad = 1.2 + seeded('fr', i) * 8.6
      return {
        x: Math.cos(a) * rad,
        z: Math.sin(a) * rad,
        h: 0.9 + seeded('fh', i) * 1.3,
        s: 0.5 + seeded('fs', i) * 0.55,
      }
    })
    trees.forEach((t, i) => {
      dummy.position.set(t.x, t.h / 2, t.z)
      dummy.scale.set(1, t.h, 1)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      trunks.current?.setMatrixAt(i, dummy.matrix)

      dummy.position.set(t.x, t.h + t.s * 0.75, t.z)
      dummy.scale.set(t.s, t.s * 1.5, t.s)
      dummy.updateMatrix()
      canopies.current?.setMatrixAt(i, dummy.matrix)

      // cone-over-cone highlight tip
      dummy.position.set(t.x, t.h + t.s * 1.35, t.z)
      dummy.scale.set(t.s * 0.9, t.s * 0.5, t.s * 0.9)
      dummy.updateMatrix()
      caps.current?.setMatrixAt(i, dummy.matrix)
    })
    for (const m of [trunks, canopies, caps]) {
      if (m.current) m.current.instanceMatrix.needsUpdate = true
    }
  }, [])

  return (
    <group>
      {/* onsen-style warm pond with steam rising */}
      <mesh position={[3.3, 0.04, -3.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.3, 28]} />
        <meshStandardMaterial color="#2a7a8f" roughness={0.12} metalness={0.55} emissive="#1a5566" emissiveIntensity={0.8} />
      </mesh>
      <Steam x={3.3} z={-3.1} count={8} />
      {/* moss mounds */}
      {[[-4.4, 2.6], [4.8, 3.8], [-2.2, -5.2]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.22, z]} scale={[1, 0.32, 1]}>
          <sphereGeometry args={[1.7 + i * 0.4, 12, 8]} />
          <meshToonMaterial color="#2c5a38" />
        </mesh>
      ))}
      <instancedMesh ref={trunks} args={[undefined, undefined, COUNT]}>
        <cylinderGeometry args={[0.09, 0.14, 1, 5]} />
        <meshStandardMaterial color="#3a2a1a" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={canopies} args={[undefined, undefined, COUNT]}>
        <coneGeometry args={[0.62, 1, 6]} />
        <meshToonMaterial color="#34995a" />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, COUNT]}>
        <coneGeometry args={[0.62, 1, 6]} />
        <meshToonMaterial color="#8FE8A8" />
      </instancedMesh>
      {/* stone lantern */}
      <group position={[-4.6, 0, -2.4]}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.22, 0.28, 1, 6]} />
          <meshStandardMaterial color="#6a6f76" roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.12, 0]}>
          <boxGeometry args={[0.42, 0.34, 0.42]} />
          <meshBasicMaterial color="#FFD9A0" toneMapped={false} />
        </mesh>
        <mesh position={[0, 1.48, 0]}>
          <coneGeometry args={[0.4, 0.32, 4]} />
          <meshStandardMaterial color="#565b62" roughness={0.9} />
        </mesh>
        <pointLight position={[0, 1.12, 0]} intensity={2.4} distance={5} color="#FFD9A0" />
      </group>
      <Motes count={20} color="#BFF765" size={0.17} speed={0.9} spreadY={2.2} opacity={0.85} />
      {/* falling leaves */}
      <Motes count={16} color="#FF9E5E" size={0.22} speed={0.45} spreadY={3.2} mode="fall" opacity={0.7} sway={0.8} />
    </group>
  )
}

function IceWorld() {
  const spikes = useRef<THREE.InstancedMesh>(null)
  const caps = useRef<THREE.InstancedMesh>(null)
  const auroraRef = useRef<THREE.MeshBasicMaterial>(null)
  const COUNT = 18

  useEffect(() => {
    const dummy = new THREE.Object3D()
    for (let i = 0; i < COUNT; i++) {
      const a = seeded('ia', i) * Math.PI * 2
      const rad = 1 + seeded('ir', i) * 8.4
      const h = 0.7 + seeded('ih', i) * 2.4
      const sx = 0.5 + seeded('is', i) * 0.5
      const rot = seeded('irot', i) * 1.5
      dummy.position.set(Math.cos(a) * rad, h / 2, Math.sin(a) * rad)
      dummy.scale.set(sx, h, 0.5 + seeded('isz', i) * 0.5)
      dummy.rotation.set(0, rot, seeded('it', i) * 0.16)
      dummy.updateMatrix()
      spikes.current?.setMatrixAt(i, dummy.matrix)

      // snow cap: smaller cone riding on top (cone-over-cone technique)
      dummy.position.set(Math.cos(a) * rad, h * 0.78, Math.sin(a) * rad)
      dummy.scale.set(sx * 0.72, h * 0.4, sx * 0.72)
      dummy.rotation.set(0, rot, seeded('it', i) * 0.16)
      dummy.updateMatrix()
      caps.current?.setMatrixAt(i, dummy.matrix)
    }
    for (const m of [spikes, caps]) {
      if (m.current) m.current.instanceMatrix.needsUpdate = true
    }
  }, [])

  useFrame((state) => {
    if (auroraRef.current) {
      const t = state.clock.elapsedTime
      auroraRef.current.opacity = 0.16 + Math.sin(t * 0.7) * 0.08
    }
  })

  return (
    <group>
      <instancedMesh ref={spikes} args={[undefined, undefined, COUNT]}>
        <coneGeometry args={[1, 1, 5]} />
        <meshToonMaterial color="#7fa8c9" />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, COUNT]}>
        <coneGeometry args={[1, 1, 5]} />
        <meshToonMaterial color="#e8f2fb" />
      </instancedMesh>
      {/* aurora ribbons */}
      {[-0.8, 0.6].map((x, i) => (
        <mesh key={i} position={[x, 4.2, 0]} rotation={[0.15 * (i ? -1 : 1), 0, 0.2 * x]}>
          <planeGeometry args={[9, 3.4, 1, 1]} />
          <meshBasicMaterial
            ref={i === 0 ? auroraRef : undefined}
            color={i === 0 ? '#57F2C9' : '#7FB4FF'}
            transparent
            opacity={0.16}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* warm hut: one warm light against all that cold */}
      <group position={[5.6, 0, -4.2]} rotation={[0, -0.5, 0]}>
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[2.2, 1.2, 1.7]} />
          <meshToonMaterial color="#3d4756" />
        </mesh>
        <mesh position={[0, 1.05, 0.87]}>
          <planeGeometry args={[1.2, 0.6]} />
          <meshBasicMaterial color="#FFD9A0" toneMapped={false} />
        </mesh>
        <mesh position={[0, 1.28, 0]} scale={[1.25, 0.28, 1.05]}>
          <sphereGeometry args={[1, 10, 6]} />
          <meshToonMaterial color="#e8f2fb" />
        </mesh>
        <pointLight position={[0, 1.05, 1.6]} intensity={3} distance={6} color="#FFD9A0" />
      </group>
      <Motes count={34} color="#DFF6FF" size={0.16} speed={0.5} spreadY={3.4} mode="fall" opacity={0.75} sway={0.5} />
    </group>
  )
}

function DesertWorld() {
  return (
    <group>
      {/* dunes */}
      {[[-3.6, 2.4, 2.6], [4.2, -3.4, 3.1], [0.4, 5.2, 2.2]].map(([x, z, s], i) => (
        <mesh key={i} position={[x, 0.1, z]} scale={[1, 0.24, 0.8]}>
          <sphereGeometry args={[s, 14, 8]} />
          <meshToonMaterial color="#c99a5b" />
        </mesh>
      ))}
      {/* buried pyramid */}
      <mesh position={[-4.6, -0.4, -3.6]} rotation={[0, 0.7, 0]}>
        <coneGeometry args={[2.3, 2.6, 4]} />
        <meshToonMaterial color="#d9b06e" />
      </mesh>
      {/* cacti */}
      {[[2.6, -1.4], [5.4, 1.8], [-1.8, -5.6]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.75, 0]}>
            <capsuleGeometry args={[0.22, 1.1, 4, 8]} />
            <meshToonMaterial color="#3f7a45" />
          </mesh>
          {i !== 1 && (
            <mesh position={[0.42, 0.9, 0]} rotation={[0, 0, -Math.PI / 5]}>
              <capsuleGeometry args={[0.14, 0.55, 4, 8]} />
              <meshToonMaterial color="#3f7a45" />
            </mesh>
          )}
        </group>
      ))}
      {/* campfire */}
      <mesh position={[1.4, 0.16, 1.2]}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshBasicMaterial color="#FFB547" toneMapped={false} />
      </mesh>
      <pointLight position={[1.4, 1.1, 1.2]} intensity={7} distance={10} color="#FFB547" />
      {/* market stall with an awning and hanging lanterns */}
      <group position={[-5.8, 0, 3.8]} rotation={[0, 0.9, 0]}>
        <mesh position={[0, 0.65, 0]}>
          <boxGeometry args={[1.8, 1.3, 1.2]} />
          <meshToonMaterial color="#8f5f3a" />
        </mesh>
        <mesh position={[0, 1.05, 0.62]}>
          <planeGeometry args={[1.5, 0.5]} />
          <meshBasicMaterial color="#FFD9A0" toneMapped={false} />
        </mesh>
        <mesh position={[0, 1.42, 0]} rotation={[-0.4, 0, 0]}>
          <planeGeometry args={[2.3, 0.9]} />
          <meshToonMaterial color="#a3463b" side={THREE.DoubleSide} />
        </mesh>
        <pointLight position={[0, 1.05, 1.2]} intensity={2.6} distance={5.5} color="#FFD9A0" />
      </group>
      <LanternString from={[-7.8, 5.4]} to={[-4.2, 6.6]} color="#FFB547" />
      {/* dust motes drifting in the heat */}
      <Motes count={16} color="#FFD9A0" size={0.15} speed={0.35} spreadY={2.2} mode="rise" opacity={0.5} />
    </group>
  )
}

/** Canvas sign texture — painterly text like the repo's signage. */
function makeSignTexture(text: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 256, 64)
  ctx.font = 'bold 30px "Arial Black", Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = color
  ctx.shadowBlur = 14
  ctx.fillStyle = color
  ctx.fillText(text, 128, 34)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * The abandoned world — the Reboot identity piece. Dim red ruins that
 * gradually light up (red → cyan, more windows, brighter core) as the
 * fraction of revived projects grows.
 */
function RuinsWorld({ revival }: { revival: number }) {
  const towers = useRef<THREE.InstancedMesh>(null)
  const relit = useRef<THREE.InstancedMesh>(null)
  const crackRef = useRef<THREE.MeshBasicMaterial>(null)
  const hologramRef = useRef<THREE.MeshBasicMaterial>(null)
  const signRef = useRef<THREE.MeshBasicMaterial>(null)
  const COUNT = 12
  const signTex = useMemo(() => makeSignTexture('REBOOT', '#3DD8FF'), [])

  useEffect(() => {
    const dummy = new THREE.Object3D()
    for (let i = 0; i < COUNT; i++) {
      const a = (i / COUNT) * Math.PI * 2 + seeded('ra', i)
      const rad = 2 + seeded('rr', i) * 7.4
      const h = 1 + seeded('rh', i) * 2.6
      dummy.position.set(Math.cos(a) * rad, h / 2, Math.sin(a) * rad)
      dummy.scale.set(0.5 + seeded('rw', i) * 0.35, h, 0.5 + seeded('rd', i) * 0.35)
      dummy.rotation.set(seeded('rx', i) * 0.1 - 0.05, a, seeded('rz', i) * 0.12 - 0.06)
      dummy.updateMatrix()
      towers.current?.setMatrixAt(i, dummy.matrix)
    }
    if (towers.current) towers.current.instanceMatrix.needsUpdate = true

    const mesh = relit.current
    if (mesh) {
      const litCount = Math.max(1, Math.round(COUNT * revival))
      for (let i = 0; i < litCount; i++) {
        const a = (i / COUNT) * Math.PI * 2 + seeded('ra', i)
        const rad = 2 + seeded('rr', i) * 7.4
        dummy.position.set(Math.cos(a) * rad, 0.9 + seeded('rh', i) * 1.4, Math.sin(a) * rad)
        dummy.scale.setScalar(0.16 + revival * 0.2)
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.count = litCount
      mesh.instanceMatrix.needsUpdate = true
    }
  }, [revival])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const c = new THREE.Color('#FF5959').lerp(new THREE.Color('#3DD8FF'), revival)
    if (crackRef.current) {
      crackRef.current.color.copy(c)
      crackRef.current.opacity = 0.3 + revival * 0.5 + Math.sin(t * 2.2) * 0.08
    }
    if (hologramRef.current) {
      hologramRef.current.opacity = revival * 0.4 * (0.8 + Math.sin(t * 1.6) * 0.2)
    }
    if (signRef.current) {
      // sputtering sign that steadies as the world revives
      const sputter = (t * 3 + Math.sin(t * 7.3) * 2) % 4 < (1 - revival) * 1.4 ? 0.15 : 1
      signRef.current.opacity = (0.15 + revival * 0.85) * sputter
    }
  })

  return (
    <group>
      {/* cracked dead ground */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[DISC_R - 0.4, 6]} />
        <meshToonMaterial color="#171320" />
      </mesh>
      {/* faint cracks glowing with the revival color */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.6, 3.9, 6]} />
        <meshBasicMaterial
          ref={crackRef}
          color="#FF5959"
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* ruins */}
      <instancedMesh ref={towers} args={[undefined, undefined, COUNT]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#241d2b" roughness={0.95} metalness={0.2} flatShading />
      </instancedMesh>
      {/* windows coming back online */}
      <instancedMesh ref={relit} args={[undefined, undefined, COUNT]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial color="#3DD8FF" toneMapped={false} />
      </instancedMesh>
      {/* reboot hologram column */}
      <mesh position={[0, 3.2, 0]}>
        <cylinderGeometry args={[1.3, 0.15, 6, 12, 1, true]} />
        <meshBasicMaterial
          ref={hologramRef}
          color="#3DD8FF"
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* sputtering REBOOT sign on two posts */}
      <group position={[-4.4, 0, 4.4]} rotation={[0, 0.55, 0]}>
        {[-0.9, 0.9].map((x) => (
          <mesh key={x} position={[x, 0.55, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 1.1, 5]} />
            <meshStandardMaterial color="#2a2f3a" roughness={0.8} />
          </mesh>
        ))}
        <mesh position={[0, 1.25, 0]}>
          <planeGeometry args={[2.1, 0.55]} />
          <meshBasicMaterial
            ref={signRef}
            map={signTex}
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
      <Motes count={18} color="#FF7E5E" size={0.17} speed={0.55} spreadY={2.6} mode="rise" opacity={0.6} />
    </group>
  )
}

// ---- one diorama assembly ------------------------------------------------- //


function People({ count, color, spread, speed = 0.5, ghost = false }: { count: number; color: string; spread: number; speed?: number; ghost?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const walkers = useMemo(() => Array.from({ length: count }, (_, i) => ({
    r: 1.0 + seeded(`pr-${color}-${i}`, i) * spread,
    a: seeded(`pa-${color}-${i}`, i + 7) * Math.PI * 2,
    sp: (0.25 + seeded(`ps-${color}-${i}`, i + 3) * 0.7) * speed,
    ph: seeded(`ph-${color}-${i}`, i + 11) * Math.PI * 2,
  })), [count, color, spread, speed])
  useFrame((state) => {
    const m = ref.current
    if (!m) return
    const t = state.clock.elapsedTime
    const o = new THREE.Object3D()
    walkers.forEach((w, i) => {
      const a = w.a + t * w.sp
      const bob = Math.abs(Math.sin(t * 5 * w.sp + w.ph)) * 0.07
      o.position.set(Math.cos(a) * w.r, 0.42 + bob, Math.sin(a) * w.r)
      o.rotation.set(0, -a + Math.PI / 2, Math.sin(t * 5 * w.sp + w.ph) * 0.06)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <capsuleGeometry args={[0.14, 0.4, 4, 8]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={ghost ? 0.4 : 0.85} transparent={ghost} opacity={ghost ? 0.5 : 1} roughness={0.6} />
    </instancedMesh>
  )
}

function Lamplighter() {
  const g = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  useFrame((state) => {
    if (!g.current) return
    const t = state.clock.elapsedTime * 0.35
    const x = Math.cos(t) * 2.9
    const z = Math.sin(t * 2) * 1.5
    g.current.position.set(x, 0.42, z)
    g.current.rotation.y = Math.atan2(Math.sin(t) * 2.9, 2 * Math.cos(t * 2) * 1.5)
    if (light.current) light.current.intensity = 1.2 + Math.sin(state.clock.elapsedTime * 8) * 0.25
  })
  return (
    <group ref={g}>
      <mesh>
        <capsuleGeometry args={[0.16, 0.44, 4, 8]} />
        <meshStandardMaterial color="#e8d9b0" emissive="#a8863c" emissiveIntensity={0.5} roughness={0.6} />
      </mesh>
      <mesh position={[0.3, 0.42, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial color="#ffd27a" toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0.3, 0.5, 0]} intensity={1.4} distance={5.5} color="#ffd9a0" />
    </group>
  )
}

function Archivist({ offset, stops }: { offset: number; stops: [number, number][] }) {
  const g = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (!g.current) return
    const t = ((state.clock.elapsedTime * 0.03 + offset) % 1 + 1) % 1
    const seg = Math.floor(t * stops.length)
    const f = t * stops.length - seg
    const [ax, az] = stops[seg]
    const [bx, bz] = stops[(seg + 1) % stops.length]
    const m = Math.min(1, f / 0.6)
    const e = m * m * (3 - 2 * m)
    const bob = m < 1 ? Math.abs(Math.sin(state.clock.elapsedTime * 6)) * 0.05 : 0
    g.current.position.set(ax + (bx - ax) * e, 0.42 + bob, az + (bz - az) * e)
    if (m < 1) g.current.rotation.y = Math.atan2(bx - ax, bz - az)
  })
  return (
    <mesh ref={g}>
      <capsuleGeometry args={[0.15, 0.42, 4, 8]} />
      <meshStandardMaterial color="#c9d6e4" emissive="#7a94b5" emissiveIntensity={0.45} roughness={0.55} />
    </mesh>
  )
}

function Courier() {
  const g = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!g.current) return
    const a = state.clock.elapsedTime * 0.55
    const bob = Math.abs(Math.sin(state.clock.elapsedTime * 7)) * 0.08
    g.current.position.set(Math.cos(a) * 5.1, 0.45 + bob, Math.sin(a) * 5.1)
    g.current.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a))
  })
  return (
    <group ref={g}>
      <mesh>
        <capsuleGeometry args={[0.15, 0.4, 4, 8]} />
        <meshStandardMaterial color="#bfe0ff" emissive="#5aa8e8" emissiveIntensity={0.9} roughness={0.5} />
      </mesh>
      <mesh position={[0.22, 0.1, 0.12]}>
        <boxGeometry args={[0.18, 0.22, 0.12]} />
        <meshBasicMaterial color="#ffd27a" toneMapped={false} />
      </mesh>
    </group>
  )
}

function ZeroTrain() {
  const g = useRef<THREE.Group>(null)
  useFrame((_, delta) => { if (g.current) g.current.rotation.y -= delta * 0.12 })
  return (
    <group>
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[6.8, 0.05, 6, 64]} />
        <meshBasicMaterial color="#8d9fb5" transparent opacity={0.5} />
      </mesh>
      {/* Zero Station platform */}
      <group position={[0, 0, 6.8]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 0.2, -1.1]}>
          <boxGeometry args={[2.2, 0.4, 0.9]} />
          <meshStandardMaterial color="#2c3646" roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.05, -1.6]}>
          <boxGeometry args={[2.2, 0.08, 0.5]} />
          <meshStandardMaterial color="#3a4656" emissive="#b8cce0" emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[-0.8, 0.6, -1.1]}>
          <cylinderGeometry args={[0.04, 0.04, 0.9, 6]} />
          <meshBasicMaterial color="#8d9fb5" />
        </mesh>
        <mesh position={[0.8, 0.6, -1.1]}>
          <cylinderGeometry args={[0.04, 0.04, 0.9, 6]} />
          <meshBasicMaterial color="#8d9fb5" />
        </mesh>
      </group>
      <group ref={g}>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2
          return (
            <group key={i} position={[Math.cos(a) * 6.8, 0.35, Math.sin(a) * 6.8]} rotation={[0, -a + Math.PI / 2, 0]}>
              <mesh>
                <boxGeometry args={[0.85, 0.34, 0.4]} />
                <meshStandardMaterial color="#33404f" emissive="#9fb4c8" emissiveIntensity={0.3} metalness={0.3} roughness={0.5} />
              </mesh>
              <mesh position={[0.46, 0.04, 0]}>
                <sphereGeometry args={[0.06, 6, 6]} />
                <meshBasicMaterial color="#cfe0f4" toneMapped={false} />
              </mesh>
            </group>
          )
        })}
      </group>
    </group>
  )
}

function ZeroWorld() {
  const monument = useRef<THREE.Mesh>(null)
  const glyphs = useRef<THREE.InstancedMesh>(null)
  const beam = useRef<THREE.Group>(null)
  const seeds = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
    r: 1.4 + seeded(`zr-${i}`, i) * 3.0,
    a: seeded(`za-${i}`, i + 5) * Math.PI * 2,
    sp: 0.35 + seeded(`zs-${i}`, i + 9) * 0.4,
    ph: seeded(`zp-${i}`, i + 2),
    s: 0.14 + seeded(`zsc-${i}`, i + 4) * 0.12,
  })), [])
  const stopsA = useMemo<[number, number][]>(() => [[-1.95, 1.95], [1.95, 1.3], [0, -0.65], [-0.65, -1.95]], [])
  const stopsB = useMemo<[number, number][]>(() => [[1.95, -1.95], [-1.3, 0.65], [0.65, 1.95], [-1.95, 0]], [])
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    if (monument.current) monument.current.rotation.y += delta * 0.4
    if (beam.current) beam.current.rotation.y = t * 0.5
    const m = glyphs.current
    if (m) {
      const o = new THREE.Object3D()
      seeds.forEach((sd, i) => {
        const cyc = ((t * sd.sp + sd.ph) % 1 + 1) % 1
        o.position.set(Math.cos(sd.a) * sd.r, 0.3 + cyc * 3.2, Math.sin(sd.a) * sd.r)
        o.rotation.set(Math.PI / 2, cyc * 4, 0)
        o.scale.setScalar(sd.s * (1 - cyc * 0.35))
        o.updateMatrix()
        m.setMatrixAt(i, o.matrix)
      })
      m.instanceMatrix.needsUpdate = true
    }
  })
  return (
    <group>
      {/* pale ground haze */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[10.4, 32]} />
        <meshBasicMaterial color="#4a5a72" transparent opacity={0.14} />
      </mesh>
      {/* the Great Zero — landmark */}
      <mesh ref={monument} position={[0, 2.4, 0]}>
        <torusGeometry args={[1.25, 0.3, 14, 48]} />
        <meshStandardMaterial color="#8d9fb5" emissive="#b8cce0" emissiveIntensity={0.55} metalness={0.5} roughness={0.35} />
      </mesh>
      {/* Zero Gate — the only way in */}
      <group position={[-5.7, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[-1.35, 1.5, 0]}>
          <boxGeometry args={[0.45, 3.0, 0.45]} />
          <meshStandardMaterial color="#5a6a80" emissive="#b8cce0" emissiveIntensity={0.25} metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[1.35, 1.5, 0]}>
          <boxGeometry args={[0.45, 3.0, 0.45]} />
          <meshStandardMaterial color="#5a6a80" emissive="#b8cce0" emissiveIntensity={0.25} metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[0, 3.12, 0]}>
          <boxGeometry args={[3.15, 0.35, 0.5]} />
          <meshStandardMaterial color="#5a6a80" emissive="#b8cce0" emissiveIntensity={0.35} metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[0, 2.55, 0.02]}>
          <torusGeometry args={[0.42, 0.1, 8, 26]} />
          <meshBasicMaterial color="#cfe0f4" toneMapped={false} />
        </mesh>
      </group>
      {/* the Unread Library — every post, no readers */}
      <group position={[4.7, 0, 2.7]} rotation={[0, -0.6, 0]}>
        <mesh position={[0, 0.9, 0]}>
          <boxGeometry args={[2.4, 1.8, 1.6]} />
          <meshStandardMaterial color="#2a3444" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.45, 0.81]}>
          <planeGeometry args={[0.7, 0.9]} />
          <meshBasicMaterial color="#cfe0f4" toneMapped={false} />
        </mesh>
        {[0.55, 0.95, 1.35].map((y, i) => (
          <mesh key={i} position={[0, y, 0.81]}>
            <planeGeometry args={[2.0, 0.07]} />
            <meshBasicMaterial color="#7a8ea8" transparent opacity={0.7} toneMapped={false} />
          </mesh>
        ))}
        <mesh position={[0, 2.05, 0]}>
          <torusGeometry args={[0.22, 0.06, 8, 22]} />
          <meshBasicMaterial color="#cfe0f4" toneMapped={false} />
        </mesh>
      </group>
      {/* one podium per zero-view post, each with its waiting light */}
      {[-1.5, -0.5, 0.5, 1.5].map((x) => [-1.5, -0.5, 0.5, 1.5].map((z) => (
        <group key={`${x}-${z}`} position={[x * 1.3, 0, z * 1.3]}>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.28, 0.34, 0.5, 10]} />
            <meshStandardMaterial color="#2c3646" roughness={0.8} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0.55, 0]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshBasicMaterial color="#cfe0f4" toneMapped={false} />
          </mesh>
        </group>
      )))}
      {/* worker NPCs */}
      <Lamplighter />
      <Archivist offset={0} stops={stopsA} />
      <Archivist offset={0.35} stops={stopsB} />
      <Courier />
      <ZeroTrain />
      {/* drifting zero glyphs */}
      <instancedMesh ref={glyphs} args={[undefined, undefined, 10]}>
        <torusGeometry args={[1, 0.3, 8, 20]} />
        <meshBasicMaterial color="#cfe0f4" transparent opacity={0.5} toneMapped={false} />
      </instancedMesh>
      {/* cold searchlight sweeping — waiting to be seen */}
      <group ref={beam}>
        <mesh position={[0, 3.2, 0]} rotation={[0.32, 0, 0]}>
          <coneGeometry args={[1.5, 4.6, 20, 1, true]} />
          <meshBasicMaterial color="#cfe0f4" transparent opacity={0.07} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
    </group>
  )
}

function WorldEnrichment({ kind }: { kind: WorldKind }) {
  const extraRef = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const mesh = extraRef.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    let i = 0
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + 0.22
      const rad = 8.4 + seeded(`ex-${k}`, k) * 1.0
      const h = 0.8 + seeded(`exh-${k}`, k + 3) * 1.4
      dummy.position.set(Math.cos(a) * rad, h / 2, Math.sin(a) * rad)
      dummy.scale.set(0.5, h, 0.5)
      dummy.rotation.set(0, seeded(`exr-${k}`, k + 6), 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i++, dummy.matrix)
    }
    mesh.count = i
    mesh.instanceMatrix.needsUpdate = true
  }, [])
  return (
    <group>
      {kind === 'city' && (
        <>
          <instancedMesh ref={extraRef} args={[undefined, undefined, 14]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#0c1220" emissive="#1f3a55" emissiveIntensity={0.5} roughness={0.7} />
          </instancedMesh>
          {/* Spire Prime — the idea currently in focus */}
          <mesh position={[3.0, 2.4, -3.0]}>
            <boxGeometry args={[0.55, 4.8, 0.55]} />
            <meshStandardMaterial color="#0e1526" emissive="#3DD8FF" emissiveIntensity={0.35} roughness={0.5} metalness={0.4} />
          </mesh>
          <mesh position={[3.0, 5.0, -3.0]}>
            <sphereGeometry args={[0.18, 10, 10]} />
            <meshBasicMaterial color="#aef2ff" toneMapped={false} />
          </mesh>
          <People count={12} color="#7de8ff" spread={2.6} speed={0.7} />
        </>
      )}
      {kind === 'forest' && (
        <>
          {/* Elder Tree landmark */}
          <group position={[-2.9, 0, 2.7]}>
            <mesh position={[0, 1.1, 0]}>
              <cylinderGeometry args={[0.22, 0.34, 2.2, 8]} />
              <meshStandardMaterial color="#3a2d22" roughness={0.9} />
            </mesh>
            <mesh position={[0, 2.6, 0]}>
              <icosahedronGeometry args={[1.15, 0]} />
              <meshStandardMaterial color="#1e5c38" emissive="#2fae66" emissiveIntensity={0.6} flatShading />
            </mesh>
            <mesh position={[0.5, 3.3, 0.3]}>
              <icosahedronGeometry args={[0.6, 0]} />
              <meshStandardMaterial color="#1e5c38" emissive="#2fae66" emissiveIntensity={0.6} flatShading />
            </mesh>
          </group>
          <People count={8} color="#a8e6b8" spread={2.2} speed={0.4} />
        </>
      )}
      {kind === 'ice' && (
        <>
          {/* Crystal obelisk landmark */}
          <mesh position={[2.7, 1.5, -2.5]}>
            <octahedronGeometry args={[1.0, 0]} />
            <meshStandardMaterial color="#bcd9ec" emissive="#7ec3ff" emissiveIntensity={0.8} transparent opacity={0.9} flatShading />
          </mesh>
          <People count={7} color="#cfe8ff" spread={2.4} speed={0.35} />
        </>
      )}
      {kind === 'desert' && (
        <>
          {/* Pyramid landmark with glowing capstone */}
          <mesh position={[-2.5, 0.95, -2.3]}>
            <coneGeometry args={[1.5, 1.9, 4]} />
            <meshStandardMaterial color="#a8763e" roughness={0.85} flatShading />
          </mesh>
          <mesh position={[-2.5, 2.05, -2.3]}>
            <octahedronGeometry args={[0.22, 0]} />
            <meshBasicMaterial color="#ffd27a" toneMapped={false} />
          </mesh>
          <People count={8} color="#ffd9a0" spread={2.4} speed={0.45} />
        </>
      )}
      {kind === 'ruins' && (
        <>
          {/* broken arch landmark */}
          <mesh position={[2.8, 1.15, -2.6]} rotation={[0, 0.4, 0.12]}>
            <torusGeometry args={[1.1, 0.16, 8, 20, Math.PI]} />
            <meshStandardMaterial color="#4a3a3a" emissive="#5a1a1a" emissiveIntensity={0.4} flatShading />
          </mesh>
          <People count={6} color="#ff8a8a" spread={2.0} speed={0.3} ghost />
        </>
      )}
      {kind === 'zero' && <People count={6} color="#c9d6e4" spread={2.0} speed={0.15} ghost />}
    </group>
  )
}

function WorldDisc({ kind, angle, index, revival }: { kind: WorldKind; angle: number; index: number; revival: number }) {
  const meta = WORLD_META[kind]
  const group = useRef<THREE.Group>(null)
  const introDelay = 0.55 + index * 0.4

  const quat = useMemo(() => {
    const up = onSphere(angle, 0, 1).normalize()
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up)
  }, [angle])
  const position = useMemo(() => onSphere(angle, 0, R_WORLD), [angle])

  useFrame((state) => {
    if (!group.current) return
    const t = state.clock.elapsedTime
    // staggered ease-out pop-in, then a gentle bob
    const p = Math.max(0, Math.min(1, (t - introDelay) / 1.15))
    const e = 1 - Math.pow(1 - p, 3)
    const overshoot = e < 1 ? 1 + Math.sin(e * Math.PI) * 0.06 : 1
    group.current.scale.setScalar(Math.max(0.0001, e * overshoot))
    group.current.position.y = Math.sin(t * 0.5 + angle * 3) * 0.3 * e
  })

  return (
    <group position={position} quaternion={quat}>
      <group ref={group}>
        <mesh position={[0, -0.6, 0]}>
          <cylinderGeometry args={[DISC_R, DISC_R * 0.72, 1.2, 10, 1]} />
          <meshStandardMaterial color="#141a26" roughness={0.85} metalness={0.3} flatShading />
        </mesh>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[DISC_R - 0.35, 24]} />
          <meshToonMaterial
            color={kind === 'forest' ? '#1c3d26' : kind === 'ice' ? '#bcd9ec' : kind === 'desert' ? '#c99a5b' : kind === 'city' ? '#101a2c' : kind === 'zero' ? '#232e40' : '#171320'}
          />
        </mesh>
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[DISC_R - 0.15, 0.16, 6, 40]} />
          <meshBasicMaterial color={meta.color} toneMapped={false} />
        </mesh>

        {kind === 'city' && <CityWorld />}
        {kind === 'forest' && <ForestWorld />}
        {kind === 'ice' && <IceWorld />}
        {kind === 'desert' && <DesertWorld />}
        {kind === 'ruins' && <RuinsWorld revival={revival} />}
        {kind === 'zero' && <ZeroWorld />}
        <WorldEnrichment kind={kind} />

        <pointLight
          position={[0, 6.5, 0]}
          intensity={kind === 'ruins' ? 10 + revival * 22 : 26}
          distance={26}
          color={meta.color}
        />

        {/* floating name tag */}
        <Html position={[0, 4.6, 0]} center distanceFactor={42} occlude style={{ pointerEvents: 'none' }}>
          <div
            className="px-2 py-0.5 rounded font-mono text-[10px] tracking-widest whitespace-nowrap"
            style={{
              color: meta.color,
              border: `1px solid ${meta.color}55`,
              background: 'rgba(6,10,18,0.72)',
              boxShadow: `0 0 12px ${meta.color}44`,
            }}
          >
            {meta.name.toUpperCase()}
          </div>
        </Html>
      </group>
    </group>
  )
}

// ---- shell ---------------------------------------------------------------- //

function Shell() {
  const panels = useMemo(
    () =>
      WINDOWS.map((w) => {
        const gapStart = w.phiCenter + WIN_PHI / 2
        const gapEnd = w.phiCenter + (Math.PI * 2) / WINDOWS.length - WIN_PHI / 2
        return {
          phiStart: gapStart,
          phiLength: gapEnd - gapStart,
          thetaStart: WIN_THETA_START,
          thetaLength: WIN_THETA_END - WIN_THETA_START,
        }
      }),
    [],
  )

  const caps = [
    { thetaStart: 0, thetaLength: WIN_THETA_START },
    { thetaStart: WIN_THETA_END, thetaLength: Math.PI - WIN_THETA_END },
  ]

  return (
    <group>
      {panels.map((p, i) => (
        <mesh key={`panel-${i}`}>
          <sphereGeometry args={[R_SHELL, 32, 10, p.phiStart, p.phiLength, p.thetaStart, p.thetaLength]} />
          <meshStandardMaterial
            color="#0d1626"
            roughness={0.35}
            metalness={0.65}
            emissive="#0a2036"
            emissiveIntensity={0.6}
            side={THREE.DoubleSide}
            flatShading
          />
        </mesh>
      ))}
      {caps.map((c, i) => (
        <mesh key={`cap-${i}`}>
          <sphereGeometry args={[R_SHELL, 32, 12, 0, Math.PI * 2, c.thetaStart, c.thetaLength]} />
          <meshStandardMaterial
            color="#0d1626"
            roughness={0.35}
            metalness={0.65}
            emissive="#0a2036"
            emissiveIntensity={0.6}
            side={THREE.DoubleSide}
            flatShading
          />
        </mesh>
      ))}
      {WINDOWS.map((w, i) => (
        <WindowFrame key={`frame-${i}`} phiCenter={w.phiCenter} />
      ))}
    </group>
  )
}

function WindowFrame({ phiCenter }: { phiCenter: number }) {
  const tube = useMemo(() => {
    const pts: THREE.Vector3[] = []
    const latA = Math.PI / 2 - WIN_THETA_START
    const latB = Math.PI / 2 - WIN_THETA_END
    const half = WIN_PHI / 2
    for (let t = 0; t <= 1.01; t += 0.05) pts.push(onSphere(phiCenter - half + t * WIN_PHI, latB, R_SHELL + 0.05))
    for (let t = 0; t <= 1.01; t += 0.08) pts.push(onSphere(phiCenter + half, latB + t * (latA - latB), R_SHELL + 0.05))
    for (let t = 1; t >= -0.01; t -= 0.05) pts.push(onSphere(phiCenter - half + t * WIN_PHI, latA, R_SHELL + 0.05))
    for (let t = 1; t >= -0.01; t -= 0.08) pts.push(onSphere(phiCenter - half, latB + t * (latA - latB), R_SHELL + 0.05))
    const curve = new THREE.CatmullRomCurve3(pts, true)
    return new THREE.TubeGeometry(curve, 220, 0.38, 6, true)
  }, [phiCenter])

  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  useFrame((state) => {
    if (matRef.current) {
      const t = state.clock.elapsedTime
      const intro = Math.min(1, t / 2.2)
      matRef.current.opacity = (0.55 + Math.sin(t * 1.3 + phiCenter * 2) * 0.25) * (0.15 + 0.85 * intro)
    }
  })

  return (
    <mesh geometry={tube}>
      <meshBasicMaterial ref={matRef} color="#3DD8FF" transparent opacity={0.6} toneMapped={false} />
    </mesh>
  )
}

function Atmosphere() {
  return (
    <group>
      <mesh scale={[1.03, 1.03, 1.03]}>
        <sphereGeometry args={[R_SHELL, 48, 32]} />
        <meshBasicMaterial color="#2E9FD8" transparent opacity={0.07} blending={THREE.AdditiveBlending} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <mesh scale={[1.07, 1.07, 1.07]}>
        <sphereGeometry args={[R_SHELL, 32, 24]} />
        <meshBasicMaterial color="#1E5F8F" transparent opacity={0.05} blending={THREE.AdditiveBlending} side={THREE.BackSide} depthWrite={false} />
      </mesh>
    </group>
  )
}

// ---- meteors + interior dust ---------------------------------------------- //

function Meteors() {
  const ref = useRef<THREE.Group>(null)
  const meteors = useMemo(
    () =>
      Array.from({ length: 3 }, (_, i) => ({
        delay: i * 4 + seeded('md', i) * 3,
        duration: 1.4,
        from: new THREE.Vector3(-180 + seeded('mx', i) * 60, 90 + seeded('my', i) * 50, -60 + seeded('mz', i) * 120),
        dir: new THREE.Vector3(1, -0.45, 0.25).normalize(),
      })),
    [],
  )
  useFrame((state) => {
    const g = ref.current
    if (!g) return
    const t = state.clock.elapsedTime
    g.children.forEach((child, i) => {
      const m = meteors[i]
      const cycle = 9
      const p = ((t + m.delay) % cycle) / m.duration
      const mesh = child as THREE.Mesh
      const mat = mesh.material as THREE.MeshBasicMaterial
      if (p > 1) {
        mesh.visible = false
        return
      }
      mesh.visible = true
      mesh.position.copy(m.from).addScaledVector(m.dir, p * 220)
      mat.opacity = Math.sin(p * Math.PI) * 0.8
    })
  })
  return (
    <group ref={ref}>
      {meteors.map((_, i) => (
        <mesh key={i} rotation={[0, 0, -0.42]}>
          <planeGeometry args={[3.2, 0.12]} />
          <meshBasicMaterial color="#CFE9FF" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

function InteriorDust() {
  const sprite = useMemo(() => makeSoftSprite(), [])
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const pts: number[] = []
    for (let i = 0; i < 130; i++) {
      const v = new THREE.Vector3(
        seeded('dx', i) * 2 - 1,
        seeded('dy', i) * 2 - 1,
        seeded('dz', i) * 2 - 1,
      ).normalize().multiplyScalar(8 + seeded('dr', i) * 16)
      pts.push(v.x, v.y, v.z)
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return geo
  }, [])
  const ref = useRef<THREE.Points>(null)
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.02
  })
  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        color="#3DD8FF"
        size={0.5}
        map={sprite}
        transparent
        opacity={0.16}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

// ---- intro ---------------------------------------------------------------- //

/** Dolly the camera in from deep space to the home framing on mount. */
function CameraIntro({ duration = 3.4 }: { duration?: number }) {
  const { camera } = useThree()
  const start = useMemo(() => new THREE.Vector3(-40, 84, 235), [])
  const end = useMemo(() => new THREE.Vector3(0, 34, 138), [])
  const done = useRef(false)
  useFrame((state) => {
    if (done.current) return
    const t = state.clock.elapsedTime
    const p = Math.min(1, t / duration)
    if (p >= 1) {
      done.current = true
      camera.position.copy(end)
      return
    }
    // ease-in-out, with a slight lateral sweep for a cinematic feel
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
    camera.position.lerpVectors(start, end, e)
  })
  return null
}

// ---- scene root ----------------------------------------------------------- //


function NebulaDome() {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  useFrame((state) => { uniforms.uTime.value = state.clock.elapsedTime })
  return (
    <mesh>
      <sphereGeometry args={[520, 32, 32]} />
      <shaderMaterial
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        vertexShader={`varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
        fragmentShader={`
          uniform float uTime; varying vec3 vPos;
          void main(){
            vec3 d = normalize(vPos);
            float base = 0.5 + 0.5 * d.y;
            vec3 col = mix(vec3(0.008, 0.010, 0.028), vec3(0.02, 0.012, 0.05), base);
            float drift1 = sin(d.x * 6.0 + uTime * 0.02) * sin(d.z * 5.0 - uTime * 0.015);
            float drift2 = sin(d.x * 11.0 - uTime * 0.01) * sin(d.y * 8.0 + uTime * 0.02);
            float cloud = smoothstep(0.15, 0.9, drift1 * 0.6 + drift2 * 0.4);
            col += vec3(0.05, 0.02, 0.11) * cloud * 0.55;
            col += vec3(0.01, 0.05, 0.08) * smoothstep(0.5, 1.0, drift2) * 0.4;
            gl_FragColor = vec4(col, 1.0);
          }`}
      />
    </mesh>
  )
}

function AuroraRing({ revival }: { revival: number }) {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uRevive: { value: revival },
    uColor1: { value: new THREE.Color('#27e0ff') },
    uColor2: { value: new THREE.Color('#8a5cff') },
  }), [])
  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime
    uniforms.uRevive.value = revival
  })
  return (
    <mesh rotation={[0.46, 0, 0.14]}>
      <torusGeometry args={[84, 3.2, 24, 200]} />
      <shaderMaterial
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
        vertexShader={`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
        fragmentShader={`
          uniform float uTime; uniform float uRevive; uniform vec3 uColor1; uniform vec3 uColor2; varying vec2 vUv;
          void main(){
            float band = sin(vUv.x * 44.0 + uTime * 1.3) * 0.5 + sin(vUv.x * 19.0 - uTime * 0.8) * 0.5;
            band = band * 0.5 + 0.5;
            float edge = smoothstep(0.0, 0.4, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
            vec3 col = mix(uColor1, uColor2, band);
            float a = edge * (0.35 + 0.65 * band) * (0.22 + 0.55 * uRevive);
            gl_FragColor = vec4(col * a * 1.7, a);
          }`}
      />
    </mesh>
  )
}

function DebrisBelt() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const count = 150
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({
    r: 88 + (i % 5) * 5 + Math.random() * 6,
    a: Math.random() * Math.PI * 2,
    y: (Math.random() - 0.5) * 12,
    s: 0.5 + Math.random() * 1.3,
    rs: 0.06 + Math.random() * 0.12,
    rot: Math.random() * Math.PI * 2,
  })), [])
  useFrame((state, delta) => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    seeds.forEach((sd, i) => {
      sd.a += delta * sd.rs
      o.position.set(Math.cos(sd.a) * sd.r, sd.y + Math.sin(state.clock.elapsedTime * 0.3 + i) * 0.9, Math.sin(sd.a) * sd.r)
      o.rotation.set(sd.rot + state.clock.elapsedTime * sd.rs * 3, i, sd.rot)
      o.scale.setScalar(sd.s)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#3a4a6a" roughness={0.9} metalness={0.25} emissive="#16233f" emissiveIntensity={0.7} flatShading />
    </instancedMesh>
  )
}

function HoloShards() {
  const g = useRef<THREE.Group>(null)
  const shards = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2
    const r = 69 + (i % 3) * 4
    const y = Math.sin(i * 2.1) * 15
    return { pos: [Math.cos(a) * r, y, Math.sin(a) * r] as [number, number, number], s: 0.9 + (i % 3) * 0.5 }
  }), [])
  useFrame((_, delta) => { if (g.current) g.current.rotation.y -= delta * 0.03 })
  return (
    <group ref={g}>
      {shards.map((sh, i) => (
        <Float key={i} speed={2.2} rotationIntensity={1.4} floatIntensity={1.2}>
          <mesh position={sh.pos} scale={sh.s}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color="#7de8ff" wireframe transparent opacity={0.55} />
          </mesh>
        </Float>
      ))}
    </group>
  )
}

function WorldsScene({ projects }: { projects: CityProject[] }) {
  const assembly = useRef<THREE.Group>(null)

  const revival = useMemo(() => {
    if (projects.length === 0) return 0.08
    const alive = projects.filter((p) => p.status === 'alive').length
    const reviving = projects.filter((p) => p.status === 'reviving').length
    return Math.min(1, (alive + reviving * 0.6) / projects.length)
  }, [projects])

  useFrame((state, delta) => {
    if (assembly.current) {
      const intro = Math.min(1, state.clock.elapsedTime / 3)
      const ease = intro * intro * (3 - 2 * intro)
      assembly.current.rotation.y += delta * 0.045 * ease
    }
  })

  return (
    <group>
      <ambientLight intensity={0.3} />
      <hemisphereLight args={['#5a7fc9', '#160f28', 0.55]} />
      <directionalLight position={[80, 100, 60]} intensity={0.55} color="#cfe2ff" />
      {/* virtual-office style neon rim rig */}
      <directionalLight position={[-85, 28, -45]} intensity={1.15} color="#ff4dd8" />
      <directionalLight position={[70, -38, 55]} intensity={0.9} color="#39e6ff" />
      {/* cube-mapped studio light, filmed once like the pmndrs office */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="ring" color="#39e6ff" intensity={7} scale={7} position={[60, 48, 60]} onUpdate={(self) => self.lookAt(0, 0, 0)} />
        <Lightformer form="rect" color="#ff4dd8" intensity={4.5} scale={[34, 9, 1]} position={[-75, 12, -45]} onUpdate={(self) => self.lookAt(0, 0, 0)} />
        <Lightformer form="rect" color="#ffb547" intensity={3.5} scale={[28, 7, 1]} position={[55, -32, -60]} onUpdate={(self) => self.lookAt(0, 0, 0)} />
        <Lightformer form="rect" color="#2a4a8f" intensity={2.5} scale={[42, 11, 1]} position={[0, 58, -75]} onUpdate={(self) => self.lookAt(0, 0, 0)} />
      </Environment>
      <Stars radius={340} depth={80} count={3200} factor={4.5} fade speed={0.8} />
      <Meteors />
      <NebulaDome />
      <DebrisBelt />
      <HoloShards />
      <AuroraRing revival={revival} />

      <group ref={assembly}>
        <Shell />
        <Atmosphere />
        {WINDOWS.map((w, i) => (
          <WorldDisc key={w.phiCenter} kind={WORLD_ORDER[i]} angle={w.phiCenter} index={i} revival={revival} />
        ))}
        <SoulCore revival={revival} />
        <Sparkles count={80} scale={[26, 26, 26]} size={2.6} speed={0.35} color="#9ff2ff" opacity={0.85} />
        <InteriorDust />
      </group>
    </group>
  )
}

function SoulCore({ revival }: { revival: number }) {
  const ref = useRef<THREE.MeshStandardMaterial>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const intro = Math.min(1, t / 2.6)
    if (ref.current) {
      ref.current.emissiveIntensity = (1.2 + revival * 2.2 + Math.sin(t * 1.8) * 0.35) * intro
    }
    if (lightRef.current) {
      lightRef.current.intensity = (60 + revival * 80) * (0.1 + 0.9 * intro)
    }
  })
  return (
    <group>
      <mesh>
        <icosahedronGeometry args={[6.5, 1]} />
        <meshStandardMaterial ref={ref} color="#05070c" emissive="#3DD8FF" emissiveIntensity={2.2} wireframe />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[4.2, 0]} />
        <meshBasicMaterial color="#9FE8FF" toneMapped={false} transparent opacity={0.85} />
      </mesh>
      <pointLight ref={lightRef} intensity={6} distance={70} color="#3DD8FF" />
    </group>
  )
}

// ---- module wrapper ------------------------------------------------------- //

export function MiniatureWorldsModule() {
  const { projects, loading } = useCityData()
  const [hubOpen, setHubOpen] = useState(true)
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setSettled(true), 80)
    return () => clearTimeout(id)
  }, [])

  const revivalPct = Math.round(
    ((projects.filter((p) => p.status === 'alive').length +
      projects.filter((p) => p.status === 'reviving').length * 0.6) /
      Math.max(projects.length, 1)) *
      100,
  )
  if (loading && projects.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="font-mono text-xs text-text-secondary animate-pulse-soft">Loading worlds...</div>
      </div>
    )
  }
  return (
    <div className="absolute inset-0">
      {/* fade-from-black so the mode hand-off doesn't hard-cut */}
      <div
        className="absolute inset-0 z-20 pointer-events-none bg-[#03050a]"
        style={{ opacity: settled ? 0 : 1, transition: 'opacity 1.4s ease-out' }}
      />
      <div
        className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none text-center"
        style={{ opacity: settled ? 1 : 0, transition: 'opacity 0.9s ease-out 0.6s' }}
      >
        <div className="glass-strong px-lg py-sm rounded-lg">
          <div className="text-sm font-medium tracking-wide">REBOOT · Five Worlds</div>
          <div className="text-[10px] text-text-secondary mt-0.5 font-mono">revival {revivalPct}%</div>
        </div>
      </div>
      {/* World Hub — what each world means */}
      <button
        onClick={() => setHubOpen(!hubOpen)}
        className="absolute top-6 right-6 z-20 glass-strong px-3 py-1.5 rounded-lg font-mono text-[10px] tracking-widest text-text-secondary hover:text-white transition-colors"
      >
        {hubOpen ? 'CLOSE HUB' : 'WORLD HUB'}
      </button>
      <div
        className="absolute top-16 right-6 z-20 w-[300px] max-h-[calc(100%-6rem)] overflow-y-auto glass-strong rounded-lg p-4 space-y-3"
        style={{ opacity: settled && hubOpen ? 1 : 0, pointerEvents: settled && hubOpen ? 'auto' : 'none', transition: 'opacity 0.6s ease-out 0.8s' }}
      >
        <div className="text-[11px] font-semibold tracking-wider">WHAT EACH WORLD IS</div>
        {WORLD_ORDER.map((kind) => {
          const meta = WORLD_META[kind]
          return (
            <div key={kind} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }} />
                <span className="text-[12px] font-medium" style={{ color: meta.color }}>{meta.name}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-text-secondary">{meta.desc}</p>
            </div>
          )
        })}
        <div className="pt-2 border-t border-white/10 text-[10px] leading-relaxed text-text-secondary font-mono">
          The core's glow, the window frames, and the revival meter all scale with the share of revived projects in the network.
        </div>
      </div>
      <Canvas
        dpr={[1, 1.8]}
        camera={{ position: [0, 34, 138], fov: 50, near: 0.1, far: 1200 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#03050a']} />
        <fog attach="fog" args={['#050810', 300, 800]} />
        <Suspense fallback={null}>
          <CameraIntro />
          <WorldsScene projects={projects} />
        </Suspense>
        <OrbitControls enablePan={false} minDistance={72} maxDistance={260} enableDamping dampingFactor={0.08} />
        <EffectComposer>
          <Bloom mipmapBlur intensity={1.4} luminanceThreshold={0.28} luminanceSmoothing={0.25} radius={0.8} />
          <ChromaticAberration offset={new THREE.Vector2(0.0012, 0.0012)} radialModulation={false} modulationOffset={0.15} />
          <Noise premultiply opacity={0.09} />
          <Vignette eskil={false} offset={0.26} darkness={0.62} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
