import { useState } from 'react'
import { LogoLoader } from '../components/StationSyncLogo'
import { usePayrollPeriods, usePayrollRecords } from '../hooks/useApi'
import { api } from '../lib/api'
import type { PayrollPeriod, PayrollRecord } from '../lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Plus, X } from 'lucide-react'

function fmt(n: number) {
  return '$' + n.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-JM', { year: 'numeric', month: 'short', day: 'numeric' })
}

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

function PeriodList({
  periods,
  selected,
  onSelect,
}: {
  periods: PayrollPeriod[]
  selected: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="space-y-2">
      {periods.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
            selected === p.id
              ? 'border-[#111] bg-[#111] text-white'
              : 'border-[#ebebeb] bg-white hover:bg-[#fafafa] text-[#111]'
          }`}
        >
          <p className="text-[13px] font-semibold">
            {fmtDate(p.start_date)} – {fmtDate(p.end_date)}
          </p>
          <p className={`text-[11px] mt-0.5 ${selected === p.id ? 'text-[#aaa]' : 'text-[#bbb]'}`}>
            {p.status}
          </p>
        </button>
      ))}
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

export function PayrollPage() {
  const { data: periods = [], isLoading } = usePayrollPeriods()
  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [showModal, setShowModal]         = useState(false)
  const { data: records = [], isLoading: loadingRecords } = usePayrollRecords(selectedId)
  const qc = useQueryClient()

  const selectedPeriod = periods.find((p) => p.id === selectedId)

  async function handlePublish() {
    if (!selectedId) return
    await api.patch(`/payroll/periods/${selectedId}/publish`)
    await qc.invalidateQueries({ queryKey: ['payroll-periods'] })
  }

  const totalNet = records.reduce((s, r) => s + r.net_pay, 0)

  return (
    <div className="p-6 flex gap-6 h-full overflow-hidden">
      {/* Left: period list */}
      <div className="w-64 shrink-0 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-bold text-[#111]">Payroll</h2>
          <button
            onClick={() => setShowModal(true)}
            className="w-8 h-8 rounded-full bg-[#111] text-white flex items-center justify-center hover:bg-[#333] transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center"><LogoLoader /></div>
        ) : periods.length === 0 ? (
          <p className="text-[13px] text-[#bbb]">No periods yet.</p>
        ) : (
          <PeriodList periods={periods} selected={selectedId} onSelect={setSelectedId} />
        )}
      </div>

      {/* Right: records */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {!selectedId ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[13px] text-[#bbb]">Select a period to view records</p>
          </div>
        ) : loadingRecords ? (
          <p className="text-[13px] text-[#aaa]">Loading records...</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[14px] font-bold text-[#111]">
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
              <p className="text-[13px] text-[#bbb]">No records for this period. Make sure employees have pay rates set.</p>
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
