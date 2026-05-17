import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { AttendantModal } from './AttendantModal'

const fmt = (n: number) => `J$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

interface Props {
  onBack: () => void
  onClose: () => void
  balances?: Record<string, number>
  attendantSales?: Record<string, number>
  attendantGradeSales?: Record<string, Record<string, number>>
}

export function OveragesBreakdownModal({ onBack, onClose, balances = {}, attendantSales, attendantGradeSales }: Props) {
  useEscapeKey(onClose)
  const [selectedAttendant, setSelectedAttendant] = useState<string | null>(null)
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 537)
  const overages = Object.entries(balances).filter(([, b]) => b > 0)
  const total = overages.reduce((s, [, b]) => s + b, 0)

  useEffect(() => {
    function onResize() { setIsNarrow(window.innerWidth < 537) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (selectedAttendant) {
    return (
      <AttendantModal
        name={selectedAttendant}
        onClose={() => setSelectedAttendant(null)}
        sales={attendantSales?.[selectedAttendant]}
        gradeSales={attendantGradeSales?.[selectedAttendant]}
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
            <h2 className="text-[36px] font-bold text-[#111] leading-none mb-3">Overages</h2>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Total</p>
              <p className="text-[11px] font-bold text-green-600">{fmt(total)}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[36px] font-bold text-[#111] leading-none">Overages</h2>
            <p className="text-[36px] font-bold text-green-600 leading-none">{fmt(total)}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-2">Breakdown</p>

          {overages.length === 0 ? (
            <p className="text-[13px] font-medium text-[#bbb] py-4">No overages recorded</p>
          ) : overages.map(([name, balance]) => (
            <div key={name} className="flex items-center justify-between py-2">
              <button
                onClick={() => setSelectedAttendant(name)}
                className="text-[13px] font-semibold text-[#111] hover:text-[#555] transition-colors"
              >
                {name}
              </button>
              <p className="text-[13px] font-semibold text-green-600">+{fmt(balance)}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-[#f0f0f0] mt-4" />

        <div className="flex items-center justify-between pt-4">
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Count</p>
          <p className="text-[13px] font-semibold text-[#333]">{overages.length} Attendants</p>
        </div>
      </div>
    </div>
  )
}
