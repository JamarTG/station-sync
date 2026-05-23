import { useState, useEffect } from 'react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { ArrowLeft } from 'lucide-react'
import { useShiftOrders, useShiftDeposits } from '../../hooks/useApi'

const fmt = (n: number) => `J$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

function SectionLabel({ label }: { label: string }) {
  return <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1 mt-6">{label}</p>
}

const accounts = ['CASH', 'CARD', 'FX', 'PHONE CREDIT']

const methodKey: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  FX: 'FX',
  'PHONE CREDIT': 'Phone Credit',
}

interface Props {
  onClose: () => void
  shiftId?: string
}

export function ConvenienceStoreBreakdownModal({ onClose, shiftId }: Props) {
  useEscapeKey(onClose)
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 537)
  const { data: orders = [] } = useShiftOrders(shiftId)
  const { data: deposits = [] } = useShiftDeposits(shiftId)

  useEffect(() => {
    function onResize() { setIsNarrow(window.innerWidth < 537) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const totalSales = orders.reduce((s, o) => s + o.total, 0)

  const salesByMethod: Record<string, number> = {}
  for (const o of orders) {
    const m = o.payment_method ?? 'Other'
    salesByMethod[m] = (salesByMethod[m] ?? 0) + o.total
  }

  const expenditures = deposits.filter((d) => d.type === 'Expenditure')
  const expendituresTotal = expenditures.reduce((s, d) => s + d.amount, 0)

  const cashSales = salesByMethod['Cash'] ?? 0
  const balance = cashSales - expendituresTotal

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

        <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-2">Convenience Store</p>
        {isNarrow ? (
          <div className="mb-6">
            <h2 className="text-[36px] font-bold text-[#111] leading-none mb-3">Sales</h2>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Total</p>
              <p className={`text-[11px] font-bold ${totalSales > 0 ? 'text-[#111]' : 'text-[#bbb]'}`}>
                {totalSales > 0 ? fmt(totalSales) : 'J$0.00'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[36px] font-bold text-[#111] leading-none">Sales</h2>
            <p className={`text-[36px] font-bold leading-none ${totalSales > 0 ? 'text-[#111]' : 'text-[#bbb]'}`}>
              {totalSales > 0 ? fmt(totalSales) : 'J$0.00'}
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">

          <SectionLabel label="Accounts" />
          {accounts.map((a) => {
            const val = salesByMethod[methodKey[a]] ?? null
            return (
              <div key={a}>
                <div className="flex items-center justify-between py-2">
                  <p className="text-[13px] font-semibold text-[#111]">{a}</p>
                  <p className={`text-[13px] font-semibold ${val != null ? 'text-[#333]' : 'text-[#bbb]'}`}>
                    {val != null ? fmt(val) : '--'}
                  </p>
                </div>
                {a === 'CASH' && (
                  <div className="flex items-center justify-between py-2 pl-4">
                    <p className="text-[13px] font-semibold text-[#888]">EXPENDITURES</p>
                    <p className={`text-[13px] font-semibold ${expendituresTotal > 0 ? 'text-red-500' : 'text-[#bbb]'}`}>
                      {expendituresTotal > 0 ? `-${fmt(expendituresTotal)}` : '--'}
                    </p>
                  </div>
                )}
              </div>
            )
          })}

        </div>

        <div className="border-t border-[#f0f0f0] mt-4" />

        <div className="flex items-center justify-between pt-4">
          <p className="text-[14px] font-semibold text-[#333]">Cash Balance</p>
          <p className={`text-[14px] font-bold ${
            balance < 0 ? 'text-red-500' : balance > 0 ? 'text-green-600' : 'text-[#111]'
          }`}>
            {balance < 0 ? `-${fmt(Math.abs(balance))}` : fmt(balance)}
          </p>
        </div>
      </div>
    </div>
  )
}
