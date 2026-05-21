import { useState, useRef, useEffect } from 'react'
import { LogoLoader } from '../components/StationSyncLogo'
import {
  useUsers, useUserPayroll, usePayrollPeriods, usePayrollRecords,
  useCreateUser, useUpdatePay, usePayrollWeeklySummary, useUserAttendance,
} from '../hooks/useApi'
import { useAuth } from '../lib/authContext'
import { api, updateUser } from '../lib/api'
import type { User, PayrollPeriod, PayrollRecord } from '../lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronRight, Download, MoreHorizontal, Pencil, Plus, Printer, Search, Sparkles, X } from 'lucide-react'
import { printPaySlip, printPayrollRegister, printJobLetter, downloadS01CSV, downloadHeartCSV } from '../lib/payrollExport'

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

// ── Edit Pay Modal ────────────────────────────────────────────────────────────

function EditPayModal({ user, onClose }: { user: User; onClose: () => void }) {
  const updatePay = useUpdatePay()
  const [rate, setRate]     = useState(user.pay_rate?.toString() ?? '')
  const [type, setType]     = useState(user.pay_type ?? 'Hourly')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await updatePay(user.id, rate ? parseFloat(rate) : null, type || null)
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
  const qc = useQueryClient()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/payroll/periods', { start_date: startDate, end_date: endDate })
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
      <div className="bg-white rounded-3xl w-full max-w-[400px] p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[16px] font-bold text-[#111]">New Payroll Period</h3>
          <button onClick={onClose} className="text-[#bbb] hover:text-[#555] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[['Start Date', startDate, setStartDate], ['End Date', endDate, setEndDate]].map(([label, val, setter]) => (
            <div key={label as string}>
              <label className="block text-[11px] font-semibold text-[#888] mb-1 uppercase tracking-widest">{label as string}</label>
              <input type="date" value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)} required
                className="w-full border border-[#ebebeb] rounded-xl px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111]" />
            </div>
          ))}
          {error && <p className="text-[12px] text-red-500">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-white border border-[#ddd] text-[#333] rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#f9f9f9] transition-colors disabled:opacity-40">
            {loading ? 'Generating...' : 'Generate Payroll'}
          </button>
        </form>
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

// ── Employee View ─────────────────────────────────────────────────────────────

function EmployeeView({ user, onBack }: { user: User; onBack: () => void }) {
  const { data: records = [], isLoading }       = useUserPayroll(user.id)
  const { data: periods = [] }                  = usePayrollPeriods()
  const { data: attendance = [], isLoading: isLoadingAttendance } = useUserAttendance(user.id)
  const { data: allUsers = [] }                 = useUsers()
  const qc                                = useQueryClient()
  const [showPayModal, setShowPayModal]       = useState(false)
  const [showPeriodModal, setShowPeriodModal] = useState(false)
  const [showEditModal, setShowEditModal]     = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
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

  async function handlePublish(periodId: string) {
    await api.patch(`/payroll/periods/${periodId}/publish`)
    await qc.invalidateQueries({ queryKey: ['payroll-periods'] })
    await qc.invalidateQueries({ queryKey: ['user-payroll', user.id] })
  }

  async function handleToggleActive() {
    await updateUser(user.id, { active: !user.active })
    await qc.invalidateQueries({ queryKey: ['users'] })
    setProfileMenuOpen(false)
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
                <div className="absolute right-0 top-full mt-1 bg-white border border-[#e0e0e0] rounded-xl shadow-lg py-1 min-w-[130px] z-20">
                  <button
                    onClick={() => { setShowEditModal(true); setProfileMenuOpen(false) }}
                    className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleToggleActive}
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
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${user.active ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-[#f0f0f0] text-[#999] dark:bg-[#222] dark:text-[#555]'}`}>
              {user.active ? 'Active' : 'Inactive'}
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
                    {r.period_status === 'Draft' && (
                      <div className="flex justify-end mt-1 pr-1">
                        <button onClick={() => handlePublish(r.period_id)}
                          className="text-[12px] text-[#888] hover:text-[#111] transition-colors">
                          Publish period
                        </button>
                      </div>
                    )}
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

      {showEditModal   && <EditEmployeeModal user={user} onClose={() => setShowEditModal(false)} />}
      {showPayModal    && <EditPayModal user={user} onClose={() => setShowPayModal(false)} />}
      {showPeriodModal && <NewPeriodModal onClose={() => setShowPeriodModal(false)} />}
    </div>
  )
}

// ── Period Overview ───────────────────────────────────────────────────────────

function PeriodOverview({ period, onBack }: { period: PayrollPeriod; onBack: () => void }) {
  const { data: records = [], isLoading } = usePayrollRecords(period.id)
  const { data: users = [] }              = useUsers()
  const qc = useQueryClient()

  const totalGross      = records.reduce((s, r) => s + r.gross_pay, 0)
  const totalDeductions = records.reduce((s, r) => s + r.nis + r.nht + r.ed_tax + r.paye, 0)
  const totalNet        = records.reduce((s, r) => s + r.net_pay, 0)

  async function handlePublish() {
    await api.patch(`/payroll/periods/${period.id}/publish`)
    await qc.invalidateQueries({ queryKey: ['payroll-periods'] })
  }

  return (
    <div className="p-6 max-w-2xl overflow-y-auto h-full">
      <button onClick={onBack} className="flex items-center gap-2 text-[13px] text-[#888] hover:text-[#111] transition-colors mb-6">
        <ArrowLeft size={14} /> Go back
      </button>

      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-[20px] font-bold text-[#111]">
            {fmtDate(period.start_date)} – {fmtDate(period.end_date)}
          </h2>
          <p className="text-[13px] text-[#999] mt-0.5">{records.length} employee{records.length !== 1 ? 's' : ''}</p>
        </div>
        {period.status === 'Draft' ? (
          <button onClick={handlePublish}
            className="px-5 py-2.5 bg-white border border-[#ddd] text-[#333] text-[13px] font-semibold rounded-xl hover:bg-[#f9f9f9] transition-colors">
            Publish
          </button>
        ) : (
          <span className="px-3 py-1 bg-[#d1e7dd] text-[#0a5435] text-[12px] font-semibold rounded-full">Published</span>
        )}
      </div>

      {records.length > 0 && (
        <div className="flex gap-3 mb-6 flex-wrap">
          <button onClick={() => printPayrollRegister(period, records)}
            className="flex items-center gap-1.5 px-3 py-2 border border-[#ebebeb] rounded-xl text-[12px] font-semibold text-[#555] hover:bg-[#fafafa] transition-colors">
            <Printer size={13} /> Print Register
          </button>
          <button onClick={() => downloadS01CSV(period, records, users)}
            className="flex items-center gap-1.5 px-3 py-2 border border-[#ebebeb] rounded-xl text-[12px] font-semibold text-[#555] hover:bg-[#fafafa] transition-colors">
            <Download size={13} /> S01 Remittance (CSV)
          </button>
          <button onClick={() => downloadHeartCSV(period, records)}
            className="flex items-center gap-1.5 px-3 py-2 border border-[#ebebeb] rounded-xl text-[12px] font-semibold text-[#555] hover:bg-[#fafafa] transition-colors">
            <Download size={13} /> HEART Levy (CSV)
          </button>
        </div>
      )}

      {/* Summary totals */}
      {records.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total Gross',      value: totalGross },
            { label: 'Total Deductions', value: totalDeductions },
            { label: 'Total Net Pay',    value: totalNet },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-2xl border border-[#ebebeb] p-4">
              <p className="text-[11px] text-[#999] mb-1">{label}</p>
              <p className="text-[15px] font-bold text-[#111]">{fmt(value)}</p>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="py-4 flex items-center justify-center"><LogoLoader /></div>
      ) : records.length === 0 ? (
        <p className="text-[13px] text-[#bbb]">No records for this period.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden">
          {records.map((r) => (
            <div key={r.id} className="flex items-center gap-4 px-5 py-4 border-b border-[#f0f0f0] last:border-0">
              <div className="w-9 h-9 rounded-full bg-[#111] text-white flex items-center justify-center text-[13px] font-bold shrink-0">
                {r.user_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#111]">{r.user_name}</p>
                <p className="text-[12px] text-[#999]">{r.user_role}</p>
              </div>
              <div className="text-right shrink-0 space-y-0.5">
                <p className="text-[12px] text-[#bbb]">Gross {fmt(r.gross_pay)}</p>
                <p className="text-[14px] font-semibold text-[#111]">{fmt(r.net_pay)} net</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Payroll Panel ─────────────────────────────────────────────────────────────

function PayrollPanel({ onSelectPeriod }: { onSelectPeriod: (p: PayrollPeriod) => void }) {
  const { data: periods = [], isLoading } = usePayrollPeriods()
  const [showModal, setShowModal]         = useState(false)

  return (
    <div className="h-full flex flex-col">
      <div className="p-5 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4">
          <p>
            <span className="text-[13px] font-bold text-[#111]">Payroll</span>
            <span className="text-[13px] font-medium text-[#aaa]"> | Periods</span>
          </p>
        </div>

        <div className="grid grid-cols-[20px_1fr_auto] gap-3 mb-2">
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">#</p>
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">Period</p>
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase text-right">Status</p>
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
          <div className="flex-1 overflow-y-auto flex flex-col">
            {periods.map((p, i) => (
              <button
                key={p.id}
                onClick={() => onSelectPeriod(p)}
                className="grid grid-cols-[20px_1fr_auto] gap-3 items-center py-2.5 border-b border-[#f8f8f8] last:border-0 hover:bg-[#fafafa] -mx-1 px-1 rounded-lg transition-colors text-left"
              >
                <p className="text-[11px] font-bold text-[#ccc]">{i + 1}</p>
                <p className="text-[13px] font-semibold text-[#111]">
                  {fmtDate(p.start_date)} – {fmtDate(p.end_date)}
                </p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  p.status === 'Published' ? 'bg-[#d1e7dd] text-[#0a5435]' : 'bg-[#f0f0f0] text-[#555]'
                }`}>
                  {p.status}
                </span>
              </button>
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

      {showModal && <NewPeriodModal onClose={() => setShowModal(false)} />}
    </div>
  )
}

// ── Staff Table ───────────────────────────────────────────────────────────────

function StaffRow({ user: u, onSelect, dimmed = false }: { user: User; onSelect: (u: User) => void; dimmed?: boolean }) {
  return (
    <button onClick={() => onSelect(u)}
      className={`w-full grid grid-cols-[2fr_1fr_2fr_1fr_1fr_1fr_32px] gap-4 items-center px-5 py-3.5 border-b border-[#f8f8f8] hover:bg-[#fafafa] transition-colors text-left ${dimmed ? 'opacity-50' : ''}`}>
      <p className="text-[13px] text-[#111] truncate">{u.name}</p>
      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit ${roleBadgeColor(u.role)}`}>{u.role}</span>
      <p className="text-[13px] text-[#666] truncate">{u.email || '—'}</p>
      <p className="text-[13px] text-[#666]">
        {u.pay_rate != null && !dimmed
          ? `${fmt(u.pay_rate)}/${u.pay_type === 'Hourly' ? 'hr' : 'mo'}`
          : dimmed ? '—' : <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f0f0f0] text-[#999]">Not set</span>}
      </p>
      <p className="text-[13px] text-[#666]">{u.sick_days != null ? `${u.sick_days}d` : '—'}</p>
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

function StaffTable({ onSelect, isManagerOrAdmin }: { onSelect: (u: User) => void; isManagerOrAdmin: boolean }) {
  const { data: users = [], isLoading } = useUsers()
  const { data: weekly }                = usePayrollWeeklySummary()
  const [query, setQuery]               = useState('')
  const [inactiveOpen, setInactiveOpen] = useState(false)

  const q = query.trim().toLowerCase()
  const match = (u: User) =>
    !q ||
    u.name.toLowerCase().includes(q) ||
    (u.email ?? '').toLowerCase().includes(q) ||
    u.role.toLowerCase().includes(q)

  const active   = users.filter((u) => u.active  && match(u))
  const inactive = users.filter((u) => !u.active && match(u))

  const stationActive     = active.filter((u) => STATION_ROLES.has(u.role))
  const convenienceActive = active.filter((u) => CONVENIENCE_ROLES.has(u.role))

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

      <div className="grid grid-cols-2 gap-3 shrink-0">
        <div className={`rounded-2xl border p-4 ${(weekly?.total_overage ?? 0) > 0 ? 'bg-green-50 border-green-200' : 'bg-white border-[#ebebeb]'}`}>
          <p className="text-[11px] mb-1"><span className="text-[#999]">Overages</span><span className="text-[#ccc]"> | Week (current)</span></p>
          <p className={`text-[15px] font-bold ${(weekly?.total_overage ?? 0) > 0 ? 'text-green-700' : 'text-[#bbb]'}`}>{fmt(weekly?.total_overage ?? 0)}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${(weekly?.total_shortage ?? 0) > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-[#ebebeb]'}`}>
          <p className="text-[11px] mb-1"><span className="text-[#999]">Shortages</span><span className="text-[#ccc]"> | Week (current)</span></p>
          <p className={`text-[15px] font-bold ${(weekly?.total_shortage ?? 0) > 0 ? 'text-[#c0392b]' : 'text-[#bbb]'}`}>{fmt(weekly?.total_shortage ?? 0)}</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col">
        <div className="grid grid-cols-[2fr_1fr_2fr_1fr_1fr_1fr_32px] gap-4 px-5 py-2.5 border-b border-[#f0f0f0] bg-[#fafafa] shrink-0">
          {['Name', 'Role', 'Email', 'Pay Rate', 'Sick Days', 'Last Paid', ''].map((h) => (
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
            {isManagerOrAdmin ? (
              <>
                {stationActive.length > 0 && (
                  <>
                    <SectionDivider label="Service Station" />
                    {stationActive.map((u) => <StaffRow key={u.id} user={u} onSelect={onSelect} />)}
                  </>
                )}
                {convenienceActive.length > 0 && (
                  <>
                    <SectionDivider label="Convenience Store" />
                    {convenienceActive.map((u) => <StaffRow key={u.id} user={u} onSelect={onSelect} />)}
                  </>
                )}
              </>
            ) : (
              active.map((u) => <StaffRow key={u.id} user={u} onSelect={onSelect} />)
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
              <div className="grid grid-cols-[2fr_1fr_2fr_1fr_1fr_1fr_32px] gap-4 px-5 py-2.5 border-b border-[#f4f4f4] bg-[#fafafa]">
                {['Name', 'Role', 'Email', 'Pay Rate', 'Sick Days', 'Last Paid', ''].map((h) => (
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
  const { user: authUser }    = useAuth()
  const [view, setView]       = useState<View>({ type: 'list' })
  const [showAdd, setShowAdd] = useState(false)

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
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#ddd] text-[#333] text-[13px] font-semibold rounded-xl hover:bg-[#f9f9f9] transition-colors">
          <Plus size={14} /> Add Employee
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <StaffTable onSelect={(u) => setView({ type: 'employee', user: u })} isManagerOrAdmin={isManagerOrAdmin} />
        <div className="w-[600px] shrink-0 border-l border-[#e8e8e8] overflow-y-auto h-full">
          <PayrollPanel onSelectPeriod={(p) => setView({ type: 'period', period: p })} />
        </div>
      </div>

      {showAdd && <AddEmployeeModal onClose={() => setShowAdd(false)} isManagerOrAdmin={isManagerOrAdmin} />}
    </div>
  )
}
