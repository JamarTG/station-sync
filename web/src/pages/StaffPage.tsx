import { useState, useRef, useEffect, useMemo } from 'react'
import { LogoLoader } from '../components/StationSyncLogo'
import {
  useUsers, useUserPayroll, usePayrollPeriods, usePayrollRecords,
  useCreateUser, useUpdatePay, useUserAttendance,
  useShiftsInRange,
} from '../hooks/useApi'
import { useAuth } from '../lib/authContext'
import { api, updateUser } from '../lib/api'
import type { User, PayrollPeriod, PayrollRecord } from '../lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronRight, Download, MoreHorizontal, Pencil, Plus, Printer, Search, Sparkles, X, PauseCircle, Umbrella, UserX, Trophy, HeartPulse } from 'lucide-react'
import { EmployeeRankingsPage } from './EmployeeRankingsPage'
import { printPaySlip, printPayrollRegister, printJobLetter, downloadS01CSV, downloadHeartCSV } from '../lib/payrollExport'
import { matchesSearch } from '../lib/search'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return '$' + n.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-JM', { year: 'numeric', month: 'short', day: 'numeric' })
}

function roleBadgeColor(_role: string) {
  return 'bg-[#f0f0f0] text-[#555]'
}

function userStatusLabel(u: User): string {
  if (u.active) return 'Active'
  return u.deactivation_reason ?? 'Inactive'
}

function userStatusBadgeClass(u: User): string {
  if (u.active) return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
  switch (u.deactivation_reason) {
    case 'Suspension':    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
    case 'Vacation':      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
    case 'Special Leave': return 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400'
    case 'Termination':   return 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
    default:              return 'bg-[#f0f0f0] text-[#999] dark:bg-[#222] dark:text-[#555]'
  }
}

const STATION_ROLES    = new Set(['Attendant', 'Supervisor', 'Manager', 'Admin', 'Super Admin'])
const CONVENIENCE_ROLES = new Set(['Cashier', 'Stock Clerk'])

// ── Add Employee Modal ────────────────────────────────────────────────────────

function AddEmployeeModal({ onClose, isManagerOrAdmin }: { onClose: () => void; isManagerOrAdmin: boolean }) {
  const createUser = useCreateUser()
  const [form, setForm] = useState({
    name: '', role: 'Attendant', password: '', phone: '',
    nis: '', trn: '', email: '', employed_on: '', pay_rate: '', pay_type: 'Hourly', sick_days: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await createUser(form)
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const field = (label: string, key: string, type = 'text', required = false) => (
    <div>
      <label className="block text-[11px] font-semibold text-[#888] mb-1 uppercase tracking-widest">{label}</label>
      <input
        type={type}
        value={form[key as keyof typeof form]}
        onChange={(e) => set(key, e.target.value)}
        required={required}
        className="w-full border border-[#ebebeb] rounded-xl px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111]"
      />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-[500px] p-8 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[16px] font-bold text-[#111]">Add Employee</h3>
          <button onClick={onClose} className="text-[#bbb] hover:text-[#555] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {field('Full Name', 'name', 'text', true)}
            {field('Email', 'email', 'email', true)}
            {field('Phone', 'phone')}
            {field('Password', 'password', 'password', true)}
            {field('NIS #', 'nis')}
            {field('TRN #', 'trn')}
            {field('Employed On', 'employed_on', 'date')}
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#888] mb-1 uppercase tracking-widest">Role</label>
            <select value={form.role} onChange={(e) => set('role', e.target.value)}
              className="w-full border border-[#ebebeb] rounded-xl px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111]">
              {(isManagerOrAdmin
                ? ['Attendant', 'Supervisor', 'Manager', 'Admin', 'Cashier', 'Stock Clerk']
                : ['Attendant', 'Supervisor', 'Manager', 'Admin']
              ).map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('Pay Rate (JMD)', 'pay_rate', 'number')}
            <div>
              <label className="block text-[11px] font-semibold text-[#888] mb-1 uppercase tracking-widest">Pay Type</label>
              <select value={form.pay_type} onChange={(e) => set('pay_type', e.target.value)}
                className="w-full border border-[#ebebeb] rounded-xl px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111]">
                <option>Hourly</option>
                <option>Salary</option>
              </select>
            </div>
          </div>
          {field('Sick Days', 'sick_days', 'number')}
          {error && <p className="text-[12px] text-red-500">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-white border border-[#ddd] text-[#333] rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#f9f9f9] transition-colors disabled:opacity-40 mt-2">
            {loading ? 'Adding...' : 'Add Employee'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Edit Employee Modal ───────────────────────────────────────────────────────

function EditEmployeeModal({ user, onClose }: { user: User; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name:        user.name,
    role:        user.role,
    email:       user.email ?? '',
    phone:       user.phone ?? '',
    nis:         user.nis ?? '',
    trn:         user.trn ?? '',
    employed_on: user.employed_on ?? '',
    sick_days:   user.sick_days?.toString() ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { updateUser } = await import('../lib/api')
      await updateUser(user.id, {
        name:        form.name.trim() || undefined,
        role:        form.role || undefined,
        email:       form.email.trim() || undefined,
        phone:       form.phone.trim() || undefined,
        nis:         form.nis.trim() || undefined,
        trn:         form.trn.trim() || undefined,
        employed_on: form.employed_on || undefined,
        sick_days:   form.sick_days !== '' ? Number(form.sick_days) : null,
      })
      qc.invalidateQueries({ queryKey: ['users'] })
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Something went wrong')
    } finally {
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
      <div className="bg-white rounded-3xl w-full max-w-[500px] p-8 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[16px] font-bold text-[#111]">Edit Employee</h3>
          <button onClick={onClose} className="text-[#bbb] hover:text-[#555] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {field('Full Name', 'name')}
            {field('Email', 'email', 'email')}
            {field('Phone', 'phone')}
            {field('NIS #', 'nis')}
            {field('TRN #', 'trn')}
            {field('Employed On', 'employed_on', 'date')}
            {field('Sick Days', 'sick_days', 'number')}
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#888] mb-1 uppercase tracking-widest">Role</label>
            <select value={form.role} onChange={(e) => set('role', e.target.value)}
              className="w-full border border-[#ebebeb] rounded-xl px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111]">
              {['Attendant', 'Supervisor', 'Manager', 'Admin', 'Cashier', 'Stock Clerk'].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-[12px] text-red-500">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-white border border-[#ddd] text-[#333] rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#f9f9f9] transition-colors disabled:opacity-40 mt-2">
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Log Sick Day Modal ────────────────────────────────────────────────────────

function LogSickDayModal({ user, onClose }: { user: User; onClose: () => void }) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate]       = useState(today)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const used      = user.sick_days_used ?? 0
  const entitle   = user.sick_days ?? null
  const remaining = entitle != null ? entitle - used : null

  async function handleConfirm() {
    setError('')
    setLoading(true)
    try {
      await api.patch(`/users/${user.id}`, { sick_days_used: used + 1, sick_day_date: date })
      await qc.invalidateQueries({ queryKey: ['users'] })
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
      <div className="bg-white rounded-3xl w-full max-w-[360px] p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-[16px] font-bold text-[#111]">Log Sick Day</h3>
            <p className="text-[13px] text-[#aaa] mt-0.5">{user.name}</p>
          </div>
          <button onClick={onClose} className="text-[#bbb] hover:text-[#555] transition-colors"><X size={18} /></button>
        </div>

        {/* Sick day stats */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 bg-[#f7f7f7] rounded-xl px-4 py-3 text-center">
            <p className="text-[20px] font-bold text-[#111]">{used}</p>
            <p className="text-[10px] font-semibold text-[#bbb] uppercase tracking-widest mt-0.5">Used</p>
          </div>
          <div className="flex-1 bg-[#f7f7f7] rounded-xl px-4 py-3 text-center">
            <p className="text-[20px] font-bold text-[#111]">{remaining != null ? remaining : '—'}</p>
            <p className="text-[10px] font-semibold text-[#bbb] uppercase tracking-widest mt-0.5">Remaining</p>
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-[11px] font-semibold text-[#888] mb-1.5 uppercase tracking-widest">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={today}
            className="w-full border border-[#ebebeb] rounded-xl px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111]"
          />
        </div>

        {remaining != null && remaining <= 0 && (
          <p className="text-[12px] text-amber-600 bg-amber-50 rounded-xl px-4 py-2.5 mb-4 font-medium">
            No sick days remaining — logging will exceed the entitlement.
          </p>
        )}

        {error && <p className="text-[12px] text-red-500 mb-3">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 border border-[#ebebeb] rounded-xl py-2.5 text-[13px] font-semibold text-[#888] hover:bg-[#fafafa] transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={loading || !date}
            className="flex-1 bg-[#111] text-white rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#333] transition-colors disabled:opacity-40">
            {loading ? 'Logging…' : 'Log Sick Day'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Pay Modal ────────────────────────────────────────────────────────────

function EditPayModal({ user, onClose }: { user: User; onClose: () => void }) {
  const updatePay = useUpdatePay()
  const [rate, setRate]         = useState(user.pay_rate?.toString() ?? '')
  const [type, setType]         = useState(user.pay_type ?? 'Hourly')
  const [overtime, setOvertime] = useState(user.overtime_rate?.toString() ?? '')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await updatePay(
        user.id,
        rate ? parseFloat(rate) : null,
        type || null,
        overtime ? parseFloat(overtime) : null,
      )
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
      <div className="bg-white rounded-3xl w-full max-w-[360px] p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[16px] font-bold text-[#111]">Edit Pay — {user.name}</h3>
          <button onClick={onClose} className="text-[#bbb] hover:text-[#555] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#888] mb-1 uppercase tracking-widest">Pay Rate (JMD)</label>
            <input type="number" value={rate} onChange={(e) => setRate(e.target.value)}
              className="w-full border border-[#ebebeb] rounded-xl px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111]" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#888] mb-1 uppercase tracking-widest">Pay Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as 'Hourly' | 'Salary')}
              className="w-full border border-[#ebebeb] rounded-xl px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111]">
              <option>Hourly</option>
              <option>Salary</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#888] mb-1 uppercase tracking-widest">Overtime Rate (JMD/hr)</label>
            <input type="number" value={overtime} onChange={(e) => setOvertime(e.target.value)}
              placeholder="Optional"
              className="w-full border border-[#ebebeb] rounded-xl px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111]" />
          </div>
          {error && <p className="text-[12px] text-red-500">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-white border border-[#ddd] text-[#333] rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#f9f9f9] transition-colors disabled:opacity-40">
            {loading ? 'Saving...' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── New Period Modal ──────────────────────────────────────────────────────────

function NewPeriodModal({ onClose }: { onClose: () => void }) {
  const qc                          = useQueryClient()
  const { data: allUsers = [] }     = useUsers()
  const [step, setStep]             = useState<1 | 2>(1)
  const [startDate, setStartDate]   = useState('')
  const [endDate, setEndDate]       = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  // Only active staff with pay configured are eligible
  const eligible = allUsers.filter((u) => u.active && u.pay_rate != null && u.pay_type != null)
  const filtered = search.trim()
    ? eligible.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || (u.role as string).toLowerCase().includes(search.toLowerCase()))
    : eligible

  // Pre-select all when advancing to step 2
  function goToStep2() {
    setSelectedIds(new Set(eligible.map((u) => u.id)))
    setStep(2)
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (filtered.every((u) => selectedIds.has(u.id))) {
      setSelectedIds((prev) => { const n = new Set(prev); filtered.forEach((u) => n.delete(u.id)); return n })
    } else {
      setSelectedIds((prev) => { const n = new Set(prev); filtered.forEach((u) => n.add(u.id)); return n })
    }
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((u) => selectedIds.has(u.id))

  async function handleSubmit() {
    if (selectedIds.size === 0) { setError('Select at least one employee'); return }
    setError('')
    setLoading(true)
    try {
      await api.post('/payroll/periods', {
        start_date: startDate,
        end_date:   endDate,
        user_ids:   Array.from(selectedIds),
      })
      await qc.invalidateQueries({ queryKey: ['payroll-periods'] })
      await qc.invalidateQueries({ queryKey: ['user-payroll'] })
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
      <div className="bg-white rounded-3xl w-full max-w-[480px] shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-6">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase mb-0.5">
              Step {step} of 2
            </p>
            <h3 className="text-[20px] font-bold text-[#111] leading-tight">
              {step === 1 ? 'New Pay Period' : 'Select Staff'}
            </h3>
            <p className="text-[13px] text-[#aaa] font-medium mt-0.5">
              {step === 1 ? 'Set the start and end dates for this period.' : 'Choose who to include in this payroll run.'}
            </p>
          </div>
          <button onClick={onClose} className="text-[#bbb] hover:text-[#555] transition-colors ml-4 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Step 1 — dates */}
        {step === 1 && (
          <div className="px-8 pb-8 flex flex-col gap-4">
            {[
              { label: 'Start Date', value: startDate, set: setStartDate },
              { label: 'End Date',   value: endDate,   set: setEndDate   },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <label className="block text-[11px] font-semibold text-[#888] mb-1.5 uppercase tracking-widest">{label}</label>
                <input
                  type="date"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  required
                  className="w-full border border-[#ebebeb] rounded-xl px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111]"
                />
              </div>
            ))}
            <button
              onClick={goToStep2}
              disabled={!startDate || !endDate || endDate <= startDate}
              className="w-full mt-2 bg-[#111] text-white rounded-xl py-3 text-[13px] font-semibold hover:bg-[#222] transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              Next — Select Staff
            </button>
          </div>
        )}

        {/* Step 2 — staff */}
        {step === 2 && (
          <>
            {/* Search */}
            <div className="px-8 pb-3">
              <div className="flex items-center gap-2 px-3 py-2 border border-[#ebebeb] rounded-xl">
                <Search size={13} className="text-[#bbb] shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by name or role…"
                  className="flex-1 text-[12px] text-[#111] placeholder-[#ccc] outline-none bg-transparent"
                />
                {search && <button onClick={() => setSearch('')} className="text-[#bbb] hover:text-[#555]"><X size={12} /></button>}
              </div>
            </div>

            {/* Select all row */}
            <div className="px-8 pb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold text-[#aaa]">
                {selectedIds.size} of {eligible.length} selected
              </p>
              <button
                onClick={toggleAll}
                className="text-[11px] font-semibold text-[#555] hover:text-[#111] transition-colors"
              >
                {allFilteredSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            {/* Staff list */}
            <div className="mx-8 border border-[#f0f0f0] rounded-2xl overflow-hidden max-h-[280px] overflow-y-auto mb-5">
              {filtered.length === 0 ? (
                <div className="py-8 flex items-center justify-center">
                  <p className="text-[12px] font-medium text-[#ccc]">
                    {eligible.length === 0 ? 'No staff with pay configured' : 'No matches'}
                  </p>
                </div>
              ) : (
                filtered.map((u, i) => (
                  <button
                    key={u.id}
                    onClick={() => toggle(u.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#fafafa] ${i > 0 ? 'border-t border-[#f8f8f8]' : ''}`}
                  >
                    {/* Checkbox */}
                    <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center flex-shrink-0 transition-colors ${
                      selectedIds.has(u.id)
                        ? 'bg-[#111] border-[#111]'
                        : 'bg-white border-[#ddd]'
                    }`}>
                      {selectedIds.has(u.id) && (
                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                          <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#111] truncate">{u.name}</p>
                      <p className="text-[11px] text-[#aaa] font-medium">{u.role as string}</p>
                    </div>
                    <p className="text-[12px] font-semibold text-[#888] flex-shrink-0">
                      ${u.pay_rate!.toLocaleString('en-JM', { minimumFractionDigits: 2 })}/{u.pay_type === 'Hourly' ? 'hr' : 'mo'}
                    </p>
                  </button>
                ))
              )}
            </div>

            {error && <p className="px-8 pb-3 text-[12px] text-red-500">{error}</p>}

            {/* Footer buttons */}
            <div className="flex items-center gap-3 px-8 pb-8">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2.5 border border-[#ddd] rounded-xl text-[12px] font-semibold text-[#555] hover:bg-[#f9f9f9] transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || selectedIds.size === 0}
                className="flex-1 bg-[#111] text-white rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#222] transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                {loading ? 'Generating…' : `Generate Payroll for ${selectedIds.size} staff`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Payroll Record Card ───────────────────────────────────────────────────────

function RecordCard({ record }: { record: PayrollRecord }) {
  const [open, setOpen]         = useState(false)
  const [editAdj, setEditAdj]   = useState(false)
  const [overage, setOverage]   = useState((record.overage ?? 0).toString())
  const [shortage, setShortage] = useState((record.shortage ?? 0).toString())
  const [saving, setSaving]     = useState(false)
  const qc = useQueryClient()

  const totalDeductions = record.nis + record.nht + record.ed_tax + record.paye
  const recOverage  = record.overage  ?? 0
  const recShortage = record.shortage ?? 0
  const liveNet = record.gross_pay - totalDeductions + (parseFloat(overage) || 0) - (parseFloat(shortage) || 0)

  async function saveAdjustments() {
    setSaving(true)
    try {
      await api.patch(`/payroll/periods/${record.period_id}/records/${record.id}`, {
        overage:  parseFloat(overage)  || 0,
        shortage: parseFloat(shortage) || 0,
      })
      await qc.invalidateQueries({ queryKey: ['payroll-records', record.period_id] })
      await qc.invalidateQueries({ queryKey: ['user-payroll', record.user_id] })
      await qc.invalidateQueries({ queryKey: ['users'] })
      setEditAdj(false)
    } finally {
      setSaving(false)
    }
  }

  function cancelAdj() {
    setOverage(record.overage.toString())
    setShortage(record.shortage.toString())
    setEditAdj(false)
  }

  return (
    <div className="border border-[#ebebeb] rounded-xl overflow-hidden">
      <button className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#fafafa] transition-colors text-left" onClick={() => setOpen((o) => !o)}>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#111]">
            {fmtDate(record.period_start_date)} – {fmtDate(record.period_end_date)}
          </p>
          <p className="text-[11px] text-[#bbb] mt-0.5">{record.period_status}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[14px] font-semibold text-[#111]">{fmt(record.net_pay)}</p>
          <p className="text-[11px] text-[#bbb]">net pay</p>
        </div>
        <ChevronRight size={16} className={`text-[#bbb] shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-4 border-t border-[#f4f4f4]">
          <div className="mt-3 mb-2 flex justify-between text-[13px]">
            <span className="text-[#888]">Gross pay</span>
            <span className="font-semibold text-[#111]">{fmt(record.gross_pay)}</span>
          </div>
          {record.hours_worked != null && (
            <div className="flex justify-between text-[12px] text-[#bbb] mb-2">
              <span>Hours worked</span><span>{record.hours_worked.toFixed(2)} hrs</span>
            </div>
          )}
          <div className="border-t border-[#f4f4f4] pt-2 mt-2 space-y-1">
            {[
              ['NIS (3%)', record.nis], ['NHT (2%)', record.nht],
              ['Education Tax (2.25%)', record.ed_tax], ['PAYE', record.paye],
            ].map(([label, amount]) => (
              <div key={label as string} className="flex justify-between text-[13px] py-0.5">
                <span className="text-[#888]">{label as string}</span>
                <span className="text-[#c0392b]">- {fmt(amount as number)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-[#ebebeb] mt-2 pt-2 flex justify-between text-[13px]">
            <span className="text-[#888]">Total deductions</span>
            <span className="text-[#c0392b] font-semibold">- {fmt(totalDeductions)}</span>
          </div>

          {/* Adjustments */}
          <div className="border-t border-[#ebebeb] mt-3 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-[#bbb] uppercase tracking-widest">Adjustments</p>
              {!editAdj && (
                <button onClick={() => setEditAdj(true)} className="flex items-center gap-1 text-[12px] text-[#888] hover:text-[#111] transition-colors">
                  <Pencil size={11} /> Edit
                </button>
              )}
            </div>
            {editAdj ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-[10px] text-[#bbb] mb-0.5">Overage (+)</p>
                    <input type="number" min="0" value={overage} onChange={(e) => setOverage(e.target.value)}
                      className="w-full border border-[#ebebeb] rounded-lg px-3 py-1.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-[#bbb] mb-0.5">Shortage (−)</p>
                    <input type="number" min="0" value={shortage} onChange={(e) => setShortage(e.target.value)}
                      className="w-full border border-[#ebebeb] rounded-lg px-3 py-1.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111]" />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[13px] mt-1">
                  <span className="text-[#888]">Adjusted net pay</span>
                  <span className="font-semibold text-[#111]">{fmt(liveNet)}</span>
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={saveAdjustments} disabled={saving}
                    className="flex-1 bg-white border border-[#ddd] text-[#333] rounded-xl py-1.5 text-[12px] font-semibold hover:bg-[#f9f9f9] transition-colors disabled:opacity-40">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={cancelAdj}
                    className="flex-1 border border-[#ebebeb] rounded-lg py-1.5 text-[12px] font-semibold text-[#888] hover:bg-[#fafafa] transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {recOverage > 0 && (
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#888]">Overage</span>
                    <span className="text-green-600">+ {fmt(recOverage)}</span>
                  </div>
                )}
                {recShortage > 0 && (
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#888]">Shortage</span>
                    <span className="text-[#c0392b]">- {fmt(recShortage)}</span>
                  </div>
                )}
                {recOverage === 0 && recShortage === 0 && (
                  <p className="text-[12px] text-[#bbb]">No adjustments</p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-between text-[14px] font-bold mt-3 pt-3 border-t border-[#ebebeb]">
            <span className="text-[#111]">Net pay</span>
            <span className="text-[#111]">{fmt(record.net_pay)}</span>
          </div>
          <button
            onClick={() => printPaySlip(record)}
            className="mt-4 flex items-center gap-1.5 text-[12px] text-[#888] hover:text-[#111] transition-colors"
          >
            <Printer size={12} /> Print Pay Slip
          </button>
        </div>
      )}
    </div>
  )
}

// ── Deactivate Modals ─────────────────────────────────────────────────────────

type DeactivateReason = 'Suspension' | 'Vacation' | 'Special Leave' | 'Termination'

const DEACTIVATE_OPTIONS: { id: DeactivateReason; label: string; description: string; Icon: React.ElementType }[] = [
  { id: 'Suspension',    Icon: PauseCircle, label: 'Suspension',    description: 'Temporarily suspends access pending review' },
  { id: 'Vacation',      Icon: Umbrella,    label: 'Vacation',       description: 'Staff member is on approved leave' },
  { id: 'Special Leave', Icon: HeartPulse,  label: 'Special Leave',  description: 'Emergency, sick, or other special leave' },
  { id: 'Termination',   Icon: UserX,       label: 'Termination',    description: 'Permanently deactivates the staff member' },
]

function DeactivateReasonModal({
  userName,
  onSelect,
  onClose,
}: {
  userName: string
  onSelect: (reason: DeactivateReason) => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[480px] p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end mb-8">
          <button
            onClick={onClose}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            <X size={13} />
            Cancel
          </button>
        </div>

        <div className="mb-6">
          <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">Deactivate...</h2>
          <p className="text-[14px] text-[#888] font-medium">{userName} · Choose a reason</p>
        </div>

        <div className="flex flex-col gap-2">
          {DEACTIVATE_OPTIONS.map(({ id, Icon, label, description }) => (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className="flex items-center gap-4 border border-[#e8e8e8] rounded-2xl p-4 text-left hover:border-[#bbb] hover:bg-[#fafafa] transition-colors"
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                id === 'Termination' ? 'bg-red-50 text-red-500' : 'bg-[#f4f4f4] text-[#555]'
              }`}>
                <Icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[15px] font-bold ${id === 'Termination' ? 'text-red-500' : 'text-[#111]'}`}>{label}</p>
                <p className="text-[12px] text-[#888] leading-snug mt-0.5">{description}</p>
              </div>
              <ChevronRight size={16} className="text-[#ccc] shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function DeactivateDateRangeModal({
  reason,
  onConfirm,
  onBack,
  onClose,
}: {
  reason: 'Suspension' | 'Vacation'
  onConfirm: (start: string, end: string) => void
  onBack: () => void
  onClose: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [start, setStart] = useState(today)
  const [end,   setEnd]   = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    if (!end)        { setError('Select an end date.'); return }
    if (end <= start) { setError('End date must be after start date.'); return }
    onConfirm(start, end)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[480px] p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[13px] font-semibold text-[#888] hover:text-[#111] transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            <X size={13} />
            Cancel
          </button>
        </div>

        <div className="mb-8">
          <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">{reason}</h2>
          <p className="text-[14px] text-[#888] font-medium">
            Staff member will be reactivated automatically when the period ends
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">Start Date</p>
            <input
              type="date"
              value={start}
              onChange={(e) => { setStart(e.target.value); setError(null) }}
              className="w-full px-4 py-3 border border-[#e0e0e0] rounded-2xl text-[14px] font-semibold text-[#111] focus:outline-none focus:border-[#aaa] transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">End Date</p>
            <input
              type="date"
              value={end}
              min={start}
              onChange={(e) => { setEnd(e.target.value); setError(null) }}
              className="w-full px-4 py-3 border border-[#e0e0e0] rounded-2xl text-[14px] font-semibold text-[#111] focus:outline-none focus:border-[#aaa] transition-colors"
            />
          </div>
          {error && <p className="text-[12px] font-semibold text-red-500">{error}</p>}
        </div>

        <button
          onClick={handleConfirm}
          className="mt-8 w-full py-3.5 bg-[#111] text-white text-[14px] font-bold rounded-2xl hover:bg-[#333] transition-colors"
        >
          Confirm {reason}
        </button>
      </div>
    </div>
  )
}

function SpecialLeaveModal({
  onConfirm,
  onBack,
  onClose,
}: {
  onConfirm: (returnDate: string, reason: string) => void
  onBack: () => void
  onClose: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [returnDate, setReturnDate] = useState('')
  const [reason, setReason]         = useState('')
  const [error, setError]           = useState<string | null>(null)

  function handleConfirm() {
    if (!returnDate)         { setError('Select a return date.'); return }
    if (returnDate <= today) { setError('Return date must be in the future.'); return }
    if (!reason.trim())      { setError('Enter a reason for the leave.'); return }
    onConfirm(returnDate, reason.trim())
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[480px] p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[13px] font-semibold text-[#888] hover:text-[#111] transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            <X size={13} />
            Cancel
          </button>
        </div>

        <div className="mb-8">
          <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">Special Leave</h2>
          <p className="text-[14px] text-[#888] font-medium">
            Staff member will be reactivated automatically on the return date
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">Return Date</p>
            <input
              type="date"
              value={returnDate}
              min={today}
              onChange={(e) => { setReturnDate(e.target.value); setError(null) }}
              className="w-full px-4 py-3 border border-[#e0e0e0] rounded-2xl text-[14px] font-semibold text-[#111] focus:outline-none focus:border-[#aaa] transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">Reason</p>
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(null) }}
              rows={3}
              placeholder="e.g. Bereavement, medical / sick leave, family emergency…"
              className="w-full px-4 py-3 border border-[#e0e0e0] rounded-2xl text-[14px] text-[#111] placeholder:text-[#ccc] focus:outline-none focus:border-[#aaa] transition-colors resize-none"
            />
          </div>
          {error && <p className="text-[12px] font-semibold text-red-500">{error}</p>}
        </div>

        <button
          onClick={handleConfirm}
          className="mt-8 w-full py-3.5 bg-[#111] text-white text-[14px] font-bold rounded-2xl hover:bg-[#333] transition-colors"
        >
          Confirm Special Leave
        </button>
      </div>
    </div>
  )
}

// ── Employee View ─────────────────────────────────────────────────────────────

function EmployeeView({ user, onBack }: { user: User; onBack: () => void }) {
  const { data: records = [], isLoading }       = useUserPayroll(user.id)
  const { data: periods = [] }                  = usePayrollPeriods()
  const { data: attendance = [], isLoading: isLoadingAttendance } = useUserAttendance(user.id)
  const { data: allUsers = [] }                 = useUsers()
  const qc                                = useQueryClient()
  const [showPayModal,        setShowPayModal]        = useState(false)
  const [showPeriodModal,     setShowPeriodModal]     = useState(false)
  const [showEditModal,       setShowEditModal]       = useState(false)
  const [showSickDayModal,    setShowSickDayModal]    = useState(false)
  const [profileMenuOpen,     setProfileMenuOpen]     = useState(false)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)
  const [deactivateReason,    setDeactivateReason]    = useState<'Suspension' | 'Vacation' | null>(null)
  const [showSpecialLeave,    setShowSpecialLeave]    = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) setProfileMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])
  const [fromDate, setFromDate]       = useState('')
  const [toDate, setToDate]           = useState('')
  const [showGenerate, setShowGenerate] = useState(false)

  // Auto-reactivate when reactivate_on date has passed
  useEffect(() => {
    if (!user.active && user.reactivate_on) {
      const today = new Date().toISOString().slice(0, 10)
      if (today >= user.reactivate_on) {
        updateUser(user.id, { active: true, set_deactivation: true, reactivate_on: null, deactivation_reason: null, deactivation_note: null })
          .then(() => qc.invalidateQueries({ queryKey: ['users'] }))
      }
    }
  }, [user.id, user.active, user.reactivate_on, qc])

  async function handleActivate() {
    await updateUser(user.id, { active: true, set_deactivation: true, reactivate_on: null, deactivation_reason: null, deactivation_note: null })
    await qc.invalidateQueries({ queryKey: ['users'] })
    setProfileMenuOpen(false)
    onBack()
  }

  async function handleTerminate() {
    await updateUser(user.id, { active: false, set_deactivation: true, deactivation_reason: 'Termination', reactivate_on: null, deactivation_note: null })
    await qc.invalidateQueries({ queryKey: ['users'] })
    setShowDeactivateModal(false)
    onBack()
  }

  async function handleDeactivateWithDates(start: string, end: string) {
    void start
    await updateUser(user.id, {
      active: false,
      set_deactivation: true,
      deactivation_reason: deactivateReason!,
      reactivate_on: end,
      deactivation_note: null,
    })
    await qc.invalidateQueries({ queryKey: ['users'] })
    setDeactivateReason(null)
    setShowDeactivateModal(false)
    onBack()
  }

  async function handleSpecialLeave(returnDate: string, reason: string) {
    await updateUser(user.id, {
      active: false,
      set_deactivation: true,
      deactivation_reason: 'Special Leave',
      reactivate_on: returnDate,
      deactivation_note: reason,
    })
    await qc.invalidateQueries({ queryKey: ['users'] })
    setShowSpecialLeave(false)
    setShowDeactivateModal(false)
    onBack()
  }

  const ranked = [...allUsers]
    .filter(u => u.active && u.latest_net_pay != null)
    .sort((a, b) => (b.latest_net_pay ?? 0) - (a.latest_net_pay ?? 0))
  const rankIdx = ranked.findIndex(u => u.id === user.id)
  const leaderboardValue = rankIdx >= 0 ? `#${rankIdx + 1} of ${ranked.length}` : '—'

  const profile = [
    { label: 'Email',       value: user.email || '—' },
    { label: 'Phone',       value: user.phone || '—' },
    { label: 'NIS #',       value: user.nis || '—' },
    { label: 'TRN #',       value: user.trn || '—' },
    { label: 'Employed On', value: fmtDate(user.employed_on) },
    { label: 'Sick Days',   value: user.sick_days != null ? `${user.sick_days} day${user.sick_days !== 1 ? 's' : ''}` : '—' },
    { label: 'Leaderboard', value: leaderboardValue },
  ]

  return (
    <div className="flex h-full overflow-hidden">

      {/* Left: profile */}
      <div className="w-[520px] shrink-0 border-r border-[#e8e8e8] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="flex items-center gap-2 text-[13px] text-[#888] hover:text-[#111] transition-colors">
            <ArrowLeft size={14} /> Go back
          </button>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setShowGenerate((v) => !v)}
                className="flex items-center gap-1.5 px-5 py-2.5 border border-[#ddd] rounded-xl text-[13px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors"
              >
                <Sparkles size={13} /> Generate
              </button>
              {showGenerate && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-[#e0e0e0] rounded-xl shadow-lg py-1 min-w-[140px] z-20">
                  <button
                    onClick={() => { records[0] && printPaySlip(records[0]); setShowGenerate(false) }}
                    disabled={records.length === 0}
                    className="w-full text-left px-4 py-2 text-[13px] font-semibold text-[#333] hover:bg-[#f9f9f9] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Payroll
                  </button>
                  <button
                    onClick={() => { printJobLetter(user); setShowGenerate(false) }}
                    className="w-full text-left px-4 py-2 text-[13px] font-semibold text-[#333] hover:bg-[#f9f9f9]"
                  >
                    Job Letter
                  </button>
                </div>
              )}
            </div>
            <div ref={profileMenuRef} className="relative">
              <button
                onClick={() => setProfileMenuOpen((o) => !o)}
                className="w-8 h-8 flex items-center justify-center border border-[#ddd] rounded-xl text-[#555] hover:bg-[#f9f9f9] transition-colors"
              >
                <MoreHorizontal size={15} />
              </button>
              {profileMenuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-[#e0e0e0] rounded-xl shadow-lg py-1 min-w-[150px] z-20">
                  <button
                    onClick={() => { setShowEditModal(true); setProfileMenuOpen(false) }}
                    className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { setShowSickDayModal(true); setProfileMenuOpen(false) }}
                    className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors"
                  >
                    Log sick day
                  </button>
                  <button
                    onClick={() => {
                      setProfileMenuOpen(false)
                      user.active ? setShowDeactivateModal(true) : handleActivate()
                    }}
                    className={`w-full text-left px-4 py-2.5 text-[13px] font-semibold transition-colors ${user.active ? 'text-red-500 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                  >
                    {user.active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-full bg-[#111] text-white flex items-center justify-center text-[20px] font-bold shrink-0 mb-3">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-[20px] font-bold text-[#111]">{user.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${userStatusBadgeClass(user)}`}>
              {userStatusLabel(user)}
            </span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${roleBadgeColor(user.role)}`}>{user.role}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden">
          {profile.map(({ label, value }) => (
            <div key={label} className="flex items-center px-5 py-3 border-b border-[#f4f4f4]">
              <span className="text-[12px] text-[#999] w-28 shrink-0">{label}</span>
              <span className="text-[13px] text-[#111]">{value}</span>
            </div>
          ))}
          <div className="flex items-center px-5 py-3">
            <span className="text-[12px] text-[#999] w-28 shrink-0">Base Pay</span>
            <span className="text-[13px] text-[#111] flex-1">
              {user.pay_rate != null && user.pay_type
                ? `${fmt(user.pay_rate)} / ${user.pay_type === 'Hourly' ? 'hr' : 'month'}`
                : <span className="text-[#bbb]">Not set</span>}
            </span>
            <button onClick={() => setShowPayModal(true)}
              className="flex items-center gap-1 text-[12px] text-[#888] hover:text-[#111] transition-colors">
              <Pencil size={12} /> Edit
            </button>
          </div>
          <div className="flex items-center px-5 py-3">
            <span className="text-[12px] text-[#999] w-28 shrink-0">Overtime Rate</span>
            <span className="text-[13px] text-[#111] flex-1">
              {user.overtime_rate != null
                ? `${fmt(user.overtime_rate)} / hr`
                : <span className="text-[#bbb]">Not set</span>}
            </span>
          </div>
        </div>
      </div>

      {/* Right: payroll + attendance */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Payroll History */}
        <div className="flex-1 overflow-y-auto p-5 border-b border-[#e8e8e8] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <p>
              <span className="text-[13px] font-bold text-[#111]">Payroll</span>
              <span className="text-[13px] font-medium text-[#aaa]"> | History</span>
            </p>
            <div className="flex items-center gap-2">
              <input
                type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="text-[13px] text-[#666] border border-[#ebebeb] rounded-xl px-3 py-2 focus:outline-none focus:border-[#111]"
              />
              <span className="text-[13px] text-[#ccc]">–</span>
              <input
                type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="text-[13px] text-[#666] border border-[#ebebeb] rounded-xl px-3 py-2 focus:outline-none focus:border-[#111]"
              />
            </div>
          </div>
          <div className="flex-1">
            {isLoading ? (
              <div className="py-6 flex items-center justify-center"><LogoLoader /></div>
            ) : records.filter((r) =>
                (!fromDate || r.period_start_date >= fromDate) &&
                (!toDate   || r.period_end_date   <= toDate)
              ).length === 0 ? (
              <div className="py-4 flex items-center justify-center">
                <p className="text-[13px] font-medium text-[#bbb]">
                  {periods.length === 0
                    ? 'No payroll periods yet'
                    : user.pay_rate == null
                    ? 'No pay rate set'
                    : 'No records found'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 mb-3">
                {records.filter((r) =>
                  (!fromDate || r.period_start_date >= fromDate) &&
                  (!toDate   || r.period_end_date   <= toDate)
                ).map((r) => (
                  <div key={r.id}>
                    <RecordCard record={r} />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-[#f0f0f0] pt-3">
            <button onClick={() => setShowPeriodModal(true)}
              className="flex items-center gap-1 text-[12px] font-semibold text-[#888] hover:text-[#111] transition-colors">
              <Plus size={12} /> Run Payroll
            </button>
            {(() => { const n = records.filter((r) => (!fromDate || r.period_start_date >= fromDate) && (!toDate || r.period_end_date <= toDate)).length; return <p className="text-[13px] font-bold text-[#bbb]">{n} record{n !== 1 ? 's' : ''}</p> })()}
          </div>
        </div>

        {/* Attendance */}
        <div className="flex-1 overflow-hidden p-5 flex flex-col">
          <p className="mb-4">
            <span className="text-[13px] font-bold text-[#111]">Attendance</span>
            <span className="text-[13px] font-medium text-[#aaa]"> | History</span>
          </p>
          <div className="flex-1 overflow-y-auto">
            {isLoadingAttendance ? (
              <div className="py-6 flex items-center justify-center"><LogoLoader /></div>
            ) : attendance.length === 0 ? (
              <div className="py-4 flex items-center justify-center">
                <p className="text-[13px] font-medium text-[#bbb]">No attendance records yet</p>
              </div>
            ) : (() => {
              const fmt2 = (d: Date) => d.toLocaleTimeString('en-JM', { hour: '2-digit', minute: '2-digit' })
              const fmtD = (s: string) => new Date(s).toLocaleDateString('en-JM', { month: 'short', day: 'numeric', year: 'numeric' })
              const grouped = attendance.reduce<Record<string, typeof attendance>>((acc, a) => {
                const key = a.shift_date ?? a.clock_in.slice(0, 10)
                ;(acc[key] ??= []).push(a)
                return acc
              }, {})
              return (
                <div className="flex flex-col mb-3">
                  {Object.entries(grouped).map(([date, entries]) => (
                    <div key={date}>
                      <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase py-2">{fmtD(date)}</p>
                      {entries.map((a) => {
                        const clockIn  = new Date(a.clock_in)
                        const clockOut = a.clock_out ? new Date(a.clock_out) : null
                        const mins     = clockOut ? Math.round((clockOut.getTime() - clockIn.getTime()) / 60000) : null
                        const duration = mins != null ? `${Math.floor(mins / 60)}h ${mins % 60}m` : null
                        return (
                          <div key={a.id} className="flex items-center justify-between py-1.5 pl-2">
                            <p className="text-[12px] text-[#666]">
                              {fmt2(clockIn)} – {clockOut ? fmt2(clockOut) : 'ongoing'}
                              {a.pump_name ? ` · ${a.pump_name}` : ''}
                            </p>
                            {duration && <p className="text-[13px] font-semibold text-[#333]">{duration}</p>}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
          <div className="flex items-center justify-end border-t border-[#f0f0f0] pt-3">
            <p className="text-[13px] font-bold text-[#bbb]">{attendance.length} shift{attendance.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

      </div>

      {showEditModal    && <EditEmployeeModal user={user} onClose={() => setShowEditModal(false)} />}
      {showPayModal     && <EditPayModal user={user} onClose={() => setShowPayModal(false)} />}
      {showPeriodModal  && <NewPeriodModal onClose={() => setShowPeriodModal(false)} />}
      {showSickDayModal && <LogSickDayModal user={user} onClose={() => setShowSickDayModal(false)} />}

      {showDeactivateModal && !deactivateReason && !showSpecialLeave && (
        <DeactivateReasonModal
          userName={user.name}
          onSelect={(reason) => {
            if (reason === 'Termination') {
              handleTerminate()
            } else if (reason === 'Special Leave') {
              setShowSpecialLeave(true)
            } else {
              setDeactivateReason(reason)
            }
          }}
          onClose={() => setShowDeactivateModal(false)}
        />
      )}
      {showDeactivateModal && deactivateReason && (
        <DeactivateDateRangeModal
          reason={deactivateReason}
          onConfirm={handleDeactivateWithDates}
          onBack={() => setDeactivateReason(null)}
          onClose={() => { setShowDeactivateModal(false); setDeactivateReason(null) }}
        />
      )}
      {showDeactivateModal && showSpecialLeave && (
        <SpecialLeaveModal
          onConfirm={handleSpecialLeave}
          onBack={() => setShowSpecialLeave(false)}
          onClose={() => { setShowDeactivateModal(false); setShowSpecialLeave(false) }}
        />
      )}
    </div>
  )
}

// ── Period Overview ───────────────────────────────────────────────────────────

function PeriodStaffRow({ record: r, active, onSelect, isDraft, onDelete }: { record: PayrollRecord; active: boolean; onSelect: () => void; isDraft: boolean; onDelete: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [menuOpen])

  const itemCls = 'w-full text-left px-3 py-2 text-[12px] font-semibold rounded-lg transition-colors hover:bg-[#f4f4f4] text-[#111]'

  return (
    <div className={`flex items-center gap-2 px-4 py-3.5 border-b border-[#f8f8f8] last:border-0 transition-colors ${active ? 'bg-[#f4f4f4]' : 'hover:bg-[#fafafa]'}`}>
      {/* Selectable area */}
      <button onClick={onSelect} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#111] truncate">{r.user_name}</p>
          <p className="text-[11px] text-[#999] truncate">{r.user_role}</p>
        </div>
      </button>

      <p className="text-[12px] font-semibold text-[#444] shrink-0">{fmt(r.net_pay)}</p>

      {/* Kebab menu */}
      <div ref={menuRef} className="relative shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o) }}
          className="w-5 h-5 flex items-center justify-center text-[#ccc] hover:text-[#555] transition-colors rounded"
        >
          <MoreHorizontal size={13} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-6 z-20 bg-white border border-[#ebebeb] rounded-xl shadow-lg py-1.5 w-36 flex flex-col">
            <button className={itemCls} onClick={() => { setMenuOpen(false); printPaySlip(r) }}>
              Print Pay Slip
            </button>
            <button className={itemCls} onClick={() => { setMenuOpen(false); onSelect() }}>
              View Calculations
            </button>
            {isDraft && (
              <button className="w-full text-left px-3 py-2 text-[12px] font-semibold rounded-lg transition-colors hover:bg-red-50 text-red-500" onClick={() => { setMenuOpen(false); onDelete() }}>
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function PeriodPayDetail({ record, isDraft }: { record: PayrollRecord; isDraft: boolean }) {
  const qc                              = useQueryClient()
  const [editAdj, setEditAdj]           = useState(false)
  const [overage, setOverage]           = useState((record.overage ?? 0).toString())
  const [shortage, setShortage]         = useState((record.shortage ?? 0).toString())
  const [saving, setSaving]             = useState(false)

  // Reset local state when the record changes
  useEffect(() => {
    setOverage((record.overage ?? 0).toString())
    setShortage((record.shortage ?? 0).toString())
    setEditAdj(false)
  }, [record.id, record.overage, record.shortage])

  const totalDeductions = record.nis + record.nht + record.ed_tax + record.paye
  const recOverage      = record.overage  ?? 0
  const recShortage     = record.shortage ?? 0
  const liveNet         = record.gross_pay - totalDeductions + (parseFloat(overage) || 0) - (parseFloat(shortage) || 0)

  async function saveAdjustments() {
    setSaving(true)
    try {
      await api.patch(`/payroll/periods/${record.period_id}/records/${record.id}`, {
        overage:  parseFloat(overage)  || 0,
        shortage: parseFloat(shortage) || 0,
      })
      await qc.invalidateQueries({ queryKey: ['payroll-records', record.period_id] })
      await qc.invalidateQueries({ queryKey: ['user-payroll', record.user_id] })
      await qc.invalidateQueries({ queryKey: ['users'] })
      setEditAdj(false)
    } finally {
      setSaving(false)
    }
  }

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-center justify-between py-1.5 border-b border-[#f4f4f4] last:border-b-0">
      <span className="text-[13px] text-[#888]">{label}</span>
      <span className="text-[13px] font-semibold text-[#111]">{value}</span>
    </div>
  )

  return (
    <div className="p-6 flex flex-col gap-8">
      {/* Name */}
      <div>
        <p className="text-[15px] font-bold text-[#111]">{record.user_name}</p>
        <p className="text-[12px] text-[#999]">{record.user_role}</p>
      </div>

      {/* Earnings */}
      <div>
        <p className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase mb-2">Earnings</p>
        {record.hours_worked != null && row('Worked', `${record.hours_worked.toFixed(2)} hrs`)}
        {row('Gross Pay', fmt(record.gross_pay))}
      </div>

      {/* Deductions */}
      <div>
        <p className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase mb-2">Deductions</p>
        {[
          ['NIS (3%)',              record.nis],
          ['NHT (2%)',              record.nht],
          ['Education Tax (2.25%)', record.ed_tax],
          ['PAYE',                  record.paye],
        ].map(([label, amount]) => (
          <div key={label as string} className="flex items-center justify-between py-1.5 border-b border-[#f4f4f4]">
            <span className="text-[13px] text-[#888]">{label as string}</span>
            <span className="text-[13px] font-semibold text-red-500">− {fmt(amount as number)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-[13px] font-semibold text-[#555]">Total</span>
          <span className="text-[13px] font-bold text-red-500">− {fmt(totalDeductions)}</span>
        </div>
      </div>

      {/* Adjustments */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase">Adjustments</p>
          {isDraft && !editAdj && (
            <button onClick={() => setEditAdj(true)} className="flex items-center gap-1 text-[11px] text-[#888] hover:text-[#111] transition-colors">
              <Pencil size={10} /> Edit
            </button>
          )}
        </div>
        {editAdj ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <p className="text-[10px] text-[#bbb] mb-1">Overage (+)</p>
                <input type="number" min="0" value={overage} onChange={(e) => setOverage(e.target.value)}
                  className="w-full border border-[#ebebeb] rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:border-[#111]" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-[#bbb] mb-1">Shortage (−)</p>
                <input type="number" min="0" value={shortage} onChange={(e) => setShortage(e.target.value)}
                  className="w-full border border-[#ebebeb] rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:border-[#111]" />
              </div>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[13px] text-[#888]">Adjusted net pay</span>
              <span className="text-[13px] font-bold text-[#111]">{fmt(liveNet)}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={saveAdjustments} disabled={saving}
                className="flex-1 bg-[#111] text-white rounded-xl py-2 text-[12px] font-semibold hover:bg-[#222] transition-colors disabled:opacity-40">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setOverage((record.overage ?? 0).toString()); setShortage((record.shortage ?? 0).toString()); setEditAdj(false) }}
                className="flex-1 border border-[#ebebeb] rounded-xl py-2 text-[12px] font-semibold text-[#888] hover:bg-[#fafafa] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {recOverage  > 0 && row('Overage',  <span className="text-green-600">+ {fmt(recOverage)}</span>)}
            {recShortage > 0 && row('Shortage', <span className="text-red-500">− {fmt(recShortage)}</span>)}
            {recOverage === 0 && recShortage === 0 && (
              <p className="text-[12px] text-[#ccc]">No adjustments</p>
            )}
          </>
        )}
      </div>

      {/* Net pay */}
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-[#111]">Net Pay</span>
        <span className="text-[18px] font-black text-[#111] leading-none">{fmt(record.net_pay)}</span>
      </div>

      {/* Print */}
      <button onClick={() => printPaySlip(record)}
        className="flex items-center gap-1.5 text-[12px] text-[#888] hover:text-[#111] transition-colors self-start">
        <Printer size={12} /> Print Pay Slip
      </button>
    </div>
  )
}

function PeriodOverview({ period, onBack }: { period: PayrollPeriod; onBack: () => void }) {
  const { data: records = [], isLoading } = usePayrollRecords(period.id)
  const { data: users = [] }              = useUsers()
  const qc                                = useQueryClient()
  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [showAddModal, setShowAddModal]   = useState(false)

  async function handleRemoveEmployee(userId: string) {
    const remaining = records.filter((r) => r.user_id !== userId).map((r) => r.user_id)
    await api.patch(`/payroll/periods/${period.id}`, {
      start_date: period.start_date,
      end_date:   period.end_date,
      user_ids:   remaining,
    })
    await qc.invalidateQueries({ queryKey: ['payroll-records', period.id] })
    if (selectedId === records.find((r) => r.user_id === userId)?.id) setSelectedId(null)
  }

  const selected = records.find((r) => r.id === selectedId) ?? records[0] ?? null

  // Auto-select first record once loaded
  useEffect(() => {
    if (records.length > 0 && !selectedId) setSelectedId(records[0].id)
  }, [records, selectedId])

  const totalGross      = records.reduce((s, r) => s + r.gross_pay, 0)
  const totalDeductions = records.reduce((s, r) => s + r.nis + r.nht + r.ed_tax + r.paye, 0)
  const totalNet        = records.reduce((s, r) => s + r.net_pay, 0)
  const isDraft         = period.status === 'Draft'

  async function handlePublish() {
    await api.patch(`/payroll/periods/${period.id}/publish`)
    await qc.invalidateQueries({ queryKey: ['payroll-periods'] })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebebeb] flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-[#888] hover:text-[#111] transition-colors">
            <ArrowLeft size={14} /> Back
          </button>
          <div className="w-px h-4 bg-[#ebebeb]" />
          <div>
            <h2 className="text-[16px] font-bold text-[#111] leading-tight">
              {fmtDate(period.start_date)} – {fmtDate(period.end_date)}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {records.length > 0 && (
            <>
              <button onClick={() => printPayrollRegister(period, records)}
                className="flex items-center gap-1.5 px-3 py-2 border border-[#ebebeb] rounded-xl text-[12px] font-semibold text-[#555] hover:bg-[#fafafa] transition-colors">
                <Printer size={12} /> Register
              </button>
              <button onClick={() => downloadS01CSV(period, records, users)}
                className="flex items-center gap-1.5 px-3 py-2 border border-[#ebebeb] rounded-xl text-[12px] font-semibold text-[#555] hover:bg-[#fafafa] transition-colors">
                <Download size={12} /> S01
              </button>
              <button onClick={() => downloadHeartCSV(period, records)}
                className="flex items-center gap-1.5 px-3 py-2 border border-[#ebebeb] rounded-xl text-[12px] font-semibold text-[#555] hover:bg-[#fafafa] transition-colors">
                <Download size={12} /> HEART
              </button>
            </>
          )}
          {isDraft ? (
            <button onClick={handlePublish}
              className="px-4 py-2 bg-white border border-[#ddd] text-[#333] text-[12px] font-semibold rounded-xl hover:bg-[#f9f9f9] transition-colors">
              Publish
            </button>
          ) : (
            <span className="px-3 py-1 bg-[#d1e7dd] text-[#0a5435] text-[11px] font-bold rounded-full">Published</span>
          )}
        </div>
      </div>

      {/* Summary strip */}
      {records.length > 0 && (
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#ebebeb] flex-shrink-0 bg-[#fafafa]">
          {isDraft ? (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 text-[12px] font-semibold text-[#888] hover:text-[#111] transition-colors"
            >
              <Plus size={12} /> Add an employee
            </button>
          ) : <span />}
          <div className="flex items-center gap-6">
            {[
              { label: 'Total Gross',      value: totalGross },
              { label: 'Total Deductions', value: totalDeductions },
              { label: 'Total Net Pay',    value: totalNet },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-[11px] text-[#aaa] font-medium">{label}</span>
                <span className="text-[13px] font-bold text-[#111]">{fmt(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center"><LogoLoader /></div>
      ) : records.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] text-[#bbb]">No records for this period.</p>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">

          {/* Left — staff list */}
          <div className="w-64 shrink-0 border-r border-[#ebebeb] flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {records.map((r) => {
                const active = r.id === (selected?.id)
                return (
                  <PeriodStaffRow
                    key={r.id}
                    record={r}
                    active={active}
                    isDraft={isDraft}
                    onSelect={() => setSelectedId(r.id)}
                    onDelete={() => handleRemoveEmployee(r.user_id)}
                  />
                )
              })}
            </div>
          </div>

          {/* Right — pay calculations */}
          <div className="flex-1 overflow-y-auto">
            {selected
              ? <PeriodPayDetail key={selected.id} record={selected} isDraft={isDraft} />
              : <div className="h-full flex items-center justify-center"><p className="text-[13px] text-[#ccc]">Select a staff member</p></div>
            }
          </div>

        </div>
      )}

      {showAddModal && (
        <AddToPeriodModal
          period={period}
          existingUserIds={records.map((r) => r.user_id)}
          onClose={() => setShowAddModal(false)}
          onAdded={async (userId) => {
            // Patch period with merged user list
            const all = [...records.map((r) => r.user_id), userId]
            await api.patch(`/payroll/periods/${period.id}`, {
              start_date: period.start_date,
              end_date:   period.end_date,
              user_ids:   all,
            })
            await qc.invalidateQueries({ queryKey: ['payroll-records', period.id] })
            setShowAddModal(false)
          }}
        />
      )}
    </div>
  )
}

function AddToPeriodModal({
  period,
  existingUserIds,
  onClose,
  onAdded,
}: {
  period: PayrollPeriod
  existingUserIds: string[]
  onClose: () => void
  onAdded: (userId: string) => Promise<void>
}) {
  const { data: allUsers = [] } = useUsers()
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(false)

  const eligible = allUsers.filter(
    (u) => u.active && u.pay_rate != null && u.pay_type != null && !existingUserIds.includes(u.id)
  )
  const filtered = search.trim()
    ? eligible.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || (u.role as string).toLowerCase().includes(search.toLowerCase()))
    : eligible

  async function pick(userId: string) {
    setLoading(true)
    try { await onAdded(userId) } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-[400px] shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h3 className="text-[16px] font-bold text-[#111]">Add an employee</h3>
          <button onClick={onClose} className="text-[#bbb] hover:text-[#555] transition-colors"><X size={16} /></button>
        </div>

        <div className="px-6 pb-3">
          <div className="flex items-center gap-2 px-3 py-2 border border-[#ebebeb] rounded-xl">
            <Search size={13} className="text-[#bbb] shrink-0" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or role…"
              className="flex-1 text-[12px] text-[#111] placeholder-[#ccc] outline-none bg-transparent"
            />
            {search && <button onClick={() => setSearch('')} className="text-[#bbb] hover:text-[#555]"><X size={12} /></button>}
          </div>
        </div>

        <div className="max-h-[320px] overflow-y-auto border-t border-[#f0f0f0] pb-4">
          {filtered.length === 0 ? (
            <div className="py-10 flex items-center justify-center">
              <p className="text-[12px] font-medium text-[#ccc]">
                {eligible.length === 0 ? 'All eligible staff are already in this period' : 'No matches'}
              </p>
            </div>
          ) : (
            filtered.map((u) => (
              <button
                key={u.id}
                disabled={loading}
                onClick={() => pick(u.id)}
                className="w-full flex items-center justify-between px-6 py-3 border-b border-[#f8f8f8] last:border-0 hover:bg-[#fafafa] transition-colors text-left disabled:opacity-40"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#111] truncate">{u.name}</p>
                  <p className="text-[11px] text-[#aaa]">{u.role as string}</p>
                </div>
                <p className="text-[12px] font-semibold text-[#888] shrink-0 ml-3">
                  ${u.pay_rate!.toLocaleString('en-JM', { minimumFractionDigits: 2 })}/{u.pay_type === 'Hourly' ? 'hr' : 'mo'}
                </p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── Period row dropdown ───────────────────────────────────────────────────────

function PeriodRowMenu({
  period,
  onView,
  onEdit,
  onDelete,
}: {
  period: PayrollPeriod
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const itemCls = 'w-full text-left px-3 py-2 text-[12px] font-semibold rounded-lg transition-colors hover:bg-[#f4f4f4]'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        className="w-5 h-5 flex items-center justify-center text-[#ccc] hover:text-[#555] transition-colors rounded"
      >
        <MoreHorizontal size={13} />
      </button>

      {open && (
        <div className="absolute right-0 top-6 z-20 bg-white border border-[#ebebeb] rounded-xl shadow-lg py-1.5 w-36 flex flex-col">
          <button className={`${itemCls} text-[#111]`} onClick={() => { setOpen(false); onView() }}>
            View
          </button>
          <button className={`${itemCls} text-[#111]`} onClick={() => { setOpen(false); onEdit() }}>
            Edit
          </button>
          {period.status === 'Draft' && (
            <button className={`${itemCls} text-red-500`} onClick={() => { setOpen(false); onDelete() }}>
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Edit Period Modal ─────────────────────────────────────────────────────────

function EditPeriodModal({ period, onClose }: { period: PayrollPeriod; onClose: () => void }) {
  const qc                        = useQueryClient()
  const [startDate, setStartDate] = useState(period.start_date)
  const [endDate, setEndDate]     = useState(period.end_date)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.patch(`/payroll/periods/${period.id}`, { start_date: startDate, end_date: endDate })
      await qc.invalidateQueries({ queryKey: ['payroll-periods'] })
      await qc.invalidateQueries({ queryKey: ['payroll-records', period.id] })
      await qc.invalidateQueries({ queryKey: ['user-payroll'] })
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
      <div className="bg-white rounded-3xl w-full max-w-[400px] p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-[18px] font-bold text-[#111]">Edit Pay Period</h3>
            <p className="text-[12px] text-[#aaa] mt-0.5">Payroll records will be recalculated.</p>
          </div>
          <button onClick={onClose} className="text-[#bbb] hover:text-[#555] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {[
            { label: 'Start Date', value: startDate, set: setStartDate },
            { label: 'End Date',   value: endDate,   set: setEndDate   },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="block text-[11px] font-semibold text-[#888] mb-1.5 uppercase tracking-widest">{label}</label>
              <input type="date" value={value} onChange={(e) => set(e.target.value)} required
                className="w-full border border-[#ebebeb] rounded-xl px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111]" />
            </div>
          ))}
          {error && <p className="text-[12px] text-red-500">{error}</p>}
          <button type="submit" disabled={loading || !startDate || !endDate || endDate <= startDate}
            className="w-full bg-[#111] text-white rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#222] transition-colors disabled:opacity-30 disabled:pointer-events-none mt-2">
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Payroll Panel ─────────────────────────────────────────────────────────────

function PayrollPanel({ onSelectPeriod }: { onSelectPeriod: (p: PayrollPeriod) => void }) {
  const qc                                    = useQueryClient()
  const { data: periods = [], isLoading }     = usePayrollPeriods()
  const [showModal, setShowModal]             = useState(false)
  const [editPeriod, setEditPeriod]           = useState<PayrollPeriod | null>(null)
  const [deletingId, setDeletingId]           = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading]     = useState(false)

  async function handleDelete(id: string) {
    setDeleteLoading(true)
    try {
      await api.delete(`/payroll/periods/${id}`)
      await qc.invalidateQueries({ queryKey: ['payroll-periods'] })
    } catch {
      // silently ignore
    } finally {
      setDeleteLoading(false)
      setDeletingId(null)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-5 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4">
          <p>
            <span className="text-[13px] font-bold text-[#111]">Payroll</span>
            <span className="text-[13px] font-medium text-[#aaa]"> | Periods</span>
          </p>
        </div>

        <div className="grid grid-cols-[20px_1fr_auto_20px] gap-2 mb-2">
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">#</p>
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">Period</p>
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase text-right">Status</p>
          <span />
        </div>

        {isLoading ? (
          <div className="py-6 flex items-center justify-center">
            <LogoLoader />
          </div>
        ) : periods.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[13px] font-medium text-[#bbb]">No payroll periods yet</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {periods.map((p, i) => (
              <div
                key={p.id}
                className="grid grid-cols-[20px_1fr_auto_20px] gap-2 items-center py-2.5 border-b border-[#f8f8f8] last:border-0 -mx-1 px-1"
              >
                <p className="text-[11px] font-bold text-[#ccc] shrink-0">{i + 1}</p>
                <button
                  onClick={() => onSelectPeriod(p)}
                  className="min-w-0 text-left hover:opacity-70 transition-opacity"
                >
                  <p className="text-[13px] font-semibold text-[#111] truncate">
                    {fmtDate(p.start_date)} – {fmtDate(p.end_date)}
                  </p>
                </button>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  p.status === 'Published' ? 'bg-[#d1e7dd] text-[#0a5435]' : 'bg-[#f0f0f0] text-[#555]'
                }`}>
                  {p.status}
                </span>
                <PeriodRowMenu
                  period={p}
                  onView={() => onSelectPeriod(p)}
                  onEdit={() => setEditPeriod(p)}
                  onDelete={() => setDeletingId(p.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[#f0f0f0] px-5 py-3">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1 text-[12px] font-semibold text-[#888] hover:text-[#111] transition-colors"
        >
          <Plus size={12} /> New
        </button>
        <p className="text-[13px] font-bold text-[#bbb]">{periods.length} period{periods.length !== 1 ? 's' : ''}</p>
      </div>

      {showModal  && <NewPeriodModal onClose={() => setShowModal(false)} />}
      {editPeriod && <EditPeriodModal period={editPeriod} onClose={() => setEditPeriod(null)} />}

      {/* Delete confirmation */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm" onClick={() => setDeletingId(null)}>
          <div className="bg-white rounded-3xl w-full max-w-[360px] p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[18px] font-bold text-[#111] mb-2">Delete pay period?</h3>
            <p className="text-[13px] text-[#888] mb-6">This will permanently delete the period and all its payroll records. This can't be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingId(null)}
                className="flex-1 border border-[#ddd] rounded-xl py-2.5 text-[13px] font-semibold text-[#555] hover:bg-[#f9f9f9] transition-colors">
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                disabled={deleteLoading}
                className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-[13px] font-semibold hover:bg-red-600 transition-colors disabled:opacity-40"
              >
                {deleteLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Staff Table ───────────────────────────────────────────────────────────────

function StaffRow({ user: u, onSelect, dimmed = false }: { user: User; onSelect: (u: User) => void; dimmed?: boolean }) {
  return (
    <button onClick={() => onSelect(u)}
      className={`w-full grid grid-cols-[2fr_1fr_2fr_1fr_1fr_1fr_32px] gap-4 items-center px-5 py-3.5 border-b border-[#f8f8f8] hover:bg-[#fafafa] transition-colors text-left ${dimmed ? 'opacity-50' : ''}`}>
      <div className="min-w-0 flex items-center gap-2">
        <p className="text-[13px] text-[#111] truncate">{u.name}</p>
        {!u.active && (
          <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${userStatusBadgeClass(u)}`}>
            {userStatusLabel(u)}
          </span>
        )}
      </div>
      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit ${roleBadgeColor(u.role)}`}>{u.role}</span>
      <p className="text-[13px] text-[#666] truncate">{u.email || '—'}</p>
      <p className="text-[13px] text-[#666]">{u.sick_days != null ? `${u.sick_days}d` : '—'}</p>
      <p className="text-[13px] text-[#666]">{u.sick_days_used != null ? `${u.sick_days_used}d` : '—'}</p>
      <p className="text-[13px] text-[#666]">{!dimmed && u.latest_net_pay != null ? fmt(u.latest_net_pay) : '—'}</p>
      <ChevronRight size={14} className="text-[#ccc]" />
    </button>
  )
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="px-5 py-2 bg-[#fafafa] border-t border-b border-[#f0f0f0]">
      <p className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase">{label}</p>
    </div>
  )
}

// ── Weekly overage / shortage cards ──────────────────────────────────────────

function isoDate(d: Date) { return d.toISOString().slice(0, 10) }

function WeeklySummaryCards() {
  const today = new Date()
  const sunday = new Date(today)
  sunday.setDate(today.getDate() - today.getDay()) // rewind to Sunday

  const start = isoDate(sunday)
  const end   = isoDate(today)

  const { data: shifts = [] } = useShiftsInRange(start, end)

  const { totalOverage, totalShortage } = useMemo(() => {
    let overage = 0, shortage = 0
    try {
      const stored: Record<string, Record<string, { overage: number; shortage: number }>> =
        JSON.parse(localStorage.getItem('ss_attendant_overages') ?? '{}')
      for (const shift of shifts) {
        const shiftData = stored[shift.id]
        if (!shiftData) continue
        for (const att of Object.values(shiftData)) {
          overage  += att.overage  ?? 0
          shortage += att.shortage ?? 0
        }
      }
    } catch {}
    return { totalOverage: overage, totalShortage: shortage }
  }, [shifts])

  const fmtAmt = (n: number) => `J$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

  return (
    <div className="grid grid-cols-2 gap-3 shrink-0">
      <div className={`rounded-2xl border p-4 ${totalOverage > 0 ? 'bg-green-50 border-green-200' : 'bg-white border-[#ebebeb]'}`}>
        <p className="text-[11px] text-[#999] mb-1">Overages <span className="text-[#bbb]">| Week (current)</span></p>
        <p className={`text-[15px] font-bold ${totalOverage > 0 ? 'text-green-700' : 'text-[#bbb]'}`}>{fmtAmt(totalOverage)}</p>
      </div>
      <div className={`rounded-2xl border p-4 ${totalShortage > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-[#ebebeb]'}`}>
        <p className="text-[11px] text-[#999] mb-1">Shortages <span className="text-[#bbb]">| Week (current)</span></p>
        <p className={`text-[15px] font-bold ${totalShortage > 0 ? 'text-[#c0392b]' : 'text-[#bbb]'}`}>{fmtAmt(totalShortage)}</p>
      </div>
    </div>
  )
}

function LeaderboardModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 bg-black/40 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#0f0f0f] rounded-2xl shadow-2xl border border-[#ebebeb] dark:border-[#222] w-full max-w-6xl my-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-h-[88vh] overflow-y-auto">
          <EmployeeRankingsPage onBack={onClose} />
        </div>
      </div>
    </div>
  )
}

function StaffTable({ onSelect, isManagerOrAdmin }: { onSelect: (u: User) => void; isManagerOrAdmin: boolean }) {
  const { data: users = [], isLoading } = useUsers()
  const [query, setQuery]               = useState('')
  const [inactiveOpen, setInactiveOpen] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  const match = (u: User) =>
    matchesSearch(query, {
      text: [u.name, u.email, u.role, u.phone, u.deactivation_reason],
      date: u.employed_on,
    })

  const active   = users.filter((u) => u.active  && match(u))
  const inactive = users.filter((u) => !u.active && match(u))


  return (
    <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4 min-w-0">
      {/* Search bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border border-[#ebebeb] rounded-xl shrink-0">
        <Search size={14} className="text-[#bbb] shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, or role…"
          className="flex-1 text-[13px] text-[#111] placeholder-[#ccc] outline-none bg-transparent"
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-[#bbb] hover:text-[#555] transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      <WeeklySummaryCards />

      {/* Leaderboard — styled to match the Inactive accordion */}
      <div className="shrink-0 border border-[#ebebeb] rounded-2xl bg-white overflow-hidden">
        <button
          onClick={() => setShowLeaderboard(true)}
          className="w-full flex items-center gap-2 px-5 py-3.5 hover:bg-[#fafafa] transition-colors"
        >
          <Trophy size={14} className="text-[#888]" />
          <span className="text-[13px] font-bold text-[#888]">Leaderboard</span>
          <ChevronRight size={14} className="text-[#bbb] ml-auto" />
        </button>
      </div>

      {showLeaderboard && <LeaderboardModal onClose={() => setShowLeaderboard(false)} />}

      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col">
        <div className="grid grid-cols-[2fr_1fr_2fr_1fr_1fr_1fr_32px] gap-4 px-5 py-2.5 border-b border-[#f0f0f0] bg-[#fafafa] shrink-0">
          {['Name', 'Role', 'Email', 'Sick Days', 'Used', 'Last Paid', ''].map((h) => (
            <p key={h} className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
          ))}
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <LogoLoader />
          </div>
        ) : active.length === 0 && inactive.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[13px] text-[#aaa]">No staff found.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {active.map((u) => <StaffRow key={u.id} user={u} onSelect={onSelect} />)}
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
              <div className="grid grid-cols-[2fr_1fr_2fr_1fr_1fr_1fr_32px] gap-4 px-5 py-2.5 border-b border-[#f4f4f4] bg-[#fafafa]">
                {['Name', 'Role', 'Email', 'Sick Days', 'Used', 'Last Paid', ''].map((h) => (
                  <p key={h} className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
                ))}
              </div>
              {inactive.map((u) => <StaffRow key={u.id} user={u} onSelect={onSelect} dimmed />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type View =
  | { type: 'list' }
  | { type: 'employee'; user: User }
  | { type: 'period'; period: PayrollPeriod }

export function StaffPage() {
  const { user: authUser }          = useAuth()
  const [view, setView]             = useState<View>({ type: 'list' })
  const [showAdd, setShowAdd]       = useState(false)
  const [showNewPeriod, setShowNewPeriod] = useState(false)

  const isManagerOrAdmin = authUser?.role === 'Manager' || authUser?.role === 'Admin'

  if (view.type === 'employee') {
    return <EmployeeView user={view.user} onBack={() => setView({ type: 'list' })} />
  }
  if (view.type === 'period') {
    return <PeriodOverview period={view.period} onBack={() => setView({ type: 'list' })} />
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebebeb] flex-shrink-0">
        <div>
          {!isManagerOrAdmin && (
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-0.5">Service Station</p>
          )}
          <h1 className="text-[22px] font-bold text-[#111] leading-tight">Staff</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNewPeriod(true)}
            className="px-4 py-2 border border-[#ddd] rounded-xl text-[12px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors">
            Start a new pay period
          </button>
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2 border border-[#ddd] rounded-xl text-[12px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors">
            Add an employee
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <StaffTable onSelect={(u) => setView({ type: 'employee', user: u })} isManagerOrAdmin={isManagerOrAdmin} />
        <div className="w-[600px] shrink-0 border-l border-[#e8e8e8] overflow-y-auto h-full">
          <PayrollPanel onSelectPeriod={(p) => setView({ type: 'period', period: p })} />
        </div>
      </div>

      {showAdd       && <AddEmployeeModal onClose={() => setShowAdd(false)} isManagerOrAdmin={isManagerOrAdmin} />}
      {showNewPeriod && <NewPeriodModal   onClose={() => setShowNewPeriod(false)} />}
    </div>
  )
}
