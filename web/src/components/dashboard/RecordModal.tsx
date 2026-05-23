import { X, ArrowDownToLine, Fuel, MinusCircle, Landmark, ChevronRight } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'

const recordTypes = [
  { id: 'drop',          label: 'Drop',          icon: ArrowDownToLine, description: 'A deposit from a pump, attendant' },
  { id: 'fuel-receival', label: 'Fuel Receival',  icon: Fuel,            description: 'Record incoming fuel delivery to a tank' },
  { id: 'expenditure',   label: 'Expenditure',    icon: MinusCircle,     description: 'Cash payments taken from sales' },
  { id: 'deposit',       label: 'Deposit',        icon: Landmark,        description: 'A bank deposit of collected cash' },
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

  function getHandler(id: string) {
    if (id === 'drop')          return onSelectDrop
    if (id === 'expenditure')   return onSelectExpenditure
    if (id === 'fuel-receival') return onSelectFuelReceival
    if (id === 'deposit')       return onSelectDeposit
    return undefined
  }

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
            Cancel
          </button>
        </div>

        <div className="mb-6">
          <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">Record a...</h2>
          <p className="text-[14px] text-[#888] font-medium">Choose a type</p>
        </div>

        <div className="flex flex-col gap-2">
          {recordTypes.map((type) => {
            const Icon = type.icon
            return (
              <button
                key={type.id}
                onClick={getHandler(type.id)}
                className="flex items-center gap-4 border border-[#e8e8e8] rounded-2xl p-4 text-left hover:border-[#bbb] hover:bg-[#fafafa] transition-colors"
              >
                <div className="w-11 h-11 bg-[#f4f4f4] rounded-xl flex items-center justify-center shrink-0 text-[#555]">
                  <Icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-[#111]">{type.label}</p>
                  <p className="text-[12px] text-[#888] leading-snug mt-0.5">{type.description}</p>
                </div>
                <ChevronRight size={16} className="text-[#ccc] shrink-0" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
