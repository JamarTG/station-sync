import { useState } from 'react'
import { SalesBreakdownModal } from './SalesBreakdownModal'

export function TotalSalesCard() {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const totalLitres = 0

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
              Total Litres {totalLitres.toLocaleString('en-US')}L
            </p>
          )}
        </div>
        <p className="text-[42px] font-bold text-[#111] leading-none tracking-tight mb-5">
          J$ 0.00
        </p>
        <div className="flex items-center justify-between pt-4 border-t border-[#f0f0f0]">
          <span className="text-[13px] font-medium text-[#888]">Balance</span>
          <span className="text-[13px] font-semibold text-[#333]">J$ 0.00</span>
        </div>
      </button>

      {showBreakdown && (
        <SalesBreakdownModal onClose={() => setShowBreakdown(false)} />
      )}
    </>
  )
}
