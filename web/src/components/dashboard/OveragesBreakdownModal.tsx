import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { AttendantModal } from './AttendantModal'

const attendants = ['T. Brisco', 'S. Smith', 'S. Lawes', 'A. Lewis']

interface Props {
  onBack: () => void
  onClose: () => void
}

export function OveragesBreakdownModal({ onBack, onClose }: Props) {
  useEscapeKey(onClose)
  const [selectedAttendant, setSelectedAttendant] = useState<string | null>(null)

  if (selectedAttendant) {
    return (
      <AttendantModal
        name={selectedAttendant}
        onClose={() => setSelectedAttendant(null)}
      />
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[640px] p-8 shadow-xl h-[820px] overflow-y-auto"
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
          <h2 className="text-[36px] font-bold text-[#111] leading-none">Overages</h2>
          <p className="text-[36px] font-bold text-[#111] leading-none">J$0.00</p>
        </div>

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

        <div className="border-t border-[#f0f0f0] mt-4" />

        <div className="flex items-center justify-between pt-4">
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Count</p>
          <p className="text-[13px] font-semibold text-[#333]">{attendants.length} Attendants</p>
        </div>
      </div>
    </div>
  )
}
