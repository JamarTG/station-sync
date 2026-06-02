import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Search, X, MoreHorizontal, CheckCircle2, Clock, ArrowUpRight, Flag, AlertTriangle } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { LogoLoader } from '../components/StationSyncLogo'
import { useShiftsInRange, useShiftDeposits } from '../hooks/useApi'
import { matchesSearch } from '../lib/search'
import type { Deposit, Shift } from '../lib/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => `J$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-JM', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(s: string) {
  const d = new Date(s)
  const h = d.getHours(), m = d.getMinutes()
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function isoDate(d: Date) { return d.toISOString().slice(0, 10) }

function displayType(type: string) {
  return type
}

function parseBagNo(metadata: string | null): string | null {
  if (!metadata) return null
  try {
    const m = JSON.parse(metadata)
    return m?.bag_no ?? m?.bagNo ?? m?.bag ?? null
  } catch {
    return null
  }
}

const JMD_DENOMS = [5000, 2000, 1000, 500, 100, 50, 20, 10, 5, 1] as const

function parseDenominations(metadata: string | null): Record<number, number> | null {
  if (!metadata) return null
  try {
    const m = JSON.parse(metadata)
    const raw = m?.denominations ?? m?.denoms ?? m?.denomination_counts ?? null
    if (!raw) return null
    // Array format: [{ denomination: 5000, count: 2 }, ...]
    if (Array.isArray(raw)) {
      const out: Record<number, number> = {}
      for (const item of raw) {
        const denom = Number(item.denomination ?? item.denom ?? item.value)
        const count = Number(item.count ?? item.qty ?? item.quantity ?? 0)
        if (!isNaN(denom) && count > 0) out[denom] = (out[denom] ?? 0) + count
      }
      return Object.keys(out).length > 0 ? out : null
    }
    // Object format: { "5000": 2, "1000": 5 }
    if (typeof raw === 'object') {
      const out: Record<number, number> = {}
      for (const [k, v] of Object.entries(raw)) {
        const denom = Number(k)
        const count = Number(v)
        if (!isNaN(denom) && count > 0) out[denom] = (out[denom] ?? 0) + count
      }
      return Object.keys(out).length > 0 ? out : null
    }
    return null
  } catch {
    return null
  }
}

const TYPE_COLOR: Record<string, string> = {
  Cash:        'bg-[#d1e7dd] text-[#0a5435]',
  Card:        'bg-[#cfe2ff] text-[#0a3d91]',
  Charge:      'bg-[#fff3cd] text-[#856404]',
  FX:          'bg-[#f0f0f0] text-[#555]',
  Advance:     'bg-[#f0f0f0] text-[#555]',
}

const INFLOW_TYPES = new Set(['Cash', 'Card', 'FX', 'Advance'])
const FILTER_TABS  = ['All', 'Cash', 'Card', 'FX', 'Advance'] as const
type FilterTab = typeof FILTER_TABS[number]

// ── Deposit loader per shift ──────────────────────────────────────────────────

function ShiftDepositsLoader({ shiftId, onLoad }: {
  shiftId: string
  onLoad: (shiftId: string, data: Deposit[]) => void
}) {
  const { data } = useShiftDeposits(shiftId)
  const ref = useRef(onLoad)
  ref.current = onLoad
  useEffect(() => {
    if (data !== undefined) ref.current(shiftId, data)
  }, [shiftId, data])
  return null
}

// ── Verified badge ────────────────────────────────────────────────────────────

function VerifiedBadge({ verified, onClick }: { verified: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors w-fit ${
        verified
          ? 'bg-green-50 text-green-600 hover:bg-green-100'
          : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
      }`}
    >
      {verified
        ? <><CheckCircle2 size={10} /> Verified</>
        : <><Clock size={10} /> Pending</>
      }
    </button>
  )
}

// ── Right panel ───────────────────────────────────────────────────────────────

function ShiftDetailPanel({ shift, deposits, verified, onToggleVerified, isCashTab }: {
  shift: Shift
  deposits: Deposit[]
  verified: Set<string>
  onToggleVerified: (id: string) => void
  isCashTab: boolean
}) {
  const navigate = useNavigate()
  const totals: Record<string, number> = {}
  for (const d of deposits) totals[d.type] = (totals[d.type] ?? 0) + d.amount
  const entries = Object.entries(totals).sort(([, a], [, b]) => b - a)
  const grand   = entries.reduce((s, [, v]) => s + v, 0)
  const verifiedCount = deposits.filter((d) => verified.has(d.id)).length

  // Aggregate denominations from all cash deposits
  const denomTotals = useMemo<Record<number, number>>(() => {
    if (!isCashTab) return {}
    const agg: Record<number, number> = {}
    for (const d of deposits.filter((x) => x.type === 'Cash')) {
      const parsed = parseDenominations(d.metadata)
      if (!parsed) continue
      for (const [k, v] of Object.entries(parsed)) {
        const denom = Number(k)
        agg[denom] = (agg[denom] ?? 0) + v
      }
    }
    return agg
  }, [deposits, isCashTab])

  const hasDenoms = isCashTab && Object.keys(denomTotals).length > 0

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-5 border-b border-[#f0f0f0] dark:border-[#1e1e1e] shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">Shift</p>
            <p className="text-[22px] font-bold text-[#111] dark:text-[#e0e0e0] leading-none mt-2">{fmtDate(shift.date)}</p>
            <p className="text-[13px] font-medium text-[#888] dark:text-[#666] mt-1">{shift.supervisor_name}</p>
          </div>
          <button
            onClick={() => navigate({ to: '/sales', search: { shift: shift.id } } as any)}
            title="Go to shift"
            className="shrink-0 mt-1 flex items-center justify-center w-7 h-7 rounded-lg border border-[#e0e0e0] dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] hover:bg-[#f5f5f5] dark:hover:bg-[#1e1e1e] transition-colors"
          >
            <ArrowUpRight size={13} className="text-[#555] dark:text-[#999]" />
          </button>
        </div>
      </div>

      <div className="p-5 border-b border-[#f0f0f0] dark:border-[#1e1e1e] shrink-0">
        <p className="text-[11px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase mb-1">Total</p>
        <p className="text-[28px] font-bold text-[#111] dark:text-[#e0e0e0] leading-none">{fmt(grand)}</p>
        <p className="text-[11px] font-semibold text-[#bbb] dark:text-[#444] mt-1.5">
          {verifiedCount} / {deposits.length} verified
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] font-medium text-[#bbb] dark:text-[#444]">No deposits for this shift</p>
        </div>
      ) : (
        <>
          <div className="p-5 border-b border-[#f0f0f0] dark:border-[#1e1e1e] shrink-0">
            <p className="text-[11px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase mb-3">Breakdown</p>
            <div className="space-y-2">
              {entries.map(([type, amount]) => (
                <div key={type} className="flex items-center justify-between">
                  <p className="text-[13px] font-medium text-[#555] dark:text-[#999]">{displayType(type)}</p>
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-1.5 rounded-full bg-[#f0f0f0] dark:bg-[#222] overflow-hidden">
                      <div className="h-full bg-[#111] dark:bg-[#e0e0e0] rounded-full" style={{ width: grand > 0 ? `${(amount / grand) * 100}%` : '0%' }} />
                    </div>
                    <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] w-24 text-right">{fmt(amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {hasDenoms && (
            <div className="p-5 border-b border-[#f0f0f0] dark:border-[#1e1e1e] shrink-0">
              <p className="text-[11px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase mb-3">Denominations</p>
              <div className="space-y-1.5">
                {JMD_DENOMS.filter((d) => (denomTotals[d] ?? 0) > 0).map((denom) => {
                  const count    = denomTotals[denom]
                  const subtotal = denom * count
                  return (
                    <div key={denom} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-semibold text-[#111] dark:text-[#e0e0e0] w-14">
                          J${denom.toLocaleString()}
                        </p>
                        <p className="text-[11px] text-[#bbb] dark:text-[#444]">× {count}</p>
                      </div>
                      <p className="text-[12px] font-semibold text-[#555] dark:text-[#999]">
                        {fmt(subtotal)}
                      </p>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#f4f4f4] dark:border-[#1e1e1e]">
                <p className="text-[11px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase">Total</p>
                <p className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">
                  {fmt(JMD_DENOMS.reduce((s, d) => s + d * (denomTotals[d] ?? 0), 0))}
                </p>
              </div>
            </div>
          )}

          <div className="flex-1 p-5 flex flex-col min-h-0 overflow-hidden">
            <p className="text-[11px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase mb-3 shrink-0">Transactions</p>
            <div className="flex-1 overflow-y-auto">
              {deposits.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2.5 border-b border-[#f8f8f8] dark:border-[#1a1a1a] last:border-0 gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] truncate">{d.attendant_name}</p>
                    <p className="text-[11px] text-[#bbb] dark:text-[#444]">{fmtTime(d.created_at)}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLOR[d.type] ?? 'bg-[#f0f0f0] text-[#555]'}`}>
                    {displayType(d.type)}
                  </span>
                  <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] shrink-0">{fmt(d.amount)}</p>
                  <VerifiedBadge verified={verified.has(d.id)} onClick={(e) => { e.stopPropagation(); onToggleVerified(d.id) }} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Report Issue Modal ────────────────────────────────────────────────────────

const ISSUE_CATEGORIES = [
  'Missing amount',
  'Incorrect type',
  'Duplicate entry',
  'Suspicious activity',
  'Other',
] as const

function ReportIssueModal({
  label,
  onSubmit,
  onClose,
}: {
  label: string
  onSubmit: (category: string, description: string) => void
  onClose: () => void
}) {
  const [category,    setCategory]    = useState(ISSUE_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [error,       setError]       = useState<string | null>(null)

  function handleSubmit() {
    if (!description.trim()) { setError('Please describe the issue.'); return }
    onSubmit(category, description.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 dark:bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#1a1a1a] rounded-2xl border border-[#e0e0e0] dark:border-[#2a2a2a] shadow-xl w-full max-w-md p-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-red-500" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-[#111] dark:text-[#e0e0e0]">Report an Issue</p>
              <p className="text-[12px] font-medium text-[#aaa] dark:text-[#555] mt-0.5 truncate max-w-[240px]">{label}</p>
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f5f5f5] dark:hover:bg-[#222] transition-colors">
            <X size={14} className="text-[#999] dark:text-[#666]" />
          </button>
        </div>

        {/* Category */}
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase">Category</p>
          <div className="flex flex-wrap gap-1.5">
            {ISSUE_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                  category === c
                    ? 'bg-red-500 text-white'
                    : 'bg-[#f4f4f4] dark:bg-[#222] text-[#555] dark:text-[#999] hover:bg-[#ebebeb] dark:hover:bg-[#2a2a2a]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase">Description</p>
          <textarea
            value={description}
            onChange={(e) => { setDescription(e.target.value); setError(null) }}
            placeholder="Describe the issue…"
            rows={4}
            className="w-full px-3 py-2.5 border border-[#e0e0e0] dark:border-[#2a2a2a] rounded-xl text-[13px] text-[#111] dark:text-[#e0e0e0] placeholder-[#ccc] dark:placeholder-[#444] bg-white dark:bg-[#111] focus:outline-none focus:border-[#aaa] dark:focus:border-[#555] transition-colors resize-none"
          />
          {error && <p className="text-[11px] font-semibold text-red-500">{error}</p>}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[12px] font-semibold text-[#666] dark:text-[#888] hover:bg-[#f5f5f5] dark:hover:bg-[#222] rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-[12px] font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors flex items-center gap-2"
          >
            <Flag size={12} />
            Submit Report
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyPanel() {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-[13px] font-medium text-[#bbb] dark:text-[#444]">Select a shift to view deposits</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function DepositsPage() {
  const today = new Date()
  const twoWeeksAgo = new Date(today)
  twoWeeksAgo.setDate(today.getDate() - 13)

  const [startDate,       setStartDate]       = useState(isoDate(twoWeeksAgo))
  const [endDate,         setEndDate]         = useState(isoDate(today))
  const [activeTab,       setActiveTab]       = useState<FilterTab>('All')
  const [query,           setQuery]           = useState('')
  const [selectedShift,   setSelectedShift]   = useState<Shift | null>(null)
  const [depositsByShift, setDepositsByShift] = useState<Record<string, Deposit[]>>({})
  const [verified,        setVerified]        = useState<Set<string>>(new Set())
  const [flagged,         setFlagged]         = useState<Set<string>>(new Set())
  const [openDropdown,    setOpenDropdown]    = useState<string | null>(null)
  const [reportTarget,    setReportTarget]    = useState<{ id: string; label: string } | null>(null)

  const navigate = useNavigate()

  const { data: shifts = [], isLoading } = useShiftsInRange(startDate, endDate)

  const handleLoad = useCallback((shiftId: string, data: Deposit[]) => {
    setDepositsByShift((prev) => ({ ...prev, [shiftId]: data }))
  }, [])

  function toggleVerified(id: string) {
    setVerified((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleFlagged(id: string) {
    setFlagged((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Build shift lookup
  const shiftById = useMemo(() => {
    const m: Record<string, Shift> = {}
    for (const s of shifts) m[s.id] = s
    return m
  }, [shifts])

  // Flatten deposits (inflow only), newest shift first
  const allDeposits = useMemo(
    () =>
      shifts
        .flatMap((s) => depositsByShift[s.id] ?? [])
        .filter((d) => INFLOW_TYPES.has(d.type))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [shifts, depositsByShift],
  )

  const isCashTab = activeTab === 'Cash'

  // All tab → flat individual rows; other tabs → one grouped row per shift
  const tableRows = useMemo(() => {
    let deposits = allDeposits
    if (activeTab !== 'All') deposits = deposits.filter((d) => d.type === activeTab)

    if (query.trim()) {
      deposits = deposits.filter((d) => {
        const shift = shiftById[d.shift_id]
        return matchesSearch(query, {
          text: [shift?.supervisor_name, d.attendant_name, d.type],
          date: shift?.date,
        })
      })
    }

    if (activeTab === 'All') {
      return deposits.map((d) => ({ type: 'individual' as const, deposit: d }))
    }

    // Group by shift, preserving shift date order (latest first)
    const seen = new Set<string>()
    const groups: { type: 'group' as const; shiftId: string; deposits: Deposit[] }[] = []
    for (const d of deposits) {
      if (!seen.has(d.shift_id)) {
        seen.add(d.shift_id)
        groups.push({ type: 'group', shiftId: d.shift_id, deposits: [] })
      }
      groups.find((g) => g.shiftId === d.shift_id)!.deposits.push(d)
    }
    return groups
  }, [allDeposits, activeTab, query, shiftById])

  const colsBase = isCashTab
    ? 'grid-cols-[1fr_1.2fr_80px_80px_1fr_100px_28px]'
    : 'grid-cols-[1fr_1.2fr_80px_1fr_100px_28px]'
  const headers = isCashTab
    ? ['Shift', 'Supervisor', 'Type', 'Bag No.', 'Amount', 'Status', '']
    : ['Shift', 'Supervisor', 'Type', 'Amount', 'Status', '']

  const selectedDeposits = useMemo(
    () => selectedShift ? (depositsByShift[selectedShift.id] ?? []).filter((d) => INFLOW_TYPES.has(d.type)) : [],
    [selectedShift, depositsByShift],
  )

  const tableTotal = useMemo(
    () => tableRows.reduce((s, row) => {
      if (row.type === 'individual') return s + row.deposit.amount
      return s + row.deposits.reduce((a, d) => a + d.amount, 0)
    }, 0),
    [tableRows],
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {shifts.map((s) => (
        <ShiftDepositsLoader key={s.id} shiftId={s.id} onLoad={handleLoad} />
      ))}

      {/* Report an Issue modal */}
      {reportTarget && (
        <ReportIssueModal
          label={reportTarget.label}
          onSubmit={(_category, _description) => {
            setFlagged((prev) => { const n = new Set(prev); n.add(reportTarget.id); return n })
            setReportTarget(null)
          }}
          onClose={() => setReportTarget(null)}
        />
      )}

      {/* Click-away overlay to close any open row dropdown */}
      {openDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebebeb] dark:border-[#222] flex-shrink-0">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] dark:text-[#555] uppercase mb-0.5">Service Station</p>
          <h1 className="text-[22px] font-bold text-[#111] dark:text-[#e0e0e0] leading-tight">Deposits</h1>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 border border-[#ddd] dark:border-[#333] rounded-xl text-[12px] font-semibold text-[#333] dark:text-[#ccc] bg-white dark:bg-[#1a1a1a] focus:outline-none focus:border-[#aaa] dark:focus:border-[#555] transition-colors" />
          <span className="text-[12px] font-semibold text-[#bbb] dark:text-[#444]">—</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 border border-[#ddd] dark:border-[#333] rounded-xl text-[12px] font-semibold text-[#333] dark:text-[#ccc] bg-white dark:bg-[#1a1a1a] focus:outline-none focus:border-[#aaa] dark:focus:border-[#555] transition-colors" />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4 min-w-0">

          {/* Search + tabs */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 flex-1 px-4 py-2.5 bg-white dark:bg-[#1a1a1a] border border-[#ebebeb] dark:border-[#222] rounded-xl">
              <Search size={14} className="text-[#bbb] dark:text-[#444] shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by supervisor or attendant…"
                className="flex-1 text-[13px] text-[#111] dark:text-[#e0e0e0] placeholder-[#ccc] dark:placeholder-[#444] outline-none bg-transparent"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-[#bbb] dark:text-[#444] hover:text-[#555] dark:hover:text-[#999] transition-colors">
                  <X size={13} />
                </button>
              )}
            </div>
            <div className="flex gap-0.5 shrink-0">
              {FILTER_TABS.map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                    tab === activeTab ? 'bg-[#f0f0f0] dark:bg-[#222] text-[#111] dark:text-[#e0e0e0]' : 'text-[#bbb] dark:text-[#444] hover:text-[#555] dark:hover:text-[#999]'
                  }`}>
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-[#ebebeb] dark:border-[#222] overflow-hidden flex flex-col">
            <div className={`grid ${colsBase} gap-4 px-5 py-2.5 border-b border-[#f0f0f0] dark:border-[#1e1e1e] bg-[#fafafa] dark:bg-[#161616] shrink-0`}>
              {headers.map((h) => (
                <p key={h} className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase">{h}</p>
              ))}
            </div>

            {isLoading ? (
              <div className="flex-1 flex items-center justify-center"><LogoLoader /></div>
            ) : tableRows.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-1">
                <p className="text-[13px] font-semibold text-[#bbb] dark:text-[#444]">
                  {allDeposits.length === 0 ? 'No deposits in this range' : 'No results found'}
                </p>
                <p className="text-[12px] font-medium text-[#ccc] dark:text-[#444]">Try adjusting the date range</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {tableRows.map((row) => {
                  // ── Individual row (All tab) ──────────────────────────────
                  if (row.type === 'individual') {
                    const { deposit: d } = row
                    const shift = shiftById[d.shift_id]
                    const isVerified = verified.has(d.id)
                    return (
                      <div
                        key={d.id}
                        onClick={() => { if (shift) setSelectedShift((cur) => cur?.id === shift.id ? null : shift) }}
                        className={`w-full grid ${colsBase} gap-4 items-center px-5 py-3.5 border-b border-[#f8f8f8] dark:border-[#1a1a1a] last:border-0 text-left transition-colors cursor-pointer ${
                          selectedShift?.id === d.shift_id ? 'bg-[#f4f4f4] dark:bg-[#222]' : 'hover:bg-[#fafafa] dark:hover:bg-[#161616]'
                        }`}
                      >
                        <p className="text-[12px] font-bold text-[#666] dark:text-[#888]">{shift ? fmtDate(shift.date) : '—'}</p>
                        <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] truncate">{shift?.supervisor_name ?? '—'}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${TYPE_COLOR[d.type] ?? 'bg-[#f0f0f0] text-[#555]'}`}>
                          {displayType(d.type)}
                        </span>
                        <p className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">{fmt(d.amount)}</p>
                        <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${
                          isVerified ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {isVerified ? <><CheckCircle2 size={10} /> Verified</> : <><Clock size={10} /> Pending</>}
                        </span>
                        {/* ··· menu */}
                        <div className="relative flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {flagged.has(d.id) && (
                            <Flag size={11} className="text-red-400 shrink-0 fill-red-400" />
                          )}
                          <button
                            onClick={() => setOpenDropdown(openDropdown === d.id ? null : d.id)}
                            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#ebebeb] dark:hover:bg-[#2a2a2a] transition-colors"
                          >
                            <MoreHorizontal size={13} className="text-[#999] dark:text-[#666]" />
                          </button>
                          {openDropdown === d.id && (
                            <div className="absolute right-0 top-7 z-50 bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#2a2a2a] rounded-xl shadow-lg py-1 w-44">
                              <button
                                onClick={() => { navigate({ to: '/sales', search: { shift: d.shift_id } } as any); setOpenDropdown(null) }}
                                className="w-full text-left px-4 py-2 text-[12px] font-semibold text-[#111] dark:text-[#e0e0e0] hover:bg-[#f5f5f5] dark:hover:bg-[#1e1e1e] transition-colors"
                              >
                                View shift
                              </button>
                              <div className="border-t border-[#f0f0f0] dark:border-[#1e1e1e] my-1" />
                              <button
                                onClick={() => { toggleVerified(d.id); setOpenDropdown(null) }}
                                className="w-full text-left px-4 py-2 text-[12px] font-semibold text-[#111] dark:text-[#e0e0e0] hover:bg-[#f5f5f5] dark:hover:bg-[#1e1e1e] transition-colors"
                              >
                                {isVerified ? 'Mark pending' : 'Mark verified'}
                              </button>
                              <div className="border-t border-[#f0f0f0] dark:border-[#1e1e1e] my-1" />
                              <button
                                onClick={() => {
                                  setOpenDropdown(null)
                                  if (flagged.has(d.id)) {
                                    toggleFlagged(d.id)
                                  } else {
                                    const label = shift ? `${fmtDate(shift.date)} · ${shift.supervisor_name}` : 'Deposit'
                                    setReportTarget({ id: d.id, label })
                                  }
                                }}
                                className="w-full text-left px-4 py-2 text-[12px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                              >
                                <Flag size={12} />
                                {flagged.has(d.id) ? 'Remove flag' : 'Flag'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  }

                  // ── Grouped row (type-specific tabs) ─────────────────────
                  const shift        = shiftById[row.shiftId]
                  const total        = row.deposits.reduce((s, d) => s + d.amount, 0)
                  const types        = [...new Set(row.deposits.map((d) => d.type))]
                  const allVerified  = row.deposits.every((d) => verified.has(d.id))
                  const someVerified = row.deposits.some((d) => verified.has(d.id))
                  const groupStatus  = allVerified ? 'verified' : someVerified ? 'partial' : 'pending'
                  const bagNos       = isCashTab
                    ? row.deposits.map((d) => parseBagNo(d.metadata)).filter(Boolean) as string[]
                    : []

                  return (
                    <div
                      key={row.shiftId}
                      onClick={() => { if (shift) setSelectedShift((cur) => cur?.id === shift.id ? null : shift) }}
                      className={`w-full grid ${colsBase} gap-4 items-center px-5 py-3.5 border-b border-[#f8f8f8] dark:border-[#1a1a1a] last:border-0 text-left transition-colors cursor-pointer ${
                        selectedShift?.id === row.shiftId ? 'bg-[#f4f4f4] dark:bg-[#222]' : 'hover:bg-[#fafafa] dark:hover:bg-[#161616]'
                      }`}
                    >
                      <p className="text-[12px] font-bold text-[#666] dark:text-[#888]">{shift ? fmtDate(shift.date) : '—'}</p>
                      <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] truncate">{shift?.supervisor_name ?? '—'}</p>
                      {types.length === 1 ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${TYPE_COLOR[types[0]] ?? 'bg-[#f0f0f0] text-[#555]'}`}>
                          {displayType(types[0])}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full w-fit bg-[#f0f0f0] dark:bg-[#222] text-[#555] dark:text-[#999]">
                          {types.length} types
                        </span>
                      )}
                      {isCashTab && (
                        <p className="text-[12px] font-semibold text-[#555] dark:text-[#999] truncate">
                          {bagNos.length > 0 ? bagNos.join(', ') : <span className="text-[#ddd] dark:text-[#333]">—</span>}
                        </p>
                      )}
                      <p className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">{fmt(total)}</p>
                      <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${
                        groupStatus === 'verified' ? 'bg-green-50 text-green-600'
                        : groupStatus === 'partial' ? 'bg-amber-50 text-amber-600'
                        : 'bg-amber-50 text-amber-600'
                      }`}>
                        {groupStatus === 'verified'
                          ? <><CheckCircle2 size={10} /> Verified</>
                          : groupStatus === 'partial'
                          ? <><Clock size={10} /> Partial</>
                          : <><Clock size={10} /> Pending</>
                        }
                      </span>
                      {/* ··· menu */}
                      <div className="relative flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {flagged.has(row.shiftId) && (
                          <Flag size={11} className="text-red-400 shrink-0 fill-red-400" />
                        )}
                        <button
                          onClick={() => setOpenDropdown(openDropdown === row.shiftId ? null : row.shiftId)}
                          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#ebebeb] dark:hover:bg-[#2a2a2a] transition-colors"
                        >
                          <MoreHorizontal size={13} className="text-[#999] dark:text-[#666]" />
                        </button>
                        {openDropdown === row.shiftId && (
                          <div className="absolute right-0 top-7 z-50 bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#2a2a2a] rounded-xl shadow-lg py-1 w-44">
                            <button
                              onClick={() => { navigate({ to: '/sales', search: { shift: row.shiftId } } as any); setOpenDropdown(null) }}
                              className="w-full text-left px-4 py-2 text-[12px] font-semibold text-[#111] dark:text-[#e0e0e0] hover:bg-[#f5f5f5] dark:hover:bg-[#1e1e1e] transition-colors"
                            >
                              View shift
                            </button>
                            <div className="border-t border-[#f0f0f0] dark:border-[#1e1e1e] my-1" />
                            <button
                              onClick={() => { setVerified((prev) => { const n = new Set(prev); row.deposits.forEach((d) => n.add(d.id)); return n }); setOpenDropdown(null) }}
                              className="w-full text-left px-4 py-2 text-[12px] font-semibold text-[#111] dark:text-[#e0e0e0] hover:bg-[#f5f5f5] dark:hover:bg-[#1e1e1e] transition-colors"
                            >
                              Mark as verified
                            </button>
                            <div className="border-t border-[#f0f0f0] dark:border-[#1e1e1e] my-1" />
                            <button
                              onClick={() => {
                                setOpenDropdown(null)
                                if (flagged.has(row.shiftId)) {
                                  toggleFlagged(row.shiftId)
                                } else {
                                  const label = shift ? `${fmtDate(shift.date)} · ${shift.supervisor_name}` : 'Shift'
                                  setReportTarget({ id: row.shiftId, label })
                                }
                              }}
                              className="w-full text-left px-4 py-2 text-[12px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                            >
                              <Flag size={12} />
                              {flagged.has(row.shiftId) ? 'Remove flag' : 'Flag'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {tableRows.length > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-[#f0f0f0] dark:border-[#1e1e1e] shrink-0">
                <p className="text-[20px] font-bold text-[#111] dark:text-[#e0e0e0]">{tableRows.length}</p>
                <p className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">{fmt(tableTotal)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: shift detail */}
        <div className="w-[340px] shrink-0 border-l border-[#e8e8e8] dark:border-[#222] h-full">
          {selectedShift
            ? <ShiftDetailPanel
                shift={selectedShift}
                deposits={selectedDeposits}
                verified={verified}
                onToggleVerified={toggleVerified}
                isCashTab={isCashTab}
              />
            : <EmptyPanel />
          }
        </div>
      </div>
    </div>
  )
}
