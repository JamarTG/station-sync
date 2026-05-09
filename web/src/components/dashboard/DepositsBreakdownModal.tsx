import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { DepositsDepositedByDetailModal } from './DepositsDepositedByDetailModal'
import { activityByAccount, type DepositRow } from './RecentActivityCard'

const depositsData: Record<string, { depositType: string; description: string; amount: number }[]> = {
  'S. Lawes': [
    { depositType: 'Cash', description: 'Shift end deposit', amount: 150000.0 },
  ],
  'S. Smith': [
    { depositType: 'Card', description: 'Card settlement', amount: 45000.0 },
  ],
  'T. Brisco': [
    { depositType: 'FX', description: 'FX deposit', amount: 32000.0 },
  ],
}

const fmt = (n: number) => `J$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

interface Props {
  onBack: () => void
  onClose: () => void
}

export function DepositsBreakdownModal({ onBack, onClose }: Props) {
  useEscapeKey(onClose)
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null)
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 537)
  const depositorMap = activityByAccount.Deposits.filter((r): r is DepositRow => r.type === 'deposit')
    .reduce<Record<string, number>>((acc, r) => { acc[r.name] = (acc[r.name] ?? 0) + r.amount; return acc }, {})
  const depositedByList = Object.keys(depositorMap)
  const personTotal = (p: string) => depositorMap[p] ?? 0
  const total = activityByAccount.Deposits.reduce((s, r) => s + r.amount, 0)

  useEffect(() => {
    function onResize() { setIsNarrow(window.innerWidth < 537) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (selectedPerson) {
    return (
      <DepositsDepositedByDetailModal
        depositedBy={selectedPerson}
        entries={depositsData[selectedPerson]}
        onBack={() => setSelectedPerson(null)}
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
            <h2 className="text-[36px] font-bold text-[#111] leading-none mb-3">Deposits</h2>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Total</p>
              <p className="text-[11px] font-bold text-[#111]">{fmt(total)}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[36px] font-bold text-[#111] leading-none">Deposits</h2>
            <p className="text-[36px] font-bold text-[#111] leading-none">{fmt(total)}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-2">Breakdown</p>

          {depositedByList.map((person) => (
            <div key={person} className="flex items-center justify-between py-2">
              <button
                onClick={() => setSelectedPerson(person)}
                className="text-[13px] font-semibold text-[#111] hover:text-[#555] transition-colors"
              >
                {person}
              </button>
              <p className="text-[13px] font-semibold text-[#333]">{fmt(personTotal(person))}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-[#f0f0f0] mt-4" />

        <div className="flex items-center justify-between pt-4">
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Count</p>
          <p className="text-[13px] font-semibold text-[#333]">{depositedByList.length} People</p>
        </div>
      </div>
    </div>
  )
}
