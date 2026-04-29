import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { ExpenditureDetailModal } from './ExpenditureDetailModal'

const expenditures = [
  { description: 'Office supplies', requestedBy: 'A. Lewis', amount: 5000.0 },
  { description: 'Equipment repair', requestedBy: 'T. Brisco', amount: 12000.0 },
]

interface Props {
  onBack: () => void
  onClose: () => void
}

export function ExpenditureBreakdownModal({ onBack, onClose }: Props) {
  useEscapeKey(onClose)
  const [selected, setSelected] = useState<typeof expenditures[0] | null>(null)

  if (selected) {
    return (
      <ExpenditureDetailModal
        description={selected.description}
        requestedBy={selected.requestedBy}
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
          className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors mb-8"
        >
          <ArrowLeft size={13} />
          Go back
        </button>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[36px] font-bold text-[#111] leading-none">Expenditures</h2>
          <p className="text-[36px] font-bold text-[#111] leading-none">J$0.00</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-2">Breakdown</p>

          {expenditures.map((e, i) => (
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
              <p className="text-[13px] font-semibold text-[#bbb]">--</p>
            </div>
          ))}
        </div>

        <div className="border-t border-[#f0f0f0] mt-4" />

        <div className="flex items-center justify-between pt-4">
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Count</p>
          <p className="text-[13px] font-semibold text-[#333]">{expenditures.length} Items</p>
        </div>
      </div>
    </div>
  )
}
