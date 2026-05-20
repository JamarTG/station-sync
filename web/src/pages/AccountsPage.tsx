import { useState } from 'react'
import { ChevronRight, Plus, Search, X } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Customer {
  id: string
  name: string
  phone: string
  email: string
  credit_balance: number
  status: 'Active' | 'Inactive'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return '$' + n.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function statusColor(status: Customer['status']) {
  return status === 'Active' ? 'bg-[#d1e7dd] text-[#0a5435]' : 'bg-[#f0f0f0] text-[#555]'
}

// ── Add Customer Modal ────────────────────────────────────────────────────────

function AddCustomerModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const [loading, setLoading] = useState(false)

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => { setLoading(false); onClose() }, 600)
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
          <button type="submit" disabled={loading}
            className="w-full bg-white border border-[#ddd] text-[#333] rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#f9f9f9] transition-colors disabled:opacity-40 mt-2">
            {loading ? 'Adding...' : 'Add Customer'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function CustomerDetailPanel({ customer }: { customer: Customer | null }) {
  if (!customer) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-5 border-b border-[#f0f0f0] shrink-0">
          <p>
            <span className="text-[13px] font-bold text-[#111]">Customers</span>
            <span className="text-[13px] font-medium text-[#aaa]"> | Account</span>
          </p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] font-medium text-[#bbb]">Select a customer to view details</p>
        </div>
      </div>
    )
  }

  const profile = [
    { label: 'Phone',          value: customer.phone  || '—' },
    { label: 'Email',          value: customer.email  || '—' },
    { label: 'Credit Balance', value: fmt(customer.credit_balance) },
  ]

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="p-5 border-b border-[#f0f0f0] shrink-0">
        <p>
          <span className="text-[13px] font-bold text-[#111]">Customers</span>
          <span className="text-[13px] font-medium text-[#aaa]"> | Account</span>
        </p>
      </div>

      <div className="p-5 border-b border-[#f0f0f0] shrink-0 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#111] text-white flex items-center justify-center text-[16px] font-bold shrink-0">
          {customer.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-bold text-[#111]">{customer.name}</p>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1 inline-block ${statusColor(customer.status)}`}>
            {customer.status}
          </span>
        </div>
      </div>

      <div className="shrink-0">
        {profile.map(({ label, value }) => (
          <div key={label} className="flex items-center px-5 py-3 border-b border-[#f4f4f4]">
            <span className="text-[12px] text-[#999] w-32 shrink-0">{label}</span>
            <span className="text-[13px] text-[#111]">{value}</span>
          </div>
        ))}
      </div>

      <div className="p-5 shrink-0">
        <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mb-3">Purchase History</p>
        <div className="flex items-center justify-center py-8">
          <p className="text-[13px] font-medium text-[#bbb]">No purchases yet</p>
        </div>
      </div>
    </div>
  )
}

// ── Customers Table ───────────────────────────────────────────────────────────

const SAMPLE_CUSTOMERS: Customer[] = []

function CustomersTable({
  customers,
  selected,
  onSelect,
}: {
  customers: Customer[]
  selected: Customer | null
  onSelect: (c: Customer) => void
}) {
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = q
    ? customers.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      )
    : customers

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

      <div className="flex-1 bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col">
        <div className="grid grid-cols-[2fr_1fr_2fr_1fr_1fr_32px] gap-4 px-5 py-2.5 border-b border-[#f0f0f0] bg-[#fafafa] shrink-0">
          {['Name', 'Phone', 'Email', 'Credit', 'Status', ''].map((h) => (
            <p key={h} className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <p className="text-[13px] font-semibold text-[#bbb]">
              {customers.length === 0 ? 'No customers yet' : 'No results found'}
            </p>
            {customers.length === 0 && (
              <p className="text-[12px] font-medium text-[#ccc]">Customer records will appear here</p>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                className={`w-full grid grid-cols-[2fr_1fr_2fr_1fr_1fr_32px] gap-4 items-center px-5 py-3.5 border-b border-[#f8f8f8] last:border-0 transition-colors text-left ${
                  selected?.id === c.id ? 'bg-[#f4f4f4]' : 'hover:bg-[#fafafa]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#111] text-white flex items-center justify-center text-[12px] font-bold shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-[13px] font-semibold text-[#111] truncate">{c.name}</p>
                </div>
                <p className="text-[13px] text-[#666]">{c.phone || '—'}</p>
                <p className="text-[13px] text-[#666] truncate">{c.email || '—'}</p>
                <p className="text-[13px] font-semibold text-[#111]">{fmt(c.credit_balance)}</p>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit ${statusColor(c.status)}`}>
                  {c.status}
                </span>
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

export function CustomersPage() {
  const [customers] = useState<Customer[]>(SAMPLE_CUSTOMERS)
  const [selected, setSelected] = useState<Customer | null>(null)
  const [showAdd, setShowAdd]   = useState(false)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebebeb] flex-shrink-0">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-0.5">Convenience Store</p>
          <h1 className="text-[22px] font-bold text-[#111] leading-tight">Customers</h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#ddd] text-[#333] text-[13px] font-semibold rounded-xl hover:bg-[#f9f9f9] transition-colors"
        >
          <Plus size={14} /> Add Customer
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <CustomersTable customers={customers} selected={selected} onSelect={setSelected} />
        <div className="w-[380px] shrink-0 border-l border-[#e8e8e8] h-full">
          <CustomerDetailPanel customer={selected} />
        </div>
      </div>

      {showAdd && <AddCustomerModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
