import { useState, useRef } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { StationSyncLogo } from '../components/StationSyncLogo'
import { login } from '../lib/api'
import { useAuth } from '../lib/authContext'

export function LoginPage() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const clickTimes = useRef<number[]>([])

  function handleLogoClick() {
    const now = Date.now()
    clickTimes.current = [...clickTimes.current, now].filter((t) => now - t < 3000)
    if (clickTimes.current.length >= 5) {
      clickTimes.current = []
      window.location.href = '/platform-signup'
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      setUser(user)
      navigate({ to: '/' })
    } catch {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen font-[Manrope] flex items-center justify-center p-4 overflow-hidden">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover scale-105"
        style={{ filter: 'blur(12px)' }}
      >
        <source src="/bg-video.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 w-full max-w-[560px]">
        <div className="bg-white/20 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-10">
          {/* Brand */}
          <div className="text-center mb-8">
            <div onClick={handleLogoClick} className="inline-flex items-center justify-center w-12 h-12 bg-white/20 border border-white/30 rounded-2xl mb-4 cursor-pointer select-none">
              <StationSyncLogo size={26} color="white" />
            </div>
            <h1 className="text-[24px] font-bold text-white leading-none mb-2">Welcome back</h1>
            <p className="text-[13px] text-white/60 font-medium">Sign in to your StationSync account</p>
          </div>

          {/* Email/password form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-bold tracking-widest text-white/50 uppercase block mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-[13px] font-semibold text-white placeholder:text-white/30 placeholder:font-normal focus:outline-none focus:border-white/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold tracking-widest text-white/50 uppercase block mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-11 text-[13px] font-semibold text-white placeholder:text-white/30 placeholder:font-normal focus:outline-none focus:border-white/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#bbb] hover:text-[#888] transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end -mt-1">
              <button type="button" className="text-[12px] font-semibold text-white/60 hover:text-white transition-colors">
                Forgot your password?
              </button>
            </div>

            {error && (
              <p className="text-[12px] font-semibold text-red-300 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-black/50 backdrop-blur-sm uppercase border border-white/15 text-white text-[13px] font-bold hover:bg-black/65 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/20" />
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">or continue with</span>
            <div className="flex-1 h-px bg-white/20" />
          </div>

          {/* Social buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              className="flex-1 flex items-center justify-center gap-2.5 bg-white/80 border border-white/40 rounded-2xl py-3 text-[13px] font-semibold text-[#333] hover:bg-white/90 transition-colors backdrop-blur-sm opacity-50 cursor-not-allowed"
            >
              <svg width="17" height="17" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            <button
              type="button"
              className="flex-1 flex items-center justify-center gap-2.5 bg-[#1877F2] rounded-2xl py-3 text-[13px] font-semibold text-white hover:bg-[#1464d0] transition-colors backdrop-blur-sm opacity-50 cursor-not-allowed"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="white">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </button>
          </div>

          <p className="text-center text-[13px] text-white/50 font-medium mt-6">
            Don't have an account?{' '}
            <button onClick={() => navigate({ to: '/signup' })} className="text-white font-bold hover:underline transition-colors">Sign up</button>
          </p>
        </div>

        <p className="text-center text-[11px] text-white/30 font-medium mt-4">
          © {new Date().getFullYear()} StationSync. All rights reserved.
        </p>
      </div>
    </div>
  )
}
