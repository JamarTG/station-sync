import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { activityByAccount } from './RecentActivityCard'

const largeDenominations = [5000, 2000, 1000, 500, 100, 50]
const smallDenominations = [20, 10, 5, 1]
const allDenominations = [...largeDenominations, ...smallDenominations]

interface Props {
  onBack: () => void
  onClose: () => void
}

function buildCounts(): Record<number, number> {
  const counts: Record<number, number> = Object.fromEntries(allDenominations.map((d) => [d, 0]))

  for (const row of activityByAccount.Cash) {
    if (row.type === 'attendant' && row.denominations) {
      for (const [d, n] of Object.entries(row.denominations)) {
        counts[Number(d)] = (counts[Number(d)] ?? 0) + n
      }
    }
  }

  for (const row of activityByAccount.Deposits) {
    if (row.type === 'deposit' && row.depositType === 'Cash' && row.denominations) {
      for (const [d, n] of Object.entries(row.denominations)) {
        counts[Number(d)] = (counts[Number(d)] ?? 0) + n
      }
    }
  }

  for (const row of activityByAccount.Expenditures) {
    if (row.type === 'expenditure' && row.denominations) {
      for (const [d, n] of Object.entries(row.denominations)) {
        counts[Number(d)] = (counts[Number(d)] ?? 0) - n
      }
    }
  }

  return counts
}

function DenomRow({ d, count }: { d: number; count: number }) {
  const subtotal = d * Math.max(0, count)
  return (
    <div className="flex items-center py-2">
      <p className="flex-1 text-[13px] font-semibold text-[#111]">J${d.toLocaleString()}</p>
      <p className="w-16 text-center text-[13px] text-[#888]">{count > 0 ? count : '—'}</p>
      <p className="w-36 text-right text-[13px] font-semibold text-[#bbb]">
        {subtotal > 0 ? `J$${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '--'}
      </p>
    </div>
  )
}

export function CashBreakdownModal({ onBack, onClose }: Props) {
  useEscapeKey(onClose)
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 537)

  useEffect(() => {
    function onResize() { setIsNarrow(window.innerWidth < 537) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const counts = buildCounts()
  const total = allDenominations.reduce((sum, d) => sum + d * Math.max(0, counts[d] ?? 0), 0)
  const totalNotes = allDenominations.reduce((sum, d) => sum + Math.max(0, counts[d] ?? 0), 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[640px] p-8 shadow-xl h-[820px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onBack}
          className="self-start flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors mb-8"
        >
          <ArrowLeft size={13} />
          Go back
        </button>

        {isNarrow ? (
          <div className="mb-6">
            <h2 className="text-[36px] font-bold text-[#111] leading-none mb-3">Cash</h2>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Total</p>
              <p className="text-[11px] font-bold text-[#111]">J${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[36px] font-bold text-[#111] leading-none">Cash</h2>
            <p className="text-[36px] font-bold text-[#111] leading-none">J${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-2">Breakdown</p>
          <div className="flex items-center pb-1 border-b border-[#f4f4f4] mb-1">
            <p className="flex-1 text-[11px] font-semibold text-[#bbb] uppercase">Note</p>
            <p className="w-16 text-center text-[11px] font-semibold text-[#bbb] uppercase">Count</p>
            <p className="w-36 text-right text-[11px] font-semibold text-[#bbb] uppercase">Subtotal</p>
          </div>

          {largeDenominations.map((d) => <DenomRow key={d} d={d} count={counts[d] ?? 0} />)}
          <div className="border-t border-[#f0f0f0] my-2" />
          {smallDenominations.map((d) => <DenomRow key={d} d={d} count={counts[d] ?? 0} />)}
        </div>

        <div className="border-t border-[#f0f0f0] mt-4" />
        <div className="flex items-center justify-between pt-4">
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Count</p>
          <p className="text-[13px] font-semibold text-[#333]">{totalNotes} Notes</p>
        </div>
      </div>
    </div>
  )
}
