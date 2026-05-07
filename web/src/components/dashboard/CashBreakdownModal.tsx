import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { fmtInput, parseInput } from '../../lib/fmt'

const largeDenominations = [5000, 2000, 1000, 500, 100, 50]
const smallDenominations = [20, 10, 5, 1]
const allDenominations = [...largeDenominations, ...smallDenominations]

const zeroCounts = Object.fromEntries(allDenominations.map((d) => [d, 0]))

interface Props {
  onBack: () => void
  onClose: () => void
}

export function CashBreakdownModal({ onBack, onClose }: Props) {
  useEscapeKey(onClose)
  const [savedCounts, setSavedCounts] = useState<Record<number, number>>(zeroCounts)
  const [editCounts, setEditCounts] = useState<Record<number, string>>({})
  const [isEditing, setIsEditing] = useState(false)
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 537)

  useEffect(() => {
    function onResize() { setIsNarrow(window.innerWidth < 537) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const expectedTotal = 0

  function totalFromCounts(counts: Record<number, number>) {
    return allDenominations.reduce((sum, d) => sum + d * (counts[d] ?? 0), 0)
  }

  function totalFromEditCounts() {
    return allDenominations.reduce((sum, d) => sum + d * (parseInt(editCounts[d] ?? '') || 0), 0)
  }

  const actualTotal = totalFromCounts(savedCounts)
  const liveTotal = isEditing ? totalFromEditCounts() : actualTotal
  const difference = liveTotal - expectedTotal

  const totalNotes = allDenominations.reduce((sum, d) => sum + (savedCounts[d] ?? 0), 0)

  function startEditing() {
    setEditCounts(Object.fromEntries(allDenominations.map((d) => [d, savedCounts[d] === 0 ? '' : String(savedCounts[d])])))
    setIsEditing(true)
  }

  function saveEditing() {
    setSavedCounts(Object.fromEntries(allDenominations.map((d) => [d, parseInt(editCounts[d] ?? '') || 0])))
    setIsEditing(false)
  }

  function renderDenominationRow(d: number) {
    const count = savedCounts[d] ?? 0
    const subtotal = d * count

    if (isEditing) {
      return (
        <div key={d} className="flex items-center justify-between py-2 gap-4">
          <p className="text-[13px] font-semibold text-[#111] w-16 flex-shrink-0">${d.toLocaleString()}</p>
          <input
            type="text"
            value={fmtInput(editCounts[d] ?? '')}
            onChange={(e) => setEditCounts((prev) => ({ ...prev, [d]: parseInput(e.target.value) }))}
            placeholder="0"
            className="w-20 border border-[#e0e0e0] rounded-lg px-3 py-1.5 text-[13px] font-semibold text-[#333] focus:outline-none text-center"
          />
          <p className="text-[13px] font-semibold text-[#bbb] text-right flex-1">
            {(d * (parseInt(editCounts[d] ?? '') || 0)) > 0
              ? `J$${(d * (parseInt(editCounts[d] ?? '') || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
              : '--'}
          </p>
        </div>
      )
    }

    return (
      <div key={d} className="flex items-center justify-between py-2">
        <p className="text-[13px] font-semibold text-[#111]">${d.toLocaleString()}</p>
        <p className="text-[13px] font-semibold text-[#bbb]">{subtotal > 0 ? `J$${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '--'}</p>
      </div>
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
          <div className="mb-2">
            <h2 className="text-[36px] font-bold text-[#111] leading-none mb-3">Cash</h2>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Total</p>
              <p className="text-[11px] font-bold text-[#111]">J$0.00</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[36px] font-bold text-[#111] leading-none">Cash</h2>
            <p className="text-[36px] font-bold text-[#111] leading-none">J$0.00</p>
          </div>
        )}

        {!isEditing && (
          <div className="flex justify-end mb-4">
            <button
              onClick={startEditing}
              className="text-[13px] font-semibold text-[#555] border border-[#ddd] rounded-full px-4 py-1.5 hover:bg-[#f4f4f4] transition-colors"
            >
              Update
            </button>
          </div>
        )}

        {isEditing && <div className="mb-4" />}

        <div className="flex-1 overflow-y-auto">
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-2">Breakdown</p>

          {largeDenominations.map(renderDenominationRow)}

          <div className="border-t border-[#f0f0f0] my-2" />

          {smallDenominations.map(renderDenominationRow)}

          <div className="border-t border-[#f0f0f0] my-4" />

          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Difference</p>
            <p className={`text-[13px] font-semibold ${difference === 0 ? 'text-[#bbb]' : difference > 0 ? 'text-green-600' : 'text-red-500'}`}>
              {difference === 0 ? '--' : `${difference > 0 ? '+' : ''}J$${difference.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            </p>
          </div>
        </div>

        <div className="border-t border-[#f0f0f0] mt-4" />

        {isEditing ? (
          <button
            onClick={saveEditing}
            className="mt-4 w-full py-3 rounded-2xl bg-[#111] text-[14px] font-semibold text-white hover:bg-[#333] transition-colors"
          >
            Save
          </button>
        ) : (
          <div className="flex items-center justify-between pt-4">
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Count</p>
            <p className="text-[13px] font-semibold text-[#333]">{totalNotes} Notes</p>
          </div>
        )}
      </div>
    </div>
  )
}
