import { ArrowLeft } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'

interface Transaction {
  transNo: string
  attendant: string
  amount: number
}

interface Props {
  bank: string
  transactions: Transaction[]
  onBack: () => void
  onClose: () => void
}

export function CardBankDetailModal({ bank, transactions, onBack, onClose }: Props) {
  useEscapeKey(onClose)

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
          <h2 className="text-[36px] font-bold text-[#111] leading-none">{bank}</h2>
          <p className="text-[36px] font-bold text-[#111] leading-none">J$0.00</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-2">Breakdown</p>

          {transactions.map((t, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div>
                <p className="text-[13px] font-semibold text-[#111]">{t.transNo}</p>
                <p className="text-[11px] font-medium text-[#888] mt-0.5">{t.attendant}</p>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-[13px] font-semibold text-[#bbb]">--</p>
                <button className="flex items-center gap-2 border border-[#ddd] rounded-full px-3 py-1 text-[12px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors">
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[#f0f0f0] mt-4" />

        <div className="flex justify-end pt-4">
          <label className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors cursor-pointer">
            <input type="file" className="hidden" />
            Add settlement
          </label>
        </div>
      </div>
    </div>
  )
}
