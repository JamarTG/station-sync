import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { CashBreakdownModal } from './CashBreakdownModal'
import { ExpenditureBreakdownModal } from './ExpenditureBreakdownModal'
import { CardBreakdownModal } from './CardBreakdownModal'
import { ChargesBreakdownModal } from './ChargesBreakdownModal'
import { AdvanceBreakdownModal } from './AdvanceBreakdownModal'
import { ShortagesBreakdownModal } from './ShortagesBreakdownModal'
import { OveragesBreakdownModal } from './OveragesBreakdownModal'
import { FXBreakdownModal } from './FXBreakdownModal'

const fuelGrades = ['87', '90', 'ADO', 'ULSD']
const accounts = ['CASH', 'CARD', 'FX', 'ADVANCE', 'CHARGES', 'EXPENDITURES']

interface Props {
  onClose: () => void
}

function SectionLabel({ label }: { label: string }) {
  return <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1 mt-6">{label}</p>
}

export function SalesBreakdownModal({ onClose }: Props) {
  useEscapeKey(onClose)
  const [showCashBreakdown, setShowCashBreakdown] = useState(false)
  const [showExpenditureBreakdown, setShowExpenditureBreakdown] = useState(false)
  const [showCardBreakdown, setShowCardBreakdown] = useState(false)
  const [showChargesBreakdown, setShowChargesBreakdown] = useState(false)
  const [showAdvanceBreakdown, setShowAdvanceBreakdown] = useState(false)
  const [showShortagesBreakdown, setShowShortagesBreakdown] = useState(false)
  const [showOveragesBreakdown, setShowOveragesBreakdown] = useState(false)
  const [showFXBreakdown, setShowFXBreakdown] = useState(false)

  if (showCashBreakdown) return <CashBreakdownModal onBack={() => setShowCashBreakdown(false)} onClose={onClose} />
  if (showExpenditureBreakdown) return <ExpenditureBreakdownModal onBack={() => setShowExpenditureBreakdown(false)} onClose={onClose} />
  if (showCardBreakdown) return <CardBreakdownModal onBack={() => setShowCardBreakdown(false)} onClose={onClose} />
  if (showChargesBreakdown) return <ChargesBreakdownModal onBack={() => setShowChargesBreakdown(false)} onClose={onClose} />
  if (showAdvanceBreakdown) return <AdvanceBreakdownModal onBack={() => setShowAdvanceBreakdown(false)} onClose={onClose} />
  if (showFXBreakdown) return <FXBreakdownModal onBack={() => setShowFXBreakdown(false)} onClose={onClose} />
  if (showShortagesBreakdown) return <ShortagesBreakdownModal onBack={() => setShowShortagesBreakdown(false)} onClose={onClose} />
  if (showOveragesBreakdown) return <OveragesBreakdownModal onBack={() => setShowOveragesBreakdown(false)} onClose={onClose} />

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
          onClick={onClose}
          className="self-start flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors mb-8"
        >
          <ArrowLeft size={13} />
          Go back
        </button>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[36px] font-bold text-[#111] leading-none">Sales</h2>
          <p className="text-[36px] font-bold text-[#111] leading-none">J$0.00</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <SectionLabel label="Amount Sold" />
          {fuelGrades.map((g) => (
            <div key={g} className="flex items-center justify-between py-2">
              <p className="text-[13px] font-semibold text-[#111]">{g}</p>
              <p className="text-[13px] font-semibold text-[#bbb]">--</p>
            </div>
          ))}

          <div className="border-t border-[#f0f0f0] mt-2" />

          <SectionLabel label="Accounts" />
          {accounts.map((a) => (
            <div key={a} className="flex items-start justify-between py-2">
              <div>
                {a === 'CASH' ? (
                  <button onClick={() => setShowCashBreakdown(true)} className="text-[13px] font-semibold text-[#111] hover:text-[#555] transition-colors">{a}</button>
                ) : a === 'CARD' ? (
                  <button onClick={() => setShowCardBreakdown(true)} className="text-[13px] font-semibold text-[#111] hover:text-[#555] transition-colors">{a}</button>
                ) : a === 'FX' ? (
                  <button onClick={() => setShowFXBreakdown(true)} className="text-[13px] font-semibold text-[#111] hover:text-[#555] transition-colors">{a}</button>
                ) : a === 'CHARGES' ? (
                  <button onClick={() => setShowChargesBreakdown(true)} className="text-[13px] font-semibold text-[#111] hover:text-[#555] transition-colors">{a}</button>
                ) : a === 'ADVANCE' ? (
                  <button onClick={() => setShowAdvanceBreakdown(true)} className="text-[13px] font-semibold text-[#111] hover:text-[#555] transition-colors">{a}</button>
                ) : a === 'EXPENDITURES' ? (
                  <button onClick={() => setShowExpenditureBreakdown(true)} className="text-[13px] font-semibold text-[#111] hover:text-[#555] transition-colors">{a}</button>
                ) : (
                  <p className="text-[13px] font-semibold text-[#111]">{a}</p>
                )}
              </div>
              <p className="text-[13px] font-semibold text-[#bbb]">--</p>
            </div>
          ))}

          <div className="border-t border-[#f0f0f0] mt-2" />

          <SectionLabel label="Attendants" />
          <div className="flex items-center justify-between py-2">
            <button onClick={() => setShowShortagesBreakdown(true)} className="text-[13px] font-semibold text-[#111] hover:text-[#555] transition-colors">SHORTAGES</button>
            <p className="text-[13px] font-semibold text-[#bbb]">--</p>
          </div>
          <div className="flex items-center justify-between py-2">
            <button onClick={() => setShowOveragesBreakdown(true)} className="text-[13px] font-semibold text-[#111] hover:text-[#555] transition-colors">OVERAGES</button>
            <p className="text-[13px] font-semibold text-[#bbb]">--</p>
          </div>
        </div>

        <div className="border-t border-[#f0f0f0] mt-4" />

        <div className="flex items-center justify-between pt-4">
          <p className="text-[14px] font-semibold text-[#333]">Balance</p>
          <p className="text-[14px] font-bold text-[#111]">J$0.00</p>
        </div>
      </div>
    </div>
  )
}
