import { useState } from 'react'
import { platformSignUp } from '../lib/api'
import type { AuthUser } from '../lib/api'

interface Props {
  onSignUp: (user: AuthUser) => void
}

export function PlatformSignUpPage({ onSignUp }: Props) {
  const [step, setStep] = useState<'code' | 'register'>('code')
  const [secretKey, setSecretKey] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!secretKey.trim()) return
    setStep('register')
    setError('')
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    setError('')
    try {
      const user = await platformSignUp({ secret_key: secretKey, name, email, password })
      onSignUp(user)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full border border-[#e0e0e0] rounded-xl px-4 py-3 text-[13px] font-medium text-[#333] focus:outline-none focus:border-[#aaa] bg-white'

  return (
    <div className="min-h-screen bg-[#f4f4f4] flex items-center justify-center p-6 font-[Manrope]">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8">
        <div className="mb-8">
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mb-1">StationSync</p>
          <h1 className="text-[28px] font-bold text-[#111] leading-tight">
            {step === 'code' ? 'Platform Access' : 'Create account'}
          </h1>
          <p className="text-[13px] text-[#888] font-medium mt-1">
            {step === 'code' ? 'Enter your access code to continue' : 'Set up your platform admin account'}
          </p>
        </div>

        {step === 'code' ? (
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase block mb-2">Access Code</label>
              <input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="••••••••••••"
                className={inputCls}
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={!secretKey.trim()}
              className="w-full py-3.5 bg-[#111] text-white rounded-xl text-[14px] font-semibold hover:bg-[#222] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase block mb-2">Full Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={inputCls} autoFocus />
            </div>
            <div>
              <label className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase block mb-2">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
            </div>
            <div>
              <label className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase block mb-2">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputCls} />
            </div>
            <div>
              <label className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase block mb-2">Confirm Password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" className={inputCls} />
            </div>
            {error && <p className="text-[12px] font-semibold text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading || !name || !email || !password || !confirm}
              className="w-full py-3.5 bg-[#111] text-white rounded-xl text-[14px] font-semibold hover:bg-[#222] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
            <button type="button" onClick={() => { setStep('code'); setError('') }} className="w-full text-[13px] font-semibold text-[#aaa] hover:text-[#555] transition-colors">
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
