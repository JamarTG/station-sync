import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { LogoLoader } from '../components/StationSyncLogo'
import { ArrowLeft, ChevronRight, Cylinder, Fuel, Search, X } from 'lucide-react'
import { useAuth } from '../lib/authContext'
import { useOpenShift, useShiftAttendance, useShiftDeposits, useShiftFuelPrices, useShiftsInRange, useTanks, usePumps, useFuels, useNozzles, useShiftTankLogs, useFuelSummary, useShiftNozzleLogs } from '../hooks/useApi'
import { upsertNozzleLog, upsertTankLog } from '../lib/api'
import type { Deposit, FuelSummary, Nozzle, Pump, Shift, Tank } from '../lib/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => `J$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

function displayType(type: string): string {
  if (type === 'Card') return 'Card Deposit'
  return type
}

function fmtTime(s: string) {
  const d = new Date(s)
  const h = d.getHours(), m = d.getMinutes()
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
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

// ── Shared helper: balance / overage / shortage ───────────────────────────────

const INFLOW_TYPES = new Set(['Cash', 'Card', 'FX', 'Advance', 'Charge'])

function calcSummary(deposits: Deposit[]) {
  const totalInflow      = deposits.filter((d) => INFLOW_TYPES.has(d.type)).reduce((s, d) => s + d.amount, 0)
  const totalExpenditure = deposits.filter((d) => d.type === 'Expenditure').reduce((s, d) => s + d.amount, 0)

  // Per-attendant balance: what they deposited vs. what they collected
  const collected: Record<string, number> = {}
  const deposited: Record<string, number> = {}
  for (const d of deposits) {
    if (INFLOW_TYPES.has(d.type)) {
      collected[d.attendant_name] = (collected[d.attendant_name] ?? 0) + d.amount
    }
  }
  // Without pump-reading targets we use collected as both sides — overages/shortages
  // surface only when cross-referenced with fuel sales, so derive from inflow vs expenditure.
  const balance  = totalInflow - totalExpenditure
  const overage  = balance > 0 ? balance : 0
  const shortage = balance < 0 ? Math.abs(balance) : 0

  return { balance, overage, shortage, totalExpenditure }
}

// ── Breakdown Panel ───────────────────────────────────────────────────────────

function BreakdownPanel({ deposits, selected }: { deposits: Deposit[]; selected: Deposit | null }) {
  const totals: Record<string, number> = {}
  for (const d of deposits) {
    totals[d.type] = (totals[d.type] ?? 0) + d.amount
  }
  const grand = Object.values(totals).reduce((s, v) => s + v, 0)
  const entries = Object.entries(totals).sort(([, a], [, b]) => b - a)
  const { balance, overage, shortage, totalExpenditure } = calcSummary(deposits)

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="p-5 border-b border-[#f0f0f0] shrink-0">
        <p className="text-[13px] font-bold text-[#111]">Sales</p>
      </div>

      {/* Breakdown by type */}
      <div className="p-5 border-b border-[#f0f0f0] shrink-0">
        <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mb-3">Breakdown</p>
        {entries.length === 0 ? (
          <p className="text-[13px] font-medium text-[#bbb]">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {entries.map(([type, amount]) => (
              <div key={type} className="flex items-center justify-between">
                <p className="text-[13px] font-medium text-[#555]">{displayType(type)}</p>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-1.5 rounded-full bg-[#f0f0f0] overflow-hidden">
                    <div className="h-full bg-[#111] rounded-full" style={{ width: grand > 0 ? `${(amount / grand) * 100}%` : '0%' }} />
                  </div>
                  <p className="text-[13px] font-semibold text-[#111] w-24 text-right">{fmt(amount)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      {deposits.length > 0 && (
        <div className="p-5 border-b border-[#f0f0f0] shrink-0">
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mb-3">Summary</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-[#555]">Expenditures</p>
              <p className={`text-[13px] font-semibold ${totalExpenditure > 0 ? 'text-red-500' : 'text-[#bbb]'}`}>
                {totalExpenditure > 0 ? `-${fmt(totalExpenditure)}` : '--'}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-[#555]">Balance</p>
              <p className={`text-[13px] font-semibold ${balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-500' : 'text-[#111]'}`}>
                {balance > 0 ? `+${fmt(balance)}` : balance < 0 ? `-${fmt(Math.abs(balance))}` : fmt(0)}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-[#555]">Overage</p>
              <p className={`text-[13px] font-semibold ${overage > 0 ? 'text-green-600' : 'text-[#bbb]'}`}>
                {overage > 0 ? `+${fmt(overage)}` : '--'}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-[#555]">Shortage</p>
              <p className={`text-[13px] font-semibold ${shortage > 0 ? 'text-red-500' : 'text-[#bbb]'}`}>
                {shortage > 0 ? `-${fmt(shortage)}` : '--'}
              </p>
            </div>
          </div>
        </div>
      )}

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
              { label: 'Type',      value: displayType(selected.type) },
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
  const [query, setQuery] = useState('')

  const isAttendant = user?.role === 'Attendant'
  const deposits = isAttendant
    ? allDeposits.filter((d) => d.attendant_id === user?.id)
    : allDeposits

  const filtered = query.trim()
    ? deposits.filter((d) =>
        d.attendant_name.toLowerCase().includes(query.toLowerCase()) ||
        d.type.toLowerCase().includes(query.toLowerCase())
      )
    : deposits

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: transactions table */}
      <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4 min-w-0">
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-white border border-[#ebebeb] rounded-xl shrink-0">
          <Search size={14} className="text-[#bbb] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by attendant or type…"
            className="flex-1 text-[13px] text-[#111] placeholder-[#ccc] outline-none bg-transparent"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[#bbb] hover:text-[#555] transition-colors">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex-1 bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col">
          <div className="grid grid-cols-[1fr_1fr_1.5fr_1fr_1fr_32px] gap-4 px-5 py-2.5 border-b border-[#f0f0f0] bg-[#fafafa] shrink-0">
            {['Time', 'Shift', 'Attendant', 'Type', 'Amount', ''].map((h) => (
              <p key={h} className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-1">
              <p className="text-[13px] font-semibold text-[#bbb]">
                {deposits.length === 0 ? 'No transactions yet' : 'No results found'}
              </p>
              {deposits.length === 0 && (
                <p className="text-[12px] font-medium text-[#ccc]">Sales will appear here once recorded</p>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {filtered.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelected(d)}
                  className={`w-full grid grid-cols-[1fr_1fr_1.5fr_1fr_1fr_32px] gap-4 items-center px-5 py-3.5 border-b border-[#f8f8f8] last:border-0 transition-colors text-left ${
                    selected?.id === d.id ? 'bg-[#f4f4f4]' : 'hover:bg-[#fafafa]'
                  }`}
                >
                  <p className="text-[11px] font-bold text-[#666]">{fmtTime(d.created_at)}</p>
                  <p className="text-[13px] text-[#666]">{shift?.date ? fmtDate(shift.date) : '—'}</p>
                  <p className="text-[13px] font-semibold text-[#111] truncate">{d.attendant_name}</p>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit ${TYPE_COLOR[d.type] ?? 'bg-[#f0f0f0] text-[#555]'}`}>
                    {displayType(d.type)}
                  </span>
                  <p className="text-[13px] font-semibold text-[#111]">{fmt(d.amount)}</p>
                  <ChevronRight size={14} className="text-[#ccc]" />
                </button>
              ))}
            </div>
          )}

          {deposits.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#f0f0f0] shrink-0">
              <p className="text-[20px] font-bold text-[#111]">{deposits.length}</p>
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

// ── Shift Detail Panel ────────────────────────────────────────────────────────

function ShiftDetailPanel({ shift }: { shift: Shift | null }) {
  const { data: deposits = [], isLoading } = useShiftDeposits(shift?.id)

  const totals: Record<string, number> = {}
  for (const d of deposits) totals[d.type] = (totals[d.type] ?? 0) + d.amount
  const entries = Object.entries(totals).sort(([, a], [, b]) => b - a)
  const grand = entries.reduce((s, [, v]) => s + v, 0)
  const { balance, overage, shortage } = calcSummary(deposits)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-5 border-b border-[#f0f0f0] shrink-0">
        <p className="text-[13px] font-bold text-[#111]">Sales</p>
        {shift && (
          <p className="text-[28px] font-bold text-[#111] leading-none mt-3">{fmt(grand)}</p>
        )}
      </div>

      {!shift ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] font-medium text-[#bbb]">Select a shift to see breakdown</p>
        </div>
      ) : isLoading ? (
        <div className="flex-1 flex items-center justify-center"><LogoLoader /></div>
      ) : entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] font-medium text-[#bbb]">No transactions for this shift</p>
        </div>
      ) : (
        <>
          <div className="p-5 border-b border-[#f0f0f0] shrink-0">
            <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mb-3">Breakdown</p>
            <div className="space-y-2">
              {entries.map(([type, amount]) => (
                <div key={type} className="flex items-center justify-between">
                  <p className="text-[13px] font-medium text-[#555]">{type}</p>
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-1.5 rounded-full bg-[#f0f0f0] overflow-hidden">
                      <div className="h-full bg-[#111] rounded-full" style={{ width: grand > 0 ? `${(amount / grand) * 100}%` : '0%' }} />
                    </div>
                    <p className="text-[13px] font-semibold text-[#111] w-24 text-right">{fmt(amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 shrink-0">
            <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mb-3">Summary</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium text-[#555]">Balance</p>
                <p className={`text-[13px] font-semibold ${balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-500' : 'text-[#111]'}`}>
                  {balance > 0 ? `+${fmt(balance)}` : balance < 0 ? `-${fmt(Math.abs(balance))}` : fmt(0)}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium text-[#555]">Overage</p>
                <p className={`text-[13px] font-semibold ${overage > 0 ? 'text-green-600' : 'text-[#bbb]'}`}>
                  {overage > 0 ? `+${fmt(overage)}` : '--'}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium text-[#555]">Shortage</p>
                <p className={`text-[13px] font-semibold ${shortage > 0 ? 'text-red-500' : 'text-[#bbb]'}`}>
                  {shortage > 0 ? `-${fmt(shortage)}` : '--'}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Pumps Panel (shift detail) ────────────────────────────────────────────────

// Used by ShiftDetailView to populate pumpSummaries state for the attendant Sold column.
function PumpSummaryLoader({
  pumpId, shiftId, onLoad,
}: {
  pumpId: string; shiftId: string; onLoad: (pumpId: string, data: FuelSummary[]) => void
}) {
  const { data } = useFuelSummary(pumpId, shiftId)
  const ref = useRef(onLoad)
  ref.current = onLoad
  useEffect(() => {
    if (data !== undefined) ref.current(pumpId, data)
  }, [pumpId, data])
  return null
}

// Renders nozzle rows for ONE pump under the selected fuel grade.
// Calls useFuelSummary directly — no intermediate state, no callbacks.
function PumpNozzleRows({
  pumpId, pumpNum, shiftId, fuelType,
}: {
  pumpId: string; pumpNum: number; shiftId: string; fuelType: string
}) {
  const { data: summary = [] } = useFuelSummary(pumpId, shiftId)
  const entry = summary.find((f) => f.fuelType === fuelType)
  if (!entry) return null
  return (
    <>
      {entry.nozzles.map((n) => {
        const hasSaved = n.openingReading !== 0 || n.closingReading !== 0
        const litres = n.closingReading - n.openingReading
        return (
          <div
            key={n.nozzleNumber}
            className="grid grid-cols-[28px_1fr_1fr_1fr] gap-3 items-center py-1.5 border-b border-[#f4f4f4] last:border-b-0"
          >
            <p className="text-[12px] font-bold text-[#ccc]">{pumpNum}</p>
            <p className="text-[13px] text-[#666]">
              {hasSaved ? n.openingReading.toLocaleString('en-JM') : '—'}
            </p>
            <p className="text-[13px] text-[#666]">
              {hasSaved ? n.closingReading.toLocaleString('en-JM') : '—'}
            </p>
            <p className="text-[13px] font-semibold text-[#111]">
              {hasSaved ? `${litres.toLocaleString('en-JM')}L` : '—'}
            </p>
          </div>
        )
      })}
    </>
  )
}

// Edit-mode rows for one pump under the selected fuel grade.
function PumpEditRows({
  pump, pumpNum, nozzles, fuelId, editState, onChange,
}: {
  pump: Pump; pumpNum: number; nozzles: Nozzle[]; fuelId: string
  editState: Record<string, { opening: string; closing: string }>
  onChange: (nozzleId: string, field: 'opening' | 'closing', value: string) => void
}) {
  const pumpNozzles = nozzles
    .filter((n) => n.pump_id === pump.id && n.fuel_id === fuelId)
    .sort((a, b) => a.id.localeCompare(b.id))

  if (pumpNozzles.length === 0) return null

  return (
    <>
      {pumpNozzles.map((nozzle) => {
        const vals = editState[nozzle.id] ?? { opening: '', closing: '' }
        const open = parseFloat(vals.opening) || 0
        const close = parseFloat(vals.closing) || 0
        const litres = close - open
        return (
          <div
            key={nozzle.id}
            className="grid grid-cols-[28px_1fr_1fr_1fr] gap-3 items-center py-1.5 border-b border-[#f4f4f4] last:border-b-0"
          >
            <p className="text-[12px] font-bold text-[#ccc]">{pumpNum}</p>
            <input
              type="number"
              value={vals.opening}
              onChange={(e) => onChange(nozzle.id, 'opening', e.target.value)}
              placeholder="0.00"
              className="text-[13px] text-[#111] bg-[#f4f4f4] rounded-lg px-2 py-1 outline-none focus:bg-[#ebebeb] w-full transition-colors"
            />
            <input
              type="number"
              value={vals.closing}
              onChange={(e) => onChange(nozzle.id, 'closing', e.target.value)}
              placeholder="0.00"
              className="text-[13px] text-[#111] bg-[#f4f4f4] rounded-lg px-2 py-1 outline-none focus:bg-[#ebebeb] w-full transition-colors"
            />
            <p className="text-[13px] font-semibold text-[#111]">
              {litres > 0 ? `${litres.toLocaleString('en-JM')}L` : '—'}
            </p>
          </div>
        )
      })}
    </>
  )
}

function PumpsPanel({ shiftId }: { shiftId: string }) {
  const qc = useQueryClient()
  const { data: pumps = [], isLoading: pumpsLoading } = usePumps()
  const { data: fuels = [], isLoading: fuelsLoading } = useFuels()
  const { data: nozzles = [] } = useNozzles()
  const { data: nozzleLogs = [] } = useShiftNozzleLogs(shiftId)
  const [activeFuelId, setActiveFuelId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editState, setEditState] = useState<Record<string, { opening: string; closing: string }>>({})
  const [saving, setSaving] = useState(false)

  const effectiveFuel = fuels.find((f) => f.id === (activeFuelId ?? fuels[0]?.id))

  const totalLitres = useMemo(() => {
    if (!effectiveFuel) return 0
    return nozzles
      .filter((n) => pumps.some((p) => p.id === n.pump_id) && n.fuel_id === effectiveFuel.id)
      .reduce((sum, n) => {
        const log = nozzleLogs.find((l) => l.nozzle_id === n.id)
        return log ? sum + (log.ending_reading - log.starting_reading) : sum
      }, 0)
  }, [nozzles, nozzleLogs, pumps, effectiveFuel])

  function enterEditMode() {
    const state: Record<string, { opening: string; closing: string }> = {}
    for (const n of nozzles) {
      if (!pumps.some((p) => p.id === n.pump_id)) continue
      const log = nozzleLogs.find((l) => l.nozzle_id === n.id)
      state[n.id] = {
        opening: log && log.starting_reading ? String(log.starting_reading) : '',
        closing: log && log.ending_reading ? String(log.ending_reading) : '',
      }
    }
    setEditState(state)
    setEditMode(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const ourNozzles = nozzles.filter((n) => pumps.some((p) => p.id === n.pump_id))
      await Promise.all(
        ourNozzles.map((n) => {
          const vals = editState[n.id]
          if (!vals) return Promise.resolve()
          const starting = parseFloat(vals.opening)
          const ending = parseFloat(vals.closing)
          if (isNaN(starting) && isNaN(ending)) return Promise.resolve()
          return upsertNozzleLog(shiftId, {
            nozzle_id: n.id,
            starting_reading: isNaN(starting) ? 0 : starting,
            ending_reading: isNaN(ending) ? 0 : ending,
          })
        })
      )
      await qc.invalidateQueries({ queryKey: ['shifts', shiftId, 'nozzle-logs'] })
      await Promise.all(
        pumps.map((p) => qc.invalidateQueries({ queryKey: ['fuel-summary', p.id, shiftId] }))
      )
      setEditMode(false)
    } finally {
      setSaving(false)
    }
  }

  function handleEditChange(nozzleId: string, field: 'opening' | 'closing', value: string) {
    setEditState((prev) => ({ ...prev, [nozzleId]: { ...prev[nozzleId], [field]: value } }))
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 p-5 flex flex-col min-h-0 overflow-hidden">
        {/* Title + fuel grade tabs + edit toggle */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <p>
            <span className="text-[13px] font-bold text-[#111]">Pumps</span>
            {effectiveFuel && <span className="text-[13px] font-medium text-[#aaa]"> | {effectiveFuel.name}</span>}
          </p>
          {fuels.length > 1 && (
            <div className="flex gap-0.5">
              {fuels.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFuelId(f.id)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                    f.id === effectiveFuel?.id ? 'bg-[#f0f0f0] text-[#111]' : 'text-[#bbb] hover:text-[#555]'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[28px_1fr_1fr_1fr] gap-3 mb-2 shrink-0">
          {['#', 'Opening', 'Closing', 'Litres'].map((h) => (
            <p key={h} className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
          ))}
        </div>

        {pumpsLoading || fuelsLoading ? (
          <div className="flex-1 flex items-center justify-center"><LogoLoader /></div>
        ) : pumps.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[13px] font-medium text-[#bbb]">No pumps configured</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {effectiveFuel && pumps.map((pump, idx) => (
              editMode ? (
                <PumpEditRows
                  key={pump.id}
                  pump={pump}
                  pumpNum={idx + 1}
                  nozzles={nozzles}
                  fuelId={effectiveFuel.id}
                  editState={editState}
                  onChange={handleEditChange}
                />
              ) : (
                <PumpNozzleRows
                  key={pump.id}
                  pumpId={pump.id}
                  pumpNum={idx + 1}
                  shiftId={shiftId}
                  fuelType={effectiveFuel.name}
                />
              )
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-[#f0f0f0] px-5 py-3 shrink-0">
        <span className="flex items-center gap-1 text-[12px] font-semibold text-[#888]">
          <Fuel size={12} />{pumps.length}
        </span>
        {totalLitres > 0 && (
          <p className="text-[12px] font-semibold text-[#888]">{totalLitres.toLocaleString('en-JM')}L</p>
        )}
      </div>
    </div>
  )
}

// ── Tank Logs Panel (shift detail) ────────────────────────────────────────────

type TankEditState = Record<string, { opening: string; closing: string; delivery: string }>

function TankEditRow({
  tank, editState, onChange,
}: {
  tank: Tank
  editState: TankEditState
  onChange: (tankId: string, field: 'opening' | 'closing' | 'delivery', value: string) => void
}) {
  const vals = editState[tank.id] ?? { opening: '', closing: '', delivery: '' }
  return (
    <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-3 items-center py-1.5 border-b border-[#f4f4f4] last:border-b-0">
      <div>
        <p className="text-[13px] font-semibold text-[#111]">{tank.name}</p>
        <p className="text-[11px] text-[#aaa]">{tank.fuel_name}</p>
      </div>
      <input
        type="number"
        value={vals.opening}
        onChange={(e) => onChange(tank.id, 'opening', e.target.value)}
        placeholder="0.00"
        className="text-[13px] text-[#111] bg-[#f4f4f4] rounded-lg px-2 py-1 outline-none focus:bg-[#ebebeb] w-full transition-colors"
      />
      <input
        type="number"
        value={vals.closing}
        onChange={(e) => onChange(tank.id, 'closing', e.target.value)}
        placeholder="0.00"
        className="text-[13px] text-[#111] bg-[#f4f4f4] rounded-lg px-2 py-1 outline-none focus:bg-[#ebebeb] w-full transition-colors"
      />
      <input
        type="number"
        value={vals.delivery}
        onChange={(e) => onChange(tank.id, 'delivery', e.target.value)}
        placeholder="0.00"
        className="text-[13px] text-[#111] bg-[#f4f4f4] rounded-lg px-2 py-1 outline-none focus:bg-[#ebebeb] w-full transition-colors"
      />
    </div>
  )
}

function TankLogsPanel({ shiftId }: { shiftId: string }) {
  const { data: tanks = [], isLoading: tanksLoading } = useTanks()
  const { data: logs  = [], isLoading: logsLoading  } = useShiftTankLogs(shiftId)

  const isLoading = tanksLoading || logsLoading
  const rows = tanks.map((t) => ({ tank: t, log: logs.find((l) => l.tank_id === t.id) ?? null }))

  const totalDelivery = useMemo(
    () => logs.reduce((sum, l) => sum + (l.delivery_litres ?? 0), 0),
    [logs],
  )

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 p-5 flex flex-col min-h-0 overflow-hidden">
        {/* Title */}
        <p className="mb-4 shrink-0">
          <span className="text-[13px] font-bold text-[#111]">Tanks</span>
          <span className="text-[13px] font-medium text-[#aaa]"> | Levels</span>
        </p>

        {/* Column headers */}
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-3 mb-2 shrink-0">
          {['Tank', 'Opening', 'Closing', 'Delivery'].map((h) => (
            <p key={h} className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
          ))}
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center"><LogoLoader /></div>
        ) : tanks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[13px] font-medium text-[#bbb]">No tanks configured</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {rows.map(({ tank, log }) => (
              <div
                key={tank.id}
                className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-3 items-center py-1.5 border-b border-[#f4f4f4] last:border-b-0"
              >
                <div>
                  <p className="text-[13px] font-semibold text-[#111]">{tank.name}</p>
                  <p className="text-[11px] text-[#aaa]">{tank.fuel_name}</p>
                </div>
                <p className="text-[13px] text-[#666]">
                  {log?.opening_level != null ? `${log.opening_level.toLocaleString('en-JM')}L` : '—'}
                </p>
                <p className="text-[13px] text-[#666]">
                  {log?.closing_level != null ? `${log.closing_level.toLocaleString('en-JM')}L` : '—'}
                </p>
                <p className="text-[13px] font-semibold text-[#111]">
                  {log?.delivery_litres != null ? `${log.delivery_litres.toLocaleString('en-JM')}L` : '—'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-[#f0f0f0] px-5 py-3 shrink-0">
        <span className="flex items-center gap-1 text-[12px] font-semibold text-[#888]">
          <Cylinder size={12} />{tanks.length}
        </span>
        {totalDelivery > 0 && (
          <p className="text-[12px] font-semibold text-[#888]">{totalDelivery.toLocaleString('en-JM')}L</p>
        )}
      </div>
    </div>
  )
}

// ── Accounts Section (shift detail) ──────────────────────────────────────────

type ShiftAccountType = 'Cash' | 'Card' | 'Expenditures' | 'Charges' | 'Advance' | 'FX' | 'Deposits'

const ACCOUNT_TABS: ShiftAccountType[] = ['Cash', 'Card', 'Expenditures', 'Charges', 'Advance', 'FX', 'Deposits']

const DEPOSIT_TYPE_MAP: Record<ShiftAccountType, string[]> = {
  Cash:         ['Cash'],
  Card:         ['Card'],
  Charges:      ['Charge'],
  Advance:      ['Advance'],
  FX:           ['FX'],
  Expenditures: ['Expenditure'],
  Deposits:     ['CashDeposit', 'CardDeposit', 'FXDeposit', 'Cheque'],
}

function AccountsSection({ deposits }: { deposits: Deposit[] }) {
  const [activeTab, setActiveTab] = useState<ShiftAccountType>('Cash')

  const filtered = useMemo(
    () => deposits.filter((d) => DEPOSIT_TYPE_MAP[activeTab].includes(d.type)),
    [deposits, activeTab],
  )

  const total = filtered.reduce((s, d) => s + d.amount, 0)

  function getSubtitle(d: Deposit): string | null {
    try {
      const m: Record<string, unknown> = JSON.parse(d.metadata ?? '{}')
      if (activeTab === 'Card' && m.bank)
        return `${String(m.bank)}${m.trans_no ? ` · #${String(m.trans_no)}` : ''}`
      if ((activeTab === 'Charges' || activeTab === 'Advance') && m.fuel_type)
        return `${String(m.fuel_type)} · ${Number(m.litres ?? 0).toFixed(2)}L`
      if (activeTab === 'FX' && m.currency)
        return `${String(m.currency)} ${Number(m.fx_amount ?? 0).toFixed(2)}`
      if ((activeTab === 'Expenditures' || activeTab === 'Deposits') && m.description)
        return String(m.description)
    } catch {}
    return null
  }

  const nameLabel =
    activeTab === 'Expenditures' ? 'Requested by' :
    activeTab === 'Deposits'     ? 'Deposited by' : 'Attendant'

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 p-5 flex flex-col min-h-0 overflow-hidden">

        {/* Title + tab pills */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <p>
            <span className="text-[13px] font-bold text-[#111]">Accounts</span>
            <span className="text-[13px] font-medium text-[#aaa]"> | {activeTab}</span>
          </p>
          <div className="flex gap-0.5">
            {ACCOUNT_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                  tab === activeTab ? 'bg-[#f0f0f0] text-[#111]' : 'text-[#bbb] hover:text-[#555]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[20px_1fr_auto] gap-3 mb-2 shrink-0">
          {['#', nameLabel, 'Amount'].map((h) => (
            <p key={h} className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[13px] font-medium text-[#bbb]">No activity recorded</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {filtered.map((d, i) => {
              const sub = getSubtitle(d)
              return (
                <div
                  key={d.id}
                  className="grid grid-cols-[20px_1fr_auto] gap-3 items-center py-1.5 border-b border-[#f4f4f4] last:border-b-0"
                >
                  <p className="text-[12px] font-bold text-[#ccc]">{i + 1}</p>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#111] truncate">{d.attendant_name}</p>
                    {sub && <p className="text-[11px] text-[#aaa] truncate">{sub}</p>}
                  </div>
                  <p className="text-[13px] font-semibold text-[#111]">{fmt(d.amount)}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[#f0f0f0] px-5 py-3 shrink-0">
        <span className="flex items-center gap-1 text-[12px] font-semibold text-[#888]">{filtered.length}</span>
        {total > 0 && <p className="text-[12px] font-semibold text-[#888]">{fmt(total)}</p>}
      </div>
    </div>
  )
}

// ── Full-page shift detail view ───────────────────────────────────────────────

function ShiftDetailView({ shift, onBack }: { shift: Shift; onBack: () => void }) {
  const { data: deposits    = [], isLoading: depositsLoading   } = useShiftDeposits(shift.id)
  const { data: attendance  = [], isLoading: attendanceLoading } = useShiftAttendance(shift.id)
  const { data: fuelPrices  = []                               } = useShiftFuelPrices(shift.id)
  const { data: pumps       = []                               } = usePumps()
  const [pumpSummaries, setPumpSummaries] = useState<Record<string, FuelSummary[]>>({})
  const handlePumpLoad = useCallback((pumpId: string, data: FuelSummary[]) => {
    setPumpSummaries((prev) => ({ ...prev, [pumpId]: data }))
  }, [])

  const isLoading = depositsLoading || attendanceLoading

  const totals: Record<string, number> = {}
  for (const d of deposits) totals[d.type] = (totals[d.type] ?? 0) + d.amount
  const entries = Object.entries(totals).sort(([, a], [, b]) => b - a)
  const grand   = entries.reduce((s, [, v]) => s + v, 0)
  const { balance, overage, shortage } = calcSummary(deposits)
  const open = !shift.end_time

  // Per-attendant: group duplicate attendance records, sum sales across distinct pump assignments
  const attendantRows = useMemo(() => {
    // Collect distinct pump IDs per attendant
    const map = new Map<string, { name: string; pumpIds: Set<string> }>()
    for (const att of attendance) {
      if (!map.has(att.user_id))
        map.set(att.user_id, { name: att.user_name, pumpIds: new Set() })
      const entry = map.get(att.user_id)!
      if (att.pump_id) entry.pumpIds.add(att.pump_id)
    }

    return [...map.entries()].map(([userId, { name, pumpIds }]) => {
      // Sold = sum of totalSales across all distinct pumps assigned to this attendant
      const sold = [...pumpIds].reduce(
        (s, pumpId) => s + (pumpSummaries[pumpId] ?? []).reduce((ps, f) => ps + f.totalSales, 0),
        0,
      )
      // Deposited = sum of all inflow deposit types recorded for this attendant
      const deposited = deposits
        .filter((d) => d.attendant_id === userId && INFLOW_TYPES.has(d.type))
        .reduce((s, d) => s + d.amount, 0)
      // Map each pump ID to its 1-based index in the pumps list
      const pumpNums = [...pumpIds]
        .map((id) => pumps.findIndex((p) => p.id === id) + 1)
        .filter((n) => n > 0)
        .sort((a, b) => a - b)
      return { name, pumpNums, sold, deposited, balance: deposited - sold }
    })
  }, [attendance, deposits, pumpSummaries, pumps])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Invisible pump summary loaders — feeds pumpSummaries state */}
      {pumps.map((p) => (
        <PumpSummaryLoader key={p.id} pumpId={p.id} shiftId={shift.id} onLoad={handlePumpLoad} />
      ))}

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebebeb] flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[13px] text-[#888] hover:text-[#111] transition-colors"
        >
          <ArrowLeft size={14} /> Go back
        </button>
        {!open && (
          <button className="px-4 py-2 border border-[#ddd] rounded-xl text-[12px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors">
            Edit
          </button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: shift info + summary */}
        <div className="w-[340px] shrink-0 border-r border-[#e8e8e8] flex flex-col overflow-hidden">

          {/* Identity — fixed */}
          <div className="p-5 border-b border-[#e8e8e8] shrink-0">
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Shift</p>
            <div className="flex items-center justify-between">
              <p className="text-[28px] font-bold text-[#111] leading-none">{fmt(grand)}</p>
              <button className="w-7 h-7 flex items-center justify-center rounded-lg text-[#bbb] hover:bg-[#f4f4f4] hover:text-[#555] transition-colors text-[16px] leading-none">
                ···
              </button>
            </div>
            {open && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] font-semibold text-[#0a5435]">Open</span>
              </div>
            )}
          </div>

          {/* Scrollable sections */}
          <div className="flex-1 overflow-y-auto flex flex-col">

          {/* Info rows */}
          <div className="p-5 border-b border-[#e8e8e8]">
            {[
              { label: 'Date',       value: fmtDate(shift.date) },
              { label: 'Supervisor', value: shift.supervisor_name },
              { label: 'Start',      value: shift.start_time ? fmtTime(`1970-01-01T${shift.start_time}`) : '—' },
              { label: 'End',        value: shift.end_time   ? fmtTime(`1970-01-01T${shift.end_time}`)   : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center py-1.5 border-b border-[#f4f4f4] last:border-b-0">
                <span className="text-[12px] text-[#999] w-24 shrink-0">{label}</span>
                <span className="text-[13px] font-semibold text-[#111]">{value}</span>
              </div>
            ))}
          </div>

          {/* Prices */}
          {fuelPrices.length > 0 && (
            <div className="p-5 border-b border-[#e8e8e8]">
              <p className="mb-4">
                <span className="text-[13px] font-bold text-[#111]">Prices</span>
              </p>
              {fuelPrices.map((fp) => (
                <div key={fp.fuel_id} className="flex items-center py-1.5 border-b border-[#f4f4f4] last:border-b-0">
                  <span className="text-[12px] text-[#999] flex-1">{fp.fuel_name}</span>
                  <span className="text-[13px] font-semibold text-[#111]">{fmt(fp.price)}<span className="text-[11px] font-medium text-[#aaa]">/L</span></span>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          <div className="p-5 border-b border-[#e8e8e8]">
            <p className="mb-4">
              <span className="text-[13px] font-bold text-[#111]">Summary</span>
            </p>
            {[
              {
                label: 'Balance',
                value: balance > 0 ? `+${fmt(balance)}` : balance < 0 ? `-${fmt(Math.abs(balance))}` : fmt(0),
                color: balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-500' : 'text-[#111]',
              },
              {
                label: 'Overage',
                value: overage > 0 ? `+${fmt(overage)}` : '--',
                color: overage > 0 ? 'text-green-600' : 'text-[#bbb]',
              },
              {
                label: 'Shortage',
                value: shortage > 0 ? `-${fmt(shortage)}` : '--',
                color: shortage > 0 ? 'text-red-500' : 'text-[#bbb]',
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-[#f4f4f4] last:border-b-0">
                <span className="text-[12px] text-[#999]">{label}</span>
                <span className={`text-[13px] font-semibold ${color}`}>{value}</span>
              </div>
            ))}
          </div>

          {/* Sales Breakdown */}
          {entries.length > 0 && (
            <div className="p-5 border-b border-[#e8e8e8]">
              <p className="mb-4">
                <span className="text-[13px] font-bold text-[#111]">Breakdown</span>
              </p>
              <div className="space-y-2.5">
                {entries.map(([type, amount]) => (
                  <div key={type} className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-medium text-[#555] shrink-0">{type}</p>
                    <div className="flex items-center gap-3 flex-1 justify-end">
                      <div className="w-20 h-1.5 rounded-full bg-[#f0f0f0] overflow-hidden">
                        <div className="h-full bg-[#111] rounded-full" style={{ width: grand > 0 ? `${(amount / grand) * 100}%` : '0%' }} />
                      </div>
                      <p className="text-[13px] font-semibold text-[#111] w-24 text-right">{fmt(amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          </div>{/* end scrollable sections */}
        </div>

        {/* Right: pumps + tanks (top) · attendants (bottom) */}
        <div className="flex flex-col flex-1 overflow-hidden divide-y divide-[#e8e8e8]">

          {/* Top: Pumps + Tanks side by side — taller */}
          <div className="flex-[3] overflow-hidden flex divide-x divide-[#e8e8e8] min-h-0">
            <div className="flex-1 overflow-hidden flex flex-col min-w-0">
              <PumpsPanel shiftId={shift.id} />
            </div>
            <div className="flex-1 overflow-hidden flex flex-col min-w-0">
              <TankLogsPanel shiftId={shift.id} />
            </div>
          </div>

          {/* Bottom: Attendants + Accounts side by side */}
          <div className="flex-[4] overflow-hidden flex min-h-0 divide-x divide-[#e8e8e8]">

            {/* Attendants */}
            <div className="flex-[5] overflow-hidden flex flex-col min-h-0">
              <div className="flex-1 p-5 flex flex-col min-h-0 overflow-hidden">
                <p className="mb-4 shrink-0">
                  <span className="text-[13px] font-bold text-[#111]">Attendants</span>
                  <span className="text-[13px] font-medium text-[#aaa]"> | Pump History</span>
                </p>

                <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 mb-2 shrink-0">
                  {['Attendant', 'Sold', 'Deposited', 'Balance'].map((h) => (
                    <p key={h} className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
                  ))}
                </div>

                {isLoading ? (
                  <div className="flex-1 flex items-center justify-center"><LogoLoader /></div>
                ) : attendantRows.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-[13px] font-medium text-[#bbb]">No transactions for this shift</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto">
                    {attendantRows.map((row) => (
                      <div
                        key={row.name}
                        className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 items-center py-1.5 border-b border-[#f4f4f4] last:border-b-0"
                      >
                        <div>
                          <p className="text-[13px] font-semibold text-[#111] truncate">{row.name}</p>
                          {row.pumpNums.length > 0 && (
                            <div className="flex items-center gap-2 mt-0.5">
                              {row.pumpNums.map((num) => (
                                <span key={num} className="flex items-center gap-0.5 text-[11px] font-semibold text-[#bbb]">
                                  <Fuel size={10} />
                                  {num}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="text-[13px] font-semibold text-[#111]">{fmt(row.sold)}</p>
                        <p className="text-[13px] text-[#666]">{fmt(row.deposited)}</p>
                        <p className={`text-[13px] font-semibold ${row.balance > 0 ? 'text-green-600' : row.balance < 0 ? 'text-red-500' : 'text-[#111]'}`}>
                          {row.balance > 0 ? `+${fmt(row.balance)}` : row.balance < 0 ? `-${fmt(Math.abs(row.balance))}` : fmt(0)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-[#f0f0f0] px-5 py-3 shrink-0">
                <p className="text-[12px] font-semibold text-[#888]">{attendantRows.length} attendant{attendantRows.length !== 1 ? 's' : ''}</p>
                <p className="text-[13px] font-bold text-[#111]">{fmt(grand)}</p>
              </div>
            </div>

            {/* Accounts */}
            <div className="flex-[6] overflow-hidden flex flex-col min-h-0">
              <AccountsSection deposits={deposits} />
            </div>

          </div>

        </div>
      </div>
    </div>
  )
}

// ── Per-row balance cell ──────────────────────────────────────────────────────

function ShiftRowBalance({ shiftId }: { shiftId: string }) {
  const { data: deposits = [], isLoading } = useShiftDeposits(shiftId)
  if (isLoading) return <p className="text-[12px] text-[#ccc]">—</p>
  const { balance } = calcSummary(deposits)
  return (
    <p className={`text-[13px] font-semibold ${balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-500' : 'text-[#111]'}`}>
      {balance > 0 ? `+${fmt(balance)}` : balance < 0 ? `-${fmt(Math.abs(balance))}` : fmt(0)}
    </p>
  )
}

// ── Period summary panel (right column, no shift selected) ───────────────────

function ShiftDepositsLoader({
  shiftId, onLoad,
}: {
  shiftId: string; onLoad: (shiftId: string, data: Deposit[]) => void
}) {
  const { data } = useShiftDeposits(shiftId)
  const ref = useRef(onLoad)
  ref.current = onLoad
  useEffect(() => {
    if (data !== undefined) ref.current(shiftId, data)
  }, [shiftId, data])
  return null
}

function PeriodSummaryPanel({ shifts }: { shifts: Shift[] }) {
  const [depositsByShift, setDepositsByShift] = useState<Record<string, Deposit[]>>({})
  const handleLoad = useCallback((shiftId: string, data: Deposit[]) => {
    setDepositsByShift((prev) => ({ ...prev, [shiftId]: data }))
  }, [])

  const deposits = useMemo(
    () => shifts.flatMap((s) => depositsByShift[s.id] ?? []),
    [shifts, depositsByShift],
  )

  const totals: Record<string, number> = {}
  for (const d of deposits) totals[d.type] = (totals[d.type] ?? 0) + d.amount
  const entries = Object.entries(totals).sort(([, a], [, b]) => b - a)
  const grand   = entries.reduce((s, [, v]) => s + v, 0)
  const { balance, overage, shortage } = calcSummary(deposits)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {shifts.map((s) => (
        <ShiftDepositsLoader key={s.id} shiftId={s.id} onLoad={handleLoad} />
      ))}

      <div className="p-5 border-b border-[#f0f0f0] shrink-0">
        <p className="text-[13px] font-bold text-[#111]">Sales</p>
        <p className="text-[28px] font-bold text-[#111] leading-none mt-3">{fmt(grand)}</p>
      </div>

      {entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] font-medium text-[#bbb]">No transactions yet</p>
        </div>
      ) : (
        <>
          <div className="p-5 border-b border-[#f0f0f0] shrink-0">
            <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mb-3">Breakdown</p>
            <div className="space-y-2">
              {entries.map(([type, amount]) => (
                <div key={type} className="flex items-center justify-between">
                  <p className="text-[13px] font-medium text-[#555]">{type}</p>
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-1.5 rounded-full bg-[#f0f0f0] overflow-hidden">
                      <div className="h-full bg-[#111] rounded-full" style={{ width: grand > 0 ? `${(amount / grand) * 100}%` : '0%' }} />
                    </div>
                    <p className="text-[13px] font-semibold text-[#111] w-24 text-right">{fmt(amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 shrink-0">
            <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mb-3">Summary</p>
            <div className="space-y-2">
              {[
                { label: 'Balance',  value: balance > 0 ? `+${fmt(balance)}` : balance < 0 ? `-${fmt(Math.abs(balance))}` : fmt(0), color: balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-500' : 'text-[#111]' },
                { label: 'Overage',  value: overage  > 0 ? `+${fmt(overage)}`  : '--', color: overage  > 0 ? 'text-green-600' : 'text-[#bbb]' },
                { label: 'Shortage', value: shortage > 0 ? `-${fmt(shortage)}` : '--', color: shortage > 0 ? 'text-red-500'  : 'text-[#bbb]' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <p className="text-[13px] font-medium text-[#555]">{label}</p>
                  <p className={`text-[13px] font-semibold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Manager/Supervisor view ───────────────────────────────────────────────────

function ManagerView() {
  const [viewShift, setViewShift] = useState<Shift | null>(null)
  const [query, setQuery]         = useState('')

  const { end, start } = useMemo(() => {
    const now = new Date()
    const end = now.toISOString().slice(0, 10)
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    return { start, end }
  }, [])

  const { data: allShifts = [], isLoading } = useShiftsInRange(start, end)
  const shifts = allShifts
    .filter((s) => !s.shift_type || s.shift_type === 'service_station')
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))

  const filtered = query.trim()
    ? shifts.filter((s) =>
        s.supervisor_name.toLowerCase().includes(query.toLowerCase()) ||
        fmtDate(s.date).toLowerCase().includes(query.toLowerCase())
      )
    : shifts

  if (viewShift) {
    return <ShiftDetailView shift={viewShift} onBack={() => setViewShift(null)} />
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4 min-w-0">
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-white border border-[#ebebeb] rounded-xl shrink-0">
          <Search size={14} className="text-[#bbb] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by supervisor or date…"
            className="flex-1 text-[13px] text-[#111] placeholder-[#ccc] outline-none bg-transparent"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[#bbb] hover:text-[#555] transition-colors">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex-1 bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col">
          <div className="grid grid-cols-[1fr_1fr_2fr_1fr_1fr_40px] gap-4 px-5 py-2.5 border-b border-[#f0f0f0] bg-[#fafafa] shrink-0">
            {['Time', 'Date', 'Supervisor', 'Status', 'Balance', ''].map((h) => (
              <p key={h} className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
            ))}
          </div>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center"><LogoLoader /></div>
          ) : filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-1">
              <p className="text-[13px] font-semibold text-[#bbb]">
                {shifts.length === 0 ? 'No shifts in the last 30 days' : 'No results found'}
              </p>
              {shifts.length === 0 && (
                <p className="text-[12px] font-medium text-[#ccc]">Shifts will appear here once recorded</p>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {filtered.map((s) => {
                const open = !s.end_time
                return (
                  <button
                    key={s.id}
                    onClick={() => setViewShift(s)}
                    className="w-full grid grid-cols-[1fr_1fr_2fr_1fr_1fr_40px] gap-4 items-center px-5 py-3.5 border-b border-[#f8f8f8] last:border-0 transition-colors text-left hover:bg-[#fafafa]"
                  >
                    <p className="text-[11px] font-bold text-[#666]">
                      {s.start_time ? fmtTime(`1970-01-01T${s.start_time}`) : '—'}
                    </p>
                    <p className="text-[11px] font-bold text-[#666]">{fmtDate(s.date)}</p>
                    <p className="text-[13px] font-semibold text-[#111] truncate">{s.supervisor_name}</p>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit ${
                      open ? 'bg-[#d1e7dd] text-[#0a5435]' : 'bg-[#f0f0f0] text-[#555]'
                    }`}>{open ? 'Open' : 'Closed'}</span>
                    <ShiftRowBalance shiftId={s.id} />
                    <ChevronRight size={14} className="text-[#ccc]" />
                  </button>
                )
              })}
            </div>
          )}

          {shifts.length > 0 && (
            <div className="px-5 py-3 border-t border-[#f0f0f0] shrink-0">
              <p className="text-[11px] font-medium text-[#bbb]">{filtered.length} shift{filtered.length !== 1 ? 's' : ''}</p>
            </div>
          )}
        </div>
      </div>

      <div className="w-[420px] shrink-0 border-l border-[#e8e8e8] h-full flex flex-col divide-y divide-[#e8e8e8]">
        <div className="shrink-0"><TanksPanel /></div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <PeriodSummaryPanel shifts={shifts} />
        </div>
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
