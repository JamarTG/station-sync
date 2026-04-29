import { X } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'

const recordTypes = [
  {
    id: 'drop',
    label: 'Drop',
    description: 'A deposit from a pump, attendant',
  },
  {
    id: 'fuel-receival',
    label: 'Fuel Receival',
    description: 'The credit card machine receipt records',
  },
  {
    id: 'expenditure',
    label: 'Expenditure',
    description: 'Cash payments taken from sales',
  },
  {
    id: 'deposit',
    label: 'Deposit',
    description: 'A bank deposit of collected cash',
  },
]

interface Props {
  onClose: () => void
  onSelectDrop: () => void
  onSelectExpenditure: () => void
  onSelectFuelReceival: () => void
  onSelectDeposit: () => void
}

export function RecordModal({ onClose, onSelectDrop, onSelectExpenditure, onSelectFuelReceival, onSelectDeposit }: Props) {
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
        {/* Top bar */}
        <div className="flex items-center justify-end mb-8">
          <button
            onClick={onClose}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            <X size={13} />
            Cancel
          </button>
        </div>

        {/* Heading */}
        <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">Record a...</h2>
        <p className="text-[14px] text-[#888] font-medium mb-8">Choose a type</p>

        {/* Type cards */}
        <div className="flex gap-4 overflow-x-auto pb-1">
          {recordTypes.map((type) => (
            <button
              key={type.id}
              onClick={
                type.id === 'drop' ? onSelectDrop
                : type.id === 'expenditure' ? onSelectExpenditure
                : type.id === 'fuel-receival' ? onSelectFuelReceival
                : type.id === 'deposit' ? onSelectDeposit
                : undefined
              }
              className="flex flex-col flex-shrink-0 w-[210px] border border-[#e0e0e0] rounded-2xl p-5 text-left hover:border-[#bbb] hover:bg-[#fafafa] transition-colors"
            >
              {/* Icon placeholder */}
              <div className="w-16 h-16 border border-[#e0e0e0] rounded-2xl mb-8 self-center" />

              {/* Description */}
              <p className="text-[12px] text-[#888] text-center leading-snug mb-4 px-1">
                {type.description}
              </p>

              {/* Label */}
              <p className="text-[22px] font-bold text-[#111] mt-auto">{type.label}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
