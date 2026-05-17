import { useState } from 'react'
import { Plus, MoreHorizontal, X } from 'lucide-react'

type ExpenseCategory = 'Fuel & Energy' | 'Maintenance' | 'Staff' | 'Supplies' | 'Utilities' | 'Other'
type ExpenseStatus = 'Paid' | 'Pending' | 'Overdue'

interface Expense {
  id: string
  date: string
  description: string
  category: ExpenseCategory
  amount: number
  status: ExpenseStatus
  reference?: string
}

const categories: ExpenseCategory[] = ['Fuel & Energy', 'Maintenance', 'Staff', 'Supplies', 'Utilities', 'Other']

const statusColour: Record<ExpenseStatus, string> = {
  Paid:    'text-green-600 bg-green-50',
  Pending: 'text-amber-600 bg-amber-50',
  Overdue: 'text-red-500 bg-red-50',
}

const fmt = (n: number) => `J$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

const inputCls = 'w-full bg-white border border-[#e0e0e0] rounded-xl px-4 py-2.5 text-[13px] font-medium text-[#111] placeholder:text-[#ccc] placeholder:font-normal focus:outline-none focus:border-[#aaa] transition-colors'
const labelCls = 'block text-[11px] font-semibold tracking-widest text-[#aaa] uppercase mb-1.5'

function AddExpenseModal({ onClose, onAdd }: { onClose: () => void; onAdd: (e: Omit<Expense, 'id'>) => void }) {
  const today = new Date().toISOString().split('T')[0]
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('Other')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [reference, setReference] = useState('')
  const [status, setStatus] = useState<ExpenseStatus>('Paid')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!description.trim() || isNaN(parsed) || parsed <= 0) return
    onAdd({ description: description.trim(), category, amount: parsed, date, reference: reference.trim() || undefined, status })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-3xl shadow-xl border border-[#ebebeb] w-full max-w-[480px] p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[18px] font-bold text-[#111]">Add Expense</h2>
          <button onClick={onClose} className="text-[#bbb] hover:text-[#111] transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Generator servicing" required className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className={inputCls}>
                {categories.map((c) => <option key={c}>{c}</option>)}
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

          <div className="grid grid-cols-2 gap-4">
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

          <button
            type="submit"
            className="w-full mt-2 py-3 rounded-2xl bg-[#111] text-white text-[13px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
          >
            Add expense
          </button>
        </form>
      </div>
    </div>
  )
}

export function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | 'All'>('All')
  const [filterStatus, setFilterStatus] = useState<ExpenseStatus | 'All'>('All')

  function addExpense(data: Omit<Expense, 'id'>) {
    setExpenses((prev) => [{ id: String(Date.now()), ...data }, ...prev])
  }

  const filtered = expenses.filter((e) => {
    if (filterCategory !== 'All' && e.category !== filterCategory) return false
    if (filterStatus !== 'All' && e.status !== filterStatus) return false
    return true
  })

  const total = expenses.reduce((s, e) => s + e.amount, 0)
  const paid = expenses.filter((e) => e.status === 'Paid').reduce((s, e) => s + e.amount, 0)
  const pending = expenses.filter((e) => e.status !== 'Paid').reduce((s, e) => s + e.amount, 0)

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-[960px] mx-auto flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Finance</p>
            <h1 className="text-[28px] font-bold text-[#111] leading-tight">Expenses</h1>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#111] text-white text-[13px] font-semibold rounded-xl hover:bg-[#333] transition-colors"
          >
            <Plus size={14} />
            Add expense
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total',   value: fmt(total),   sub: `${expenses.length} expense${expenses.length !== 1 ? 's' : ''}` },
            { label: 'Paid',    value: fmt(paid),    sub: `${expenses.filter((e) => e.status === 'Paid').length} items` },
            { label: 'Outstanding', value: fmt(pending), sub: `${expenses.filter((e) => e.status !== 'Paid').length} items` },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-white rounded-2xl border border-[#ebebeb] p-5">
              <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-2">{label}</p>
              <p className="text-[24px] font-bold text-[#111] leading-none tracking-tight">{value}</p>
              <p className="text-[12px] font-medium text-[#bbb] mt-1.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as ExpenseCategory | 'All')}
            className="bg-white border border-[#e0e0e0] rounded-xl px-4 py-2 text-[13px] font-medium text-[#333] focus:outline-none focus:border-[#aaa] transition-colors appearance-none"
          >
            <option value="All">All categories</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ExpenseStatus | 'All')}
            className="bg-white border border-[#e0e0e0] rounded-xl px-4 py-2 text-[13px] font-medium text-[#333] focus:outline-none focus:border-[#aaa] transition-colors appearance-none"
          >
            <option value="All">All statuses</option>
            <option>Paid</option>
            <option>Pending</option>
            <option>Overdue</option>
          </select>
          {(filterCategory !== 'All' || filterStatus !== 'All') && (
            <button
              onClick={() => { setFilterCategory('All'); setFilterStatus('All') }}
              className="text-[12px] font-semibold text-[#888] hover:text-[#111] transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden">
          <div className="grid grid-cols-[1.8fr_1.2fr_1fr_1fr_1fr_32px] gap-3 px-5 py-3 border-b border-[#f0f0f0]">
            {['Description', 'Category', 'Date', 'Amount', 'Status', ''].map((h) => (
              <p key={h} className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="px-5 py-12 flex flex-col items-center justify-center gap-2">
              <p className="text-[13px] font-semibold text-[#bbb]">
                {expenses.length === 0 ? 'No expenses recorded yet' : 'No expenses match the current filters'}
              </p>
              {expenses.length === 0 && (
                <button
                  onClick={() => setShowAdd(true)}
                  className="text-[12px] font-semibold text-[#888] hover:text-[#111] transition-colors mt-1"
                >
                  Add your first expense
                </button>
              )}
            </div>
          ) : (
            filtered.map((e) => (
              <div key={e.id} className="grid grid-cols-[1.8fr_1.2fr_1fr_1fr_1fr_32px] gap-3 px-5 py-3.5 border-b border-[#f9f9f9] last:border-0 items-center">
                <div>
                  <p className="text-[13px] font-semibold text-[#111] truncate">{e.description}</p>
                  {e.reference && <p className="text-[11px] font-medium text-[#bbb] mt-0.5">{e.reference}</p>}
                </div>
                <p className="text-[13px] font-medium text-[#555]">{e.category}</p>
                <p className="text-[13px] font-medium text-[#555]">{new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                <p className="text-[13px] font-semibold text-[#111]">{fmt(e.amount)}</p>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold w-fit ${statusColour[e.status]}`}>
                  {e.status}
                </span>
                <button className="text-[#ddd] hover:text-[#888] transition-colors flex-shrink-0">
                  <MoreHorizontal size={15} />
                </button>
              </div>
            ))
          )}

          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-[#f0f0f0] flex items-center justify-between">
              <p className="text-[12px] font-medium text-[#bbb]">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</p>
              <p className="text-[13px] font-bold text-[#111]">{fmt(filtered.reduce((s, e) => s + e.amount, 0))}</p>
            </div>
          )}
        </div>

      </div>

      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} onAdd={addExpense} />}
    </div>
  )
}
