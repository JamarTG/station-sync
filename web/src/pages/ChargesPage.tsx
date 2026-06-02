import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Search, X, ChevronRight, ChevronDown, MoreHorizontal } from 'lucide-react'
import { useAuth } from '../lib/authContext'
import { LogoLoader } from '../components/StationSyncLogo'
import { useShiftsInRange, useShiftDeposits, useCustomers } from '../hooks/useApi'
import { createCustomer, updateCustomer } from '../lib/api'
import { useQueryClient } from '@tanstack/react-query'
import type { Customer, Deposit, Shift } from '../lib/api'
import { loadChargeIds, saveChargeId } from '../lib/chargeIds'
import { matchesSearch } from '../lib/search'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => `J$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-JM', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isoDate(d: Date) { return d.toISOString().slice(0, 10) }

function parseCustomer(metadata: string | null): string | null {
  if (!metadata) return null
  try {
    const m = JSON.parse(metadata)
    return m?.customer_name ?? m?.customerName ?? m?.account_name ?? m?.accountName ?? m?.customer ?? null
  } catch {
    return null
  }
}

function parseDepositedBy(metadata: string | null): string | null {
  if (!metadata) return null
  try {
    const m = JSON.parse(metadata)
    return m?.deposited_by ?? m?.depositedBy ?? null
  } catch {
    return null
  }
}

function parseFuelType(metadata: string | null): string | null {
  if (!metadata) return null
  try {
    const m = JSON.parse(metadata)
    return m?.fuel_type ?? m?.fuelType ?? m?.fuel_name ?? m?.fuelName ?? m?.fuel ?? null
  } catch {
    return null
  }
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

// ── Customer group type ───────────────────────────────────────────────────────

interface CustomerGroup {
  customer: string
  deposits: Deposit[]  // type === 'Charge'
  payments: Deposit[]  // matched by deposited_by
  total: number        // net outstanding (charges - payments)
  lastUsed: string
}

// ── Right panel ───────────────────────────────────────────────────────────────

function CustomerDetailPanel({ group, shiftById, apiCustomer }: {
  group: CustomerGroup
  shiftById: Record<string, Shift>
  apiCustomer: Customer | null
}) {
  const [menuOpen,        setMenuOpen]        = useState(false)
  const [showEditModal,   setShowEditModal]   = useState(false)
  const [shiftsOpen,      setShiftsOpen]      = useState(true)
  const [paymentsOpen,    setPaymentsOpen]    = useState(true)

  // Group deposits by shift, newest first
  const shiftRows = useMemo(() => {
    const byShift = new Map<string, Deposit[]>()
    for (const d of group.deposits) {
      if (!byShift.has(d.shift_id)) byShift.set(d.shift_id, [])
      byShift.get(d.shift_id)!.push(d)
    }
    return Array.from(byShift.entries())
      .map(([shiftId, deposits]) => ({
        shift: shiftById[shiftId],
        deposits,
        total: deposits.reduce((s, d) => s + d.amount, 0),
      }))
      .sort((a, b) => (b.shift?.date ?? '').localeCompare(a.shift?.date ?? ''))
  }, [group, shiftById])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {menuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
      )}

      {showEditModal && apiCustomer && (
        <EditCustomerModal customer={apiCustomer} onClose={() => setShowEditModal(false)} />
      )}

      {/* Scrollable top content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5 border-b border-[#f0f0f0] dark:border-[#1e1e1e]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">Customer</p>
              <p className="text-[22px] font-bold text-[#111] dark:text-[#e0e0e0] leading-none mt-2 truncate">{group.customer}</p>
              <p className="text-[11px] font-semibold text-[#bbb] dark:text-[#444] mt-1">Last charged {fmtDate(group.lastUsed)}</p>
            </div>
            <div className="relative shrink-0 mt-1">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#e0e0e0] dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] hover:bg-[#f5f5f5] dark:hover:bg-[#1e1e1e] transition-colors"
              >
                <MoreHorizontal size={13} className="text-[#555] dark:text-[#999]" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-8 z-50 bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#2a2a2a] rounded-xl shadow-lg py-1 w-44">
                  {apiCustomer && (
                    <button
                      onClick={() => { setMenuOpen(false); setShowEditModal(true) }}
                      className="w-full text-left px-4 py-2 text-[12px] font-semibold text-[#111] dark:text-[#e0e0e0] hover:bg-[#f5f5f5] dark:hover:bg-[#1e1e1e] transition-colors"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => { setMenuOpen(false) }}
                    className="w-full text-left px-4 py-2 text-[12px] font-semibold text-[#111] dark:text-[#e0e0e0] hover:bg-[#f5f5f5] dark:hover:bg-[#1e1e1e] transition-colors"
                  >
                    Record a payment
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false) }}
                    className="w-full text-left px-4 py-2 text-[12px] font-semibold text-[#111] dark:text-[#e0e0e0] hover:bg-[#f5f5f5] dark:hover:bg-[#1e1e1e] transition-colors"
                  >
                    Generate report
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 border-b border-[#f0f0f0] dark:border-[#1e1e1e]">
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase mb-1">Total outstanding</p>
          <p className="text-[28px] font-bold text-[#111] dark:text-[#e0e0e0] leading-none">{fmt(Math.max(0, group.total))}</p>
          <p className="text-[11px] font-semibold text-[#bbb] dark:text-[#444] mt-1.5">across {shiftRows.length} shift{shiftRows.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Shifts accordion */}
        <div>
          <button
            onClick={() => setShiftsOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#fafafa] dark:hover:bg-[#161616] transition-colors"
          >
            <p className="text-[11px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase">Shifts</p>
            {shiftsOpen
              ? <ChevronDown size={13} className="text-[#bbb] dark:text-[#444]" />
              : <ChevronRight size={13} className="text-[#bbb] dark:text-[#444]" />
            }
          </button>
          {shiftsOpen && (
            <div className="px-5 pb-3">
              {shiftRows.map(({ shift, total }, i) => (
                <div key={shift?.id ?? i} className="py-3 border-b border-[#f8f8f8] dark:border-[#1a1a1a] last:border-0">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0]">
                      {shift ? fmtDate(shift.date) : '—'}
                    </p>
                    <p className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">{fmt(total)}</p>
                  </div>
                  {shift && (
                    <p className="text-[11px] text-[#bbb] dark:text-[#444] mt-0.5">{shift.supervisor_name}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payment history pinned to bottom */}
      <div className="shrink-0 border-t border-[#f0f0f0] dark:border-[#1e1e1e]">
        <button
          onClick={() => setPaymentsOpen((o) => !o)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#fafafa] dark:hover:bg-[#161616] transition-colors"
        >
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase">Payment History</p>
          {paymentsOpen
            ? <ChevronDown size={13} className="text-[#bbb] dark:text-[#444]" />
            : <ChevronRight size={13} className="text-[#bbb] dark:text-[#444]" />
          }
        </button>
        {paymentsOpen && (
          <div className="px-5 pb-5">
            {group.payments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-1">
                <p className="text-[13px] font-semibold text-[#bbb] dark:text-[#444]">No payments recorded</p>
                <p className="text-[12px] font-medium text-[#ccc] dark:text-[#444]">Payments will appear here</p>
              </div>
            ) : (
              <>
                {[...group.payments]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((p) => (
                    <div key={p.id} className="py-3 border-b border-[#f8f8f8] dark:border-[#1a1a1a] last:border-0">
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0]">{fmtDate(p.created_at)}</p>
                        <p className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">{fmt(p.amount)}</p>
                      </div>
                      <p className="text-[11px] text-[#bbb] dark:text-[#444] mt-0.5">{p.type.replace('Deposit', '')}</p>
                    </div>
                  ))}
                <div className="flex items-center justify-between pt-3 mt-1 border-t border-[#f0f0f0] dark:border-[#1e1e1e]">
                  <p className="text-[11px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase">Total paid</p>
                  <p className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">
                    {fmt(group.payments.reduce((s, p) => s + p.amount, 0))}
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function OverviewPanel({ rows }: { rows: CustomerGroup[] }) {
  const grandTotal = rows.reduce((s, r) => s + Math.max(0, r.total), 0)

  // Build fuel-type breakdown from all deposits across all customers
  const fuelBreakdown = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      for (const d of r.deposits) {
        const fuel = parseFuelType(d.metadata) ?? 'Other'
        map.set(fuel, (map.get(fuel) ?? 0) + d.amount)
      }
    }
    return Array.from(map.entries())
      .map(([fuel, amount]) => ({ fuel, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [rows])

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-5 border-b border-[#f0f0f0] dark:border-[#1e1e1e]">
        <p className="text-[11px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase mb-1">Total outstanding</p>
        <p className="text-[28px] font-bold text-[#111] dark:text-[#e0e0e0] leading-none">{fmt(grandTotal)}</p>
      </div>

      {fuelBreakdown.length > 0 && (
        <div className="p-5 border-b border-[#f0f0f0] dark:border-[#1e1e1e]">
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase mb-3">Fuel</p>
          <div className="space-y-2.5">
            {fuelBreakdown.map(({ fuel, amount }) => (
              <div key={fuel} className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-medium text-[#555] dark:text-[#999] truncate min-w-0">{fuel}</p>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-20 h-1.5 rounded-full bg-[#f0f0f0] dark:bg-[#222] overflow-hidden">
                    <div
                      className="h-full bg-[#111] dark:bg-[#e0e0e0] rounded-full"
                      style={{ width: grandTotal > 0 ? `${(amount / grandTotal) * 100}%` : '0%' }}
                    />
                  </div>
                  <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] w-24 text-right">{fmt(amount)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="p-5">
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase mb-3">Customers</p>
          <div className="space-y-3">
            {[...rows].sort((a, b) => b.total - a.total).map((r) => (
              <div key={r.customer}>
                <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] truncate mb-1.5">{r.customer}</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 rounded-full bg-[#f0f0f0] dark:bg-[#222] overflow-hidden">
                    <div
                      className="h-full bg-[#111] dark:bg-[#e0e0e0] rounded-full"
                      style={{ width: grandTotal > 0 ? `${(Math.max(0, r.total) / grandTotal) * 100}%` : '0%' }}
                    />
                  </div>
                  <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] shrink-0">{fmt(r.total)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {rows.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] font-medium text-[#bbb] dark:text-[#444]">No charges yet</p>
        </div>
      )}
    </div>
  )
}

// ── Edit Customer Modal ───────────────────────────────────────────────────────

function EditCustomerModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const qc = useQueryClient()
  const [name,    setName]    = useState(customer.name)
  const [phone,   setPhone]   = useState(customer.phone ?? '')
  const [email,   setEmail]   = useState(customer.email ?? '')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const fieldCls = 'w-full bg-white dark:bg-[#1a1a1a] border border-[#ebebeb] dark:border-[#222] rounded-xl px-4 py-2.5 text-[13px] text-[#111] dark:text-[#e0e0e0] focus:outline-none focus:border-[#111] dark:focus:border-[#e0e0e0]'
  const labelCls = 'block text-[11px] font-semibold tracking-widest text-[#888] dark:text-[#666] uppercase mb-1'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    setLoading(true)
    try {
      await updateCustomer(customer.id, {
        name:  name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      })
      await qc.invalidateQueries({ queryKey: ['customers'] })
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl w-full max-w-[420px] p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[16px] font-bold text-[#111] dark:text-[#e0e0e0]">Edit Customer</h3>
          <button onClick={onClose} className="text-[#bbb] dark:text-[#444] hover:text-[#555] dark:hover:text-[#999] transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelCls}>Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className={fieldCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Phone <span className="normal-case tracking-normal font-normal text-[#ccc] dark:text-[#444]">(optional)</span></label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="876-000-0000"
                className={fieldCls}
              />
            </div>
            <div>
              <label className={labelCls}>Email <span className="normal-case tracking-normal font-normal text-[#ccc] dark:text-[#444]">(optional)</span></label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className={fieldCls}
              />
            </div>
          </div>
          {error && <p className="text-[12px] text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white dark:bg-[#1a1a1a] border border-[#ddd] dark:border-[#333] text-[#333] dark:text-[#ccc] rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#f9f9f9] dark:hover:bg-[#161616] transition-colors disabled:opacity-40 mt-2"
          >
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Add Customer Modal ────────────────────────────────────────────────────────

function AddOrgModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [name,    setName]    = useState('')
  const [phone,   setPhone]   = useState('')
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const fieldCls = 'w-full bg-white dark:bg-[#1a1a1a] border border-[#ebebeb] dark:border-[#222] rounded-xl px-4 py-2.5 text-[13px] text-[#111] dark:text-[#e0e0e0] focus:outline-none focus:border-[#111] dark:focus:border-[#e0e0e0]'
  const labelCls = 'block text-[11px] font-semibold tracking-widest text-[#888] dark:text-[#666] uppercase mb-1'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    setLoading(true)
    try {
      const customer = await createCustomer({
        name:          name.trim(),
        phone:         phone.trim() || undefined,
        email:         email.trim() || undefined,
        customer_type: 'charge',
      })
      saveChargeId(customer.id)
      await qc.invalidateQueries({ queryKey: ['customers'] })
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl w-full max-w-[420px] p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[16px] font-bold text-[#111] dark:text-[#e0e0e0]">Add Customer</h3>
          <button onClick={onClose} className="text-[#bbb] dark:text-[#444] hover:text-[#555] dark:hover:text-[#999] transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelCls}>Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Ltd."
              required
              autoFocus
              className={fieldCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Phone <span className="normal-case tracking-normal font-normal text-[#ccc] dark:text-[#444]">(optional)</span></label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="876-000-0000"
                className={fieldCls}
              />
            </div>
            <div>
              <label className={labelCls}>Email <span className="normal-case tracking-normal font-normal text-[#ccc] dark:text-[#444]">(optional)</span></label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className={fieldCls}
              />
            </div>
          </div>
          {error && <p className="text-[12px] text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white dark:bg-[#1a1a1a] border border-[#ddd] dark:border-[#333] text-[#333] dark:text-[#ccc] rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#f9f9f9] dark:hover:bg-[#161616] transition-colors disabled:opacity-40 mt-2"
          >
            {loading ? 'Adding…' : 'Add Customer'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ChargesPage() {
  const { user: authUser } = useAuth()
  const isManagerOrAdmin = authUser?.role === 'Manager' || authUser?.role === 'Admin'

  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 29)

  const [query,           setQuery]           = useState('')
  const [selectedKey,     setSelectedKey]     = useState<string | null>(null)
  const [depositsByShift, setDepositsByShift] = useState<Record<string, Deposit[]>>({})
  const [showAddModal,    setShowAddModal]    = useState(false)

  const { data: shifts = [],       isLoading: shiftsLoading }    = useShiftsInRange(isoDate(thirtyDaysAgo), isoDate(today))
  const { data: customerList = [], isLoading: customersLoading } = useCustomers()
  const isLoading = shiftsLoading || customersLoading

  const handleLoad = useCallback((shiftId: string, data: Deposit[]) => {
    setDepositsByShift((prev) => ({ ...prev, [shiftId]: data }))
  }, [])

  const shiftById = useMemo(() => {
    const m: Record<string, Shift> = {}
    for (const s of shifts) m[s.id] = s
    return m
  }, [shifts])

  // All charge deposits, newest first
  const charges = useMemo(
    () =>
      shifts
        .flatMap((s) => depositsByShift[s.id] ?? [])
        .filter((d) => d.type === 'Charge')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [shifts, depositsByShift],
  )

  // All payment deposits (any non-Charge deposit with a deposited_by name)
  const paymentDeposits = useMemo(
    () =>
      shifts
        .flatMap((s) => depositsByShift[s.id] ?? [])
        .filter((d) => d.type !== 'Charge' && parseDepositedBy(d.metadata) !== null),
    [shifts, depositsByShift],
  )

  // Group by customer, apply search, merge with API customer list
  const tableRows = useMemo<CustomerGroup[]>(() => {
    const q = query.trim().toLowerCase()

    // Build deposit groups from shift charges
    let list = charges
    if (q) {
      list = charges.filter((d) => {
        const c     = parseCustomer(d.metadata) ?? d.attendant_name
        const shift = shiftById[d.shift_id]
        return matchesSearch(query, {
          text: [c, shift?.supervisor_name],
          date: shift?.date ?? d.created_at,
        })
      })
    }

    const map = new Map<string, Deposit[]>()
    for (const d of list) {
      const key = parseCustomer(d.metadata) ?? d.attendant_name
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(d)
    }

    const depositRows: CustomerGroup[] = Array.from(map.entries()).map(([customer, chargeDeposits]) => {
      const payments = paymentDeposits.filter(
        (d) => (parseDepositedBy(d.metadata) ?? '').toLowerCase() === customer.toLowerCase()
      )
      const totalCharged = chargeDeposits.reduce((s, d) => s + d.amount, 0)
      const totalPaid    = payments.reduce((s, d) => s + d.amount, 0)
      return {
        customer,
        deposits: chargeDeposits,
        payments,
        total:    totalCharged - totalPaid,
        lastUsed: chargeDeposits[0].created_at,
      }
    })

    // Customers added via the modal but not yet in any shift deposit
    const chargeIds = loadChargeIds()
    const depositNames = new Set(depositRows.map((r) => r.customer.toLowerCase()))
    const apiOnlyRows: CustomerGroup[] = customerList
      .filter((c) => c.customer_type === 'charge' || chargeIds.has(c.id))
      .filter((c) => !depositNames.has(c.name.toLowerCase()))
      .filter((c) => matchesSearch(query, { text: [c.name, c.phone, c.email] }))
      .map((c) => ({
        customer: c.name,
        deposits: [],
        payments: [],
        total:    0,
        lastUsed: c.created_at,
      }))

    return [...depositRows, ...apiOnlyRows]
      .sort((a, b) => b.lastUsed.localeCompare(a.lastUsed))
  }, [charges, paymentDeposits, query, shiftById, customerList])

  const selectedGroup = tableRows.find((r) => r.customer === selectedKey) ?? null
  const selectedApiCustomer = selectedGroup
    ? (customerList.find((c) => c.name.toLowerCase() === selectedGroup.customer.toLowerCase()) ?? null)
    : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {shifts.map((s) => (
        <ShiftDepositsLoader key={s.id} shiftId={s.id} onLoad={handleLoad} />
      ))}

      {showAddModal && <AddOrgModal onClose={() => setShowAddModal(false)} />}

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebebeb] dark:border-[#222] flex-shrink-0">
        <div>
          {!isManagerOrAdmin && (
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] dark:text-[#555] uppercase mb-0.5">Service Station</p>
          )}
          <h1 className="text-[22px] font-bold text-[#111] dark:text-[#e0e0e0] leading-tight">Charges</h1>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 border border-[#ddd] dark:border-[#333] rounded-xl text-[12px] font-semibold text-[#333] dark:text-[#ccc] bg-white dark:bg-[#1a1a1a] hover:bg-[#f9f9f9] dark:hover:bg-[#161616] transition-colors"
        >
          Add a customer
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: charges table */}
        <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4 min-w-0">

          {/* Search */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-[#1a1a1a] border border-[#ebebeb] dark:border-[#222] rounded-xl shrink-0">
            <Search size={14} className="text-[#bbb] dark:text-[#444] shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by customer or supervisor…"
              className="flex-1 text-[13px] text-[#111] dark:text-[#e0e0e0] placeholder-[#ccc] dark:placeholder-[#444] outline-none bg-transparent"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-[#bbb] dark:text-[#444] hover:text-[#555] dark:hover:text-[#999] transition-colors">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Table */}
          <div className="flex-1 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-[#ebebeb] dark:border-[#222] overflow-hidden flex flex-col">
            <div className="grid grid-cols-[2fr_1fr_1fr] gap-4 px-5 py-2.5 border-b border-[#f0f0f0] dark:border-[#1e1e1e] bg-[#fafafa] dark:bg-[#161616] shrink-0">
              {['Customer', 'Last Visit', 'Amount'].map((h) => (
                <p key={h} className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase">{h}</p>
              ))}
            </div>

            {isLoading ? (
              <div className="flex-1 flex items-center justify-center"><LogoLoader /></div>
            ) : tableRows.length === 0 ? (
              <div className="flex-1 overflow-y-auto flex items-center justify-center">
                <div className="flex flex-col items-center gap-1">
                  <p className="text-[13px] font-semibold text-[#bbb] dark:text-[#444]">
                    {charges.length === 0 ? 'No charges yet' : 'No results found'}
                  </p>
                  <p className="text-[12px] font-medium text-[#ccc] dark:text-[#444]">Charge records will appear here</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {tableRows.map((row) => (
                  <button
                    key={row.customer}
                    onClick={() => setSelectedKey((cur) => cur === row.customer ? null : row.customer)}
                    className={`w-full grid grid-cols-[2fr_1fr_1fr] gap-4 items-center px-5 py-3.5 border-b border-[#f8f8f8] dark:border-[#1a1a1a] last:border-0 text-left transition-colors ${
                      selectedKey === row.customer ? 'bg-[#f4f4f4] dark:bg-[#222]' : 'hover:bg-[#fafafa] dark:hover:bg-[#161616]'
                    }`}
                  >
                    <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] truncate">{row.customer}</p>
                    <p className="text-[12px] font-semibold text-[#666] dark:text-[#888]">{fmtDate(row.lastUsed)}</p>
                    <p className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">{fmt(row.total)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: customer detail */}
        <div className="w-[340px] shrink-0 border-l border-[#e8e8e8] dark:border-[#222] h-full">
          {selectedGroup
            ? <CustomerDetailPanel group={selectedGroup} shiftById={shiftById} apiCustomer={selectedApiCustomer} />
            : <OverviewPanel rows={tableRows} />
          }
        </div>
      </div>
    </div>
  )
}
