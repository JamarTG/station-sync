import { useState } from 'react'
import { SalesBreakdownModal } from './SalesBreakdownModal'
import { fmtNum } from '../../lib/fmt'
import { useShiftDeposits } from '../../hooks/useApi'

const fmt = (n: number) => `J$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

const inflowTypes = new Set(['Cash', 'Card', 'FX', 'Advance', 'Expenditure', 'Charge'])
const attendantDepositTypes = new Set(['Cash', 'Card', 'FX', 'Advance', 'Charge'])

interface Props {
  totalSales?: number
  totalLitres?: number
  attendantSales?: Record<string, number>
  gradeSales?: Record<string, number | null>
  attendantGradeSales?: Record<string, Record<string, number>>
  shiftId?: string
}

export function TotalSalesCard({ totalSales = 0, totalLitres = 0, attendantSales, gradeSales, attendantGradeSales, shiftId }: Props) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const { data: deposits = [] } = useShiftDeposits(shiftId)

  const allGradesComplete = !!gradeSales && Object.keys(gradeSales).length > 0 && Object.values(gradeSales).every((v) => v != null)
  const grandTotal = allGradesComplete ? Object.values(gradeSales!).reduce<number>((s, v) => s + v!, 0) : null

  const inflow = deposits.filter((d) => inflowTypes.has(d.type)).reduce((s, d) => s + d.amount, 0)

  const depositedByAttendant: Record<string, number> = {}
  for (const d of deposits) {
    if (attendantDepositTypes.has(d.type)) {
      depositedByAttendant[d.attendant_name] = (depositedByAttendant[d.attendant_name] ?? 0) + d.amount
    }
  }

  const overageTotal = Object.entries(attendantSales ?? {})
    .filter(([, sales]) => sales > 0)
    .reduce((s, [name, sales]) => { const b = (depositedByAttendant[name] ?? 0) - sales; return b > 0 ? s + b : s }, 0)
  const shortageTotal = Object.entries(attendantSales ?? {})
    .filter(([, sales]) => sales > 0)
    .reduce((s, [name, sales]) => { const b = (depositedByAttendant[name] ?? 0) - sales; return b < 0 ? s + Math.abs(b) : s }, 0)

  const salesBalance = grandTotal != null ? inflow + shortageTotal - overageTotal - grandTotal : null

  return (
    <>
      <button
        onClick={() => setShowBreakdown(true)}
        className="bg-white rounded-2xl border border-[#ebebeb] p-6 text-left w-full hover:border-[#ccc] transition-colors"
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-semibold text-[#888]">Total Sales</p>
          {totalLitres > 0 && (
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase whitespace-nowrap">
              Total Litres {fmtNum(totalLitres)}L
            </p>
          )}
        </div>
        <p className="text-[42px] font-bold text-[#111] leading-none tracking-tight mb-5">
          J$ {fmtNum(totalSales)}
        </p>
        <div className="flex items-center justify-between pt-4 border-t border-[#f0f0f0]">
          <span className="text-[13px] font-medium text-[#888]">Balance</span>
          <span className={`text-[13px] font-semibold ${
            salesBalance == null ? 'text-[#bbb]'
            : salesBalance < 0 ? 'text-red-500'
            : salesBalance > 0 ? 'text-green-600'
            : 'text-[#333]'
          }`}>
            {salesBalance == null
              ? '--'
              : salesBalance < 0 ? `-${fmt(Math.abs(salesBalance))}`
              : salesBalance > 0 ? `+${fmt(salesBalance)}`
              : fmt(0)}
          </span>
        </div>
      </button>

      {showBreakdown && (
        <SalesBreakdownModal onClose={() => setShowBreakdown(false)} shiftId={shiftId} attendantSales={attendantSales} gradeSales={gradeSales} attendantGradeSales={attendantGradeSales} />
      )}
    </>
  )
}
