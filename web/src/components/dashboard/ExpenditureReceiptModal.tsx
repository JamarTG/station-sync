import { X } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import type { ExpenditureRow } from './RecentActivityCard'

interface Props {
  row: ExpenditureRow
  onClose: () => void
}

const denomOrder = [5000, 2000, 1000, 500, 100, 50, 20, 10, 5, 1]

function ReceiptLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between py-2.5">
      <p className="text-[12px] font-semibold text-[#888]">{label}</p>
      <p className="text-[12px] font-semibold text-[#222] text-right max-w-[260px]">{value}</p>
    </div>
  )
}

export function ExpenditureReceiptModal({ row, onClose }: Props) {
  useEscapeKey(onClose)

  const amount = row.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[480px] p-8 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end mb-8">
          <button
            onClick={onClose}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            <X size={13} />
            Close
          </button>
        </div>

        <div className="bg-[#fafafa] rounded-2xl border border-[#f0f0f0] p-6">
          <div className="text-center mb-6">
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#aaa] uppercase mb-1">StationSync</p>
            <p className="text-[20px] font-bold text-[#111]">Expenditure Receipt</p>
          </div>

          <div className="border-t border-dashed border-[#ddd] mb-4" />

          <div className="mb-4">
            <ReceiptLine label="Requested By" value={row.requestedBy} />
            <ReceiptLine label="Description" value={row.description} />
          </div>

          <div className="border-t border-dashed border-[#ddd] mb-4" />

          <div className="flex items-center justify-between mb-6">
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Amount</p>
            <p className="text-[22px] font-bold text-[#111]">
              <span className="text-[13px] font-bold text-[#aaa] mr-0.5">J$</span>
              {amount}
            </p>
          </div>

          {row.denominations && (() => {
            const entries = denomOrder.filter((d) => (row.denominations![d] ?? 0) > 0)
            return entries.length > 0 ? (
              <>
                <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-2">Cash breakdown</p>
                <table className="w-full mb-4">
                  <tbody>
                    {entries.map((d) => {
                      const count = row.denominations![d]
                      return (
                        <tr key={d} className="border-b border-dashed border-[#ebebeb] last:border-b-0">
                          <td className="py-1.5 text-[11px] font-semibold text-[#888]">J$ {d.toLocaleString()}</td>
                          <td className="py-1.5 text-[11px] text-[#bbb] text-center">× {count}</td>
                          <td className="py-1.5 text-[11px] font-semibold text-[#333] text-right">J$ {(count * d).toLocaleString()}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </>
            ) : null
          })()}

          <div className="border-t border-dashed border-[#ddd] mb-6" />

          <div className="flex items-end justify-between">
            <div className="flex-1 mr-8">
              <p className="text-[11px] font-semibold text-[#bbb] mb-6">Authorized by</p>
              <div className="border-b border-[#ddd]" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-semibold text-[#bbb] mb-6">Date</p>
              <div className="border-b border-[#ddd]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
