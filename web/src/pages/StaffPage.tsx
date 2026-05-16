import { useState } from 'react'
import { useUsers, usePayrollPeriods, usePayrollRecords } from '../hooks/useApi'
import { api } from '../lib/api'
import type { User, PayrollPeriod, PayrollRecord } from '../lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Plus, X } from 'lucide-react'

// ── Shared formatters ─────────────────────────────────────────────────────────

function fmt(n: number) {
  return '$' + n.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-JM', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Staff list ────────────────────────────────────────────────────────────────

function roleBadgeColor(role: string) {
  switch (role) {
    case 'Supervisor': return 'bg-[#f0f0f0] text-[#555]'
    case 'Manager':    return 'bg-[#fff3cd] text-[#856404]'
    case 'Admin':      return 'bg-[#cfe2ff] text-[#0a3d91]'
    case 'Attendant':  return 'bg-[#d1e7dd] text-[#0a5435]'
    default:           return 'bg-[#f0f0f0] text-[#555]'
  }
}

function StaffRow({ user }: { user: User }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-[#f0f0f0] hover:bg-[#fafafa] transition-colors">
      <div className="w-9 h-9 rounded-full bg-[#111] text-white flex items-center justify-center text-[13px] font-bold shrink-0">
        {user.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-[#111] truncate">{user.name}</p>
        <p className="text-[12px] text-[#999] truncate">{user.email}</p>
      </div>
      <span className={`text-[11px] font-semibold px-2 py-1 rounded-full shrink-0 ${roleBadgeColor(user.role)}`}>
        {user.role}
      </span>
      <div className="text-right shrink-0 w-28">
        {user.pay_rate != null && user.pay_type != null ? (
          <>
            <p className="text-[14px] font-semibold text-[#111]">{fmt(user.pay_rate)}</p>
            <p className="text-[11px] text-[#999]">{user.pay_type === 'Hourly' ? 'per hour' : 'per month'}</p>
          </>
        ) : (
          <p className="text-[12px] text-[#bbb]">No pay set</p>
        )}
      </div>
      <span className={`w-2 h-2 rounded-full shrink-0 ${user.active ? 'bg-green-400' : 'bg-[#ddd]'}`} />
    </div>
  )
}

function StaffList() {
  const { data: users = [], isLoading } = useUsers()
  const active   = users.filter((u) => u.active)
  const inactive = users.filter((u) => !u.active)

  return (
    <div>
      <p className="text-[11px] font-semibold text-[#bbb] uppercase tracking-widest mb-3">
        {users.length} Employee{users.length !== 1 ? 's' : ''}
      </p>
      {isLoading ? (
        <p className="text-[13px] text-[#aaa]">Loading...</p>
      ) : (
        <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden">
          {active.length === 0 && inactive.length === 0 && (
            <p className="text-[13px] text-[#aaa] p-5">No staff found.</p>
          )}
          {active.map((u) => <StaffRow key={u.id} user={u} />)}
          {inactive.length > 0 && (
            <>
              <div className="px-5 py-2 bg-[#fafafa] border-t border-b border-[#f0f0f0]">
                <p className="text-[11px] font-semibold text-[#bbb] uppercase tracking-widest">Inactive</p>
              </div>
              {inactive.map((u) => (
                <div key={u.id} className="opacity-50">
                  <StaffRow user={u} />
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Payroll ───────────────────────────────────────────────────────────────────

function DeductionRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex justify-between text-[13px] py-1">
      <span className="text-[#888]">{label}</span>
      <span className="text-[#c0392b]">- {fmt(amount)}</span>
    </div>
  )
}

function RecordCard({ record }: { record: PayrollRecord }) {
  const [open, setOpen] = useState(false)
  const totalDeductions = record.nis + record.nht + record.ed_tax + record.paye

  return (
    <div className="border border-[#ebebeb] rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#fafafa] transition-colors text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="w-8 h-8 rounded-full bg-[#111] text-white flex items-center justify-center text-[12px] font-bold shrink-0">
          {record.user_name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-[#111]">{record.user_name}</p>
          <p className="text-[12px] text-[#999]">{record.user_role}</p>
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
          <div className="border-t border-[#f4f4f4] pt-2 mt-2">
            <DeductionRow label="NIS (3%)" amount={record.nis} />
            <DeductionRow label="NHT (2%)" amount={record.nht} />
            <DeductionRow label="Education Tax (2.25%)" amount={record.ed_tax} />
            <DeductionRow label="PAYE" amount={record.paye} />
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

function PayrollSection() {
  const { data: periods = [], isLoading } = usePayrollPeriods()
  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [showModal, setShowModal]         = useState(false)
  const { data: records = [], isLoading: loadingRecords } = usePayrollRecords(selectedId)
  const qc = useQueryClient()

  const selectedPeriod = periods.find((p) => p.id === selectedId)
  const totalNet = records.reduce((s, r) => s + r.net_pay, 0)

  async function handlePublish() {
    if (!selectedId) return
    await api.patch(`/payroll/periods/${selectedId}/publish`)
    await qc.invalidateQueries({ queryKey: ['payroll-periods'] })
  }

  return (
    <div className="flex gap-6 min-h-0">
      {/* Period list */}
      <div className="w-56 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold text-[#bbb] uppercase tracking-widest">Periods</p>
          <button
            onClick={() => setShowModal(true)}
            className="w-6 h-6 rounded-full bg-[#111] text-white flex items-center justify-center hover:bg-[#333] transition-colors"
          >
            <Plus size={12} />
          </button>
        </div>
        {isLoading ? (
          <p className="text-[13px] text-[#aaa]">Loading...</p>
        ) : periods.length === 0 ? (
          <p className="text-[13px] text-[#bbb]">No periods yet.</p>
        ) : (
          <div className="space-y-2">
            {periods.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                  selectedId === p.id
                    ? 'border-[#111] bg-[#111] text-white'
                    : 'border-[#ebebeb] bg-white hover:bg-[#fafafa] text-[#111]'
                }`}
              >
                <p className="text-[13px] font-semibold">
                  {fmtDate(p.start_date)} – {fmtDate(p.end_date)}
                </p>
                <p className={`text-[11px] mt-0.5 ${selectedId === p.id ? 'text-[#aaa]' : 'text-[#bbb]'}`}>
                  {p.status}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Records */}
      <div className="flex-1 min-w-0">
        {!selectedId ? (
          <p className="text-[13px] text-[#bbb] mt-1">Select a period to view records.</p>
        ) : loadingRecords ? (
          <p className="text-[13px] text-[#aaa]">Loading...</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[13px] font-bold text-[#111]">
                  {selectedPeriod && `${fmtDate(selectedPeriod.start_date)} – ${fmtDate(selectedPeriod.end_date)}`}
                </p>
                <p className="text-[12px] text-[#999] mt-0.5">
                  {records.length} employee{records.length !== 1 ? 's' : ''} · Total net {fmt(totalNet)}
                </p>
              </div>
              {selectedPeriod?.status === 'Draft' && (
                <button
                  onClick={handlePublish}
                  className="px-4 py-2 bg-[#111] text-white text-[13px] font-semibold rounded-xl hover:bg-[#333] transition-colors"
                >
                  Publish
                </button>
              )}
              {selectedPeriod?.status === 'Published' && (
                <span className="px-3 py-1 bg-[#d1e7dd] text-[#0a5435] text-[12px] font-semibold rounded-full">
                  Published
                </span>
              )}
            </div>
            {records.length === 0 ? (
              <p className="text-[13px] text-[#bbb]">No records. Make sure employees have pay rates set.</p>
            ) : (
              <div className="space-y-2">
                {records.map((r) => <RecordCard key={r.id} record={r} />)}
              </div>
            )}
          </>
        )}
      </div>

      {showModal && <NewPeriodModal onClose={() => setShowModal(false)} />}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function StaffPage() {
  return (
    <div className="p-6 space-y-10 max-w-4xl overflow-y-auto h-full">
      <div>
        <h2 className="text-[20px] font-bold text-[#111] mb-6">Staff</h2>
        <StaffList />
      </div>

      <div>
        <h2 className="text-[20px] font-bold text-[#111] mb-6">Payroll</h2>
        <PayrollSection />
      </div>
    </div>
  )
}
