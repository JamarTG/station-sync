import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, ChevronRight, MoreHorizontal, Plus, Search, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useCustomers, useCustomerOrders } from '../hooks/useApi'
import { createCustomer, updateCustomer, type Customer } from '../lib/api'
import { LogoLoader } from '../components/StationSyncLogo'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return '$' + n.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-JM', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('en-JM', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function statusColor(status: Customer['status']) {
  return status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-[#f0f0f0] text-[#999]'
}

const ORDER_STATUS_COLOR: Record<string, string> = {
  paid:   'bg-green-50 text-green-600',
  voided: 'bg-red-50 text-red-500',
  held:   'bg-amber-50 text-amber-600',
}

// ── Add Customer Modal ────────────────────────────────────────────────────────

function AddCustomerModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required.'); return }
    setLoading(true)
    setError('')
    try {
      await createCustomer({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
      })
      qc.invalidateQueries({ queryKey: ['customers'] })
      onClose()
    } catch {
      setError('Failed to add customer. Please try again.')
      setLoading(false)
    }
  }

  const field = (label: string, key: string, type = 'text') => (
    <div>
      <label className="block text-[11px] font-semibold text-[#888] mb-1 uppercase tracking-widest">{label}</label>
      <input
        type={type}
        value={form[key as keyof typeof form]}
        onChange={(e) => set(key, e.target.value)}
        className="w-full border border-[#ebebeb] rounded-xl px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111]"
      />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-[420px] p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[16px] font-bold text-[#111]">Add Customer</h3>
          <button onClick={onClose} className="text-[#bbb] hover:text-[#555] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {field('Full Name', 'name')}
          {field('Phone', 'phone', 'tel')}
          {field('Email', 'email', 'email')}
          {error && <p className="text-[12px] font-semibold text-red-500">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-white border border-[#ddd] text-[#333] rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#f9f9f9] transition-colors disabled:opacity-40 mt-2">
            {loading ? 'Adding...' : 'Add Customer'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Edit Customer Modal ───────────────────────────────────────────────────────

function EditCustomerModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name:  customer.name,
    phone: customer.phone ?? '',
    email: customer.email ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await updateCustomer(customer.id, {
        name:  form.name.trim() || undefined,
        phone: form.phone.trim(),
        email: form.email.trim(),
      })
      qc.invalidateQueries({ queryKey: ['customers'] })
      onClose()
    } catch {
      setError('Something went wrong')
      setLoading(false)
    }
  }

  const field = (label: string, key: string, type = 'text') => (
    <div>
      <label className="block text-[11px] font-semibold text-[#888] mb-1 uppercase tracking-widest">{label}</label>
      <input
        type={type}
        value={form[key as keyof typeof form]}
        onChange={(e) => set(key, e.target.value)}
        className="w-full border border-[#ebebeb] rounded-xl px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111]"
      />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-[420px] p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[16px] font-bold text-[#111]">Edit Customer</h3>
          <button onClick={onClose} className="text-[#bbb] hover:text-[#555] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {field('Full Name', 'name')}
          {field('Phone', 'phone', 'tel')}
          {field('Email', 'email', 'email')}
          {error && <p className="text-[12px] font-semibold text-red-500">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-white border border-[#ddd] text-[#333] rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#f9f9f9] transition-colors disabled:opacity-40 mt-2">
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Customer Profile View ─────────────────────────────────────────────────────

function CustomerView({ customer, onBack }: { customer: Customer; onBack: () => void }) {
  const qc = useQueryClient()
  const { data: orders = [], isLoading } = useCustomerOrders(customer.id)
  const [showEdit, setShowEdit] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleToggleStatus() {
    await updateCustomer(customer.id, { status: customer.status === 'Active' ? 'Inactive' : 'Active' })
    await qc.invalidateQueries({ queryKey: ['customers'] })
    setMenuOpen(false)
    onBack()
  }

  const profile = [
    { label: 'Phone',        value: customer.phone || '—' },
    { label: 'Email',        value: customer.email || '—' },
    { label: 'Account Type', value: customer.user_id ? 'Staff' : 'Customer' },
    { label: 'Member Since', value: fmtDate(customer.created_at) },
  ]

  const totalSpent = orders.filter((o) => o.status === 'paid').reduce((s, o) => s + o.total, 0)
  const loyaltyPoints = Math.floor(totalSpent)

  return (
    <div className="flex h-full overflow-hidden">

      {/* Left: profile */}
      <div className="w-[520px] shrink-0 border-r border-[#e8e8e8] overflow-y-auto p-6 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="flex items-center gap-2 text-[13px] text-[#888] hover:text-[#111] transition-colors">
            <ArrowLeft size={14} /> Go back
          </button>
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="w-8 h-8 flex items-center justify-center border border-[#ddd] rounded-xl text-[#555] hover:bg-[#f9f9f9] transition-colors"
            >
              <MoreHorizontal size={15} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1.5 bg-white border border-[#e8e8e8] rounded-2xl shadow-lg overflow-hidden min-w-[130px] z-20">
                <button
                  onClick={() => { setShowEdit(true); setMenuOpen(false) }}
                  className="w-full text-left px-4 py-2.5 text-[12px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={handleToggleStatus}
                  className={`w-full text-left px-4 py-2.5 text-[12px] font-semibold transition-colors ${
                    customer.status === 'Active' ? 'text-red-500 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                  }`}
                >
                  {customer.status === 'Active' ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-full bg-[#111] text-white flex items-center justify-center text-[20px] font-bold shrink-0 mb-3">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-[20px] font-bold text-[#111]">{customer.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusColor(customer.status)}`}>
              {customer.status}
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f0f0f0] text-[#555]">
              {customer.user_id ? 'Staff' : 'Customer'}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden">
          {profile.map(({ label, value }) => (
            <div key={label} className="flex items-center px-5 py-3 border-b border-[#f4f4f4] last:border-0">
              <span className="text-[12px] text-[#999] w-28 shrink-0">{label}</span>
              <span className="text-[13px] text-[#111]">{value}</span>
            </div>
          ))}
        </div>

        {/* Credit balance — pinned to the bottom */}
        <div className="mt-auto pt-6">
          <p className={`text-[32px] font-bold leading-none tracking-tight text-right ${
            customer.credit_balance > 0 ? 'text-[#c0392b]' : 'text-[#111]'
          }`}>
            {fmt(customer.credit_balance)}
          </p>
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mt-1.5 text-right">
            Credit Balance
          </p>
        </div>
      </div>

      {/* Right: purchase history */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 p-5 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <p>
              <span className="text-[13px] font-bold text-[#111]">Purchases</span>
              <span className="text-[13px] font-medium text-[#aaa]"> | History</span>
            </p>
            <p className="text-[11px] font-semibold text-[#bbb]">{loyaltyPoints.toLocaleString()} pts</p>
          </div>

          <div className="grid grid-cols-[20px_1fr_auto_auto] gap-3 mb-2 shrink-0">
            {['#', 'Invoice', 'Status', 'Amount'].map((h) => (
              <p key={h} className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
            ))}
          </div>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center"><LogoLoader /></div>
          ) : orders.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[13px] font-medium text-[#bbb]">No purchases yet</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {orders.map((o, i) => (
                <div key={o.id} className="grid grid-cols-[20px_1fr_auto_auto] gap-3 items-center py-1.5 border-b border-[#f4f4f4] last:border-b-0">
                  <p className="text-[12px] font-bold text-[#ccc]">{i + 1}</p>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#111] truncate">
                      {o.invoice_no ?? `#${String(o.order_no).padStart(4, '0')}`}
                    </p>
                    <p className="text-[11px] text-[#bbb] truncate">{fmtDateTime(o.created_at)}</p>
                  </div>
                  <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 capitalize w-fit ${
                    ORDER_STATUS_COLOR[o.status] ?? 'bg-[#f0f0f0] text-[#555]'
                  }`}>
                    {o.status}
                  </span>
                  <p className="text-[13px] font-semibold text-[#111] text-right">{fmt(o.total)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#f0f0f0] px-5 py-3 shrink-0">
          <p className="text-[12px] font-semibold text-[#888]">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
          <p className={`text-[13px] font-bold ${totalSpent > 0 ? 'text-[#111]' : 'text-[#bbb]'}`}>{fmt(totalSpent)}</p>
        </div>
      </div>

      {showEdit && <EditCustomerModal customer={customer} onClose={() => setShowEdit(false)} />}
    </div>
  )
}

// ── Outstanding Balances Panel ────────────────────────────────────────────────

function OutstandingBalancesPanel({
  customers,
  onSelect,
}: {
  customers: Customer[]
  onSelect: (c: Customer) => void
}) {
  const outstanding = customers
    .filter((c) => c.credit_balance > 0)
    .sort((a, b) => b.credit_balance - a.credit_balance)
  const total = outstanding.reduce((s, c) => s + c.credit_balance, 0)

  return (
    <div className="h-full flex flex-col">
      <div className="p-5 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4">
          <p>
            <span className="text-[13px] font-bold text-[#111]">Customers</span>
            <span className="text-[13px] font-medium text-[#aaa]"> | Outstanding Balances</span>
          </p>
        </div>

        <div className="grid grid-cols-[24px_1fr_auto] gap-3 mb-2">
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">#</p>
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">Name</p>
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase text-right">Balance</p>
        </div>

        {outstanding.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[13px] font-medium text-[#bbb]">No outstanding balances</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {outstanding.map((c, i) => (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                className="grid grid-cols-[24px_1fr_auto] gap-3 items-center py-2.5 border-b border-[#f8f8f8] last:border-0 hover:bg-[#fafafa] -mx-1 px-1 rounded-lg transition-colors text-left"
              >
                <p className="text-[11px] font-bold text-[#ccc]">{i + 1}</p>
                <p className="text-[13px] font-semibold text-[#111] truncate">{c.name}</p>
                <p className="text-[13px] font-semibold text-[#c0392b]">{fmt(c.credit_balance)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[#f0f0f0] px-5 py-3">
        <p className="text-[12px] font-semibold text-[#888]">Total outstanding</p>
        <p className={`text-[13px] font-bold ${total > 0 ? 'text-[#c0392b]' : 'text-[#bbb]'}`}>{fmt(total)}</p>
      </div>
    </div>
  )
}

// ── Customers Table ───────────────────────────────────────────────────────────

function CustomerRow({
  customer: c,
  onSelect,
  dimmed = false,
}: {
  customer: Customer
  onSelect: (c: Customer) => void
  dimmed?: boolean
}) {
  return (
    <button
      onClick={() => onSelect(c)}
      className={`w-full grid grid-cols-[2fr_1fr_2fr_1fr_1fr_32px] gap-4 items-center px-5 py-3.5 border-b border-[#f8f8f8] last:border-0 hover:bg-[#fafafa] transition-colors text-left ${dimmed ? 'opacity-50' : ''}`}
    >
      <p className="text-[13px] text-[#111] truncate">{c.name}</p>
      <p className="text-[13px] text-[#666] truncate">{c.phone || '—'}</p>
      <p className="text-[13px] text-[#666] truncate">{c.email || '—'}</p>
      <p className={`text-[13px] font-semibold ${c.credit_balance > 0 ? 'text-[#c0392b]' : 'text-[#666]'}`}>
        {fmt(c.credit_balance)}
      </p>
      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit ${statusColor(c.status)}`}>
        {c.status}
      </span>
      <ChevronRight size={14} className="text-[#ccc]" />
    </button>
  )
}

function CustomersTable({ onSelect }: { onSelect: (c: Customer) => void }) {
  const { data: customers = [], isLoading } = useCustomers()
  const [query, setQuery] = useState('')
  const [inactiveOpen, setInactiveOpen] = useState(false)

  const q = query.trim().toLowerCase()
  const match = (c: Customer) =>
    !q ||
    c.name.toLowerCase().includes(q) ||
    c.phone.toLowerCase().includes(q) ||
    c.email.toLowerCase().includes(q)

  const active   = customers.filter((c) => c.status === 'Active'   && match(c))
  const inactive = customers.filter((c) => c.status === 'Inactive' && match(c))

  return (
    <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4 min-w-0">
      {/* Search bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border border-[#ebebeb] rounded-xl shrink-0">
        <Search size={14} className="text-[#bbb] shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, or email…"
          className="flex-1 text-[13px] text-[#111] placeholder-[#ccc] outline-none bg-transparent"
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-[#bbb] hover:text-[#555] transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col">
        <div className="grid grid-cols-[2fr_1fr_2fr_1fr_1fr_32px] gap-4 px-5 py-2.5 border-b border-[#f0f0f0] bg-[#fafafa] shrink-0">
          {['Name', 'Phone', 'Email', 'Credit', 'Status', ''].map((h) => (
            <p key={h} className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
          ))}
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center"><LogoLoader /></div>
        ) : active.length === 0 && inactive.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[13px] text-[#aaa]">
              {customers.length === 0 ? 'No customers yet' : 'No results found'}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {active.map((c) => <CustomerRow key={c.id} customer={c} onSelect={onSelect} />)}
            {active.length === 0 && (
              <div className="py-8 flex items-center justify-center">
                <p className="text-[13px] text-[#aaa]">No active customers</p>
              </div>
            )}
          </div>
        )}
      </div>

      {inactive.length > 0 && (
        <div className="shrink-0 border border-[#ebebeb] rounded-2xl bg-white overflow-hidden">
          <button
            onClick={() => setInactiveOpen((o) => !o)}
            className="w-full flex items-center gap-2 px-5 py-3.5 hover:bg-[#fafafa] transition-colors"
          >
            <ChevronRight size={14} className={`text-[#888] transition-transform ${inactiveOpen ? 'rotate-90' : ''}`} />
            <span className="text-[13px] font-bold text-[#888]">Inactive</span>
            <span className="text-[11px] font-bold text-[#bbb] bg-[#f4f4f4] px-2 py-0.5 rounded-full">{inactive.length}</span>
          </button>
          {inactiveOpen && (
            <div className="border-t border-[#f0f0f0] max-h-[280px] overflow-y-auto">
              <div className="grid grid-cols-[2fr_1fr_2fr_1fr_1fr_32px] gap-4 px-5 py-2.5 border-b border-[#f4f4f4] bg-[#fafafa]">
                {['Name', 'Phone', 'Email', 'Credit', 'Status', ''].map((h) => (
                  <p key={h} className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
                ))}
              </div>
              {inactive.map((c) => <CustomerRow key={c.id} customer={c} onSelect={onSelect} dimmed />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type View = { type: 'list' } | { type: 'customer'; customer: Customer }

export function CustomersPage() {
  const { data: customers = [] } = useCustomers()
  const [view, setView]       = useState<View>({ type: 'list' })
  const [showAdd, setShowAdd] = useState(false)

  if (view.type === 'customer') {
    return <CustomerView customer={view.customer} onBack={() => setView({ type: 'list' })} />
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebebeb] flex-shrink-0">
        <h1 className="text-[22px] font-bold text-[#111] leading-tight">Customers</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#ddd] text-[#333] text-[13px] font-semibold rounded-xl hover:bg-[#f9f9f9] transition-colors"
        >
          <Plus size={14} /> Add Customer
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <CustomersTable onSelect={(c) => setView({ type: 'customer', customer: c })} />
        <div className="w-[420px] shrink-0 border-l border-[#e8e8e8] overflow-y-auto h-full">
          <OutstandingBalancesPanel customers={customers} onSelect={(c) => setView({ type: 'customer', customer: c })} />
        </div>
      </div>

      {showAdd && <AddCustomerModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
