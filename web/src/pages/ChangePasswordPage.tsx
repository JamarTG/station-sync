import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { StationSyncLogo } from '../components/StationSyncLogo'
import { changePassword } from '../lib/api'
import { useAuth } from '../lib/authContext'

export function ChangePasswordPage({ onDone }: { onDone?: () => void }) {
  const { user, setUser } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const mismatch = confirm.length > 0 && confirm !== next
  const canSubmit = current.length > 0 && next.length >= 6 && next === confirm

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError('')
    try {
      await changePassword(current, next)
      if (user) setUser({ ...user, must_change_password: false })
      onDone?.()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg === 'current password is incorrect' ? 'The current password you entered is incorrect.' : 'Failed to update password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen font-[Manrope] flex items-center justify-center p-4 overflow-hidden">
      <video
        autoPlay loop muted playsInline
        className="absolute inset-0 w-full h-full object-cover scale-105"
        style={{ filter: 'blur(12px)' }}
      >
        <source src="/bg-video.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/40" />

      <div className="relative z-10 w-full max-w-[480px]">
        <div className="bg-white/20 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-10">

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 border border-white/30 rounded-2xl mb-4">
              <StationSyncLogo size={26} color="white" />
            </div>
            <h1 className="text-[22px] font-bold text-white leading-tight mb-2">Set your password</h1>
            <p className="text-[13px] text-white/60 font-medium leading-snug">
              Your account was set up with a temporary password.<br />
              Please create a new password to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-bold tracking-widest text-white/50 uppercase block mb-2">Temporary password</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-11 text-[13px] font-semibold text-white placeholder:text-white/30 placeholder:font-normal focus:outline-none focus:border-white/50 transition-colors"
                />
                <button type="button" onClick={() => setShowCurrent((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                  {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold tracking-widest text-white/50 uppercase block mb-2">New password</label>
              <div className="relative">
                <input
                  type={showNext ? 'text' : 'password'}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-11 text-[13px] font-semibold text-white placeholder:text-white/30 placeholder:font-normal focus:outline-none focus:border-white/50 transition-colors"
                />
                <button type="button" onClick={() => setShowNext((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                  {showNext ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold tracking-widest text-white/50 uppercase block mb-2">Confirm new password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full bg-white/10 border rounded-xl px-4 py-3 pr-11 text-[13px] font-semibold text-white placeholder:text-white/30 placeholder:font-normal focus:outline-none transition-colors ${
                    mismatch ? 'border-red-400 focus:border-red-400' : 'border-white/20 focus:border-white/50'
                  }`}
                />
                <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {mismatch && <p className="text-[11px] font-semibold text-red-400 mt-1.5">Passwords do not match</p>}
            </div>

            {error && <p className="text-[12px] font-semibold text-red-300 text-center">{error}</p>}

            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="w-full py-3.5 rounded-2xl bg-black/50 backdrop-blur-sm border border-white/15 text-white text-[13px] font-bold uppercase tracking-widest hover:bg-black/65 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-1"
            >
              {loading ? 'Updating…' : 'Set password & continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
