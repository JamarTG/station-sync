import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type PaymentMethod = 'Cash' | 'Card' | 'Credit'

interface CategorySale {
  name: string
  amount: number
}

interface ShiftSale {
  id: string
  date: string
  cashier: string
  startTime: string
  endTime: string
  total: number
  status: 'Open' | 'Closed'
  byPayment: { method: PaymentMethod; amount: number }[]
  byCategory: CategorySale[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return '$' + n.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-JM', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Breakdown Panel ───────────────────────────────────────────────────────────

function BreakdownPanel({ shift }: { shift: ShiftSale | null }) {
  if (!shift) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-5 shrink-0">
          <p>
            <span className="text-[13px] font-bold text-[#111]">Sales</span>
            <span className="text-[13px] font-medium text-[#aaa]"> | Breakdown</span>
          </p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] font-medium text-[#bbb]">Select a shift to see breakdown</p>
        </div>
      </div>
    )
  }

  const totalByPayment = shift.byPayment.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-5 border-b border-[#f0f0f0] shrink-0">
        <p>
          <span className="text-[13px] font-bold text-[#111]">Sales</span>
          <span className="text-[13px] font-medium text-[#aaa]"> | Breakdown</span>
        </p>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <p className="text-[22px] font-bold text-[#111]">{fmt(shift.total)}</p>
            <p className="text-[12px] text-[#999] mt-0.5">{fmtDate(shift.date)} · {shift.startTime}–{shift.endTime}</p>
          </div>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
            shift.status === 'Open' ? 'bg-[#d1e7dd] text-[#0a5435]' : 'bg-[#f0f0f0] text-[#555]'
          }`}>{shift.status}</span>
        </div>
      </div>

      {/* Payment methods */}
      <div className="p-5 border-b border-[#f0f0f0] shrink-0">
        <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mb-3">Payment Methods</p>
        <div className="space-y-2">
          {shift.byPayment.map((p) => (
            <div key={p.method} className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-[#555]">{p.method}</p>
              <div className="flex items-center gap-3">
                <div className="w-24 h-1.5 rounded-full bg-[#f0f0f0] overflow-hidden">
                  <div
                    className="h-full bg-[#111] rounded-full"
                    style={{ width: totalByPayment > 0 ? `${(p.amount / totalByPayment) * 100}%` : '0%' }}
                  />
                </div>
                <p className="text-[13px] font-semibold text-[#111] w-24 text-right">{fmt(p.amount)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* By category */}
      <div className="p-5 shrink-0">
        <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mb-3">By Category</p>
        {shift.byCategory.length === 0 ? (
          <p className="text-[13px] text-[#bbb]">No category data</p>
        ) : (
          <div className="space-y-2">
            {shift.byCategory
              .slice()
              .sort((a, b) => b.amount - a.amount)
              .map((c) => (
                <div key={c.name} className="flex items-center justify-between py-1 border-b border-[#f8f8f8] last:border-0">
                  <p className="text-[13px] font-medium text-[#555] truncate">{c.name}</p>
                  <p className="text-[13px] font-semibold text-[#111] shrink-0 ml-4">{fmt(c.amount)}</p>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Shifts Table ──────────────────────────────────────────────────────────────

function ShiftsTable({
  shifts,
  selected,
  onSelect,
}: {
  shifts: ShiftSale[]
  selected: ShiftSale | null
  onSelect: (s: ShiftSale) => void
}) {
  return (
    <div className="flex-1 overflow-hidden flex flex-col p-6 gap-5 min-w-0">
      <div className="flex-1 bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col">
        <div className="grid grid-cols-[1fr_1.5fr_1fr_1fr_auto_32px] gap-4 px-5 py-2.5 border-b border-[#f0f0f0] bg-[#fafafa] shrink-0">
          {['Date', 'Cashier', 'Hours', 'Total', 'Status', ''].map((h) => (
            <p key={h} className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
          ))}
        </div>

        {shifts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <p className="text-[13px] font-semibold text-[#bbb]">No shifts yet</p>
            <p className="text-[12px] font-medium text-[#ccc]">Completed shift sales will appear here</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {shifts.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelect(s)}
                className={`w-full grid grid-cols-[1fr_1.5fr_1fr_1fr_auto_32px] gap-4 items-center px-5 py-3.5 border-b border-[#f8f8f8] last:border-0 transition-colors text-left ${
                  selected?.id === s.id ? 'bg-[#f4f4f4]' : 'hover:bg-[#fafafa]'
                }`}
              >
                <p className="text-[13px] font-semibold text-[#111]">{fmtDate(s.date)}</p>
                <p className="text-[13px] text-[#666] truncate">{s.cashier}</p>
                <p className="text-[13px] text-[#666]">{s.startTime}–{s.endTime}</p>
                <p className="text-[13px] font-semibold text-[#111]">{fmt(s.total)}</p>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  s.status === 'Open' ? 'bg-[#d1e7dd] text-[#0a5435]' : 'bg-[#f0f0f0] text-[#555]'
                }`}>{s.status}</span>
                <ChevronRight size={14} className="text-[#ccc]" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const SAMPLE_SHIFTS: ShiftSale[] = []

export function ConvenienceSalesPage() {
  const [shifts] = useState<ShiftSale[]>(SAMPLE_SHIFTS)
  const [selected, setSelected] = useState<ShiftSale | null>(null)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebebeb] flex-shrink-0">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-0.5">Convenience Store</p>
          <h1 className="text-[22px] font-bold text-[#111] leading-tight">Sales</h1>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <ShiftsTable shifts={shifts} selected={selected} onSelect={setSelected} />
        <div className="w-[450px] shrink-0 border-l border-[#e8e8e8] h-full">
          <BreakdownPanel shift={selected} />
        </div>
      </div>
    </div>
  )
}
