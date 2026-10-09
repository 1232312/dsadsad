/**
 * Lightweight animated skyline used on the landing page. Pure CSS/SVG — no
 * Three.js — so the first paint is instant and the heavy 3D bundle only loads
 * once the user enters a module.
 */
import { motion } from 'framer-motion'

export function LandingSkyline() {
  // Procedural building silhouettes. Heights are fixed for stable layout.
  const buildings = [
    { x: 4, w: 60, h: 180, delay: 0 },
    { x: 70, w: 40, h: 120, delay: 0.1 },
    { x: 116, w: 80, h: 240, delay: 0.2 },
    { x: 202, w: 50, h: 160, delay: 0.15 },
    { x: 258, w: 70, h: 300, delay: 0.25 },
    { x: 334, w: 45, h: 140, delay: 0.1 },
    { x: 385, w: 90, h: 260, delay: 0.3 },
    { x: 481, w: 55, h: 200, delay: 0.2 },
    { x: 542, w: 65, h: 320, delay: 0.35 },
    { x: 613, w: 48, h: 170, delay: 0.15 },
    { x: 667, w: 75, h: 280, delay: 0.25 },
    { x: 748, w: 42, h: 150, delay: 0.1 },
    { x: 796, w: 85, h: 340, delay: 0.3 },
    { x: 887, w: 50, h: 190, delay: 0.2 },
    { x: 943, w: 60, h: 250, delay: 0.25 },
    { x: 1009, w: 48, h: 130, delay: 0.15 },
    { x: 1063, w: 72, h: 300, delay: 0.3 },
    { x: 1141, w: 44, h: 160, delay: 0.1 },
    { x: 1191, w: 68, h: 270, delay: 0.25 },
    { x: 1265, w: 52, h: 200, delay: 0.2 },
  ]

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Deep gradient sky */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#06080C] via-[#080b12] to-[#0a0e16]" />

      {/* Horizon glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[40%]"
        style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(61,216,255,0.12) 0%, transparent 60%)' }}
      />

      {/* Building silhouettes */}
      <div className="absolute bottom-0 left-0 right-0 h-[45%]">
        <svg
          viewBox="0 0 1320 360"
          preserveAspectRatio="xMidYMax slice"
          className="w-full h-full"
        >
          {buildings.map((b, i) => (
            <motion.rect
              key={i}
              x={b.x}
              y={360 - b.h}
              width={b.w}
              height={b.h}
              fill="#0c1018"
              stroke="#1a2230"
              strokeWidth="0.5"
              initial={{ opacity: 0, y: 360 }}
              animate={{ opacity: 1, y: 360 - b.h }}
              transition={{ duration: 1.2, delay: b.delay, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}
          {/* Window lights on taller buildings */}
          {buildings.filter((b) => b.h > 200).map((b, i) => (
            <motion.g
              key={`lights-${i}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 4, repeat: Infinity, delay: i * 0.5, ease: 'easeInOut' }}
            >
              {Array.from({ length: Math.floor(b.h / 24) }).map((_, r) =>
                Array.from({ length: Math.floor(b.w / 14) }).map((_, c) => (
                  <rect
                    key={`${r}-${c}`}
                    x={b.x + 4 + c * 14}
                    y={360 - b.h + 10 + r * 24}
                    width={4}
                    height={6}
                    fill="#3DD8FF"
                    opacity={Math.random() > 0.6 ? 0.7 : 0.15}
                  />
                )),
              )}
            </motion.g>
          ))}
        </svg>
      </div>

      {/* Floating particles */}
      {Array.from({ length: 24 }).map((_, i) => (
        <motion.div
          key={`p-${i}`}
          className="absolute w-[2px] h-[2px] rounded-full bg-primary/40"
          style={{ left: `${(i * 4.1) % 100}%`, bottom: `${20 + (i * 7) % 60}%` }}
          animate={{ y: [0, -30, 0], opacity: [0, 0.6, 0] }}
          transition={{ duration: 6 + (i % 5), repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}
