import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Loader2, ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth, type AuthProvider } from '@/stores/auth'
import { useUI } from '@/stores/ui'

const BOOT_LOGS = [
  'Scanning Identity...',
  'Loading Founder Profile...',
  'Synchronizing Innovation Network...',
  'Calibrating City Districts...',
  'Establishing Secure Channel...',
]

export function AuthPage() {
  const { signIn, signUp, error, clearError } = useAuth()
  const setMode = useUI((s) => s.setMode)
  const [booting, setBooting] = useState(true)
  const [logIndex, setLogIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [emailMode, setEmailMode] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!booting) return
    if (logIndex >= BOOT_LOGS.length) {
      const t = setTimeout(() => setBooting(false), 400)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => {
      setLogIndex((i) => i + 1)
      setProgress(((logIndex + 1) / BOOT_LOGS.length) * 100)
    }, 480)
    return () => clearTimeout(t)
  }, [booting, logIndex])

  async function handleAuth(provider: AuthProvider) {
    if (provider !== 'email') {
      setBusy(true)
      try {
        await signIn(provider)
        setMode('city')
      } catch {
        /* error surfaced in store */
      } finally {
        setBusy(false)
      }
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      if (isSignUp) await signUp(email, password)
      else await signIn('email', email, password)
      setMode('city')
    } catch {
      /* error surfaced in store */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Boot scan backdrop */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 bg-gradient-to-b from-background to-[#080b12]" />
      <motion.div
        className="absolute left-0 right-0 h-[2px] bg-primary/40"
        animate={{ y: ['-10%', '110%'] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        style={{ boxShadow: '0 0 20px rgba(61,216,255,0.5)' }}
      />

      <button
        onClick={() => setMode('landing')}
        className="absolute top-lg right-lg z-20 text-text-secondary hover:text-text transition-colors"
        aria-label="Back"
      >
        <X size={20} />
      </button>

      <AnimatePresence mode="wait">
        {booting ? (
          <motion.div
            key="boot"
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-md px-lg"
          >
            <div className="font-mono text-xs text-primary/70 mb-md">REBOOT OS · BOOT SEQUENCE</div>
            <div className="space-y-2 min-h-[120px]">
              {BOOT_LOGS.slice(0, logIndex).map((log, i) => (
                <motion.div
                  key={log}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="font-mono text-xs text-text-secondary flex items-center gap-2"
                >
                  <span className="text-success">✓</span>
                  {log}
                </motion.div>
              ))}
              {logIndex < BOOT_LOGS.length && (
                <div className="font-mono text-xs text-primary flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" />
                  {BOOT_LOGS[logIndex]}
                </div>
              )}
            </div>
            <div className="mt-lg h-[2px] bg-border overflow-hidden rounded-full">
              <motion.div
                className="h-full bg-primary"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: 'smooth' }}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="auth"
            initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-sm px-lg"
          >
            <div className="glass-strong p-2xl">
              <div className="text-center mb-2xl">
                <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary/70 mb-sm">
                  Initialize Identity
                </div>
                <h2 className="text-2xl font-light text-text">Welcome to Reboot</h2>
                <p className="text-sm text-text-secondary mt-sm">
                  Choose how you want to enter the city.
                </p>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mb-md p-md rounded-lg border border-error/40 bg-error/10 text-xs text-error"
                >
                  {error}
                  <button onClick={clearError} className="ml-2 underline">dismiss</button>
                </motion.div>
              )}

              <AnimatePresence mode="wait">
                {emailMode ? (
                  <motion.form
                    key="email-form"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    onSubmit={handleEmailSubmit}
                    className="space-y-md"
                  >
                    <input
                      type="email"
                      required
                      placeholder="founder@reboot.city"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-md py-2.5 rounded-lg bg-surface border border-border text-sm text-text placeholder:text-text-secondary/60 focus:border-primary/50 focus:outline-none transition-colors"
                    />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-md py-2.5 rounded-lg bg-surface border border-border text-sm text-text placeholder:text-text-secondary/60 focus:border-primary/50 focus:outline-none transition-colors"
                    />
                    <Button type="submit" variant="primary" size="md" disabled={busy} className="w-full">
                      {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                      {isSignUp ? 'Create Account' : 'Continue'}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setIsSignUp((v) => !v)}
                      className="w-full text-center text-xs text-text-secondary hover:text-text transition-colors"
                    >
                      {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                    </button>
                  </motion.form>
                ) : (
                  <motion.div
                    key="providers"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-md"
                  >
                    <Button
                      variant="default"
                      size="md"
                      disabled={busy}
                      onClick={() => handleAuth('google')}
                      className="w-full justify-center"
                    >
                      <GoogleIcon /> Continue with Google
                    </Button>
                    <Button
                      variant="default"
                      size="md"
                      disabled={busy}
                      onClick={() => handleAuth('github')}
                      className="w-full justify-center"
                    >
                      <GithubIcon /> Continue with GitHub
                    </Button>
                    <Button
                      variant="ghost"
                      size="md"
                      disabled={busy}
                      onClick={() => setEmailMode(true)}
                      className="w-full justify-center"
                    >
                      <Mail size={16} /> Continue with Email
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <p className="text-center text-xs text-text-secondary/60 mt-lg">
              By continuing you agree to explore abandoned ideas with respect.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}

function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1C5.92 1 1 5.92 1 12c0 4.87 3.15 9 7.52 10.46.55.1.75-.24.75-.53v-1.86c-3.06.67-3.71-1.48-3.71-1.48-.5-1.27-1.22-1.61-1.22-1.61-1-.68.08-.67.08-.67 1.1.08 1.68 1.13 1.68 1.13.98 1.68 2.57 1.2 3.2.92.1-.71.38-1.2.69-1.48-2.44-.28-5.01-1.22-5.01-5.43 0-1.2.43-2.18 1.13-2.95-.11-.28-.49-1.4.11-2.92 0 0 .92-.3 3.02 1.13a10.5 10.5 0 0 1 5.5 0c2.1-1.43 3.02-1.13 3.02-1.13.6 1.52.22 2.64.11 2.92.7.77 1.13 1.75 1.13 2.95 0 4.22-2.58 5.15-5.03 5.42.4.34.74 1.01.74 2.04v3.03c0 .3.2.64.76.53A11 11 0 0 0 23 12c0-6.08-4.92-11-11-11z" />
    </svg>
  )
}
