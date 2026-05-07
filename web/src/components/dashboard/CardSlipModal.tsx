import { X } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import type { CardRow } from './RecentActivityCard'

interface Props {
  row: CardRow
  onClose: () => void
}

function SlipLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <p className="text-[12px] font-semibold text-[#888]">{label}</p>
      <p className="text-[12px] font-semibold text-[#222]">{value}</p>
    </div>
  )
}

export function CardSlipModal({ row, onClose }: Props) {
  useEscapeKey(onClose)

  const amount = row.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[480px] p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end mb-8">
          <button
            onClick={onClose}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            <X size={13} />
            Close
          </button>
        </div>

        <div className="bg-[#fafafa] rounded-2xl border border-[#f0f0f0] p-6">
          <div className="text-center mb-6">
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#aaa] uppercase mb-1">StationSync</p>
            <p className="text-[20px] font-bold text-[#111]">Card Transaction Slip</p>
          </div>

          <div className="border-t border-dashed border-[#ddd] mb-4" />

          <div className="mb-4">
            <SlipLine label="Attendant" value={row.name} />
            <SlipLine label="Bank" value={row.bank} />
            <SlipLine label="Litres" value={row.litres.toFixed(2)} />
          </div>

          <div className="border-t border-dashed border-[#ddd] mb-4" />

          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Total</p>
            <p className="text-[22px] font-bold text-[#111]">
              <span className="text-[13px] font-bold text-[#aaa] mr-0.5">J$</span>
              {amount}
            </p>
          </div>

          <div className="border-t border-dashed border-[#ddd] mt-4 mb-6" />

          <div className="flex items-end justify-between">
            <div className="flex-1 mr-8">
              <p className="text-[11px] font-semibold text-[#bbb] mb-6">Cardholder signature</p>
              <div className="border-b border-[#ddd]" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-semibold text-[#bbb] mb-6">Date</p>
              <div className="border-b border-[#ddd]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
