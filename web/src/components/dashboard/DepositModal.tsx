import { ArrowLeft, Banknote, CreditCard, FileText, Globe, ChevronRight, X } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useState } from 'react'
import { CashDepositEntryModal } from './CashDepositEntryModal'
import { ChequeDepositModal } from './ChequeDepositModal'
import { CardDepositModal } from './CardDepositModal'
import { FXDepositModal } from './FXDepositModal'

const depositTypes = [
  { id: 'cash',   label: 'Cash',   icon: Banknote,    description: 'A physical cash deposit made to the bank' },
  { id: 'cheque', label: 'Cheque', icon: FileText,    description: 'A cheque deposit made to the bank' },
  { id: 'card',   label: 'Card',   icon: CreditCard,  description: 'A card settlement deposit made to the bank' },
  { id: 'fx',     label: 'FX',     icon: Globe,       description: 'A foreign exchange deposit made to the bank' },
]

interface Props {
  onBack: () => void
  onClose: () => void
  shiftId?: string
}

export function DepositModal({ onBack, onClose, shiftId }: Props) {
  useEscapeKey(onClose)
  const [showCash,   setShowCash]   = useState(false)
  const [showCheque, setShowCheque] = useState(false)
  const [showCard,   setShowCard]   = useState(false)
  const [showFX,     setShowFX]     = useState(false)

  function getHandler(id: string) {
    if (id === 'cash')   return () => setShowCash(true)
    if (id === 'cheque') return () => setShowCheque(true)
    if (id === 'card')   return () => setShowCard(true)
    if (id === 'fx')     return () => setShowFX(true)
    return undefined
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-3xl w-full max-w-[480px] p-8 shadow-xl"
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

          <div className="mb-6">
            <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">Record a deposit</h2>
            <p className="text-[14px] text-[#888] font-medium">Choose a type</p>
          </div>

          <div className="flex flex-col gap-2">
            {depositTypes.map((type) => {
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

      {showCash && (
        <CashDepositEntryModal
          onBack={() => setShowCash(false)}
          onClose={onClose}
          shiftId={shiftId}
        />
      )}
      {showCheque && (
        <ChequeDepositModal
          onBack={() => setShowCheque(false)}
          onClose={onClose}
          shiftId={shiftId}
        />
      )}
      {showCard && (
        <CardDepositModal
          onBack={() => setShowCard(false)}
          onClose={onClose}
          shiftId={shiftId}
        />
      )}
      {showFX && (
        <FXDepositModal
          onBack={() => setShowFX(false)}
          onClose={onClose}
          shiftId={shiftId}
        />
      )}
    </>
  )
}
