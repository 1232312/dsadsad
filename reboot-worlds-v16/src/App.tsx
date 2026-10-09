import { useEffect, lazy, Suspense } from 'react'
import { useUI } from '@/stores/ui'
import { useProjects } from '@/stores/auth'
import { BootIntro } from '@/components/BootIntro'
import { LandingPage } from '@/components/landing/LandingPage'
import { LandingSkyline } from '@/components/landing/LandingSkyline'
import { AuthPage } from '@/components/auth/AuthPage'
import { AppShell } from '@/components/shell/AppShell'

const CityModule = lazy(() => import('@/modules/city/CityModule').then((m) => ({ default: m.CityModule })))
const EchoModule = lazy(() => import('@/modules/echo/EchoModule').then((m) => ({ default: m.EchoModule })))
const GraveyardModule = lazy(() => import('@/modules/graveyard/GraveyardModule').then((m) => ({ default: m.GraveyardModule })))
const NetworkModule = lazy(() => import('@/modules/network/NetworkModule').then((m) => ({ default: m.NetworkModule })))
const MiniatureWorldsModule = lazy(() => import('@/modules/city/MiniatureWorlds').then((m) => ({ default: m.MiniatureWorldsModule })))

function ModuleLoader() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="font-mono text-xs text-text-secondary animate-pulse-soft">Loading module...</div>
    </div>
  )
}

export default function App() {
  const mode = useUI((s) => s.mode)
  const fetchProjects = useProjects((s) => s.fetchProjects)

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  if (mode === 'boot') {
    return <BootIntro />
  }

  if (mode === 'landing') {
    return (
      <div className="relative w-full h-full">
        <LandingSkyline />
        <LandingPage />
      </div>
    )
  }

  if (mode === 'auth') {
    return (
      <div className="relative w-full h-full">
        <AuthPage />
      </div>
    )
  }

  return (
    <AppShell>
      <Suspense fallback={<ModuleLoader />}>
        {mode === 'city' && <CityModule />}
        {mode === 'worlds' && <MiniatureWorldsModule />}
        {mode === 'echo' && <EchoModule />}
        {mode === 'graveyard' && <GraveyardModule />}
        {mode === 'network' && <NetworkModule />}
      </Suspense>
    </AppShell>
  )
}
