import { ArrowLeft, X } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'

const depositTypes = [
  {
    id: 'cash',
    label: 'Cash',
    description: 'A physical cash deposit made to the bank',
  },
  {
    id: 'cheque',
    label: 'Cheque',
    description: 'A cheque deposit made to the bank',
  },
  {
    id: 'card',
    label: 'Card',
    description: 'A card settlement deposit made to the bank',
  },
  {
    id: 'fx',
    label: 'FX',
    description: 'A foreign exchange deposit made to the bank',
  },
]

interface Props {
  onBack: () => void
  onClose: () => void
}

export function DepositModal({ onBack, onClose }: Props) {
  useEscapeKey(onClose)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[740px] p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            <ArrowLeft size={13} />
            Go back
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            <X size={13} />
            Cancel
          </button>
        </div>

        <div className="mb-8">
          <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">Record a deposit</h2>
          <p className="text-[14px] text-[#888] font-medium">Choose a type</p>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-1">
          {depositTypes.map((type) => (
            <button
              key={type.id}
              className="flex flex-col flex-shrink-0 w-[180px] border border-[#e0e0e0] rounded-2xl p-5 text-left hover:border-[#bbb] hover:bg-[#fafafa] transition-colors"
            >
              <div className="w-16 h-16 border border-[#e0e0e0] rounded-2xl mb-8 self-center" />
              <p className="text-[12px] text-[#888] text-center leading-snug mb-4 px-1">
                {type.description}
              </p>
              <p className="text-[22px] font-bold text-[#111] mt-auto">{type.label}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
