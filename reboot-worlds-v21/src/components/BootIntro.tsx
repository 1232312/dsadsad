import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUI } from '@/stores/ui'

const BOOT_LINES = [
  '> Initializing REBOOT OS...',
  '> Scanning idea graveyard...',
  '> Loading planet topology...',
  '> Mapping district biomes...',
  '> Restoring abandoned projects...',
  '> Awakening the world...',
  '> System ready.',
]

const GLITCH_CHARS = '!<>-_\\/[]{}=+*^?#________'

export function BootIntro() {
  const setMode = useUI((s) => s.setMode)
  const [lineIndex, setLineIndex] = useState(0)
  const [showEnter, setShowEnter] = useState(false)
  const [glitchText, setGlitchText] = useState('')
  const [glitching, setGlitching] = useState(true)
  const [planetPhase, setPlanetPhase] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Glitch text effect
  useEffect(() => {
    const interval = setInterval(() => {
      if (!glitching) return
      const target = 'REBOOT'
      let result = ''
      for (let i = 0; i < target.length; i++) {
        if (Math.random() > 0.7) {
          result += GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
        } else {
          result += target[i]
        }
      }
      setGlitchText(result)
    }, 80)
    return () => clearInterval(interval)
  }, [glitching])

  useEffect(() => {
    const stopGlitch = setTimeout(() => {
      setGlitching(false)
      setGlitchText('REBOOT')
    }, 1800)
    return () => clearTimeout(stopGlitch)
  }, [])

  // Boot log progression
  useEffect(() => {
    if (lineIndex >= BOOT_LINES.length) {
      const t = setTimeout(() => setShowEnter(true), 500)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setLineIndex((i) => i + 1), 320)
    return () => clearTimeout(t)
  }, [lineIndex])

  // Planet animation phase
  useEffect(() => {
    const interval = setInterval(() => {
      setPlanetPhase((p) => Math.min(1, p + 0.02))
    }, 50)
    return () => clearInterval(interval)
  }, [])

  // Canvas planet render
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let t = 0

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
    }
    resize()
    window.addEventListener('resize', resize)

    const render = () => {
      t += 0.008
      const w = canvas.width
      const h = canvas.height
      const cx = w / 2
      const cy = h / 2 + h * 0.05
      const baseR = Math.min(w, h) * 0.28 * (0.3 + planetPhase * 0.7)

      ctx.clearRect(0, 0, w, h)

      // Atmosphere glow
      const atmoGrad = ctx.createRadialGradient(cx, cy, baseR * 0.8, cx, cy, baseR * 1.5)
      atmoGrad.addColorStop(0, 'rgba(61,216,255,0.12)')
      atmoGrad.addColorStop(0.5, 'rgba(61,216,255,0.04)')
      atmoGrad.addColorStop(1, 'rgba(61,216,255,0)')
      ctx.fillStyle = atmoGrad
      ctx.beginPath()
      ctx.arc(cx, cy, baseR * 1.5, 0, Math.PI * 2)
      ctx.fill()

      // Planet body — dark with subtle gradient
      const planetGrad = ctx.createRadialGradient(cx - baseR * 0.3, cy - baseR * 0.4, 0, cx, cy, baseR)
      planetGrad.addColorStop(0, '#0d1828')
      planetGrad.addColorStop(0.5, '#080d18')
      planetGrad.addColorStop(1, '#03050a')
      ctx.fillStyle = planetGrad
      ctx.beginPath()
      ctx.arc(cx, cy, baseR, 0, Math.PI * 2)
      ctx.fill()

      if (baseR > 5) {
        // District arcs on the planet surface
        const districts = [
          { color: '#3DD8FF', start: 0, end: Math.PI * 0.28 },
          { color: '#FFB547', start: Math.PI * 0.28, end: Math.PI * 0.52 },
          { color: '#3BFF91', start: Math.PI * 0.52, end: Math.PI * 0.78 },
          { color: '#FF5959', start: Math.PI * 0.78, end: Math.PI * 1.02 },
          { color: '#3DD8FF', start: Math.PI * 1.02, end: Math.PI * 1.28 },
          { color: '#FFB547', start: Math.PI * 1.28, end: Math.PI * 1.52 },
          { color: '#3BFF91', start: Math.PI * 1.52, end: Math.PI * 1.78 },
          { color: '#FF5959', start: Math.PI * 1.78, end: Math.PI * 2 },
        ]

        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, baseR, 0, Math.PI * 2)
        ctx.clip()

        districts.forEach((d) => {
          ctx.strokeStyle = d.color
          ctx.globalAlpha = 0.15 + Math.sin(t * 2 + d.start) * 0.05
          ctx.lineWidth = baseR * 0.08
          ctx.beginPath()
          ctx.arc(cx, cy, baseR * (0.4 + Math.sin(t + d.start) * 0.05), d.start + t * 0.1, d.end + t * 0.1)
          ctx.stroke()
        })

        // Surface grid lines
        ctx.globalAlpha = 0.08
        ctx.strokeStyle = '#3DD8FF'
        ctx.lineWidth = 1
        for (let i = 1; i < 5; i++) {
          ctx.beginPath()
          ctx.arc(cx, cy, baseR * (i / 5), 0, Math.PI * 2)
          ctx.stroke()
        }
        // Meridian lines
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI + t * 0.05
          ctx.beginPath()
          ctx.moveTo(cx + Math.cos(angle) * baseR * 0.3, cy + Math.sin(angle) * baseR * 0.3)
          ctx.lineTo(cx + Math.cos(angle) * baseR, cy + Math.sin(angle) * baseR)
          ctx.stroke()
        }

        ctx.restore()

        // Orbiting fragments
        ctx.globalAlpha = 0.6
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + t * 0.3
          const r = baseR * (1.15 + Math.sin(t + i) * 0.05)
          const fx = cx + Math.cos(angle) * r
          const fy = cy + Math.sin(angle) * r * 0.4
          const colors = ['#3DD8FF', '#FFB547', '#3BFF91', '#FF5959']
          ctx.fillStyle = colors[i % 4]
          ctx.beginPath()
          ctx.arc(fx, fy, 2 + Math.sin(t * 3 + i) * 1, 0, Math.PI * 2)
          ctx.fill()
        }

        // Bright equator line
        ctx.globalAlpha = 0.3 + Math.sin(t * 1.5) * 0.1
        ctx.strokeStyle = '#3DD8FF'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.ellipse(cx, cy, baseR, baseR * 0.15, 0, 0, Math.PI * 2)
        ctx.stroke()
      }

      ctx.globalAlpha = 1
      raf = requestAnimationFrame(render)
    }
    render()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [planetPhase])

  return (
    <AnimatePresence>
      <motion.div
        key="boot"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, filter: 'blur(20px)' }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#02040a] overflow-hidden"
      >
        {/* Scanline overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-15"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(61,216,255,0.03) 2px, rgba(61,216,255,0.03) 4px)',
          }}
        />

        {/* Planet canvas background */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ opacity: planetPhase * 0.7 }}
        />

        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.7) 100%)' }}
        />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="relative z-10 flex flex-col items-center"
        >
          {/* Glitch title */}
          <div className="relative mb-lg">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <h1
                className="font-mono text-6xl md:text-8xl font-bold tracking-tight text-[#3DD8FF] text-center select-none"
                style={{
                  textShadow: '0 0 30px rgba(61,216,255,0.6), 0 0 60px rgba(61,216,255,0.25)',
                }}
              >
                {glitchText}
              </h1>
              {glitching && (
                <>
                  <h1
                    className="absolute inset-0 font-mono text-6xl md:text-8xl font-bold tracking-tight text-[#FF5959] text-center select-none opacity-30"
                    style={{ transform: 'translate(4px, 0)' }}
                  >
                    {glitchText}
                  </h1>
                  <h1
                    className="absolute inset-0 font-mono text-6xl md:text-8xl font-bold tracking-tight text-[#3BFF91] text-center select-none opacity-25"
                    style={{ transform: 'translate(-4px, 0)' }}
                  >
                    {glitchText}
                  </h1>
                </>
              )}
            </motion.div>
          </div>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="font-mono text-xs md:text-sm text-text-secondary/60 text-center mb-xl tracking-wider"
          >
            A world where abandoned ideas become architecture
          </motion.p>

          {/* Boot log */}
          <div className="font-mono text-xs text-text-secondary/70 h-[140px] w-[300px] md:w-[360px]">
            {BOOT_LINES.slice(0, lineIndex).map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className={i === BOOT_LINES.length - 1 ? 'text-[#3BFF91]' : ''}
              >
                {line}
              </motion.div>
            ))}
          </div>

          {/* Enter button */}
          <AnimatePresence>
            {showEnter && (
              <motion.button
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => setMode('graveyard')}
                className="relative mt-xl px-3xl py-lg rounded-2xl border border-[#3DD8FF]/40 bg-[#3DD8FF]/10 hover:bg-[#3DD8FF]/20 transition-all duration-500 group overflow-hidden"
                style={{ boxShadow: '0 0 40px rgba(61,216,255,0.2), inset 0 0 20px rgba(61,216,255,0.05)' }}
              >
                <span className="font-mono text-base text-[#3DD8FF] tracking-[0.2em] uppercase relative z-10">
                  Enter the World
                </span>
                <motion.div
                  className="absolute inset-0 rounded-2xl border border-[#3DD8FF]/20"
                  animate={{ opacity: [0.2, 0.5, 0.2] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                />
                <motion.div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: 'radial-gradient(ellipse at center, rgba(61,216,255,0.15), transparent 70%)' }}
                />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Subtitle */}
          {showEnter && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="absolute bottom-2xl left-0 right-0 text-center font-mono text-[10px] text-text-secondary/40"
            >
              Every idea deserves a second chance
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
