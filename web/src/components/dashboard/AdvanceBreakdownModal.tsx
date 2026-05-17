import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { AdvanceAttendantDetailModal } from './AdvanceAttendantDetailModal'
import { activityByAccount, type AdvanceRow } from './RecentActivityCard'

const advanceData: Record<string, { fuel: string; amount: number; litres: number }[]> = {
  'T. Brisco': [
    { fuel: '87', amount: 8608.08, litres: 45.2 },
  ],
  'S. Smith': [
    { fuel: '90', amount: 6150.0, litres: 30.0 },
  ],
}

const fmt = (n: number) => `J$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

interface Props {
  onBack: () => void
  onClose: () => void
}

export function AdvanceBreakdownModal({ onBack, onClose }: Props) {
  useEscapeKey(onClose)
  const [selectedAttendant, setSelectedAttendant] = useState<string | null>(null)
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 537)
  const advanceMap = activityByAccount.Advance.filter((r): r is AdvanceRow => r.type === 'advance')
    .reduce<Record<string, number>>((acc, r) => { acc[r.name] = (acc[r.name] ?? 0) + r.amount; return acc }, {})
  const attendants = Object.keys(advanceMap)
  const attendantTotal = (a: string) => advanceMap[a] ?? 0
  const total = activityByAccount.Advance.reduce((s, r) => s + r.amount, 0)

  useEffect(() => {
    function onResize() { setIsNarrow(window.innerWidth < 537) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (selectedAttendant) {
    return (
      <AdvanceAttendantDetailModal
        attendant={selectedAttendant}
        entries={advanceData[selectedAttendant]}
        onBack={() => setSelectedAttendant(null)}
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
            <h2 className="text-[36px] font-bold text-[#111] leading-none mb-3">Advance</h2>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Total</p>
              <p className="text-[11px] font-bold text-[#111]">{fmt(total)}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[36px] font-bold text-[#111] leading-none">Advance</h2>
            <p className="text-[36px] font-bold text-[#111] leading-none">{fmt(total)}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-2">Breakdown</p>

          {attendants.map((a) => (
            <div key={a} className="flex items-center justify-between py-2">
              <button
                onClick={() => setSelectedAttendant(a)}
                className="text-[13px] font-semibold text-[#111] hover:text-[#555] transition-colors"
              >
                {a}
              </button>
              <p className="text-[13px] font-semibold text-[#333]">{fmt(attendantTotal(a))}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-[#f0f0f0] mt-4" />

        <div className="flex items-center justify-between pt-4">
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Count</p>
          <p className="text-[13px] font-semibold text-[#333]">{attendants.length} Attendants</p>
        </div>
      </div>
    </div>
  )
}
