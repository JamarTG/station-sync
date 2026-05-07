import { X, Printer } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import type { AttendantRow, DepositRow } from './RecentActivityCard'

interface Props {
  row: AttendantRow | DepositRow
  onClose: () => void
}

const denomOrder = [5000, 2000, 1000, 500, 100, 50, 20, 10, 5, 1]

function ReceiptLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <p className="text-[12px] font-semibold text-[#888]">{label}</p>
      <p className="text-[12px] font-semibold text-[#222]">{value}</p>
    </div>
  )
}

export function ReceiptModal({ row, onClose }: Props) {
  useEscapeKey(onClose)

  const title = row.type === 'deposit' ? `${row.depositType} Deposit Receipt` : 'Cash Drop Receipt'
  const name = row.name
  const amount = row.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })
  const time = row.type === 'attendant' ? row.time : undefined
  const supervisor = row.type === 'attendant' ? row.supervisor : undefined
  const description = row.type === 'deposit' ? row.description : undefined
  const depositType = row.type === 'deposit' ? row.depositType : undefined
  const depositSupervisor = row.type === 'deposit' ? row.supervisor : undefined

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
            onClick={() => window.print()}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            <Printer size={13} />
            Print
          </button>
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
            <p className="text-[20px] font-bold text-[#111]">{title}</p>
          </div>

          <div className="border-t border-dashed border-[#ddd] mb-4" />

          <div className="mb-4">
            <ReceiptLine label={row.type === 'deposit' ? 'Deposited By' : 'Attendant'} value={name} />
            {time && <ReceiptLine label="Time" value={time} />}
            {supervisor && <ReceiptLine label="Supervisor" value={supervisor} />}
            {description && <ReceiptLine label="Description" value={description} />}
            {depositType && <ReceiptLine label="Type" value={depositType} />}
            {depositSupervisor && <ReceiptLine label="Supervisor" value={depositSupervisor} />}
          </div>

          <div className="border-t border-dashed border-[#ddd] mb-4" />

          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Total</p>
            <p className="text-[22px] font-bold text-[#111]">
              <span className="text-[13px] font-bold text-[#aaa] mr-0.5">J$</span>
              {amount}
            </p>
          </div>

          {row.type === 'attendant' && row.denominations && (() => {
            const entries = denomOrder.filter((d) => (row.denominations![d] ?? 0) > 0)
            return entries.length > 0 ? (
              <>
                <div className="border-t border-dashed border-[#ddd] mt-4 mb-4" />
                <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-2">Cash breakdown</p>
                <table className="w-full mb-2">
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

          <div className="border-t border-dashed border-[#ddd] mt-4 mb-6" />

          <p className="text-center text-[10px] text-[#bbb] font-medium">Thank you</p>
        </div>
      </div>
    </div>
  )
}
