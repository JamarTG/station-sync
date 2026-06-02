import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, X, Search, ArrowUpRight, MoreHorizontal } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { LogoLoader } from '../components/StationSyncLogo'
import { useShiftsInRange, useShiftDeposits, useShiftFuelReceivals } from '../hooks/useApi'
import { matchesSearch } from '../lib/search'
import type { Deposit, FuelReceival as ApiFuelReceival } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

type ExpenseCategory = 'Fuel & Energy' | 'Maintenance' | 'Staff' | 'Supplies' | 'Utilities' | 'Other' | 'Cash'
type ExpenseStatus   = 'Paid' | 'Pending' | 'Overdue'

interface Expense {
  id: string
  date: string
  description: string
  category: ExpenseCategory
  amount: number
  status: ExpenseStatus
  reference?: string
  shiftId?: string
}

interface FuelRecival {
  id: string
  invoiceNo: string
  shiftId: string
  shiftDate: string
  supervisor: string
  rate: number
  haulage: number
  gct: number
  total: number
  amountDue: number
  variance: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORIES: ExpenseCategory[] = ['Fuel & Energy', 'Maintenance', 'Staff', 'Supplies', 'Utilities', 'Other']

const STATUS_COLOR: Record<ExpenseStatus, string> = {
  Paid:    'bg-[#d1e7dd] text-[#0a5435]',
  Pending: 'bg-[#fff3cd] text-[#856404]',
  Overdue: 'bg-[#f8d7da] text-[#842029]',
}

const CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  'Cash':          'bg-[#d1e7dd] text-[#0a5435]',
  'Fuel & Energy': 'bg-[#cfe2ff] text-[#0a3d91]',
  'Maintenance':   'bg-amber-50 text-amber-700',
  'Staff':         'bg-purple-50 text-purple-700',
  'Supplies':      'bg-cyan-50 text-cyan-700',
  'Utilities':     'bg-[#f0f0f0] text-[#555]',
  'Other':         'bg-[#f0f0f0] text-[#555]',
}

const fmt          = (n: number) => `J$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
const fmtDate      = (s: string) => new Date(s).toLocaleDateString('en-JM', { year: 'numeric', month: 'short', day: 'numeric' })
const isoDate      = (d: Date)   => d.toISOString().slice(0, 10)
const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

function parseExpenseDescription(metadata: string | null): string | null {
  if (!metadata) return null
  try {
    const m = JSON.parse(metadata)
    return m?.description ?? m?.notes ?? m?.note ?? m?.reason ?? null
  } catch { return null }
}

// ── Shift deposits loader ─────────────────────────────────────────────────────

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

function ShiftFuelRecivalsLoader({ shiftId, onLoad }: {
  shiftId: string
  onLoad: (shiftId: string, data: ApiFuelReceival[]) => void
}) {
  const { data } = useShiftFuelReceivals(shiftId)
  const ref = useRef(onLoad)
  ref.current = onLoad
  useEffect(() => {
    if (data !== undefined) ref.current(shiftId, data)
  }, [shiftId, data])
  return null
}

const inputCls = 'w-full bg-white dark:bg-[#1a1a1a] border border-[#ebebeb] dark:border-[#222] rounded-xl px-4 py-2.5 text-[13px] text-[#111] dark:text-[#e0e0e0] focus:outline-none focus:border-[#111] dark:focus:border-[#e0e0e0]'
const labelCls = 'block text-[11px] font-semibold tracking-widest text-[#888] dark:text-[#666] uppercase mb-1'

// ── Add Expense Modal ─────────────────────────────────────────────────────────

function AddExpenseModal({ onClose, onAdd }: { onClose: () => void; onAdd: (e: Omit<Expense, 'id'>) => void }) {
  const today = new Date().toISOString().split('T')[0]
  const [description, setDescription] = useState('')
  const [category, setCategory]       = useState<ExpenseCategory>('Other')
  const [amount, setAmount]           = useState('')
  const [date, setDate]               = useState(today)
  const [reference, setReference]     = useState('')
  const [status, setStatus]           = useState<ExpenseStatus>('Paid')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!description.trim() || isNaN(parsed) || parsed <= 0) return
    onAdd({ description: description.trim(), category, amount: parsed, date, reference: reference.trim() || undefined, status })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl w-full max-w-[480px] p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[16px] font-bold text-[#111] dark:text-[#e0e0e0]">Add Expense</h3>
          <button onClick={onClose} className="text-[#bbb] dark:text-[#444] hover:text-[#555] dark:hover:text-[#999] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelCls}>Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Generator servicing" required className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className={inputCls}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as ExpenseStatus)} className={inputCls}>
                <option>Paid</option>
                <option>Pending</option>
                <option>Overdue</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Amount (J$)</label>
              <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Reference <span className="normal-case tracking-normal font-normal text-[#ccc] dark:text-[#444]">(optional)</span></label>
            <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. Invoice #1042" className={inputCls} />
          </div>
          <button type="submit"
            className="w-full bg-white dark:bg-[#1a1a1a] border border-[#ddd] dark:border-[#333] text-[#333] dark:text-[#ccc] rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#f9f9f9] dark:hover:bg-[#161616] transition-colors mt-2">
            Add Expense
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function ExpenseDetailPanel({ expense, expenses }: { expense: Expense | null; expenses: Expense[] }) {
  const total       = expenses.reduce((s, e) => s + e.amount, 0)
  const totalPaid   = expenses.filter((e) => e.status === 'Paid').reduce((s, e) => s + e.amount, 0)
  const totalUnpaid = expenses.filter((e) => e.status !== 'Paid').reduce((s, e) => s + e.amount, 0)

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="p-5 border-b border-[#f0f0f0] dark:border-[#1e1e1e] shrink-0">
        <p>
          <span className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">Expenses</span>
          <span className="text-[13px] font-medium text-[#aaa] dark:text-[#555]"> | Summary</span>
        </p>
      </div>

      {/* Stats */}
      <div className="p-5 border-b border-[#f0f0f0] dark:border-[#1e1e1e] shrink-0 flex flex-col gap-2">
        {[
          { label: 'Total',       value: fmt(total),       count: expenses.length },
          { label: 'Paid',        value: fmt(totalPaid),   count: expenses.filter((e) => e.status === 'Paid').length },
          { label: 'Outstanding', value: fmt(totalUnpaid), count: expenses.filter((e) => e.status !== 'Paid').length },
        ].map(({ label, value, count }) => (
          <div key={label} className="flex items-center justify-between py-1.5">
            <div>
              <p className="text-[11px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase">{label}</p>
              <p className="text-[12px] font-medium text-[#aaa] dark:text-[#555]">{count} item{count !== 1 ? 's' : ''}</p>
            </div>
            <p className="text-[15px] font-bold text-[#111] dark:text-[#e0e0e0]">{value}</p>
          </div>
        ))}
      </div>

      {/* Selected expense */}
      {!expense ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] font-medium text-[#bbb] dark:text-[#444]">Select an expense to view details</p>
        </div>
      ) : (
        <div className="shrink-0">
          <div className="p-5 border-b border-[#f0f0f0] dark:border-[#1e1e1e]">
            <p className="text-[15px] font-bold text-[#111] dark:text-[#e0e0e0] mb-1">{sentenceCase(expense.description)}</p>
            {expense.reference && <p className="text-[12px] font-medium text-[#aaa] dark:text-[#555]">{expense.reference}</p>}
            <div className="mt-3">
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[expense.status]}`}>
                {expense.status}
              </span>
            </div>
          </div>
          {[
            { label: 'Amount',   value: fmt(expense.amount) },
            { label: 'Category', value: expense.category },
            { label: 'Date',     value: fmtDate(expense.date) },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center px-5 py-3 border-b border-[#f4f4f4] dark:border-[#1e1e1e]">
              <span className="text-[12px] text-[#999] dark:text-[#666] w-28 shrink-0">{label}</span>
              <span className="text-[13px] text-[#111] dark:text-[#e0e0e0]">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Fuel Receivals Accordion ──────────────────────────────────────────────────

const RECIVAL_ACTIONS = ['Record a payment', 'Edit invoice no.', 'Edit rates', 'Edit haulage', 'Edit GCT'] as const

// Portal dropdown — escapes overflow-hidden and flips upward near the bottom of the viewport
function RecivalRowDropdown() {
  const [open, setOpen]   = useState(false)
  const [pos,  setPos]    = useState<{ top: number; right: number }>({ top: 0, right: 0 })
  const btnRef            = useRef<HTMLButtonElement>(null)
  const MENU_H            = RECIVAL_ACTIONS.length * 34 + 8 // approx menu height
  const MENU_W            = 192                              // w-48

  function toggle() {
    if (!btnRef.current) return
    const rect      = btnRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const top        = spaceBelow < MENU_H + 8 ? rect.top - MENU_H - 4 : rect.bottom + 4
    setPos({ top, right: window.innerWidth - rect.right })
    setOpen((o) => !o)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#ebebeb] dark:hover:bg-[#2a2a2a] transition-colors"
      >
        <MoreHorizontal size={13} className="text-[#aaa]" />
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#2a2a2a] rounded-xl shadow-lg py-1"
            style={{ top: pos.top, right: pos.right, width: MENU_W }}
          >
            {RECIVAL_ACTIONS.map((action) => (
              <button
                key={action}
                onClick={() => setOpen(false)}
                className="w-full text-left px-4 py-2 text-[12px] font-semibold text-[#111] dark:text-[#e0e0e0] hover:bg-[#f5f5f5] dark:hover:bg-[#1e1e1e] transition-colors"
              >
                {action}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </>
  )
}

function FuelRecivalsSection({ receivals }: { receivals: FuelRecival[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="shrink-0 border border-[#ebebeb] dark:border-[#222] rounded-2xl bg-white dark:bg-[#1a1a1a] overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#fafafa] dark:hover:bg-[#161616] transition-colors"
      >
        <div className="flex items-center gap-2">
          <ChevronRight size={14} className={`text-[#888] dark:text-[#666] transition-transform ${open ? 'rotate-90' : ''}`} />
          <span className="text-[13px] font-bold text-[#888] dark:text-[#666]">Fuel Receivals</span>
          {receivals.length > 0 && (
            <span className="text-[11px] font-bold text-[#bbb] dark:text-[#444] bg-[#f4f4f4] dark:bg-[#222] px-2 py-0.5 rounded-full">
              {receivals.length}
            </span>
          )}
        </div>
        {receivals.length > 0 && (
          <p className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">
            {fmt(receivals.reduce((s, r) => s + r.total, 0))}
          </p>
        )}
      </button>

      {open && (
        <div className="border-t border-[#f0f0f0] dark:border-[#1e1e1e] max-h-[480px] overflow-y-auto">
          {/* Column headers */}
          <div className="grid grid-cols-[80px_110px_1.4fr_1fr_1fr_1fr_1.1fr_1.1fr_1.1fr_32px] gap-3 px-5 py-2.5 bg-[#fafafa] dark:bg-[#161616] border-b border-[#f4f4f4] dark:border-[#1e1e1e]">
            {['#', 'Shift', 'Supervisor', 'Rate', 'Haulage', 'GCT', 'Total', 'Amount Due', 'Variance', ''].map((h) => (
              <p key={h || 'act'} className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase">{h}</p>
            ))}
          </div>

          {receivals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-1">
              <p className="text-[13px] font-semibold text-[#bbb] dark:text-[#444]">No fuel receivals recorded</p>
              <p className="text-[12px] font-medium text-[#ccc] dark:text-[#444]">Receivals will appear here</p>
            </div>
          ) : (
            receivals.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[80px_110px_1.4fr_1fr_1fr_1fr_1.1fr_1.1fr_1.1fr_32px] gap-3 items-center px-5 py-3.5 border-b border-[#f8f8f8] dark:border-[#1a1a1a] last:border-0 hover:bg-[#fafafa] dark:hover:bg-[#161616] transition-colors"
              >
                <p className="text-[12px] font-semibold text-[#111] dark:text-[#e0e0e0] truncate">{r.invoiceNo}</p>
                <p className="text-[12px] text-[#666] dark:text-[#888]">{fmtDate(r.shiftDate)}</p>
                <p className="text-[12px] text-[#666] dark:text-[#888] truncate">{r.supervisor}</p>
                <p className="text-[12px] font-medium text-[#111] dark:text-[#e0e0e0]">{fmt(r.rate)}</p>
                <p className="text-[12px] font-medium text-[#111] dark:text-[#e0e0e0]">{fmt(r.haulage)}</p>
                <p className="text-[12px] font-medium text-[#111] dark:text-[#e0e0e0]">{fmt(r.gct)}</p>
                <p className="text-[12px] font-bold text-[#111] dark:text-[#e0e0e0]">{fmt(r.total)}</p>
                <p className="text-[12px] font-bold text-[#111] dark:text-[#e0e0e0]">{fmt(r.amountDue)}</p>
                <p className={`text-[12px] font-semibold ${r.variance > 0 ? 'text-green-600' : r.variance < 0 ? 'text-red-500' : 'text-[#bbb]'}`}>
                  {r.variance === 0 ? '—' : (r.variance > 0 ? '+' : '') + fmt(r.variance)}
                </p>
                <RecivalRowDropdown />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Expenses Table ────────────────────────────────────────────────────────────

function ExpensesTable({
  expenses,
  selected,
  onSelect,
  isLoading,
  receivals,
}: {
  expenses: Expense[]
  selected: Expense | null
  onSelect: (e: Expense) => void
  isLoading: boolean
  receivals: FuelRecival[]
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const filtered = expenses.filter((e) =>
    matchesSearch(query, {
      text: [e.description, e.category, e.status, e.reference],
      date: e.date,
    }))

  const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4 min-w-0">
      {/* Search */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-[#1a1a1a] border border-[#ebebeb] dark:border-[#222] rounded-xl shrink-0">
        <Search size={14} className="text-[#bbb] dark:text-[#444] shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by description, category, or status…"
          className="flex-1 text-[13px] text-[#111] dark:text-[#e0e0e0] placeholder-[#ccc] dark:placeholder-[#444] outline-none bg-transparent"
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-[#bbb] dark:text-[#444] hover:text-[#555] dark:hover:text-[#999] transition-colors">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-[#ebebeb] dark:border-[#222] overflow-hidden flex flex-col">
        <div className="grid grid-cols-[1.8fr_1.2fr_1fr_1fr_1fr_32px] gap-3 px-5 py-2.5 border-b border-[#f0f0f0] dark:border-[#1e1e1e] bg-[#fafafa] dark:bg-[#161616] shrink-0">
          {['Description', 'Category', 'Date', 'Amount', 'Status', ''].map((h) => (
            <p key={h || 'action'} className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase">{h}</p>
          ))}
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center"><LogoLoader /></div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <p className="text-[13px] font-semibold text-[#bbb] dark:text-[#444]">
              {expenses.length === 0 ? 'No expenses recorded yet' : 'No results found'}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {filtered.map((e) => (
              <button key={e.id} onClick={() => onSelect(e)}
                className={`w-full grid grid-cols-[1.8fr_1.2fr_1fr_1fr_1fr_32px] gap-3 items-center px-5 py-3.5 border-b border-[#f8f8f8] dark:border-[#1a1a1a] last:border-0 transition-colors text-left ${
                  selected?.id === e.id ? 'bg-[#f4f4f4] dark:bg-[#222]' : 'hover:bg-[#fafafa] dark:hover:bg-[#161616]'
                }`}
              >
                <div className="min-w-0 flex items-center gap-1.5">
                  <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] truncate">{sentenceCase(e.description)}</p>
                  {e.shiftId && (
                    <button
                      onClick={(ev) => { ev.stopPropagation(); navigate({ to: '/sales', search: { shift: e.shiftId } } as any) }}
                      className="shrink-0 flex items-center justify-center w-5 h-5 rounded-md hover:bg-[#ebebeb] dark:hover:bg-[#2a2a2a] transition-colors"
                    >
                      <ArrowUpRight size={11} className="text-[#aaa] dark:text-[#555]" />
                    </button>
                  )}
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit ${CATEGORY_COLOR[e.category] ?? 'bg-[#f0f0f0] text-[#555]'}`}>
                  {e.category}
                </span>
                <p className="text-[13px] text-[#666] dark:text-[#888]">{fmtDate(e.date)}</p>
                <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0]">{fmt(e.amount)}</p>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit ${STATUS_COLOR[e.status]}`}>
                  {e.status}
                </span>
                <ChevronRight size={14} className="text-[#ccc] dark:text-[#444]" />
              </button>
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#f0f0f0] dark:border-[#1e1e1e] shrink-0">
            <p className="text-[20px] font-bold text-[#111] dark:text-[#e0e0e0]">{filtered.length}</p>
            <p className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">{fmt(filteredTotal)}</p>
          </div>
        )}
      </div>

      {/* Fuel receivals accordion — pinned to bottom */}
      <FuelRecivalsSection receivals={receivals} />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ExpensesPage() {
  const today        = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 29)

  const [manualExpenses,       setManualExpenses]       = useState<Expense[]>([])
  const [selected,             setSelected]             = useState<Expense | null>(null)
  const [showAdd,              setShowAdd]              = useState(false)
  const [depositsByShift,      setDepositsByShift]      = useState<Record<string, Deposit[]>>({})
  const [recivalsByShift,      setRecivalsByShift]      = useState<Record<string, ApiFuelReceival[]>>({})

  const { data: shifts = [], isLoading } = useShiftsInRange(isoDate(thirtyDaysAgo), isoDate(today))

  const handleLoad = useCallback((shiftId: string, data: Deposit[]) => {
    setDepositsByShift((prev) => ({ ...prev, [shiftId]: data }))
  }, [])

  const handleRecivalsLoad = useCallback((shiftId: string, data: ApiFuelReceival[]) => {
    setRecivalsByShift((prev) => ({ ...prev, [shiftId]: data }))
  }, [])

  const shiftById = useMemo(() => {
    const m: Record<string, { supervisor_name: string }> = {}
    for (const s of shifts) m[s.id] = s
    return m
  }, [shifts])

  // Map API FuelReceival records → display FuelRecival rows
  const fuelRecivalsRows = useMemo<FuelRecival[]>(
    () =>
      shifts
        .flatMap((s) =>
          (recivalsByShift[s.id] ?? []).map((r): FuelRecival => {
            const fuelCost  = (r.rate ?? 0) * r.litres_ordered
            const total     = fuelCost + (r.haulage ?? 0) + (r.gct ?? 0)
            const actualLitres =
              r.closing_level != null && r.opening_level != null
                ? r.closing_level - r.opening_level
                : null
            const variance =
              actualLitres != null ? (actualLitres - r.litres_ordered) * (r.rate ?? 0) : 0
            return {
              id:         r.id,
              invoiceNo:  r.invoice_no ?? '—',
              shiftId:    s.id,
              shiftDate:  s.date,
              supervisor: s.supervisor_name,
              rate:       r.rate ?? 0,
              haulage:    r.haulage ?? 0,
              gct:        r.gct ?? 0,
              total,
              amountDue:  total,
              variance,
            }
          })
        )
        .sort((a, b) => b.shiftDate.localeCompare(a.shiftDate)),
    [shifts, recivalsByShift],
  )

  // Map shift Expenditure deposits → Expense objects
  const shiftExpenses = useMemo<Expense[]>(
    () =>
      shifts
        .flatMap((s) => depositsByShift[s.id] ?? [])
        .filter((d) => d.type === 'Expenditure')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .map((d) => ({
          id:          d.id,
          date:        d.created_at.slice(0, 10),
          description: parseExpenseDescription(d.metadata) ?? 'Expenditure',
          category:    'Cash' as ExpenseCategory,
          amount:      d.amount,
          status:      'Paid' as ExpenseStatus,
          reference:   shiftById[d.shift_id]?.supervisor_name,
          shiftId:     d.shift_id,
        })),
    [shifts, depositsByShift, shiftById],
  )

  // Merge shift + manually added expenses, newest date first
  const expenses = useMemo(
    () => [...shiftExpenses, ...manualExpenses].sort((a, b) => b.date.localeCompare(a.date)),
    [shiftExpenses, manualExpenses],
  )

  function addExpense(data: Omit<Expense, 'id'>) {
    setManualExpenses((prev) => [{ id: String(Date.now()), ...data }, ...prev])
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {shifts.map((s) => (
        <ShiftDepositsLoader key={s.id} shiftId={s.id} onLoad={handleLoad} />
      ))}
      {shifts.map((s) => (
        <ShiftFuelRecivalsLoader key={s.id} shiftId={s.id} onLoad={handleRecivalsLoad} />
      ))}

      <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebebeb] dark:border-[#222] flex-shrink-0">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] dark:text-[#555] uppercase mb-0.5">Finance</p>
          <h1 className="text-[22px] font-bold text-[#111] dark:text-[#e0e0e0] leading-tight">Expenses</h1>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="px-4 py-2 border border-[#ddd] dark:border-[#333] rounded-xl text-[12px] font-semibold text-[#333] dark:text-[#ccc] bg-white dark:bg-[#1a1a1a] hover:bg-[#f9f9f9] dark:hover:bg-[#161616] transition-colors">
          Add an expense
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <ExpensesTable
          expenses={expenses}
          selected={selected}
          onSelect={setSelected}
          isLoading={isLoading}
          receivals={fuelRecivalsRows}
        />
        <div className="w-[340px] shrink-0 border-l border-[#e8e8e8] dark:border-[#222] h-full">
          <ExpenseDetailPanel expense={selected} expenses={expenses} />
        </div>
      </div>

      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} onAdd={addExpense} />}
    </div>
  )
}
