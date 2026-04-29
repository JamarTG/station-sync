import { useState } from 'react'
import { SalesBreakdownModal } from './SalesBreakdownModal'

export function TotalSalesCard() {
  const [showBreakdown, setShowBreakdown] = useState(false)

  return (
    <>
      <button
        onClick={() => setShowBreakdown(true)}
        className="bg-white rounded-2xl border border-[#ebebeb] p-6 text-left w-full hover:border-[#ccc] transition-colors"
      >
        <p className="text-[13px] font-semibold text-[#888] mb-3">Total Sales</p>
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
