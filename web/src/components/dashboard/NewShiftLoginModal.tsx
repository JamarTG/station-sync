import { useState } from 'react'
import { X, Eye, EyeOff } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'

interface Props {
  onClose: () => void
  onConfirm: () => void
}

export function NewShiftLoginModal({ onClose, onConfirm }: Props) {
  useEscapeKey(onClose)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onConfirm()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[440px] p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end mb-8">
          <button
            onClick={onClose}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            <X size={13} />
            Cancel
          </button>
        </div>

        <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">New shift</h2>
        <p className="text-[14px] text-[#888] font-medium mb-8">Sign in to continue to the new shift</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-[13px] font-semibold text-[#888] block mb-2">email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full border border-[#e0e0e0] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] focus:outline-none focus:border-[#bbb] transition-colors"
            />
          </div>

          <div>
            <label className="text-[13px] font-semibold text-[#888] block mb-2">password</label>
            <div className="flex items-center border border-[#e0e0e0] rounded-xl px-4 py-2.5 gap-2 focus-within:border-[#bbb] transition-colors">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="flex-1 text-[13px] font-semibold text-[#333] focus:outline-none bg-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-[#aaa] hover:text-[#555] transition-colors flex-shrink-0"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="mt-2 w-full py-4 rounded-2xl bg-[#111] text-[15px] font-semibold text-white hover:bg-[#222] transition-colors"
          >
            Continue to new shift
          </button>
        </form>
      </div>
    </div>
  )
}
