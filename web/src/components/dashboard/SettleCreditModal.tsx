import { useState } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { updateOrderStatus, type Order } from '../../lib/api'
import { fmtInput, parseInput } from '../../lib/fmt'

const DENOMINATIONS = [5000, 2000, 1000, 500, 100, 50, 20, 10, 5, 1]

function fmt(n: number) {
  return 'J$ ' + n.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Settles an outstanding credit invoice — marks it paid and clears the customer's balance.
// Stock is untouched (it already moved when the credit sale was made).
export function SettleCreditModal({
  order,
  shiftId,
  onClose,
}: {
  order: Order
  shiftId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [step, setStep] = useState<'method' | 'cash'>('method')
  const [cashCounts, setCashCounts] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const label = order.invoice_no ?? `#${String(order.order_no).padStart(4, '0')}`

  async function settle(method: string, changeGiven?: number) {
    setLoading(true)
    setError('')
    try {
      await updateOrderStatus(shiftId, order.id, 'paid', method, changeGiven)
      qc.invalidateQueries({ queryKey: ['shifts', shiftId, 'orders'] })
      qc.invalidateQueries({ queryKey: ['customers'] })
      onClose()
    } catch {
      setError('Failed to settle. Please try again.')
      setLoading(false)
    }
  }

  // ── Payment method step ──
  if (step === 'method') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      >
        <div className="bg-white rounded-3xl w-full max-w-[340px] p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Settle Credit</p>
            <button onClick={onClose} className="text-[#bbb] hover:text-[#555] transition-colors"><X size={16} /></button>
          </div>
          <h2 className="text-[24px] font-bold text-[#111] mb-1">Payment Method</h2>
          <p className="text-[13px] text-[#888] mb-6">{label} · {fmt(order.total)}</p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => setStep('cash')}
              disabled={loading}
              className="w-full flex items-center justify-between px-5 py-4 border border-[#e0e0e0] rounded-2xl hover:bg-[#f9f9f9] hover:border-[#ccc] transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div>
                <p className="text-[14px] font-semibold text-[#111]">Cash</p>
                <p className="text-[12px] text-[#888]">Paid with physical cash</p>
              </div>
              <span className="text-[#bbb] text-[18px]">›</span>
            </button>
            <button
              onClick={() => settle('Card')}
              disabled={loading}
              className="w-full flex items-center justify-between px-5 py-4 border border-[#e0e0e0] rounded-2xl hover:bg-[#f9f9f9] hover:border-[#ccc] transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div>
                <p className="text-[14px] font-semibold text-[#111]">Card</p>
                <p className="text-[12px] text-[#888]">Debit or credit card</p>
              </div>
              <span className="text-[#bbb] text-[18px]">›</span>
            </button>
          </div>

          {error && <p className="text-[12px] font-semibold text-red-500 mt-3">{error}</p>}

          <button
            onClick={onClose}
            className="w-full mt-4 py-3 text-[13px] font-semibold text-[#888] hover:text-[#333] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // ── Cash confirmation step ──
  const cashTotal = DENOMINATIONS.reduce((sum, d) => {
    const n = parseInt(cashCounts[d] ?? '', 10)
    return sum + (isNaN(n) ? 0 : n * d)
  }, 0)
  const change = cashTotal - order.total
  const canSubmit = cashTotal >= order.total

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[480px] p-8 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => setStep('method')}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            <ArrowLeft size={13} /> Go back
          </button>
          <button onClick={onClose} className="text-[#bbb] hover:text-[#555] transition-colors"><X size={18} /></button>
        </div>

        <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-2">Cash Payment</p>
        <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">{label}</h2>
        <p className="text-[14px] text-[#888] font-medium mb-6">Total due: {fmt(order.total)}</p>

        <p className="text-[13px] font-semibold text-[#888] mb-2">amount tendered</p>
        <table className="w-full border border-[#e0e0e0] rounded-xl overflow-hidden mb-6">
          <tbody>
            {DENOMINATIONS.map((d) => (
              <tr key={d} className="border-b border-[#e0e0e0] last:border-b-0">
                <td className="border-r border-[#e0e0e0] px-3 py-2 w-1/2">
                  <input
                    type="text"
                    value={fmtInput(cashCounts[d] ?? '')}
                    onChange={(e) => setCashCounts((prev) => ({ ...prev, [d]: parseInput(e.target.value) }))}
                    placeholder="0"
                    className="w-full text-[13px] font-medium text-[#333] focus:outline-none bg-transparent"
                  />
                </td>
                <td className="px-3 py-2 text-center text-[13px] font-medium text-[#333]">
                  {d.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-col gap-3 mb-6">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-[#888]">Tendered</p>
            <p className="text-[13px] font-bold text-[#111]">{fmt(cashTotal)}</p>
          </div>
          <div className="text-left">
            <p className={`text-[32px] font-bold leading-none tracking-tight ${change < 0 ? 'text-red-500' : 'text-green-600'}`}>
              {change >= 0 ? fmt(change) : `-${fmt(Math.abs(change))}`}
            </p>
            <p className="text-[12px] font-semibold text-[#888] mt-1.5">Change</p>
          </div>
        </div>

        {error && <p className="text-[12px] font-semibold text-red-500 mb-3">{error}</p>}

        <button
          onClick={() => settle('Cash', change > 0 ? change : 0)}
          disabled={!canSubmit || loading}
          className="w-full py-4 rounded-2xl border border-[#e0e0e0] text-[15px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : 'Confirm Payment'}
        </button>
      </div>
    </div>
  )
}
