import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { FXAttendantDetailModal } from './FXAttendantDetailModal'

const fxData: Record<string, { currency: string; amount: number; rate: number }[]> = {
  'S. Smith': [
    { currency: 'USD', amount: 500, rate: 150 },
  ],
  'T. Brisco': [
    { currency: 'EUR', amount: 200, rate: 160 },
  ],
}

const attendants = Object.keys(fxData)

interface Props {
  onBack: () => void
  onClose: () => void
}

export function FXBreakdownModal({ onBack, onClose }: Props) {
  useEscapeKey(onClose)
  const [selectedAttendant, setSelectedAttendant] = useState<string | null>(null)

  if (selectedAttendant) {
    return (
      <FXAttendantDetailModal
        attendant={selectedAttendant}
        entries={fxData[selectedAttendant]}
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

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[36px] font-bold text-[#111] leading-none">FX</h2>
          <p className="text-[36px] font-bold text-[#111] leading-none">J$0.00</p>
        </div>

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
              <p className="text-[13px] font-semibold text-[#bbb]">--</p>
            </div>
          ))}
        </div>

        <div className="border-t border-[#f0f0f0] mt-4" />

        <div className="flex items-center justify-between pt-4">
          <p className="text-[11px] font-bold tracking-widests text-[#aaa] uppercase">Count</p>
          <p className="text-[13px] font-semibold text-[#333]">{attendants.length} Attendants</p>
        </div>
      </div>
    </div>
  )
}
