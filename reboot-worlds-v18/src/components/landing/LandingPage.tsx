import { motion } from 'framer-motion'
import { Building2, Network, Skull, Sparkles, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useUI, type Mode } from '@/stores/ui'

const navItems = ['About', 'Features', 'Roadmap', 'Community'] as const

const modeCards: { icon: typeof Building2; label: string; mode: Mode; desc: string }[] = [
  { icon: Building2, label: 'City', mode: 'city', desc: 'Projects as buildings' },
  { icon: Network, label: 'Network', mode: 'network', desc: 'Relationships as nodes' },
  { icon: Skull, label: 'Graveyard', mode: 'graveyard', desc: 'The abandoned' },
  { icon: Sparkles, label: 'Echo', mode: 'echo', desc: 'Holographic AI' },
]

export function LandingPage() {
  const setMode = useUI((s) => s.setMode)

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden">
      {/* Top nav */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-20 flex items-center justify-between px-lg md:px-2xl py-md"
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse-soft" />
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-text-secondary">Reboot</span>
        </div>
        <div className="hidden md:flex items-center gap-xl">
          {navItems.map((item) => (
            <button
              key={item}
              className="text-sm text-text-secondary hover:text-text transition-colors duration-300"
            >
              {item}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-md">
          <Button variant="ghost" size="sm" onClick={() => setMode('city')}>
            Login
          </Button>
          <Button variant="primary" size="sm" onClick={() => setMode('city')}>
            Sign Up
          </Button>
        </div>
      </motion.nav>

      {/* Hero — centered, fills viewport */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-lg text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mb-lg"
        >
          <span className="label-mono">v1.0 · Living Archive</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 32, filter: 'blur(12px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1.2, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-6xl md:text-8xl font-light tracking-tight text-text"
          style={{ letterSpacing: '-0.04em' }}
        >
          REBOOT
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="mt-lg text-base md:text-lg text-text-secondary max-w-md font-light"
        >
          Every Idea Deserves a Second Chance.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="mt-2xl flex flex-col sm:flex-row items-center gap-md"
        >
          <Button variant="primary" size="lg" onClick={() => setMode('city')}>
            <Building2 size={18} />
            Explore City
            <ArrowRight size={16} />
          </Button>
          <Button variant="default" size="lg" onClick={() => setMode('city')}>
            <Sparkles size={18} />
            Initialize Project
          </Button>
        </motion.div>
      </div>

      {/* Floating mode dock — horizontal bar at bottom, not a grid list */}
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 1.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 px-lg md:px-2xl pb-2xl"
      >
        <div className="flex items-center justify-center gap-sm">
          {modeCards.map((m, i) => (
            <motion.button
              key={m.label}
              onClick={() => setMode(m.mode)}
              whileHover={{ y: -6 }}
              transition={{ duration: 0.3, ease: 'smooth' }}
              className="group glass px-lg py-lg text-center transition-colors duration-300 hover:border-primary/30 flex-1 max-w-[180px]"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex flex-col items-center gap-sm">
                <m.icon className="text-primary" size={22} />
                <div className="text-sm font-medium text-text">{m.label}</div>
                <div className="text-[10px] text-text-secondary">{m.desc}</div>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
