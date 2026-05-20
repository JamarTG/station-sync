import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import { useShiftsInRange, useShiftAttendance, useShiftDeposits, useShiftFuelPrices, useTimeOffRequests } from '../hooks/useApi'
import { createTimeOffRequest, reviewTimeOffRequest, type Shift, type TimeOffRequest } from '../lib/api'
import { useAuth } from '../lib/authContext'
import { useQueryClient } from '@tanstack/react-query'

const approverRoles = new Set(['Super Admin', 'Admin', 'Manager'])
const requesterRoles = new Set(['Supervisor', 'Attendant'])

type ViewMode = 'month' | 'week'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function fmt12(time24: string): string {
  const [h, m] = time24.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')}${suffix}`
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// ── Month grid helpers ────────────────────────────────────────────────────────

function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const cells: (Date | null)[] = []
  for (let i = 0; i < first.getDay(); i++) cells.push(null)
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function monthRange(year: number, month: number): [string, string] {
  const start = toISO(year, month, 1)
  const end   = new Date(year, month + 1, 0).toISOString().slice(0, 10)
  return [start, end]
}

function weekRange(anchor: Date): [string, string] {
  const sun = new Date(anchor)
  sun.setDate(anchor.getDate() - anchor.getDay())
  const sat = new Date(sun)
  sat.setDate(sun.getDate() + 6)
  return [sun.toISOString().slice(0, 10), sat.toISOString().slice(0, 10)]
}

function buildWeekDays(anchor: Date): Date[] {
  const sun = new Date(anchor)
  sun.setDate(anchor.getDate() - anchor.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sun)
    d.setDate(sun.getDate() + i)
    return d
  })
}

// ── Shared status chip ────────────────────────────────────────────────────────

function statusChip(status: TimeOffRequest['status']) {
  if (status === 'Approved') return <span className="text-[11px] font-medium text-[#2e7d32]">Approved</span>
  if (status === 'Rejected') return <span className="text-[11px] font-medium text-[#c62828]">Rejected</span>
  return <span className="text-[11px] font-medium text-[#888]">Pending</span>
}

// ── Time-off modal (requester: list + form in one) ────────────────────────────

function TimeOffModal({ defaultDate, onClose }: { defaultDate: string; onClose: () => void }) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data: requests = [] } = useTimeOffRequests()

  const [view, setView] = useState<'list' | 'form'>(requests.length === 0 ? 'form' : 'list')
  const [date, setDate] = useState(defaultDate < today ? today : defaultDate)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    setSaving(true)
    try {
      await createTimeOffRequest({ date, reason: reason.trim() || undefined })
      await qc.invalidateQueries({ queryKey: ['time-off-requests'] })
      setReason('')
      setView('list')
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-[400px] shadow-xl max-h-[80vh] flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-[#ebebeb] flex items-center justify-between flex-shrink-0">
          {view === 'form' ? (
            <button
              onClick={() => { setView('list'); setError(null) }}
              className="text-[13px] font-semibold text-[#111] flex items-center gap-1.5 hover:text-[#555] transition-colors"
            >
              <ChevronLeft size={14} />
              Day Off Requests
            </button>
          ) : (
            <p className="text-[13px] font-semibold text-[#111]">Day Off Requests</p>
          )}
          <div className="flex items-center gap-2">
            {view === 'list' && (
              <button
                onClick={() => setView('form')}
                className="px-3 py-1 text-[11px] font-semibold text-[#111] border border-[#e0e0e0] rounded-lg hover:border-[#ccc] transition-colors"
              >
                + New
              </button>
            )}
            <button onClick={onClose} className="text-[#bbb] hover:text-[#555] text-[18px] leading-none transition-colors">&times;</button>
          </div>
        </div>

        {/* List view */}
        {view === 'list' && (
          <div className="flex-1 overflow-y-auto">
            {requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-[13px] font-semibold text-[#bbb]">No requests yet</p>
              </div>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-5 py-3.5 border-b border-[#f4f4f4] last:border-0 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#111]">
                      {new Date(r.date + 'T00:00:00').toLocaleDateString('en-JM', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    {r.reason && <p className="text-[11px] text-[#aaa] truncate">{r.reason}</p>}
                    {r.status === 'Rejected' && r.reviewed_by_name && (
                      <p className="text-[11px] text-[#aaa]">Reviewed by {r.reviewed_by_name}</p>
                    )}
                  </div>
                  <div className="shrink-0">{statusChip(r.status)}</div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Form view */}
        {view === 'form' && (
          <div className="p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-[#aaa]">Date</label>
              <input
                type="date"
                value={date}
                min={today}
                onChange={(e) => { setDate(e.target.value); setError(null) }}
                className="border border-[#ebebeb] rounded-lg px-3 py-2 text-[13px] text-[#111] focus:outline-none focus:border-[#111] transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-[#aaa]">Reason <span className="text-[#ccc]">(optional)</span></label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Add a note…"
                className="border border-[#ebebeb] rounded-lg px-3 py-2 text-[13px] text-[#111] placeholder:text-[#ccc] focus:outline-none focus:border-[#111] transition-colors resize-none"
              />
            </div>
            {error && <p className="text-[12px] text-[#c62828]">{error}</p>}
            <button
              onClick={submit}
              disabled={!date || saving}
              className="w-full py-2.5 rounded-lg bg-[#111] text-white text-[13px] font-semibold disabled:opacity-40 transition-opacity"
            >
              {saving ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Approvals modal (approver view) ───────────────────────────────────────────

function ApprovalsModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data: requests = [] } = useTimeOffRequests()
  const [loading, setLoading] = useState<string | null>(null)

  async function review(id: string, action: 'approve' | 'reject') {
    setLoading(id + action)
    try {
      await reviewTimeOffRequest(id, action)
      await qc.invalidateQueries({ queryKey: ['time-off-requests'] })
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-[420px] shadow-xl max-h-[80vh] flex flex-col">
        <div className="px-5 py-4 border-b border-[#ebebeb] flex items-center justify-between flex-shrink-0">
          <p className="text-[13px] font-semibold text-[#111]">Day Off Requests</p>
          <button onClick={onClose} className="text-[#bbb] hover:text-[#555] text-[18px] leading-none transition-colors">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-[13px] font-semibold text-[#bbb]">No requests</p>
            </div>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3.5 border-b border-[#f4f4f4] last:border-0 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#111] truncate">{r.user_name}</p>
                  <p className="text-[11px] text-[#aaa]">
                    {new Date(r.date + 'T00:00:00').toLocaleDateString('en-JM', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {r.reason && ` · ${r.reason}`}
                  </p>
                </div>
                {r.status === 'Pending' ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => review(r.id, 'approve')}
                      disabled={!!loading}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-[#e8f5e9] text-[#2e7d32] hover:bg-[#c8e6c9] transition-colors disabled:opacity-40"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onClick={() => review(r.id, 'reject')}
                      disabled={!!loading}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-[#ffebee] text-[#c62828] hover:bg-[#ffcdd2] transition-colors disabled:opacity-40"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="shrink-0">{statusChip(r.status)}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── Shift pill ────────────────────────────────────────────────────────────────

function ShiftPill({ shift }: { shift: Shift }) {
  const open = shift.end_time == null
  return (
    <div className="flex items-center gap-1.5 truncate">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${open ? 'bg-[#2e7d32]' : 'bg-[#ccc]'}`} />
      <span className="text-[11px] text-[#555] truncate">
        {fmt12(shift.start_time)}
        {shift.end_time && ` – ${fmt12(shift.end_time)}`}
      </span>
    </div>
  )
}

// ── Shift card (in day panel) ─────────────────────────────────────────────────

function ShiftCard({ s }: { s: Shift }) {
  const { data: attendance = [] } = useShiftAttendance(s.id)
  const { data: deposits = [] }   = useShiftDeposits(s.id)
  const { data: fuelPrices = [] } = useShiftFuelPrices(s.id)
  const depositTotal = deposits.reduce((sum, d) => sum + d.amount, 0)
  const open = s.end_time == null

  return (
    <div className="border border-[#ebebeb] rounded-xl bg-white">
      <div className="px-4 py-3 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-[#111]">
          {fmt12(s.start_time)}{s.end_time ? ` – ${fmt12(s.end_time)}` : ''}
        </p>
        <span className={`text-[11px] font-medium ${open ? 'text-[#2e7d32]' : 'text-[#aaa]'}`}>
          {open ? 'Open' : 'Closed'}
        </span>
      </div>

      {s.supervisor_name && (
        <div className="px-4 py-2.5 border-t border-[#f4f4f4] flex items-center justify-between">
          <p className="text-[11px] text-[#aaa]">Supervisor</p>
          <p className="text-[12px] font-medium text-[#333]">{s.supervisor_name}</p>
        </div>
      )}

      {attendance.length > 0 && (
        <div className="px-4 py-2.5 border-t border-[#f4f4f4]">
          <p className="text-[11px] text-[#aaa] mb-2">Staff</p>
          <div className="flex flex-col gap-1.5">
            {attendance.map((a) => (
              <div key={a.id} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#111] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                  {a.user_name.charAt(0).toUpperCase()}
                </div>
                <p className="text-[12px] text-[#333] flex-1">{a.user_name}</p>
                {a.pump_name && (
                  <p className="text-[11px] text-[#aaa]">{a.pump_name}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {deposits.length > 0 && (
        <div className="px-4 py-2.5 border-t border-[#f4f4f4] flex items-center justify-between">
          <p className="text-[11px] text-[#aaa]">Deposits</p>
          <p className="text-[12px] font-medium text-[#333]">
            J${depositTotal.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      )}

      {fuelPrices.length > 0 && (
        <div className="px-4 py-2.5 border-t border-[#f4f4f4]">
          <p className="text-[11px] text-[#aaa] mb-2">Fuel Prices</p>
          <div className="flex flex-col gap-1">
            {fuelPrices.map((fp) => (
              <div key={fp.fuel_id} className="flex items-center justify-between">
                <p className="text-[12px] text-[#888]">{fp.fuel_name}</p>
                <p className="text-[12px] font-medium text-[#333]">J${fp.price.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Day detail panel ──────────────────────────────────────────────────────────

function DayPanel({ date, shifts, onClose }: { date: Date; shifts: Shift[]; onClose: () => void }) {
  const label = date.toLocaleDateString('en-JM', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="w-[280px] shrink-0 border-l border-[#ebebeb] bg-white flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#ebebeb]">
        <p className="text-[13px] font-semibold text-[#111]">{label}</p>
        <button onClick={onClose} className="text-[#bbb] hover:text-[#555] text-[18px] leading-none transition-colors">&times;</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {shifts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <p className="text-[13px] font-semibold text-[#bbb]">No shift</p>
            <p className="text-[11px] text-[#ccc]">No shift was recorded for this day.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {shifts.map((s) => <ShiftCard key={s.id} s={s} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Month view ────────────────────────────────────────────────────────────────

function MonthView({
  year, month, shiftsByDate, today, selected, onSelect,
}: {
  year: number
  month: number
  shiftsByDate: Map<string, Shift[]>
  today: string
  selected: string | null
  onSelect: (iso: string) => void
}) {
  const cells = useMemo(() => buildMonthGrid(year, month), [year, month])

  return (
    <div>
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-[#ebebeb]">
        {DAYS.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-bold text-[#bbb] uppercase tracking-widest">
            {d}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7" style={{ gridAutoRows: 'minmax(96px, 1fr)' }}>
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="bg-[#fafafa] border-b border-r border-[#f4f4f4]" />
          const iso     = date.toISOString().slice(0, 10)
          const shifts  = shiftsByDate.get(iso) ?? []
          const isToday = iso === today
          const isSel   = iso === selected

          return (
            <button
              key={iso}
              onClick={() => onSelect(iso)}
              className={`flex flex-col items-start p-2 border-b border-r border-[#f4f4f4] text-left transition-colors hover:bg-[#f9f9f9] ${
                isSel ? 'bg-[#f4f4f4]' : ''
              }`}
            >
              <span className={`text-[12px] font-bold mb-1.5 w-6 h-6 flex items-center justify-center rounded-full ${
                isToday ? 'bg-[#111] text-white' : 'text-[#555]'
              }`}>
                {date.getDate()}
              </span>
              <div className="w-full flex flex-col gap-0.5">
                {shifts.slice(0, 2).map((s) => (
                  <ShiftPill key={s.id} shift={s} />
                ))}
                {shifts.length > 2 && (
                  <p className="text-[10px] text-[#aaa] pl-1">+{shifts.length - 2} more</p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Week view ─────────────────────────────────────────────────────────────────

function WeekView({
  anchor, shiftsByDate, today, selected, onSelect,
}: {
  anchor: Date
  shiftsByDate: Map<string, Shift[]>
  today: string
  selected: string | null
  onSelect: (iso: string) => void
}) {
  const days = useMemo(() => buildWeekDays(anchor), [anchor])

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-[#ebebeb]">
        {days.map((d) => {
          const iso     = d.toISOString().slice(0, 10)
          const isToday = iso === today
          return (
            <div key={iso} className="py-3 flex flex-col items-center gap-1 border-r border-[#f4f4f4] last:border-0">
              <p className="text-[10px] font-bold text-[#bbb] uppercase tracking-widest">{DAYS[d.getDay()]}</p>
              <span className={`text-[14px] font-bold w-8 h-8 flex items-center justify-center rounded-full ${
                isToday ? 'bg-[#111] text-white' : 'text-[#555]'
              }`}>
                {d.getDate()}
              </span>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-7" style={{ minHeight: 400 }}>
        {days.map((d) => {
          const iso    = d.toISOString().slice(0, 10)
          const shifts = shiftsByDate.get(iso) ?? []
          const isSel  = iso === selected

          return (
            <button
              key={iso}
              onClick={() => onSelect(iso)}
              className={`flex flex-col gap-1.5 p-3 border-r border-b border-[#f4f4f4] last:border-r-0 text-left align-top hover:bg-[#f9f9f9] transition-colors ${
                isSel ? 'bg-[#f4f4f4]' : ''
              }`}
            >
              {shifts.map((s) => <ShiftPill key={s.id} shift={s} />)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Generate modal ────────────────────────────────────────────────────────────

type GeneratePeriod = 'this-week' | 'next-week' | 'this-month' | 'next-month'

const periodLabels: Record<GeneratePeriod, string> = {
  'this-week':   'This week',
  'next-week':   'Next week',
  'this-month':  'This month',
  'next-month':  'Next month',
}

function loadShiftConfigs(key: string): { id: string; name: string; start: string; end: string }[] {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? [] } catch { return [] }
}

function GenerateModal({ onClose, onManual }: { onClose: () => void; onManual: () => void }) {
  const stationShifts = loadShiftConfigs('ss_station_shifts')
  const convShifts    = loadShiftConfigs('ss_conv_shifts')

  const [period, setPeriod]           = useState<GeneratePeriod>('next-week')
  const [stationEnabled, setStation]  = useState<Record<string, boolean>>(
    Object.fromEntries(stationShifts.map((s) => [s.id, true]))
  )
  const [convEnabled, setConv]        = useState<Record<string, boolean>>(
    Object.fromEntries(convShifts.map((s) => [s.id, true]))
  )
  const [generating, setGenerating]   = useState(false)
  const [done, setDone]               = useState(false)

  function fmt12(t: string) {
    if (!t) return ''
    const [h, m] = t.split(':').map(Number)
    return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`
  }

  function handleGenerate() {
    setGenerating(true)
    setTimeout(() => { setGenerating(false); setDone(true) }, 1200)
  }

  const inputCls = 'bg-[#f9f9f9] border border-[#ebebeb] rounded-xl px-4 py-2.5 text-[13px] font-medium text-[#111] outline-none focus:border-[#ccc] transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-3xl shadow-xl border border-[#ebebeb] w-full max-w-[480px]">
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-[#f4f4f4]">
          <div className="flex items-center gap-2.5">
            <Sparkles size={16} className="text-[#555]" />
            <h2 className="text-[16px] font-bold text-[#111]">Create Schedule</h2>
          </div>
          <button onClick={onClose} className="text-[#bbb] hover:text-[#555] transition-colors">
            <X size={17} />
          </button>
        </div>

        <div className="px-7 py-5 space-y-5">
          {/* Period */}
          <div>
            <label className="block text-[11px] font-semibold tracking-widest text-[#aaa] uppercase mb-2">Period</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(periodLabels) as GeneratePeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`py-2.5 rounded-xl text-[13px] font-semibold border transition-colors ${
                    period === p
                      ? 'bg-[#111] text-white border-[#111]'
                      : 'bg-white text-[#555] border-[#e8e8e8] hover:border-[#ccc]'
                  }`}
                >
                  {periodLabels[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Service station shifts */}
          {stationShifts.length > 0 && (
            <div>
              <label className="block text-[11px] font-semibold tracking-widest text-[#aaa] uppercase mb-2">Service Station Shifts</label>
              <div className="space-y-2">
                {stationShifts.map((s) => (
                  <label key={s.id} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={!!stationEnabled[s.id]}
                      onChange={(e) => setStation((prev) => ({ ...prev, [s.id]: e.target.checked }))}
                      className="w-4 h-4 rounded accent-[#111] cursor-pointer"
                    />
                    <span className="text-[13px] font-semibold text-[#111] flex-1">{s.name || 'Unnamed'}</span>
                    {s.start && s.end && (
                      <span className="text-[12px] font-medium text-[#aaa]">{fmt12(s.start)} – {fmt12(s.end)}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Convenience store shifts */}
          {convShifts.length > 0 && (
            <div>
              <label className="block text-[11px] font-semibold tracking-widest text-[#aaa] uppercase mb-2">Convenience Store Shifts</label>
              <div className="space-y-2">
                {convShifts.map((s) => (
                  <label key={s.id} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={!!convEnabled[s.id]}
                      onChange={(e) => setConv((prev) => ({ ...prev, [s.id]: e.target.checked }))}
                      className="w-4 h-4 rounded accent-[#111] cursor-pointer"
                    />
                    <span className="text-[13px] font-semibold text-[#111] flex-1">{s.name || 'Unnamed'}</span>
                    {s.start && s.end && (
                      <span className="text-[12px] font-medium text-[#aaa]">{fmt12(s.start)} – {fmt12(s.end)}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {stationShifts.length === 0 && convShifts.length === 0 && (
            <p className="text-[13px] font-medium text-[#bbb] py-2">
              No shifts configured. Add shifts in <span className="font-semibold text-[#888]">Settings → Profile</span> first.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 pb-6 pt-2 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-[13px] font-semibold text-[#555] border border-[#e8e8e8] hover:border-[#ccc] transition-colors"
            >
              Cancel
            </button>
            {done ? (
              <span className="text-[13px] font-semibold text-green-600">Schedule generated</span>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#ddd] text-[#333] text-[13px] font-semibold rounded-xl hover:bg-[#f9f9f9] transition-colors disabled:opacity-50"
              >
                <Sparkles size={13} />
                {generating ? 'Creating…' : 'Create'}
              </button>
            )}
          </div>
          <button
            onClick={onManual}
            className="w-full text-center text-[12px] font-medium text-[#bbb] hover:text-[#555] transition-colors"
          >
            Do manually instead
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function SchedulePage({ storeLabel }: { storeLabel?: string } = {}) {
  const now   = new Date()
  const today = now.toISOString().slice(0, 10)

  const { user } = useAuth()
  const isApprover  = approverRoles.has(user?.role ?? '')
  const isRequester = requesterRoles.has(user?.role ?? '')

  const [view, setView]         = useState<ViewMode>('month')
  const [year, setYear]         = useState(now.getFullYear())
  const [month, setMonth]       = useState(now.getMonth())
  const [weekAnchor, setWeekAnchor] = useState(now)
  const [selected, setSelected] = useState<string | null>(null)
  const [showTimeOff, setShowTimeOff]       = useState(false)
  const [showApprovals, setShowApprovals]   = useState(false)

  const { data: timeOffRequests = [] } = useTimeOffRequests()
  const pendingCount = timeOffRequests.filter((r) => r.status === 'Pending').length

  // Date range for the current view
  const [rangeStart, rangeEnd] = view === 'month'
    ? monthRange(year, month)
    : weekRange(weekAnchor)

  const { data: shifts = [], isLoading } = useShiftsInRange(rangeStart, rangeEnd)

  const shiftsByDate = useMemo(() => {
    const m = new Map<string, Shift[]>()
    for (const s of shifts) {
      const list = m.get(s.date) ?? []
      list.push(s)
      m.set(s.date, list)
    }
    return m
  }, [shifts])

  const selectedShifts = selected ? (shiftsByDate.get(selected) ?? []) : []

  function prevPeriod() {
    if (view === 'month') {
      if (month === 0) { setYear((y) => y - 1); setMonth(11) }
      else setMonth((m) => m - 1)
    } else {
      const d = new Date(weekAnchor)
      d.setDate(d.getDate() - 7)
      setWeekAnchor(d)
    }
    setSelected(null)
  }

  function nextPeriod() {
    if (view === 'month') {
      if (month === 11) { setYear((y) => y + 1); setMonth(0) }
      else setMonth((m) => m + 1)
    } else {
      const d = new Date(weekAnchor)
      d.setDate(d.getDate() + 7)
      setWeekAnchor(d)
    }
    setSelected(null)
  }

  function goToday() {
    setYear(now.getFullYear())
    setMonth(now.getMonth())
    setWeekAnchor(now)
    setSelected(null)
  }

  const periodLabel = view === 'month'
    ? `${MONTHS[month]} ${year}`
    : (() => {
        const days = buildWeekDays(weekAnchor)
        const s = days[0], e = days[6]
        if (s.getMonth() === e.getMonth())
          return `${MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`
        return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`
      })()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebebeb] bg-white flex-shrink-0 gap-4 flex-wrap">
        <div>
          {storeLabel && (
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-0.5">{storeLabel}</p>
          )}
          <h1 className="text-[20px] font-bold text-[#111]">Schedule</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Create */}
          <button
            onClick={() => setShowGenerate(true)}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-white border border-[#ddd] text-[#333] text-[13px] font-semibold rounded-xl hover:bg-[#f9f9f9] transition-colors"
          >
            <Sparkles size={13} />
            Create
          </button>

          {/* Period navigation */}
          <button
            onClick={prevPeriod}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:text-[#111] hover:bg-[#f4f4f4] transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-[14px] font-bold text-[#111] min-w-[180px] text-center">{periodLabel}</span>
          <button
            onClick={nextPeriod}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:text-[#111] hover:bg-[#f4f4f4] transition-colors"
          >
            <ChevronRight size={16} />
          </button>

          {/* Today */}
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-[12px] font-semibold text-[#555] border border-[#e0e0e0] rounded-lg hover:border-[#ccc] hover:text-[#111] transition-colors ml-1"
          >
            Today
          </button>

          {/* Time-off buttons */}
          {isApprover && (
            <button
              onClick={() => setShowApprovals(true)}
              className="relative px-3 py-1.5 text-[12px] font-semibold text-[#555] border border-[#e0e0e0] rounded-lg hover:border-[#ccc] hover:text-[#111] transition-colors"
            >
              Requests
              {pendingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-[#111] text-white text-[9px] font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
          )}
          {isRequester && (
            <button
              onClick={() => setShowTimeOff(true)}
              className="px-3 py-1.5 text-[12px] font-semibold text-[#555] border border-[#e0e0e0] rounded-lg hover:border-[#ccc] hover:text-[#111] transition-colors"
            >
              Day Off
            </button>
          )}

          {/* View toggle */}
          <div className="flex items-center bg-[#f4f4f4] rounded-lg p-0.5 ml-1">
            {(['week', 'month'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => { setView(v); setSelected(null) }}
                className={`px-3 py-1 text-[12px] font-semibold rounded-md capitalize transition-colors ${
                  view === v ? 'bg-white text-[#111] shadow-sm' : 'text-[#888] hover:text-[#555]'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto bg-white min-w-0">
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <p className="text-[13px] font-semibold text-[#bbb]">Loading…</p>
            </div>
          ) : view === 'month' ? (
            <MonthView
              year={year}
              month={month}
              shiftsByDate={shiftsByDate}
              today={today}
              selected={selected}
              onSelect={setSelected}
            />
          ) : (
            <WeekView
              anchor={weekAnchor}
              shiftsByDate={shiftsByDate}
              today={today}
              selected={selected}
              onSelect={setSelected}
            />
          )}

          {/* Time off requests */}
          <div className="border-t border-[#e8e8e8] p-5">
            <p className="mb-4">
              <span className="text-[13px] font-bold text-[#111]">Time Off</span>
              <span className="text-[13px] font-medium text-[#aaa]"> | Requests</span>
            </p>
            <div className="grid grid-cols-[28px_1fr_1fr_1fr_auto] gap-3 mb-2">
              {['#', 'Employee', 'Date', 'Reason', 'Status'].map((h) => (
                <p key={h} className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
              ))}
            </div>
            <div className="py-8 flex items-center justify-center">
              <p className="text-[13px] font-medium text-[#bbb]">No time off requests</p>
            </div>
            <div className="flex items-center justify-between border-t border-[#f0f0f0] pt-3">
              <button className="text-[12px] font-semibold text-[#888] hover:text-[#111] transition-colors">view all</button>
              <p className="text-[13px] font-bold text-[#bbb]">0 requests</p>
            </div>
          </div>
        </div>

        {/* Day detail panel */}
        {selected && (
          <DayPanel
            date={new Date(selected + 'T00:00:00')}
            shifts={selectedShifts}
            onClose={() => setSelected(null)}
          />
        )}
      </div>

      {showTimeOff && (
        <TimeOffModal
          defaultDate={selected ?? today}
          onClose={() => setShowTimeOff(false)}
        />
      )}
      {showApprovals && (
        <ApprovalsModal onClose={() => setShowApprovals(false)} />
      )}
    </div>
  )
}
