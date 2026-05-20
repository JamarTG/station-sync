import { useAuth } from '../lib/authContext'
import { useTanks } from '../hooks/useApi'

// ── Tanks Panel ───────────────────────────────────────────────────────────────

function TanksPanel() {
  const { data: tanks = [], isLoading } = useTanks()

  return (
    <div className="h-full flex flex-col">
      <div className="p-5 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4">
          <p>
            <span className="text-[13px] font-bold text-[#111]">Tanks</span>
            <span className="text-[13px] font-medium text-[#aaa]"> | Overview</span>
          </p>
        </div>

        <div className="grid grid-cols-[20px_1fr_1fr_auto] gap-3 mb-2">
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">#</p>
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">Name</p>
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">Fuel</p>
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase text-right">Capacity</p>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[13px] font-medium text-[#bbb]">Loading…</p>
          </div>
        ) : tanks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[13px] font-medium text-[#bbb]">No tanks configured</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {tanks.map((tank, i) => (
              <div
                key={tank.id}
                className="grid grid-cols-[20px_1fr_1fr_auto] gap-3 items-center py-2.5 border-b border-[#f8f8f8] last:border-0"
              >
                <p className="text-[11px] font-bold text-[#ccc]">{i + 1}</p>
                <p className="text-[13px] font-semibold text-[#111]">{tank.name}</p>
                <p className="text-[13px] text-[#666]">{tank.fuel_name}</p>
                <p className="text-[13px] font-semibold text-[#111] text-right">
                  {tank.capacity_litres.toLocaleString('en-JM')}L
                </p>
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

// ── Cash Panel ────────────────────────────────────────────────────────────────

function CashPanel() {
  // TODO: wire to real cash deposit data
  const entries: { id: string; date: string; supervisor: string; bag_no: string; amount: number }[] = []

  return (
    <div className="flex flex-col">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <p>
            <span className="text-[13px] font-bold text-[#111]">Cash</span>
            <span className="text-[13px] font-medium text-[#aaa]"> | Deposits</span>
          </p>
        </div>

        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 mb-2">
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">Date</p>
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">Supervisor</p>
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">Bag No.</p>
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase text-right">Amount</p>
        </div>

        {entries.length === 0 ? (
          <div className="py-6 flex items-center justify-center">
            <p className="text-[13px] font-medium text-[#bbb]">No cash deposits yet</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {entries.map((e, i) => (
              <div key={e.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-center py-2.5 border-b border-[#f8f8f8] last:border-0">
                <p className="text-[11px] font-bold text-[#ccc]">{i + 1}</p>
                <p className="text-[13px] font-semibold text-[#111]">{e.attendant}</p>
                <p className="text-[13px] text-[#666]">{e.date}</p>
                <p className="text-[13px] font-semibold text-[#111] text-right">
                  ${e.amount.toLocaleString('en-JM', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end border-t border-[#f0f0f0] px-5 py-3">
        <p className="text-[13px] font-bold text-[#bbb]">{entries.length} deposit{entries.length !== 1 ? 's' : ''}</p>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SalesPage() {
  const { user: authUser } = useAuth()
  const isManagerOrAdmin = authUser?.role === 'Manager' || authUser?.role === 'Admin'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebebeb] flex-shrink-0">
        <div>
          {!isManagerOrAdmin && (
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-0.5">Service Station</p>
          )}
          <h1 className="text-[22px] font-bold text-[#111] leading-tight">Sales</h1>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: sales table */}
        <div className="flex-1 overflow-hidden flex flex-col p-6 min-w-0">
          <div className="flex-1 bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col">
            <div className="grid grid-cols-[1fr_2fr_1fr_1fr] gap-4 px-5 py-2.5 border-b border-[#f0f0f0] bg-[#fafafa] shrink-0">
              {['Date', 'Supervisor', 'Amount', 'Balance'].map((h) => (
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

        {/* Right: tanks + cash panels */}
        <div className="w-[600px] shrink-0 border-l border-[#e8e8e8] h-full flex flex-col divide-y divide-[#e8e8e8]">
          <div className="shrink-0">
            <TanksPanel />
          </div>
          <div className="flex-1 overflow-y-auto">
            <CashPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
