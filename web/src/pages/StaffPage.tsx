import { useState } from 'react'
import { useUsers, useUserPayroll, usePayrollPeriods } from '../hooks/useApi'
import { api } from '../lib/api'
import type { User, PayrollRecord } from '../lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronRight, Plus, X } from 'lucide-react'

function fmt(n: number) {
  return '$' + n.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-JM', { year: 'numeric', month: 'short', day: 'numeric' })
}

function roleBadgeColor(role: string) {
  switch (role) {
    case 'Supervisor': return 'bg-[#f0f0f0] text-[#555]'
    case 'Manager':    return 'bg-[#fff3cd] text-[#856404]'
    case 'Admin':      return 'bg-[#cfe2ff] text-[#0a3d91]'
    case 'Attendant':  return 'bg-[#d1e7dd] text-[#0a5435]'
    default:           return 'bg-[#f0f0f0] text-[#555]'
  }
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[400px] p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[16px] font-bold text-[#111]">New Payroll Period</h3>
          <button onClick={onClose} className="text-[#bbb] hover:text-[#555] transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#888] mb-1 uppercase tracking-widest">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full border border-[#ebebeb] rounded-xl px-4 py-3 text-[14px] text-[#111] focus:outline-none focus:border-[#111]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#888] mb-1 uppercase tracking-widest">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="w-full border border-[#ebebeb] rounded-xl px-4 py-3 text-[14px] text-[#111] focus:outline-none focus:border-[#111]"
            />
          </div>
          {error && <p className="text-[12px] text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#111] text-white rounded-xl py-3 text-[14px] font-semibold hover:bg-[#333] transition-colors disabled:opacity-40"
          >
            {loading ? 'Generating...' : 'Generate Payroll'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Payroll Record Card ───────────────────────────────────────────────────────

function RecordCard({ record }: { record: PayrollRecord }) {
  const [open, setOpen] = useState(false)
  const totalDeductions = record.nis + record.nht + record.ed_tax + record.paye

  return (
    <div className="border border-[#ebebeb] rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#fafafa] transition-colors text-left"
        onClick={() => setOpen((o) => !o)}
      >
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
        <ChevronRight
          size={16}
          className={`text-[#bbb] shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && (
        <div className="px-5 pb-4 border-t border-[#f4f4f4]">
          <div className="mt-3 mb-2 flex justify-between text-[13px]">
            <span className="text-[#888]">Gross pay</span>
            <span className="font-semibold text-[#111]">{fmt(record.gross_pay)}</span>
          </div>
          {record.hours_worked != null && (
            <div className="flex justify-between text-[12px] text-[#bbb] mb-2">
              <span>Hours worked</span>
              <span>{record.hours_worked.toFixed(2)} hrs</span>
            </div>
          )}
          <div className="border-t border-[#f4f4f4] pt-2 mt-2 space-y-1">
            {[
              { label: 'NIS (3%)',              amount: record.nis },
              { label: 'NHT (2%)',              amount: record.nht },
              { label: 'Education Tax (2.25%)', amount: record.ed_tax },
              { label: 'PAYE',                  amount: record.paye },
            ].map(({ label, amount }) => (
              <div key={label} className="flex justify-between text-[13px] py-0.5">
                <span className="text-[#888]">{label}</span>
                <span className="text-[#c0392b]">- {fmt(amount)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-[#ebebeb] mt-2 pt-2 flex justify-between text-[13px]">
            <span className="text-[#888]">Total deductions</span>
            <span className="text-[#c0392b] font-semibold">- {fmt(totalDeductions)}</span>
          </div>
          <div className="flex justify-between text-[14px] font-bold mt-1">
            <span className="text-[#111]">Net pay</span>
            <span className="text-[#111]">{fmt(record.net_pay)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Employee Payroll View ─────────────────────────────────────────────────────

function EmployeePayroll({ user, onBack }: { user: User; onBack: () => void }) {
  const { data: records = [], isLoading } = useUserPayroll(user.id)
  const { data: periods = [] } = usePayrollPeriods()
  const [showModal, setShowModal] = useState(false)
  const qc = useQueryClient()

  const hasPeriods = periods.length > 0

  async function handlePublish(periodId: string) {
    await api.patch(`/payroll/periods/${periodId}/publish`)
    await qc.invalidateQueries({ queryKey: ['payroll-periods'] })
    await qc.invalidateQueries({ queryKey: ['user-payroll', user.id] })
  }

  return (
    <div className="p-6 max-w-2xl overflow-y-auto h-full">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[13px] text-[#888] hover:text-[#111] transition-colors mb-6"
      >
        <ArrowLeft size={14} />
        Back to Staff
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-[#111] text-white flex items-center justify-center text-[16px] font-bold shrink-0">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="text-[20px] font-bold text-[#111]">{user.name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${roleBadgeColor(user.role)}`}>
              {user.role}
            </span>
            {user.pay_rate != null && user.pay_type != null && (
              <span className="text-[12px] text-[#999]">
                {fmt(user.pay_rate)} {user.pay_type === 'Hourly' ? '/ hr' : '/ month'}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-[#111] text-white text-[13px] font-semibold rounded-xl hover:bg-[#333] transition-colors"
        >
          <Plus size={14} />
          Run Payroll
        </button>
      </div>

      {isLoading ? (
        <p className="text-[13px] text-[#aaa]">Loading...</p>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#ebebeb] p-6">
          <p className="text-[13px] text-[#bbb]">
            {!hasPeriods
              ? 'No payroll periods yet. Run payroll to generate records.'
              : user.pay_rate == null
              ? 'This employee has no pay rate set.'
              : 'No payroll records found for this employee.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id}>
              <RecordCard record={r} />
              {r.period_status === 'Draft' && (
                <div className="flex justify-end mt-1 pr-1">
                  <button
                    onClick={() => handlePublish(r.period_id)}
                    className="text-[12px] text-[#888] hover:text-[#111] transition-colors"
                  >
                    Publish period
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && <NewPeriodModal onClose={() => setShowModal(false)} />}
    </div>
  )
}

// ── Staff List ────────────────────────────────────────────────────────────────

function StaffList({ onSelect }: { onSelect: (user: User) => void }) {
  const { data: users = [], isLoading } = useUsers()
  const active   = users.filter((u) => u.active)
  const inactive = users.filter((u) => !u.active)

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-[20px] font-bold text-[#111] mb-6">Staff</h2>
      {isLoading ? (
        <p className="text-[13px] text-[#aaa]">Loading...</p>
      ) : (
        <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden">
          {active.length === 0 && inactive.length === 0 && (
            <p className="text-[13px] text-[#aaa] p-5">No staff found.</p>
          )}
          {active.map((u) => (
            <button
              key={u.id}
              onClick={() => onSelect(u)}
              className="w-full flex items-center gap-4 px-5 py-4 border-b border-[#f0f0f0] hover:bg-[#fafafa] transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-full bg-[#111] text-white flex items-center justify-center text-[13px] font-bold shrink-0">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#111] truncate">{u.name}</p>
                <p className="text-[12px] text-[#999] truncate">{u.email}</p>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-1 rounded-full shrink-0 ${roleBadgeColor(u.role)}`}>
                {u.role}
              </span>
              <div className="text-right shrink-0 w-28">
                {u.pay_rate != null && u.pay_type != null ? (
                  <>
                    <p className="text-[14px] font-semibold text-[#111]">{fmt(u.pay_rate)}</p>
                    <p className="text-[11px] text-[#999]">{u.pay_type === 'Hourly' ? 'per hour' : 'per month'}</p>
                  </>
                ) : (
                  <p className="text-[12px] text-[#bbb]">No pay set</p>
                )}
              </div>
              <ChevronRight size={14} className="text-[#ccc] shrink-0" />
            </button>
          ))}
          {inactive.length > 0 && (
            <>
              <div className="px-5 py-2 bg-[#fafafa] border-t border-b border-[#f0f0f0]">
                <p className="text-[11px] font-semibold text-[#bbb] uppercase tracking-widest">Inactive</p>
              </div>
              {inactive.map((u) => (
                <button
                  key={u.id}
                  onClick={() => onSelect(u)}
                  className="w-full flex items-center gap-4 px-5 py-4 border-b border-[#f0f0f0] hover:bg-[#fafafa] transition-colors text-left opacity-50"
                >
                  <div className="w-9 h-9 rounded-full bg-[#111] text-white flex items-center justify-center text-[13px] font-bold shrink-0">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#111] truncate">{u.name}</p>
                    <p className="text-[12px] text-[#999] truncate">{u.email}</p>
                  </div>
                  <ChevronRight size={14} className="text-[#ccc] shrink-0" />
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function StaffPage() {
  const [selected, setSelected] = useState<User | null>(null)

  if (selected) {
    return <EmployeePayroll user={selected} onBack={() => setSelected(null)} />
  }

  return <StaffList onSelect={setSelected} />
}
