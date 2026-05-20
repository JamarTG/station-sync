import { useState } from 'react'
import { ChevronRight, Plus, X } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type ExpenseCategory = 'Fuel & Energy' | 'Maintenance' | 'Staff' | 'Supplies' | 'Utilities' | 'Other'
type ExpenseStatus   = 'Paid' | 'Pending' | 'Overdue'

interface Expense {
  id: string
  date: string
  description: string
  category: ExpenseCategory
  amount: number
  status: ExpenseStatus
  reference?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORIES: ExpenseCategory[] = ['Fuel & Energy', 'Maintenance', 'Staff', 'Supplies', 'Utilities', 'Other']

const STATUS_COLOR: Record<ExpenseStatus, string> = {
  Paid:    'bg-[#d1e7dd] text-[#0a5435]',
  Pending: 'bg-[#fff3cd] text-[#856404]',
  Overdue: 'bg-[#f8d7da] text-[#842029]',
}

const fmt    = (n: number) => `J$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-JM', { year: 'numeric', month: 'short', day: 'numeric' })

const inputCls = 'w-full bg-white border border-[#ebebeb] rounded-xl px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111]'
const labelCls = 'block text-[11px] font-semibold tracking-widest text-[#888] uppercase mb-1'

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
      <div className="bg-white rounded-3xl w-full max-w-[480px] p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[16px] font-bold text-[#111]">Add Expense</h3>
          <button onClick={onClose} className="text-[#bbb] hover:text-[#555] transition-colors"><X size={18} /></button>
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
            <label className={labelCls}>Reference <span className="normal-case tracking-normal font-normal text-[#ccc]">(optional)</span></label>
            <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. Invoice #1042" className={inputCls} />
          </div>
          <button type="submit"
            className="w-full bg-white border border-[#ddd] text-[#333] rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#f9f9f9] transition-colors mt-2">
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
      <div className="p-5 border-b border-[#f0f0f0] shrink-0">
        <p>
          <span className="text-[13px] font-bold text-[#111]">Expenses</span>
          <span className="text-[13px] font-medium text-[#aaa]"> | Summary</span>
        </p>
      </div>

      {/* Stats */}
      <div className="p-5 border-b border-[#f0f0f0] shrink-0 flex flex-col gap-2">
        {[
          { label: 'Total',       value: fmt(total),       count: expenses.length },
          { label: 'Paid',        value: fmt(totalPaid),   count: expenses.filter((e) => e.status === 'Paid').length },
          { label: 'Outstanding', value: fmt(totalUnpaid), count: expenses.filter((e) => e.status !== 'Paid').length },
        ].map(({ label, value, count }) => (
          <div key={label} className="flex items-center justify-between py-1.5">
            <div>
              <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">{label}</p>
              <p className="text-[12px] font-medium text-[#aaa]">{count} item{count !== 1 ? 's' : ''}</p>
            </div>
            <p className="text-[15px] font-bold text-[#111]">{value}</p>
          </div>
        ))}
      </div>

      {/* Selected expense */}
      {!expense ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] font-medium text-[#bbb]">Select an expense to view details</p>
        </div>
      ) : (
        <div className="shrink-0">
          <div className="p-5 border-b border-[#f0f0f0]">
            <p className="text-[15px] font-bold text-[#111] mb-1">{expense.description}</p>
            {expense.reference && <p className="text-[12px] font-medium text-[#aaa]">{expense.reference}</p>}
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
            <div key={label} className="flex items-center px-5 py-3 border-b border-[#f4f4f4]">
              <span className="text-[12px] text-[#999] w-28 shrink-0">{label}</span>
              <span className="text-[13px] text-[#111]">{value}</span>
            </div>
          ))}
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
}: {
  expenses: Expense[]
  selected: Expense | null
  onSelect: (e: Expense) => void
}) {
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | 'All'>('All')
  const [filterStatus,   setFilterStatus]   = useState<ExpenseStatus   | 'All'>('All')

  const filtered = expenses.filter((e) => {
    if (filterCategory !== 'All' && e.category !== filterCategory) return false
    if (filterStatus   !== 'All' && e.status   !== filterStatus)   return false
    return true
  })

  const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4 min-w-0">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as ExpenseCategory | 'All')}
          className="bg-white border border-[#e0e0e0] rounded-xl px-4 py-2 text-[13px] font-medium text-[#333] focus:outline-none focus:border-[#aaa] appearance-none">
          <option value="All">All categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as ExpenseStatus | 'All')}
          className="bg-white border border-[#e0e0e0] rounded-xl px-4 py-2 text-[13px] font-medium text-[#333] focus:outline-none focus:border-[#aaa] appearance-none">
          <option value="All">All statuses</option>
          <option>Paid</option>
          <option>Pending</option>
          <option>Overdue</option>
        </select>
        {(filterCategory !== 'All' || filterStatus !== 'All') && (
          <button onClick={() => { setFilterCategory('All'); setFilterStatus('All') }}
            className="text-[12px] font-semibold text-[#888] hover:text-[#111] transition-colors">
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col">
        <div className="grid grid-cols-[1.8fr_1.2fr_1fr_1fr_1fr_32px] gap-3 px-5 py-2.5 border-b border-[#f0f0f0] bg-[#fafafa] shrink-0">
          {['Description', 'Category', 'Date', 'Amount', 'Status', ''].map((h) => (
            <p key={h} className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <p className="text-[13px] font-semibold text-[#bbb]">
              {expenses.length === 0 ? 'No expenses recorded yet' : 'No expenses match the current filters'}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {filtered.map((e) => (
              <button key={e.id} onClick={() => onSelect(e)}
                className={`w-full grid grid-cols-[1.8fr_1.2fr_1fr_1fr_1fr_32px] gap-3 items-center px-5 py-3.5 border-b border-[#f8f8f8] last:border-0 transition-colors text-left ${
                  selected?.id === e.id ? 'bg-[#f4f4f4]' : 'hover:bg-[#fafafa]'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#111] truncate">{e.description}</p>
                  {e.reference && <p className="text-[11px] font-medium text-[#bbb] mt-0.5">{e.reference}</p>}
                </div>
                <p className="text-[13px] text-[#666]">{e.category}</p>
                <p className="text-[13px] text-[#666]">{fmtDate(e.date)}</p>
                <p className="text-[13px] font-semibold text-[#111]">{fmt(e.amount)}</p>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit ${STATUS_COLOR[e.status]}`}>
                  {e.status}
                </span>
                <ChevronRight size={14} className="text-[#ccc]" />
              </button>
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#f0f0f0] shrink-0">
            <p className="text-[11px] font-medium text-[#bbb]">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</p>
            <p className="text-[13px] font-bold text-[#111]">{fmt(filteredTotal)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [selected, setSelected] = useState<Expense | null>(null)
  const [showAdd, setShowAdd]   = useState(false)

  function addExpense(data: Omit<Expense, 'id'>) {
    setExpenses((prev) => [{ id: String(Date.now()), ...data }, ...prev])
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebebeb] flex-shrink-0">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-0.5">Finance</p>
          <h1 className="text-[22px] font-bold text-[#111] leading-tight">Expenses</h1>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#ddd] text-[#333] text-[13px] font-semibold rounded-xl hover:bg-[#f9f9f9] transition-colors">
          <Plus size={14} /> Add Expense
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <ExpensesTable expenses={expenses} selected={selected} onSelect={setSelected} />
        <div className="w-[340px] shrink-0 border-l border-[#e8e8e8] h-full">
          <ExpenseDetailPanel expense={selected} expenses={expenses} />
        </div>
      </div>

      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} onAdd={addExpense} />}
    </div>
  )
}
