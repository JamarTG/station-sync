import { useState } from 'react'
import { LogoLoader } from '../components/StationSyncLogo'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '../lib/authContext'
import { useOpenShift, useShiftDeposits, useTanks } from '../hooks/useApi'
import type { Deposit } from '../lib/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => `J$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString('en-JM', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-JM', { month: 'short', day: 'numeric', year: 'numeric' })
}

const TYPE_COLOR: Record<string, string> = {
  Cash:        'bg-[#d1e7dd] text-[#0a5435]',
  Card:        'bg-[#cfe2ff] text-[#0a3d91]',
  Charge:      'bg-[#fff3cd] text-[#856404]',
  FX:          'bg-[#f0f0f0] text-[#555]',
  Advance:     'bg-[#f0f0f0] text-[#555]',
  Expenditure: 'bg-[#f8d7da] text-[#842029]',
}

// ── Breakdown Panel ───────────────────────────────────────────────────────────

function BreakdownPanel({ deposits, selected }: { deposits: Deposit[]; selected: Deposit | null }) {
  const totals: Record<string, number> = {}
  for (const d of deposits) {
    totals[d.type] = (totals[d.type] ?? 0) + d.amount
  }
  const grand = Object.values(totals).reduce((s, v) => s + v, 0)
  const entries = Object.entries(totals).sort(([, a], [, b]) => b - a)

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="p-5 border-b border-[#f0f0f0] shrink-0">
        <p>
          <span className="text-[13px] font-bold text-[#111]">Sales</span>
          <span className="text-[13px] font-medium text-[#aaa]"> | Breakdown</span>
        </p>
      </div>

      {/* Totals by type */}
      <div className="p-5 border-b border-[#f0f0f0] shrink-0">
        <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mb-3">By Payment Type</p>
        {entries.length === 0 ? (
          <p className="text-[13px] font-medium text-[#bbb]">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {entries.map(([type, amount]) => (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLOR[type] ?? 'bg-[#f0f0f0] text-[#555]'}`}>
                    {type}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-1.5 rounded-full bg-[#f0f0f0] overflow-hidden">
                    <div className="h-full bg-[#111] rounded-full" style={{ width: grand > 0 ? `${(amount / grand) * 100}%` : '0%' }} />
                  </div>
                  <p className="text-[13px] font-semibold text-[#111] w-24 text-right">{fmt(amount)}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-[#f0f0f0] mt-2">
              <p className="text-[12px] font-semibold text-[#888]">Total</p>
              <p className="text-[14px] font-bold text-[#111]">{fmt(grand)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Selected transaction detail */}
      {!selected ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] font-medium text-[#bbb]">Select a transaction to view details</p>
        </div>
      ) : (
        <div className="shrink-0">
          <div className="p-5 border-b border-[#f0f0f0]">
            <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mb-3">Transaction</p>
            {[
              { label: 'Attendant', value: selected.attendant_name },
              { label: 'Type',      value: selected.type },
              { label: 'Amount',    value: fmt(selected.amount) },
              { label: 'Date',      value: fmtDate(selected.created_at) },
              { label: 'Time',      value: fmtTime(selected.created_at) },
              ...(selected.metadata ? [{ label: 'Note', value: selected.metadata }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center py-2.5 border-b border-[#f8f8f8] last:border-0">
                <span className="text-[12px] text-[#999] w-24 shrink-0">{label}</span>
                <span className="text-[13px] text-[#111]">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Transactions Table (cashier / attendant view) ─────────────────────────────

function TransactionsView() {
  const { user } = useAuth()
  const { data: shift }       = useOpenShift()
  const { data: allDeposits = [] } = useShiftDeposits(shift?.id)
  const [selected, setSelected] = useState<Deposit | null>(null)

  const isAttendant = user?.role === 'Attendant'
  const deposits = isAttendant
    ? allDeposits.filter((d) => d.attendant_id === user?.id)
    : allDeposits

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: transactions table */}
      <div className="flex-1 overflow-hidden flex flex-col p-6 min-w-0">
        <div className="flex-1 bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col">
          <div className="grid grid-cols-[1fr_1fr_1.5fr_1fr_1fr_32px] gap-4 px-5 py-2.5 border-b border-[#f0f0f0] bg-[#fafafa] shrink-0">
            {['Time', 'Shift', 'Attendant', 'Type', 'Amount', ''].map((h) => (
              <p key={h} className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
            ))}
          </div>

          {deposits.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-1">
              <p className="text-[13px] font-semibold text-[#bbb]">No transactions yet</p>
              <p className="text-[12px] font-medium text-[#ccc]">Sales will appear here once recorded</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {deposits.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelected(d)}
                  className={`w-full grid grid-cols-[1fr_1fr_1.5fr_1fr_1fr_32px] gap-4 items-center px-5 py-3.5 border-b border-[#f8f8f8] last:border-0 transition-colors text-left ${
                    selected?.id === d.id ? 'bg-[#f4f4f4]' : 'hover:bg-[#fafafa]'
                  }`}
                >
                  <p className="text-[13px] text-[#666]">{fmtTime(d.created_at)}</p>
                  <p className="text-[13px] text-[#666]">{shift?.date ? fmtDate(shift.date) : '—'}</p>
                  <p className="text-[13px] font-semibold text-[#111] truncate">{d.attendant_name}</p>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit ${TYPE_COLOR[d.type] ?? 'bg-[#f0f0f0] text-[#555]'}`}>
                    {d.type}
                  </span>
                  <p className="text-[13px] font-semibold text-[#111]">{fmt(d.amount)}</p>
                  <ChevronRight size={14} className="text-[#ccc]" />
                </button>
              ))}
            </div>
          )}

          {deposits.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#f0f0f0] shrink-0">
              <p className="text-[11px] font-medium text-[#bbb]">{deposits.length} transaction{deposits.length !== 1 ? 's' : ''}</p>
              <p className="text-[13px] font-bold text-[#111]">{fmt(deposits.reduce((s, d) => s + d.amount, 0))}</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: breakdown panel */}
      <div className="w-[380px] shrink-0 border-l border-[#e8e8e8] h-full">
        <BreakdownPanel deposits={deposits} selected={selected} />
      </div>
    </div>
  )
}

// ── Tanks Panel (manager view) ────────────────────────────────────────────────

function TanksPanel() {
  const { data: tanks = [], isLoading } = useTanks()

  return (
    <div className="h-full flex flex-col">
      <div className="p-5 flex-1 flex flex-col min-h-0">
        <p className="mb-4">
          <span className="text-[13px] font-bold text-[#111]">Tanks</span>
          <span className="text-[13px] font-medium text-[#aaa]"> | Overview</span>
        </p>
        <div className="grid grid-cols-[20px_1fr_1fr_auto] gap-3 mb-2">
          {['#', 'Name', 'Fuel', 'Capacity'].map((h) => (
            <p key={h} className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
          ))}
        </div>
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <LogoLoader />
          </div>
        ) : tanks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[13px] font-medium text-[#bbb]">No tanks configured</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {tanks.map((tank, i) => (
              <div key={tank.id} className="grid grid-cols-[20px_1fr_1fr_auto] gap-3 items-center py-2.5 border-b border-[#f8f8f8] last:border-0">
                <p className="text-[11px] font-bold text-[#ccc]">{i + 1}</p>
                <p className="text-[13px] font-semibold text-[#111]">{tank.name}</p>
                <p className="text-[13px] text-[#666]">{tank.fuel_name}</p>
                <p className="text-[13px] font-semibold text-[#111] text-right">{tank.capacity_litres.toLocaleString('en-JM')}L</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-end border-t border-[#f0f0f0] px-5 py-3">
        <p className="text-[13px] font-bold text-[#bbb]">{tanks.length} tank{tanks.length !== 1 ? 's' : ''}</p>
      </div>
    </div>
  )
}

// ── Manager/Supervisor view ───────────────────────────────────────────────────

function ManagerView() {
  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-hidden flex flex-col p-6 min-w-0">
        <div className="flex-1 bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col">
          <div className="grid grid-cols-[1fr_1fr_2fr_1fr_1fr] gap-4 px-5 py-2.5 border-b border-[#f0f0f0] bg-[#fafafa] shrink-0">
            {['Date', 'Shift', 'Supervisor', 'Amount', 'Balance'].map((h) => (
              <p key={h} className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto flex items-center justify-center">
            <div className="flex flex-col items-center gap-1">
              <p className="text-[13px] font-semibold text-[#bbb]">No sales data yet</p>
              <p className="text-[12px] font-medium text-[#ccc]">Sales transactions will appear here</p>
            </div>
          </div>
        </div>
      </div>
      <div className="w-[600px] shrink-0 border-l border-[#e8e8e8] h-full flex flex-col divide-y divide-[#e8e8e8]">
        <div className="shrink-0"><TanksPanel /></div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TRANSACTION_ROLES = new Set(['Cashier', 'Attendant'])

export function SalesPage() {
  const { user } = useAuth()
  const showTransactions = TRANSACTION_ROLES.has(user?.role ?? '')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebebeb] flex-shrink-0">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-0.5">Service Station</p>
          <h1 className="text-[22px] font-bold text-[#111] leading-tight">Sales</h1>
        </div>
      </div>

      {showTransactions ? <TransactionsView /> : <ManagerView />}
    </div>
  )
}
