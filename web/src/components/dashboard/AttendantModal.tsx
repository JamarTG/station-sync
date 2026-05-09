import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { ManageAttendantsModal } from './ManageAttendantsModal'
import { activityByAccount } from './RecentActivityCard'

const fmt = (n: number) => `J$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

const fuelGrades = ['87', '90', 'ADO', 'ULSD']

const depositSources = [
  { label: 'CASH', key: 'Cash' },
  { label: 'CARD', key: 'Card' },
  { label: 'FX', key: 'FX' },
  { label: 'ADVANCE', key: 'Advance' },
  { label: 'CHARGES', key: 'Charges' },
] as const

interface Props {
  name: string
  onClose: () => void
  sales?: number
  gradeSales?: Record<string, number>
}

export function AttendantModal({ name, onClose, sales, gradeSales }: Props) {
  useEscapeKey(onClose)
  const [showManage, setShowManage] = useState(false)

  const depositBreakdown = depositSources.map(({ label, key }) => {
    const rows = activityByAccount[key]
    const amount = rows.reduce((s, r) => {
      if (r.type === 'expenditure' || r.type === 'attendants' || r.type === 'deposit') return s
      return r.name === name ? s + r.amount : s
    }, 0)
    return { label, amount }
  })
  const totalDeposited = depositBreakdown.reduce((s, d) => s + d.amount, 0)
  const hasSales = sales != null && sales > 0
  const balance = hasSales ? totalDeposited - sales! : null

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[420px] max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8">
          <div className="flex items-center mb-7">
            <button
              onClick={onClose}
              className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
            >
              <ArrowLeft size={13} />
              Go back
            </button>
          </div>
          <p className="text-[12px] font-medium text-[#aaa] mb-1">Attendant</p>
          <div className="flex items-center justify-between mb-7">
            <h2 className="text-[28px] font-bold text-[#111] leading-none">{name}</h2>
            <button
              onClick={() => setShowManage(true)}
              className="text-[12px] font-semibold text-[#333] border border-[#ddd] rounded-lg px-3 py-1 hover:bg-[#f4f4f4] transition-colors"
            >
              Manage
            </button>
          </div>

          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Amount Sold</p>
          <div className="divide-y divide-[#f0f0f0] mb-6">
            {fuelGrades.map((g) => {
              const val = gradeSales?.[g] ?? 0
              return (
                <div key={g} className="flex items-center justify-between py-2.5">
                  <span className="text-[13px] font-medium text-[#222]">{g}</span>
                  <span className={`text-[13px] font-medium ${val > 0 ? 'text-[#333]' : 'text-[#bbb]'}`}>
                    {val > 0 ? fmt(val) : '--'}
                  </span>
                </div>
              )
            })}
            <div className="flex items-center justify-between py-2.5">
              <span className="text-[13px] font-semibold text-[#222] uppercase tracking-wide">Total</span>
              <span className={`text-[13px] font-semibold ${hasSales ? 'text-[#333]' : 'text-[#bbb]'}`}>
                {hasSales ? fmt(sales!) : '--'}
              </span>
            </div>
          </div>

          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Amount Deposited</p>
          <div className="divide-y divide-[#f0f0f0] mb-7">
            {depositBreakdown.map(({ label, amount }) => (
              <div key={label} className="flex items-center justify-between py-2.5">
                <span className="text-[13px] font-medium text-[#222]">{label}</span>
                <span className={`text-[13px] font-medium ${amount > 0 ? 'text-[#333]' : 'text-[#bbb]'}`}>
                  {amount > 0 ? fmt(amount) : '--'}
                </span>
              </div>
            ))}
          </div>

          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Total Deposited</p>
          <p className={`text-[36px] font-bold leading-none tracking-tight mb-5 ${totalDeposited > 0 ? 'text-[#111]' : 'text-[#bbb]'}`}>
            {totalDeposited > 0 ? fmt(totalDeposited) : 'J$ 0.00'}
          </p>

          <div className="pt-4 border-t border-[#ebebeb] flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#888]">Balance</span>
            <span className={`text-[13px] font-bold ${balance == null || balance === 0 ? 'text-[#bbb]' : balance < 0 ? 'text-red-500' : 'text-green-600'}`}>
              {balance == null || balance === 0
                ? '--'
                : `${balance < 0 ? '-' : '+'}${fmt(Math.abs(balance))}`}
            </span>
          </div>
        </div>
      </div>
    </div>
    {showManage && <ManageAttendantsModal onClose={() => setShowManage(false)} />}
    </>
  )
}
