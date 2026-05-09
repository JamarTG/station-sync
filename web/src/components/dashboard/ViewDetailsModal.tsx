import { X, Pencil } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import type { ActivityRow } from './RecentActivityCard'

interface Props {
  row: ActivityRow
  onClose: () => void
  onEdit?: () => void
}

function typeLabel(row: ActivityRow): string {
  if (row.type === 'attendant') return 'Cash Drop'
  if (row.type === 'expenditure') return 'Expenditure'
  if (row.type === 'charges') return 'Charge'
  if (row.type === 'card') return 'Card Record'
  if (row.type === 'advance') return 'Advance'
  if (row.type === 'fx') return 'FX Record'
  if (row.type === 'deposit') return `${row.depositType} Deposit`
  return 'Record'
}

const denomOrder = [5000, 2000, 1000, 500, 100, 50, 20, 10, 5, 1]

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-[#f4f4f4] last:border-b-0">
      <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">{label}</p>
      <p className="text-[13px] font-semibold text-[#222]">{value}</p>
    </div>
  )
}

function DenominationBreakdown({ denominations }: { denominations: Record<number, number> }) {
  const entries = denomOrder.filter((d) => (denominations[d] ?? 0) > 0)
  if (entries.length === 0) return null
  return (
    <div className="mt-4">
      <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-2">Breakdown</p>
      <div className="border border-[#f0f0f0] rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#f4f4f4]">
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#bbb]">Denomination</th>
              <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-[#bbb]">Count</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#bbb]">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((d) => {
              const count = denominations[d]
              return (
                <tr key={d} className="border-b border-[#f9f9f9] last:border-b-0">
                  <td className="px-4 py-2.5 text-[13px] font-semibold text-[#333]">
                    J$ {d.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-[#555] text-center">{count}</td>
                  <td className="px-4 py-2.5 text-[13px] font-semibold text-[#333] text-right">
                    J$ {(count * d).toLocaleString()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function fmt(amount: number) {
  return `J$ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

export function ViewDetailsModal({ row, onClose, onEdit }: Props) {
  useEscapeKey(onClose)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[520px] p-8 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onClose}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            <X size={13} />
            Close
          </button>
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
            >
              <Pencil size={13} />
              Edit
            </button>
          )}
        </div>

        <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">{typeLabel(row)}</p>
        {row.type !== 'attendants' && (
          <p className="text-[40px] font-bold text-[#111] leading-none tracking-tight mb-8">
            <span className="text-[22px] font-bold text-[#aaa] mr-1">J$</span>
            {row.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        )}

        <div className="border border-[#f0f0f0] rounded-2xl px-5">
          {row.type === 'attendant' && (
            <>
              <Field label="Attendant" value={row.name} />
              <Field label="Time" value={row.time} />
              <Field label="Amount" value={fmt(row.amount)} />
            </>
          )}
          {row.type === 'attendant' && row.denominations && (
            <div className="py-4">
              <DenominationBreakdown denominations={row.denominations} />
            </div>
          )}
          {row.type === 'expenditure' && (
            <>
              <Field label="Requested By" value={row.requestedBy} />
              <Field label="Description" value={row.description} />
              <Field label="Amount" value={fmt(row.amount)} />
            </>
          )}
          {row.type === 'charges' && (
            <>
              <Field label="Attendant" value={row.name} />
              <Field label="Fuel Type" value={row.fuelType} />
              <Field label="Litres" value={row.litres.toFixed(2)} />
              <Field label="Amount" value={fmt(row.amount)} />
            </>
          )}
          {row.type === 'card' && (
            <>
              <Field label="Attendant" value={row.name} />
              <Field label="Bank" value={row.bank} />
              <Field label="Trans #" value={row.transNo} />
              <Field label="Amount" value={fmt(row.amount)} />
            </>
          )}
          {row.type === 'advance' && (
            <>
              <Field label="Attendant" value={row.name} />
              <Field label="Fuel Type" value={row.fuelType} />
              <Field label="Litres" value={row.litres.toFixed(2)} />
              <Field label="Amount" value={fmt(row.amount)} />
            </>
          )}
          {row.type === 'fx' && (
            <>
              <Field label="Attendant" value={row.name} />
              <Field label="FX Amount" value={`${row.currency} ${row.fxAmount.toFixed(2)}`} />
              <Field label="Currency" value={row.currency} />
              <Field label="JMD Total" value={fmt(row.amount)} />
            </>
          )}
          {row.type === 'deposit' && (
            <>
              <Field label="Deposited By" value={row.name} />
              <Field label="Description" value={row.description} />
              <Field label="Type" value={row.depositType} />
              <Field label="Amount" value={fmt(row.amount)} />
            </>
          )}
          {row.type === 'deposit' && row.depositType === 'Cash' && row.denominations && (
            <div className="py-4">
              <DenominationBreakdown denominations={row.denominations} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
