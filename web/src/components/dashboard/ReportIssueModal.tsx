import { useState } from 'react'
import { X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { createIssue } from '../../lib/api'

const categories = ['Equipment', 'Safety', 'Fuel', 'Staff', 'Customer', 'Other']

interface Props {
  onClose: () => void
}

export function ReportIssueModal({ onClose }: Props) {
  useEscapeKey(onClose)
  const qc = useQueryClient()
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!category || !description.trim()) return
    setLoading(true)
    try {
      await createIssue({ category, description })
      await qc.invalidateQueries({ queryKey: ['issues'] })
      setSubmitted(true)
    } catch {
      // silently fail — user can retry
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[720px] p-8 shadow-xl"
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

        {submitted ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[#f0f0f0] flex items-center justify-center mb-4">
              <span className="text-[20px]">✓</span>
            </div>
            <h2 className="text-[24px] font-bold text-[#111] leading-none mb-2">Issue reported</h2>
            <p className="text-[14px] text-[#888] font-medium mb-8">Your report has been submitted.</p>
            <button
              onClick={onClose}
              className="w-full py-4 rounded-2xl bg-[#111] text-[15px] font-semibold text-white hover:bg-[#222] transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Action</p>
            <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">Report an issue</h2>
            <p className="text-[14px] text-[#888] font-medium mb-8">Describe the issue and we'll look into it.</p>

            <div className="mb-5">
              <label className="text-[13px] font-semibold text-[#888] block mb-2">Category</label>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`px-4 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                      category === c
                        ? 'bg-[#111] text-white border-[#111]'
                        : 'bg-white text-[#555] border-[#ddd] hover:bg-[#f4f4f4]'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <label className="text-[13px] font-semibold text-[#888] block mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue..."
                rows={5}
                className="w-full border border-[#e0e0e0] rounded-xl px-4 py-3 text-[13px] font-medium text-[#333] focus:outline-none resize-none placeholder:text-[#ccc]"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!category || !description.trim() || loading}
              className="w-full py-4 rounded-2xl bg-[#111] text-[15px] font-semibold text-white hover:bg-[#222] transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              {loading ? 'Submitting…' : 'Submit'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
