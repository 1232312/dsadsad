import { lazy, Suspense, useEffect, useMemo, useState, Component, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useUI } from '@/stores/ui'
import { useProjects } from '@/stores/auth'
import { DISTRICT_MAP, type Project, type ProjectCategory } from '@/types/project'
import { CITY_CATEGORIES, CITY_LABELS, CITY_ENV } from './cityRegistry'

const AICity = lazy(() => import('./cities/AICity').then((m) => ({ default: m.AICity })))
const GamingCity = lazy(() => import('./cities/GamingCity').then((m) => ({ default: m.GamingCity })))
const EducationCity = lazy(() => import('./cities/EducationCity').then((m) => ({ default: m.EducationCity })))
const HealthCity = lazy(() => import('./cities/HealthCity').then((m) => ({ default: m.HealthCity })))
const CreatorCity = lazy(() => import('./cities/CreatorCity').then((m) => ({ default: m.CreatorCity })))
const GraveyardCity = lazy(() => import('./cities/GraveyardCity').then((m) => ({ default: m.GraveyardCity })))
const RevivalCity = lazy(() => import('./cities/RevivalCity').then((m) => ({ default: m.RevivalCity })))
const SuccessCity = lazy(() => import('./cities/SuccessCity').then((m) => ({ default: m.SuccessCity })))

/** Scenes per category. Only categories listed here are enterable. */
const CITY_SCENES: Partial<Record<ProjectCategory, React.ComponentType<CitySceneProps>>> = {
  AI: AICity,
  Gaming: GamingCity,
  Education: EducationCity,
  Health: HealthCity,
  Creator: CreatorCity,
  IdeaHub: RevivalCity,
  Graveyard: GraveyardCity,
  Legend: SuccessCity,
}

export interface CitySceneProps {
  projects: Project[]
  selectedId: string | null
  onSelect: (p: Project) => void
}

const STATUS_COLOR: Record<string, string> = {
  alive: '#3BFF91',
  reviving: '#3DD8FF',
  decaying: '#FFB547',
  abandoned: '#FF5959',
}

/** Camera flythrough: from behind the portal, through its ring, into overview. */
function IntroRig({ reduced, onDone }: { reduced: boolean; onDone: () => void }) {
  const { camera } = useThree()
  const done = useMemo(() => ({ v: false }), [])
  const progress = useMemo(() => ({ v: 0 }), [])
  const curve = useMemo(
    () => new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 34, -88),
      new THREE.Vector3(0, 21, -55),
      new THREE.Vector3(44, 30, 48),
    ),
    [],
  )
  useFrame((_, delta) => {
    if (done.v) return
    if (reduced) {
      camera.position.set(44, 30, 48)
      camera.lookAt(0, 8, 0)
      done.v = true
      onDone()
      return
    }
    progress.v = Math.min(1, progress.v + delta / 3.6)
    const p = progress.v
    const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
    curve.getPoint(e, camera.position)
    const target = new THREE.Vector3(0, 8 + e * 0, 0).lerpVectors(new THREE.Vector3(0, 20, -55), new THREE.Vector3(0, 8, 0), e)
    camera.lookAt(target)
    if (p >= 1) {
      done.v = true
      onDone()
    }
  })
  return null
}

/** WebGL failure fallback: a functional 2D index of the city's projects. */
class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function CityFallback({ name, projects, onExit }: { name: string; projects: Project[]; onExit: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background p-lg">
      <div className="w-full max-w-xl rounded-lg border border-border/60 bg-card/80 p-lg">
        <p className="label-mono text-text-secondary">3D mode unavailable</p>
        <h2 className="mt-sm text-xl font-semibold text-text">{name} — index</h2>
        <p className="mt-sm text-xs text-text-secondary">
          WebGL could not start on this device, so the city view is unavailable. The project index below stays fully usable.
        </p>
        <div className="mt-md max-h-[40vh] space-y-2 overflow-y-auto">
          {projects.length === 0 && <p className="text-xs text-text-secondary">No projects in this district yet.</p>}
          {projects.map((p) => (
            <div key={p.id} className="rounded border border-border/40 p-sm">
              <div className="text-sm font-medium text-text">{p.name}</div>
              <div className="text-[10px] text-text-secondary">{p.tagline}</div>
            </div>
          ))}
        </div>
        <button
          onClick={onExit}
          className="mt-md rounded-md border border-border/60 bg-surface px-md py-2 text-xs text-text transition-colors hover:bg-card"
        >
          Return to World Hub
        </button>
      </div>
    </div>
  )
}

export function CityWorldModule() {
  const cityCategory = useUI((s) => s.cityCategory)
  const exitCity = useUI((s) => s.exitCity)
  const projects = useProjects((s) => s.projects)
  const [phase, setPhase] = useState<'intro' | 'live' | 'leaving'>('intro')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const reduced = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const category = (cityCategory && CITY_CATEGORIES.includes(cityCategory) ? cityCategory : null) ?? CITY_CATEGORIES[0]
  const meta = DISTRICT_MAP[category]
  const env = CITY_ENV[category] ?? { bg: '#050b14', fogNear: 70, fogFar: 210 }
  const Scene = CITY_SCENES[category]
  const cityProjects = useMemo(() => projects.filter((p) => p.category === category), [projects, category])
  const selected = cityProjects.find((p) => p.id === selectedId) ?? null

  const startExit = () => {
    if (phase === 'leaving') return
    setPhase('leaving')
    window.setTimeout(exitCity, reduced ? 0 : 420)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') startExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const veilVisible = phase !== 'live'
  return (
    <div className="relative w-full h-full overflow-hidden">
      <SceneBoundary fallback={<CityFallback name={meta.name} projects={cityProjects} onExit={exitCity} />}>
        <Canvas
          key={category}
          camera={{ position: [0, 34, -88], fov: 55, near: 0.1, far: 420 }}
          dpr={[1, 2]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => gl.setClearColor(env.bg)}
        >
          <fog attach="fog" args={[env.bg, env.fogNear, env.fogFar]} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[30, 60, 20]} intensity={0.8} color="#9adfff" />
          <Suspense fallback={null}>
            {Scene && <Scene projects={cityProjects} selectedId={selectedId} onSelect={(p) => setSelectedId(p.id)} />}
          </Suspense>
          <IntroRig reduced={reduced} onDone={() => setPhase('live')} />
          <OrbitControls
            enabled={phase === 'live'}
            makeDefault
            target={[0, 8, 0]}
            maxPolarAngle={Math.PI / 2.05}
            minDistance={20}
            maxDistance={130}
            enablePan={false}
          />
        </Canvas>
      </SceneBoundary>

      {/* transition veil — flashes on entry, returns on exit */}
      <div
        className={`pointer-events-none absolute inset-0 z-40 ${reduced ? '' : 'transition-opacity duration-[400ms]'}`}
        style={{
          opacity: veilVisible ? 1 : 0,
          background: 'radial-gradient(circle at 50% 55%, rgba(191,244,255,0.95), rgba(5,11,20,0.98))',
        }}
      />

      {phase === 'live' && (
        <>
          {/* city identity panel */}
          <div className="absolute left-lg top-md z-10 max-w-xs rounded-lg border border-border/60 bg-surface/80 p-md backdrop-blur-xl">
            <p className="label-mono text-text-secondary">{meta.shortName} district</p>
            <h1 className="mt-xs text-lg font-semibold" style={{ color: meta.theme.color }}>
              {CITY_LABELS[category] ?? meta.name}
            </h1>
            <p className="mt-xs text-xs leading-relaxed text-text-secondary">{meta.description}</p>
            <p className="mt-sm font-mono text-[10px] text-text-secondary">
              {cityProjects.length} project{cityProjects.length === 1 ? '' : 's'} located here · click a tower to inspect
            </p>
          </div>

          {/* return control */}
          <button
            onClick={startExit}
            className="absolute right-lg top-md z-10 rounded-md border border-border/60 bg-surface/80 px-md py-2 text-xs text-text backdrop-blur-xl transition-colors hover:bg-card"
          >
            ← Return to World Hub
          </button>

          {/* project index — mirrors the clickable towers */}
          <div className="absolute bottom-md left-lg z-10 max-w-xs rounded-lg border border-border/60 bg-surface/80 p-md backdrop-blur-xl">
            <p className="label-mono mb-sm text-text-secondary">Projects in {meta.shortName}</p>
            <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
              {cityProjects.length === 0 && (
                <p className="text-xs text-text-secondary">
                  No projects here yet — towers appear as AI projects are added to Reboot.
                </p>
              )}
              {cityProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
                  className={`flex w-full items-center gap-sm rounded px-sm py-1.5 text-left text-xs transition-colors ${
                    selectedId === p.id ? 'bg-card text-text' : 'text-text-secondary hover:bg-card/60 hover:text-text'
                  }`}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLOR[p.status] }} />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="font-mono text-[9px] text-text-secondary/70">{p.status}</span>
                </button>
              ))}
            </div>
          </div>

          {/* city selector — only cities that exist are listed (no dead buttons) */}
          <div className="absolute bottom-md left-1/2 z-10 flex -translate-x-1/2 items-center gap-sm rounded-full border border-border/60 bg-surface/80 px-md py-1.5 backdrop-blur-xl">
            {CITY_CATEGORIES.map((c) => (
              <span
                key={c}
                className="rounded-full px-sm py-0.5 font-mono text-[10px]"
                style={{
                  color: DISTRICT_MAP[c].theme.color,
                  backgroundColor: `${DISTRICT_MAP[c].theme.color}18`,
                  boxShadow: `inset 0 0 0 1px ${DISTRICT_MAP[c].theme.color}50`,
                }}
              >
                {CITY_LABELS[c] ?? c}
              </span>
            ))}
            <span className="font-mono text-[9px] text-text-secondary/60">more cities coming</span>
          </div>

          {/* project detail card — real data only */}
          {selected && (
            <div className="absolute bottom-lg right-lg z-10 w-80 rounded-lg border border-border/60 bg-surface/90 p-md backdrop-blur-xl">
              <div className="flex items-start justify-between gap-sm">
                <div>
                  <h2 className="text-base font-semibold text-text">{selected.name}</h2>
                  <p className="text-[10px] text-text-secondary">{selected.tagline}</p>
                </div>
                <button onClick={() => setSelectedId(null)} className="text-text-secondary transition-colors hover:text-text" aria-label="Close project card">
                  ✕
                </button>
              </div>
              <div className="mt-sm flex items-center gap-md text-[10px] text-text-secondary">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[selected.status] }} />
                  {selected.status}
                </span>
                <span>by {selected.founder}</span>
                <span>stage {selected.stage}/5</span>
              </div>
              <div className="mt-sm">
                <div className="flex justify-between font-mono text-[9px] text-text-secondary">
                  <span>momentum</span>
                  <span>{selected.momentum}</span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-card">
                  <div className="h-full rounded-full" style={{ width: `${selected.momentum}%`, backgroundColor: meta.theme.color }} />
                </div>
              </div>
              <p className="mt-sm max-h-32 overflow-y-auto text-xs leading-relaxed text-text-secondary">{selected.description}</p>
              {selected.tags.length > 0 && (
                <div className="mt-sm flex flex-wrap gap-1">
                  {selected.tags.map((t) => (
                    <span key={t} className="rounded-full bg-card px-1.5 py-0.5 font-mono text-[9px] text-text-secondary">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
