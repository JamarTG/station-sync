import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { ExpenditureDetailModal } from './ExpenditureDetailModal'
import { activityByAccount, type ExpenditureRow } from './RecentActivityCard'

const fmt = (n: number) => `J$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

interface Props {
  onBack: () => void
  onClose: () => void
}

export function ExpenditureBreakdownModal({ onBack, onClose }: Props) {
  useEscapeKey(onClose)
  const expenditureRows = activityByAccount.Expenditures.filter((r): r is ExpenditureRow => r.type === 'expenditure')
  const [selected, setSelected] = useState<ExpenditureRow | null>(null)
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 537)
  const total = expenditureRows.reduce((sum, e) => sum + e.amount, 0)

  useEffect(() => {
    function onResize() { setIsNarrow(window.innerWidth < 537) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (selected) {
    return (
      <ExpenditureDetailModal
        row={selected}
        onBack={() => setSelected(null)}
        onClose={onClose}
      />
    )
  }

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
            <h2 className="text-[36px] font-bold text-[#111] leading-none mb-3">Expenditures</h2>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Total</p>
              <p className="text-[11px] font-bold text-[#111]">{fmt(total)}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[36px] font-bold text-[#111] leading-none">Expenditures</h2>
            <p className="text-[36px] font-bold text-[#111] leading-none">{fmt(total)}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-2">Breakdown</p>

          {expenditureRows.map((e, i) => (
            <div key={i} className="flex items-start justify-between py-2">
              <div>
                <button
                  onClick={() => setSelected(e)}
                  className="text-[13px] font-semibold text-[#111] hover:text-[#555] transition-colors text-left"
                >
                  {e.description}
                </button>
                <p className="text-[11px] font-medium text-[#888] mt-0.5">{e.requestedBy}</p>
              </div>
              <p className="text-[13px] font-semibold text-[#333]">{fmt(e.amount)}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-[#f0f0f0] mt-4" />

        <div className="flex items-center justify-between pt-4">
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Count</p>
          <p className="text-[13px] font-semibold text-[#333]">{expenditureRows.length} Items</p>
        </div>
      </div>
    </div>
  )
}
