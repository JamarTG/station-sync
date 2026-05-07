import { useState } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { fmtInput, parseInput } from '../../lib/fmt'

const denominations = [5000, 2000, 1000, 500, 100, 50, 20, 10, 5, 1]

interface Props {
  onBack: () => void
  onClose: () => void
  isEditing?: boolean
  initialData?: { depositedBy: string; description: string }
}

export function CashDepositEntryModal({ onBack, onClose, isEditing, initialData }: Props) {
  useEscapeKey(onClose)
  const [counts, setCounts] = useState<Record<number, string>>({})
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [depositedBy, setDepositedBy] = useState(initialData?.depositedBy ?? '')

  const total = denominations.reduce((sum, d) => {
    const n = parseInt(counts[d] ?? '', 10)
    return sum + (isNaN(n) ? 0 : n * d)
  }, 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[740px] p-8 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-8">
          {!isEditing ? (
            <button
              onClick={onBack}
              className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
            >
              <ArrowLeft size={13} />
              Go back
            </button>
          ) : <div />}
          <button
            onClick={onClose}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            <X size={13} />
            Cancel
          </button>
        </div>

        <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">{isEditing ? 'Edit cash deposit' : 'Record cash deposit'}</h2>
        <p className="text-[14px] text-[#888] font-medium mb-6">Please use accurate info</p>

        <p className="text-[13px] font-semibold text-[#888] mb-2">description</p>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-[#e0e0e0] rounded-xl px-4 py-3 text-[13px] font-medium text-[#333] focus:outline-none mb-6"
        />

        <p className="text-[13px] font-semibold text-[#888] mb-2">amount</p>
        <table className="w-full border border-[#e0e0e0] rounded-xl overflow-hidden mb-6">
          <tbody>
            {denominations.map((d) => (
              <tr key={d} className="border-b border-[#e0e0e0] last:border-b-0">
                <td className="border-r border-[#e0e0e0] px-3 py-2 w-1/2">
                  <input
                    type="text"
                    value={fmtInput(counts[d] ?? '')}
                    onChange={(e) => setCounts((prev) => ({ ...prev, [d]: parseInput(e.target.value) }))}
                    className="w-full text-[13px] font-medium text-[#333] focus:outline-none bg-transparent"
                  />
                </td>
                <td className="px-3 py-2 text-center text-[13px] font-medium text-[#333]">
                  {d.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Total</p>
        <p className="text-[36px] font-bold text-[#111] leading-none tracking-tight mb-6">
          <span className="text-[20px] font-bold text-[#aaa] mr-1">J$</span>
          {total.toLocaleString()}
        </p>

        <div className="mb-8">
          <label className="text-[13px] font-semibold text-[#888] block mb-2">deposited by</label>
          <input
            type="text"
            value={depositedBy}
            onChange={(e) => setDepositedBy(e.target.value)}
            className="w-full border border-[#e0e0e0] rounded-xl px-4 py-3 text-[13px] font-medium text-[#333] focus:outline-none"
          />
        </div>

        <button className="w-full py-4 rounded-2xl border border-[#e0e0e0] text-[15px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors">
          Submit
        </button>
      </div>
    </div>
  )
}
