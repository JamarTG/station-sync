import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { ExpenditureModal } from './ExpenditureModal'
import type { ExpenditureRow } from './RecentActivityCard'

const largeDenominations = [5000, 2000, 1000, 500, 100, 50]
const smallDenominations = [20, 10, 5, 1]
const allDenominations = [...largeDenominations, ...smallDenominations]

const fmt = (n: number) => `J$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

interface Props {
  row: ExpenditureRow
  onBack: () => void
  onClose: () => void
}

function DenomRow({ d, count }: { d: number; count: number }) {
  const subtotal = d * count
  return (
    <div className="flex items-center py-2">
      <p className="flex-1 text-[13px] font-semibold text-[#111]">J${d.toLocaleString()}</p>
      <p className="w-16 text-center text-[13px] text-[#888]">{count > 0 ? count : '—'}</p>
      <p className="w-36 text-right text-[13px] font-semibold text-[#bbb]">
        {subtotal > 0 ? fmt(subtotal) : '--'}
      </p>
    </div>
  )
}

export function ExpenditureDetailModal({ row, onBack, onClose }: Props) {
  useEscapeKey(onClose)
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <ExpenditureModal
        initialData={{ requestedBy: row.requestedBy, description: row.description }}
        isEditing
        onBack={() => setEditing(false)}
        onClose={onClose}
      />
    )
  }

  const denoms = row.denominations ?? {}
  const hasBreakdown = allDenominations.some((d) => (denoms[d] ?? 0) > 0)

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

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[36px] font-bold text-[#111] leading-none truncate pr-4">{row.description}</h2>
          <p className="text-[36px] font-bold text-[#111] leading-none flex-shrink-0">{fmt(row.amount)}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-2">Breakdown</p>

          {hasBreakdown ? (
            <>
              <div className="flex items-center pb-1 border-b border-[#f4f4f4] mb-1">
                <p className="flex-1 text-[11px] font-semibold text-[#bbb] uppercase">Note</p>
                <p className="w-16 text-center text-[11px] font-semibold text-[#bbb] uppercase">Count</p>
                <p className="w-36 text-right text-[11px] font-semibold text-[#bbb] uppercase">Subtotal</p>
              </div>
              {largeDenominations.map((d) => <DenomRow key={d} d={d} count={denoms[d] ?? 0} />)}
              <div className="border-t border-[#f0f0f0] my-2" />
              {smallDenominations.map((d) => <DenomRow key={d} d={d} count={denoms[d] ?? 0} />)}
            </>
          ) : (
            <p className="text-[13px] text-[#bbb] font-medium py-4">No denomination breakdown recorded</p>
          )}
        </div>

        <div className="border-t border-[#f0f0f0] mt-4" />

        <div className="flex items-center justify-between pt-4">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Requested by</p>
            <p className="text-[13px] font-semibold text-[#333] mt-0.5">{row.requestedBy}</p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  )
}
