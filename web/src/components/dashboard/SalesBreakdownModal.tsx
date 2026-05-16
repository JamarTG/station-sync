import { useState, useEffect } from 'react'
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
import { activityByAccount } from './RecentActivityCard'
import { useShiftDeposits } from '../../hooks/useApi'

const accounts = ['CASH', 'CARD', 'FX', 'ADVANCE', 'CHARGES', 'EXPENDITURES']

const accountKeyMap: Record<string, keyof typeof activityByAccount> = {
  CASH: 'Cash', CARD: 'Card', FX: 'FX', ADVANCE: 'Advance',
  CHARGES: 'Charges', EXPENDITURES: 'Expenditures',
}

function accountTotal(key: string): number {
  const rows = activityByAccount[accountKeyMap[key]]
  return rows ? rows.reduce((sum, r) => sum + r.amount, 0) : 0
}

const fmt = (n: number) => `J$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

interface Props {
  onClose: () => void
  shiftId?: string
  attendantSales?: Record<string, number>
  gradeSales?: Record<string, number | null>
  attendantGradeSales?: Record<string, Record<string, number>>
}

function SectionLabel({ label }: { label: string }) {
  return <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1 mt-6">{label}</p>
}

export function SalesBreakdownModal({ onClose, shiftId, attendantSales, gradeSales, attendantGradeSales }: Props) {
  useEscapeKey(onClose)
  const [showCashBreakdown, setShowCashBreakdown] = useState(false)
  const [showExpenditureBreakdown, setShowExpenditureBreakdown] = useState(false)
  const [showCardBreakdown, setShowCardBreakdown] = useState(false)
  const [showChargesBreakdown, setShowChargesBreakdown] = useState(false)
  const [showAdvanceBreakdown, setShowAdvanceBreakdown] = useState(false)
  const [showShortagesBreakdown, setShowShortagesBreakdown] = useState(false)
  const [showOveragesBreakdown, setShowOveragesBreakdown] = useState(false)
  const [showFXBreakdown, setShowFXBreakdown] = useState(false)
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 537)
  const { data: deposits = [] } = useShiftDeposits(shiftId)
  const allGradesComplete = !!gradeSales && Object.keys(gradeSales).length > 0 && Object.values(gradeSales).every((v) => v != null)
  const grandTotal = allGradesComplete ? Object.values(gradeSales!).reduce<number>((sum, v) => sum + v!, 0) : null

  const hasCashDeposits = activityByAccount.Deposits.some((r) => r.type === 'deposit' && r.depositType === 'CashDeposit')

  const inflowTypes = new Set(['Cash', 'Card', 'FX', 'Advance', 'Expenditure', 'Charge'])
  const attendantDepositTypes = new Set(['Cash', 'Card', 'FX', 'Advance', 'Charge'])
  const inflow = deposits.filter((d) => inflowTypes.has(d.type)).reduce((s, d) => s + d.amount, 0)
  const depositedByAttendant: Record<string, number> = {}
  for (const d of deposits) {
    if (attendantDepositTypes.has(d.type)) {
      depositedByAttendant[d.attendant_name] = (depositedByAttendant[d.attendant_name] ?? 0) + d.amount
    }
  }
  const balances: Record<string, number> = Object.fromEntries(
    Object.entries(attendantSales ?? {})
      .filter(([, sales]) => sales > 0)
      .map(([name, sales]) => [name, (depositedByAttendant[name] ?? 0) - sales])
  )
  const overageTotal = Object.entries(attendantSales ?? {})
    .filter(([, sales]) => sales > 0)
    .reduce((s, [name, sales]) => { const b = (depositedByAttendant[name] ?? 0) - sales; return b > 0 ? s + b : s }, 0)
  const shortageTotal = Object.entries(attendantSales ?? {})
    .filter(([, sales]) => sales > 0)
    .reduce((s, [name, sales]) => { const b = (depositedByAttendant[name] ?? 0) - sales; return b < 0 ? s + Math.abs(b) : s }, 0)
  const salesBalance = grandTotal != null ? inflow + shortageTotal - overageTotal - grandTotal : null

  useEffect(() => {
    function onResize() { setIsNarrow(window.innerWidth < 537) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (showCashBreakdown) return <CashBreakdownModal onBack={() => setShowCashBreakdown(false)} onClose={onClose} />
  if (showExpenditureBreakdown) return <ExpenditureBreakdownModal onBack={() => setShowExpenditureBreakdown(false)} onClose={onClose} />
  if (showCardBreakdown) return <CardBreakdownModal onBack={() => setShowCardBreakdown(false)} onClose={onClose} />
  if (showChargesBreakdown) return <ChargesBreakdownModal onBack={() => setShowChargesBreakdown(false)} onClose={onClose} />
  if (showAdvanceBreakdown) return <AdvanceBreakdownModal onBack={() => setShowAdvanceBreakdown(false)} onClose={onClose} />
  if (showFXBreakdown) return <FXBreakdownModal onBack={() => setShowFXBreakdown(false)} onClose={onClose} />
  if (showShortagesBreakdown) return <ShortagesBreakdownModal onBack={() => setShowShortagesBreakdown(false)} onClose={onClose} balances={balances} attendantSales={attendantSales} attendantGradeSales={attendantGradeSales} />
  if (showOveragesBreakdown) return <OveragesBreakdownModal onBack={() => setShowOveragesBreakdown(false)} onClose={onClose} balances={balances} attendantSales={attendantSales} attendantGradeSales={attendantGradeSales} />

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

        <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-2">Service Station</p>
        {isNarrow ? (
          <div className="mb-6">
            <h2 className="text-[36px] font-bold text-[#111] leading-none mb-3">Sales</h2>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Total</p>
              <p className={`text-[11px] font-bold ${grandTotal != null ? 'text-[#111]' : 'text-[#bbb]'}`}>{grandTotal != null ? fmt(grandTotal) : '--'}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[36px] font-bold text-[#111] leading-none">Sales</h2>
            <p className={`text-[36px] font-bold leading-none ${grandTotal != null ? 'text-[#111]' : 'text-[#bbb]'}`}>{grandTotal != null ? fmt(grandTotal) : '--'}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <SectionLabel label="Amount Sold" />
          {Object.entries(gradeSales ?? {}).map(([g, val]) => (
            <div key={g} className="flex items-center justify-between py-2">
              <p className="text-[13px] font-semibold text-[#111]">{g}</p>
              <p className={`text-[13px] font-semibold ${val != null ? 'text-[#333]' : 'text-[#bbb]'}`}>
                {val != null ? fmt(val) : '--'}
              </p>
            </div>
          ))}

          <div className="border-t border-[#f0f0f0] mt-2" />

          <SectionLabel label="Accounts" />
          {accounts.map((a) => {
            const handler =
              a === 'CASH' ? () => setShowCashBreakdown(true) :
              a === 'CARD' ? () => setShowCardBreakdown(true) :
              a === 'FX' ? () => setShowFXBreakdown(true) :
              a === 'CHARGES' ? () => setShowChargesBreakdown(true) :
              a === 'ADVANCE' ? () => setShowAdvanceBreakdown(true) :
              a === 'EXPENDITURES' ? () => setShowExpenditureBreakdown(true) :
              null
            return (
              <button key={a} onClick={handler ?? undefined} className="flex items-center justify-between py-2 w-full text-left hover:opacity-70 transition-opacity">
                <p className="text-[13px] font-semibold text-[#111]">{a}</p>
                <p className="text-[13px] font-semibold text-[#333]">
                  {a === 'CASH' && hasCashDeposits ? '...' : fmt(accountTotal(a))}
                </p>
              </button>
            )
          })}

          <div className="border-t border-[#f0f0f0] mt-2" />

          <SectionLabel label="Attendants" />
          {(() => {
            return (
              <>
                <button onClick={() => setShowShortagesBreakdown(true)} className="flex items-center justify-between py-2 w-full text-left hover:opacity-70 transition-opacity">
                  <p className="text-[13px] font-semibold text-[#111]">SHORTAGES</p>
                  <p className={`text-[13px] font-semibold ${shortageTotal > 0 ? 'text-red-500' : 'text-[#bbb]'}`}>
                    {shortageTotal > 0 ? `-${fmt(shortageTotal)}` : '--'}
                  </p>
                </button>
                <button onClick={() => setShowOveragesBreakdown(true)} className="flex items-center justify-between py-2 w-full text-left hover:opacity-70 transition-opacity">
                  <p className="text-[13px] font-semibold text-[#111]">OVERAGES</p>
                  <p className={`text-[13px] font-semibold ${overageTotal > 0 ? 'text-green-600' : 'text-[#bbb]'}`}>
                    {overageTotal > 0 ? `+${fmt(overageTotal)}` : '--'}
                  </p>
                </button>
              </>
            )
          })()}
        </div>

        <div className="border-t border-[#f0f0f0] mt-4" />

        <div className="flex items-center justify-between pt-4">
          <p className="text-[14px] font-semibold text-[#333]">Balance</p>
          <p className={`text-[14px] font-bold ${salesBalance != null ? salesBalance < 0 ? 'text-red-500' : salesBalance > 0 ? 'text-green-600' : 'text-[#111]' : 'text-[#bbb]'}`}>
            {salesBalance != null ? (salesBalance < 0 ? `-${fmt(Math.abs(salesBalance))}` : salesBalance > 0 ? `+${fmt(salesBalance)}` : fmt(0)) : '--'}
          </p>
        </div>
      </div>
    </div>
  )
}
