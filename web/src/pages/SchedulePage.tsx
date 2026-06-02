import { useState, useMemo, useRef, useEffect, createContext, useContext } from 'react'
import { LogoLoader } from '../components/StationSyncLogo'
import { AlertTriangle, ArrowUpRight, Check, ChevronLeft, ChevronRight, Fuel, MoreHorizontal, Pencil, ShoppingCart, Sparkles, X } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useShiftsInRange, useShiftAttendance, useShiftDeposits, useShiftFuelPrices, useTimeOffRequests, useUsers, usePumps } from '../hooks/useApi'
import { createTimeOffRequest, reviewTimeOffRequest, type Shift, type TimeOffRequest, type User, type Pump } from '../lib/api'
import { useAuth } from '../lib/authContext'
import { useQueryClient } from '@tanstack/react-query'

const approverRoles = new Set(['Super Admin', 'Admin', 'Manager'])
const requesterRoles = new Set(['Supervisor', 'Attendant'])

type ViewMode = 'month' | 'week'
type ScheduleType = 'station' | 'convenience'
type ShiftSlot = 'morning' | 'evening'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const SHIFT_LABELS: Record<ShiftSlot, string> = {
  morning: 'Morning  ·  6:00 AM – 2:00 PM',
  evening: 'Evening  ·  2:00 PM – 10:00 PM',
}

// ── Schedule draft types ──────────────────────────────────────────────────────

interface AttendantAssignment {
  userId: string
  userName: string
  pumpIds: string[]
}

interface DayPlan {
  supMorning: string | null
  supEvening: string | null
  staffMorning: AttendantAssignment[]
  staffEvening: AttendantAssignment[]
  cashierMorning: AttendantAssignment[]
  cashierEvening: AttendantAssignment[]
}

interface ScheduleDraft {
  type: ScheduleType
  startISO: string
  endISO: string
  supervisors: User[]
  staff: User[]
  cashiers: User[]
  days: Record<string, DayPlan>
}

function emptyDay(): DayPlan {
  return { supMorning: null, supEvening: null, staffMorning: [], staffEvening: [], cashierMorning: [], cashierEvening: [] }
}

function isDayInDraft(iso: string, draft: ScheduleDraft): boolean {
  return iso >= draft.startISO && iso <= draft.endISO
}

/** Returns the published schedule from the array that covers `iso`, or null. */
function findScheduleForDay(iso: string, schedules: ScheduleDraft[]): ScheduleDraft | null {
  return schedules.find((s) => isDayInDraft(iso, s)) ?? null
}

// ── Calendar helpers ──────────────────────────────────────────────────────────

function fmt12(time24: string): string {
  const [h, m] = time24.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')}${suffix}`
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const cells: Date[] = []
  // Leading days from previous month
  for (let i = first.getDay() - 1; i >= 0; i--) {
    cells.push(new Date(year, month, -i)) // day 0 = last of prev month, -1 = 2nd to last, …
  }
  // Days in this month
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d))
  // Trailing days from next month
  let next = 1
  while (cells.length % 7 !== 0) cells.push(new Date(year, month + 1, next++))
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

function prevDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

// ── Shared status chip ────────────────────────────────────────────────────────

function statusChip(status: TimeOffRequest['status']) {
  if (status === 'Approved') return <span className="text-[11px] font-medium text-[#2e7d32]">Approved</span>
  if (status === 'Rejected') return <span className="text-[11px] font-medium text-[#c62828]">Rejected</span>
  return <span className="text-[11px] font-medium text-[#888]">Pending</span>
}

// ── Time-off modal ────────────────────────────────────────────────────────────

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
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-[400px] shadow-xl max-h-[80vh] flex flex-col">
        <div className="px-5 py-4 border-b border-[#ebebeb] dark:border-[#222] flex items-center justify-between flex-shrink-0">
          {view === 'form' ? (
            <button onClick={() => { setView('list'); setError(null) }} className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] flex items-center gap-1.5 hover:text-[#555] dark:hover:text-[#999] transition-colors">
              <ChevronLeft size={14} /> Day Off Requests
            </button>
          ) : (
            <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0]">Day Off Requests</p>
          )}
          <div className="flex items-center gap-2">
            {view === 'list' && (
              <button onClick={() => setView('form')} className="px-3 py-1 text-[11px] font-semibold text-[#111] dark:text-[#e0e0e0] border border-[#e0e0e0] dark:border-[#2a2a2a] rounded-lg hover:border-[#ccc] dark:hover:border-[#444] transition-colors">
                + New
              </button>
            )}
            <button onClick={onClose} className="text-[#bbb] dark:text-[#444] hover:text-[#555] dark:hover:text-[#999] text-[18px] leading-none transition-colors">&times;</button>
          </div>
        </div>
        {view === 'list' && (
          <div className="flex-1 overflow-y-auto">
            {requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-[13px] font-semibold text-[#bbb]">No requests yet</p>
              </div>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-5 py-3.5 border-b border-[#f4f4f4] dark:border-[#1e1e1e] last:border-0 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0]">
                      {new Date(r.date + 'T00:00:00').toLocaleDateString('en-JM', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    {r.reason && <p className="text-[11px] text-[#aaa] dark:text-[#555] truncate">{r.reason}</p>}
                  </div>
                  <div className="shrink-0">{statusChip(r.status)}</div>
                </div>
              ))
            )}
          </div>
        )}
        {view === 'form' && (
          <div className="p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-[#aaa] dark:text-[#555]">Date</label>
              <input type="date" value={date} min={today} onChange={(e) => { setDate(e.target.value); setError(null) }}
                className="border border-[#ebebeb] dark:border-[#222] rounded-lg px-3 py-2 text-[13px] text-[#111] dark:text-[#e0e0e0] bg-white dark:bg-[#1a1a1a] focus:outline-none focus:border-[#111] dark:focus:border-[#e0e0e0] transition-colors" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-[#aaa] dark:text-[#555]">Reason <span className="text-[#ccc] dark:text-[#444]">(optional)</span></label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Add a note…"
                className="border border-[#ebebeb] dark:border-[#222] rounded-lg px-3 py-2 text-[13px] text-[#111] dark:text-[#e0e0e0] bg-white dark:bg-[#1a1a1a] placeholder:text-[#ccc] dark:placeholder:text-[#444] focus:outline-none focus:border-[#111] dark:focus:border-[#e0e0e0] transition-colors resize-none" />
            </div>
            {error && <p className="text-[12px] text-[#c62828]">{error}</p>}
            <button onClick={submit} disabled={!date || saving}
              className="w-full py-2.5 rounded-lg bg-[#111] text-white text-[13px] font-semibold disabled:opacity-40 transition-opacity">
              {saving ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Selected-shift context ────────────────────────────────────────────────────
//
// Lets the calendar cells (ShiftPill) drive which shift is shown in the right
// column without prop-drilling through MonthView / WeekView. Also exposes a
// "station supervisor for a given date" lookup — c-store shifts are opened by
// a Cashier (stored in shifts.supervisor_name), so their real supervisor is
// whichever Supervisor opened the station shift on the same date.

interface SelectedShiftCtx {
  shiftId: string | null
  select: (id: string | null) => void
  /** Returns the supervisor of the station shift on `date`, or null if none. */
  getStationSupervisorForDate: (date: string) => string | null
}
const SelectedShiftContext = createContext<SelectedShiftCtx>({
  shiftId: null,
  select: () => {},
  getStationSupervisorForDate: () => null,
})

// ── Shift pill ────────────────────────────────────────────────────────────────
//
// Rounded container on each calendar cell summarising one closed/open shift:
// a small type identifier (service-station vs convenience-store) and the
// people working it — supervisor + attendants for a station shift, cashiers
// for a c-store shift. Names are deduped and truncated to keep the card tidy.
// Clicking the pill selects that shift; the right-column panel then shows
// only this shift instead of the full day list.

function ShiftPill({ shift }: { shift: Shift }) {
  const { data: attendance = [] } = useShiftAttendance(shift.id)
  const { shiftId: selectedShiftId, select, getStationSupervisorForDate } = useContext(SelectedShiftContext)
  const isSelected = selectedShiftId === shift.id
  const open = shift.end_time == null
  const isCStore = shift.shift_type === 'convenience_store'
  // c-store shifts are opened by a Cashier (stored as supervisor_name); the
  // real "Supervisor" for the c-store comes from the station shift on the same
  // date. For station shifts, supervisor_name is the actual Supervisor.
  const supervisorName = isCStore
    ? getStationSupervisorForDate(shift.date)
    : shift.supervisor_name

  const Icon = isCStore ? ShoppingCart : Fuel
  const typeBadge = isCStore
    ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400'
    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
  const typeLabel = isCStore ? 'C-Store' : 'Station'

  // Deduplicate names. For c-store shifts, ensure the opener (stored in
  // shift.supervisor_name — actually a Cashier) appears in the cashier list,
  // even if they haven't yet logged a shift_attendance row.
  const seen = new Set<string>()
  const attendees: string[] = []
  if (isCStore && shift.supervisor_name) {
    seen.add(shift.supervisor_name)
    attendees.push(shift.supervisor_name)
  }
  for (const a of attendance) {
    if (!a.user_name || seen.has(a.user_name)) continue
    seen.add(a.user_name)
    attendees.push(a.user_name)
  }
  const peopleLabel = isCStore ? 'Cashiers' : 'Attendants'

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); select(isSelected ? null : shift.id) }}
      className={`text-left w-full flex flex-col gap-1 px-2 py-1.5 rounded-xl border transition-colors overflow-hidden ${
        isSelected
          ? 'border-[#111] dark:border-[#e0e0e0] ring-2 ring-[#111]/10 dark:ring-[#e0e0e0]/15 bg-white dark:bg-[#161616]'
          : open
            ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 hover:border-emerald-300 dark:hover:border-emerald-800'
            : 'border-[#ebebeb] dark:border-[#222] bg-white dark:bg-[#161616] hover:border-[#ddd] dark:hover:border-[#333]'
      }`}>
      {/* Top row: type identifier + open/closed dot */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${typeBadge}`} title={isCStore ? 'Convenience Store' : 'Service Station'}>
          <Icon size={8} strokeWidth={2.5} />
          <span className="text-[8px] font-bold uppercase tracking-wider">{typeLabel}</span>
        </span>
        <span className={`shrink-0 w-1 h-1 rounded-full ${open ? 'bg-emerald-500' : 'bg-[#ccc] dark:bg-[#444]'}`} />
        <span className="text-[9px] font-semibold text-[#888] dark:text-[#666] truncate">
          {open ? 'Open' : 'Closed'}
        </span>
      </div>

      {/* Supervisor — actual Supervisor for station shifts; for c-store the
          station-shift supervisor on the same date (or hidden if none). */}
      {supervisorName && (
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[8px] font-bold uppercase tracking-wider text-[#bbb] dark:text-[#555] shrink-0">Sup</span>
          <span className="text-[10px] font-semibold text-[#333] dark:text-[#ccc] truncate">{supervisorName}</span>
        </div>
      )}

      {/* Attendants / cashiers list (compact, deduped) */}
      {attendees.length > 0 ? (
        <div className="flex items-start gap-1 min-w-0">
          <span className="text-[8px] font-bold uppercase tracking-wider text-[#bbb] dark:text-[#555] shrink-0 mt-px">
            {peopleLabel.slice(0, 4)}
          </span>
          <span className="text-[10px] font-medium text-[#555] dark:text-[#999] leading-tight line-clamp-2">
            {attendees.join(', ')}
          </span>
        </div>
      ) : (
        <span className="text-[9px] text-[#bbb] dark:text-[#555] italic">No {peopleLabel.toLowerCase()} yet</span>
      )}
    </button>
  )
}

// ── Shift card (in day panel) ─────────────────────────────────────────────────

function ShiftCard({ s }: { s: Shift }) {
  const navigate = useNavigate()
  const { data: attendance = [] } = useShiftAttendance(s.id)
  const { data: deposits = [] }   = useShiftDeposits(s.id)
  const { data: fuelPrices = [] } = useShiftFuelPrices(s.id)
  const { getStationSupervisorForDate } = useContext(SelectedShiftContext)
  const depositTotal = deposits.reduce((sum, d) => sum + d.amount, 0)
  const open = s.end_time == null
  const isCStore = s.shift_type === 'convenience_store'
  // c-store opener (s.supervisor_name) is a Cashier, NOT a supervisor. The
  // real supervisor for the c-store is the station-shift supervisor on the
  // same date.
  const supervisorName = isCStore
    ? getStationSupervisorForDate(s.date)
    : s.supervisor_name

  // Convenience: cashiers come from attendance; service station attendants too.
  // Whichever role the shift type implies, we label the section accordingly.
  const sectionLabel = isCStore ? 'Cashiers' : 'Attendants'
  const salesRoute = isCStore ? '/convenience/sales' : '/sales'

  function fmtClock(ts: string | null): string {
    if (!ts) return '—'
    return new Date(ts).toLocaleTimeString('en-JM', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
  }

  return (
    <div className="border border-[#ebebeb] dark:border-[#222] rounded-xl bg-white dark:bg-[#1a1a1a]">
      {/* Header: type identifier on its own row, with status; clock times below */}
      <div className="px-4 py-3 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            isCStore ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400'
                     : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
          }`}>
            {isCStore ? <ShoppingCart size={9} strokeWidth={2.5} /> : <Fuel size={9} strokeWidth={2.5} />}
            {isCStore ? 'C-Store' : 'Station'}
          </span>
          <span className={`shrink-0 text-[11px] font-medium ${open ? 'text-[#2e7d32]' : 'text-[#aaa] dark:text-[#555]'}`}>
            {open ? 'Open' : 'Closed'}
          </span>
        </div>
        <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] truncate tabular-nums">
          {fmt12(s.start_time)}{s.end_time ? ` – ${fmt12(s.end_time)}` : ''}
        </p>
      </div>

      {/* Redirect to sales for this shift */}
      <button
        onClick={() => navigate({ to: salesRoute, search: { shift: s.id } as any })}
        className="w-full px-4 py-2.5 border-t border-[#f4f4f4] dark:border-[#1e1e1e] flex items-center justify-between text-left hover:bg-[#fafafa] dark:hover:bg-[#161616] transition-colors group"
      >
        <span className="text-[12px] font-semibold text-[#333] dark:text-[#ccc]">View sales</span>
        <span className="flex items-center gap-1 text-[11px] font-medium text-[#888] dark:text-[#666] group-hover:text-[#111] dark:group-hover:text-[#e0e0e0] transition-colors">
          More info <ArrowUpRight size={11} />
        </span>
      </button>

      {/* Supervisor — actual Supervisor for station shifts; for c-store, the
          station-shift supervisor on the same date. */}
      {supervisorName && (
        <div className="px-4 py-2.5 border-t border-[#f4f4f4] dark:border-[#1e1e1e]">
          <p className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase mb-2">Supervisor</p>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#111] dark:bg-[#e0e0e0] text-white dark:text-[#111] flex items-center justify-center text-[10px] font-bold shrink-0">
              {supervisorName.charAt(0).toUpperCase()}
            </div>
            <p className="text-[12px] font-medium text-[#333] dark:text-[#ccc] flex-1">{supervisorName}</p>
          </div>
        </div>
      )}

      {/* Attendants / Cashiers — grouped per person, pumps above clock times */}
      {(() => {
        // Group rows by user so one attendant who covers multiple pumps shows
        // up as a single block listing all their pumps.
        const groups = new Map<string, {
          userName: string
          pumps: string[]
          clockIn: string | null
          clockOut: string | null
        }>()

        // For c-store shifts, the opener (stored in s.supervisor_name) is a
        // Cashier — make sure they appear in the cashier list using the shift
        // start_time/end_time as their clock-in/out, even if no attendance
        // row exists for them yet.
        if (isCStore && s.supervisor_id && s.supervisor_name) {
          const startTs = `${s.date}T${s.start_time}`
          const endTs = s.end_time ? `${s.date}T${s.end_time}` : null
          groups.set(s.supervisor_id, {
            userName: s.supervisor_name, pumps: [], clockIn: startTs, clockOut: endTs,
          })
        }

        for (const a of attendance) {
          const g = groups.get(a.user_id) ?? { userName: a.user_name, pumps: [], clockIn: a.clock_in, clockOut: a.clock_out }
          if (a.pump_name) g.pumps.push(a.pump_name)
          // Earliest clock-in / latest clock-out across the person's rows.
          if (a.clock_in && (!g.clockIn || a.clock_in < g.clockIn)) g.clockIn = a.clock_in
          if (a.clock_out && (!g.clockOut || a.clock_out > g.clockOut)) g.clockOut = a.clock_out
          groups.set(a.user_id, g)
        }
        const rows = Array.from(groups.entries())
        if (rows.length === 0) return null

        return (
          <div className="px-4 py-2.5 border-t border-[#f4f4f4] dark:border-[#1e1e1e]">
            <p className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase mb-2">{sectionLabel}</p>
            <div className="flex flex-col gap-2.5">
              {rows.map(([userId, g]) => (
                <div key={userId} className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#111] dark:bg-[#e0e0e0] text-white dark:text-[#111] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    {g.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[#333] dark:text-[#ccc] truncate">{g.userName}</p>
                    <p className="text-[10px] text-[#aaa] dark:text-[#555] tabular-nums mt-0.5">
                      In <span className="text-[#555] dark:text-[#999]">{fmtClock(g.clockIn)}</span>
                      {' · '}Out <span className={g.clockOut ? 'text-[#555] dark:text-[#999]' : 'text-emerald-600 dark:text-emerald-400 font-semibold'}>{g.clockOut ? fmtClock(g.clockOut) : 'still on'}</span>
                    </p>
                    {g.pumps.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        {g.pumps.map((p) => {
                          // Show just the trailing pump number when the name is
                          // like "Pump 3" / "Pump #3"; fall back to the raw name.
                          const num = p.match(/(\d+)\s*$/)?.[1] ?? p
                          return (
                            <span key={p} title={p}
                              className="inline-flex items-center gap-1 px-1.5 h-5 rounded-md bg-[#f4f4f4] dark:bg-[#222] text-[#555] dark:text-[#999]">
                              <Fuel size={10} strokeWidth={2.5} />
                              <span className="text-[10px] font-bold tabular-nums leading-none">{num}</span>
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {deposits.length > 0 && (
        <div className="px-4 py-2.5 border-t border-[#f4f4f4] dark:border-[#1e1e1e] flex items-center justify-between">
          <p className="text-[11px] text-[#aaa] dark:text-[#555]">Deposits</p>
          <p className="text-[12px] font-medium text-[#333] dark:text-[#ccc]">
            J${depositTotal.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      )}
      {fuelPrices.length > 0 && (
        <div className="px-4 py-2.5 border-t border-[#f4f4f4] dark:border-[#1e1e1e]">
          <p className="text-[11px] text-[#aaa] dark:text-[#555] mb-2">Fuel Prices</p>
          <div className="flex flex-col gap-1">
            {fuelPrices.map((fp) => (
              <div key={fp.fuel_id} className="flex items-center justify-between">
                <p className="text-[12px] text-[#888] dark:text-[#666]">{fp.fuel_name}</p>
                <p className="text-[12px] font-medium text-[#333] dark:text-[#ccc]">J${fp.price.toFixed(2)}</p>
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
    <div className="w-[280px] shrink-0 border-l border-[#ebebeb] dark:border-[#222] bg-white dark:bg-[#1a1a1a] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#ebebeb] dark:border-[#222]">
        <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0]">{label}</p>
        <button onClick={onClose} className="text-[#bbb] dark:text-[#444] hover:text-[#555] dark:hover:text-[#999] text-[18px] leading-none transition-colors">&times;</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {shifts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <p className="text-[13px] font-semibold text-[#bbb] dark:text-[#444]">No shift</p>
            <p className="text-[11px] text-[#ccc] dark:text-[#444]">No shift was recorded for this day.</p>
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

// ── Published day detail panel ────────────────────────────────────────────────

function PublishedDayPanel({
  date,
  schedule,
  onClose,
  onEdit,
}: {
  date: string
  schedule: ScheduleDraft
  onClose: () => void
  onEdit?: () => void
}) {
  const plan = schedule.days[date] ?? emptyDay()
  const label = new Date(date + 'T00:00:00').toLocaleDateString('en-JM', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  const supMorning = plan.supMorning
    ? schedule.supervisors.find((u) => u.id === plan.supMorning)?.name ?? null
    : null
  const supEvening = plan.supEvening
    ? schedule.supervisors.find((u) => u.id === plan.supEvening)?.name ?? null
    : null

  function StaffRows({ assignments, dotColor }: { assignments: AttendantAssignment[]; dotColor: string }) {
    if (assignments.length === 0)
      return <p className="text-[12px] text-[#ccc] dark:text-[#444] italic">None assigned</p>
    return (
      <div className="flex flex-col gap-1.5">
        {assignments.map((a) => (
          <div key={a.userId} className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded-full ${dotColor} text-white flex items-center justify-center text-[9px] font-bold shrink-0`}>
              {a.userName.charAt(0).toUpperCase()}
            </div>
            <p className="text-[12px] text-[#333] dark:text-[#ccc]">{a.userName}</p>
          </div>
        ))}
      </div>
    )
  }

  function SlotSection({ slot }: { slot: ShiftSlot }) {
    const isAM      = slot === 'morning'
    const supName    = isAM ? supMorning   : supEvening
    const attendants = isAM ? plan.staffMorning   : plan.staffEvening
    const cashiers   = isAM ? plan.cashierMorning : plan.cashierEvening
    return (
      <div className="border border-[#ebebeb] dark:border-[#222] rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-[#fafafa] dark:bg-[#111] border-b border-[#f4f4f4] dark:border-[#1e1e1e] flex items-center justify-between">
          <span className={`text-[11px] font-bold uppercase tracking-widest ${isAM ? 'text-amber-500' : 'text-amber-600'}`}>
            {isAM ? 'AM' : 'PM'}
          </span>
          <span className="text-[10px] text-[#ccc] dark:text-[#444]">{isAM ? '6:00 – 14:00' : '14:00 – 22:00'}</span>
        </div>
        <div className="px-4 py-3 flex flex-col gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase mb-1.5">Supervisor</p>
            {supName ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-[#222] dark:bg-[#d4d4d4] text-white dark:text-[#111] flex items-center justify-center text-[9px] font-bold shrink-0">
                  {supName.charAt(0).toUpperCase()}
                </div>
                <p className="text-[12px] text-[#333] dark:text-[#ccc]">{supName}</p>
              </div>
            ) : (
              <p className="text-[12px] text-[#ccc] dark:text-[#444] italic">Not assigned</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase mb-1.5">Attendants</p>
            <StaffRows assignments={attendants} dotColor="bg-[#aaa] dark:bg-[#666]" />
          </div>
          {cashiers.length > 0 && (
            <div>
              <p className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase mb-1.5">Cashiers</p>
              <StaffRows assignments={cashiers} dotColor="bg-blue-400 dark:bg-blue-600" />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-[280px] shrink-0 border-l border-[#ebebeb] dark:border-[#222] bg-white dark:bg-[#1a1a1a] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#ebebeb] dark:border-[#222]">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-widest text-emerald-500 dark:text-emerald-400 uppercase mb-0.5">Published</p>
          <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] truncate">{label}</p>
        </div>
        <button
          onClick={onClose}
          className="text-[#bbb] dark:text-[#444] hover:text-[#555] dark:hover:text-[#999] text-[18px] leading-none transition-colors ml-3"
        >
          &times;
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <SlotSection slot="morning" />
        <SlotSection slot="evening" />
      </div>
      {onEdit && (
        <div className="px-4 pb-4">
          <button
            onClick={onEdit}
            className="w-full py-2.5 rounded-xl border border-[#ebebeb] dark:border-[#222] text-[13px] font-semibold text-[#333] dark:text-[#ccc] hover:bg-[#f9f9f9] dark:hover:bg-[#222] transition-colors"
          >
            Edit schedule
          </button>
        </div>
      )}
    </div>
  )
}

// ── Create Schedule Wizard ────────────────────────────────────────────────────

function CreateScheduleWizard({
  onClose,
  onCreate,
  publishedSchedules,
}: {
  onClose: () => void
  onCreate: (draft: ScheduleDraft) => void
  publishedSchedules: ScheduleDraft[]
}) {
  const today = new Date().toISOString().slice(0, 10)
  const { data: users = [] } = useUsers()

  const [step, setStep]           = useState<'start' | 'end'>('start')
  const [startDate, setStartDate] = useState<string | null>(null)
  const [hoverEnd, setHoverEnd]   = useState<string | null>(null)

  const nowD = new Date()
  const [calYear, setCalYear]   = useState(nowD.getFullYear())
  const [calMonth, setCalMonth] = useState(nowD.getMonth())

  // Expand all published schedules into a flat set of disabled ISO dates
  const disabledDates = useMemo(() => {
    const s = new Set<string>()
    for (const ps of publishedSchedules) {
      const cur = new Date(ps.startISO + 'T00:00:00')
      const end = new Date(ps.endISO   + 'T00:00:00')
      while (cur <= end) {
        s.add(cur.toISOString().slice(0, 10))
        cur.setDate(cur.getDate() + 1)
      }
    }
    return s
  }, [publishedSchedules])

  const cells = useMemo(() => buildMonthGrid(calYear, calMonth), [calYear, calMonth])

  function goPrevMonth() {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11) }
    else setCalMonth((m) => m - 1)
  }
  function goNextMonth() {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0) }
    else setCalMonth((m) => m + 1)
  }

  function goBackToStart() {
    setStep('start')
    setHoverEnd(null)
    // Re-focus calendar on the already-picked start date so user sees their selection
    if (startDate) {
      const d = new Date(startDate + 'T00:00:00')
      setCalYear(d.getFullYear())
      setCalMonth(d.getMonth())
    }
  }

  function handleDayClick(iso: string) {
    if (step === 'start') {
      setStartDate(iso)
      // Advance calendar to that month for the end picker
      const d = new Date(iso + 'T00:00:00')
      setCalYear(d.getFullYear())
      setCalMonth(d.getMonth())
      setHoverEnd(null)
      setStep('end')
    } else {
      if (!startDate) return
      onCreate({
        type: 'station',
        startISO: startDate,
        endISO: iso,
        supervisors: users.filter((u) => u.role === 'Supervisor' && u.active !== false),
        staff:       users.filter((u) => u.role === 'Attendant'  && u.active !== false),
        cashiers:    users.filter((u) => u.role === 'Cashier'    && u.active !== false),
        days: {},
      })
      onClose()
    }
  }

  // Live end of the range preview — only valid when hovered date ≥ startDate
  const activeRangeEnd = step === 'end' && hoverEnd && startDate && hoverEnd >= startDate
    ? hoverEnd
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xl w-full max-w-[360px] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#ebebeb] dark:border-[#222]">
          {step === 'end' ? (
            <button
              onClick={goBackToStart}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] hover:text-[#555] dark:hover:text-[#999] transition-colors"
            >
              <ChevronLeft size={14} /> Back
            </button>
          ) : (
            <h2 className="text-[14px] font-bold text-[#111] dark:text-[#e0e0e0]">New Schedule</h2>
          )}
          <button onClick={onClose} className="text-[#bbb] dark:text-[#444] hover:text-[#555] dark:hover:text-[#999] transition-colors">
            <X size={17} />
          </button>
        </div>

        {/* Step info */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full transition-colors ${step === 'start' ? 'bg-[#111] dark:bg-[#e0e0e0]' : 'bg-[#ccc] dark:bg-[#444]'}`} />
              <div className={`w-1.5 h-1.5 rounded-full transition-colors ${step === 'end'   ? 'bg-[#111] dark:bg-[#e0e0e0]' : 'bg-[#ccc] dark:bg-[#444]'}`} />
            </div>
            <span className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase">
              Step {step === 'start' ? '1' : '2'} of 2
            </span>
          </div>
          <p className="text-[16px] font-bold text-[#111] dark:text-[#e0e0e0]">
            {step === 'start' ? 'Start Date' : 'End Date'}
          </p>
          {step === 'end' && startDate && (
            <p className="text-[11px] text-[#aaa] dark:text-[#555] mt-0.5">
              Starting{' '}
              {new Date(startDate + 'T00:00:00').toLocaleDateString('en-JM', {
                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
              })}
            </p>
          )}
        </div>

        {/* Calendar */}
        <div className="px-4 pb-5">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={goPrevMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#888] dark:text-[#666] hover:bg-[#f4f4f4] dark:hover:bg-[#222] hover:text-[#111] dark:hover:text-[#e0e0e0] transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <p className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">
              {MONTHS[calMonth]} {calYear}
            </p>
            <button
              onClick={goNextMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#888] dark:text-[#666] hover:bg-[#f4f4f4] dark:hover:bg-[#222] hover:text-[#111] dark:hover:text-[#e0e0e0] transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="h-7 flex items-center justify-center">
                <span className="text-[10px] font-bold text-[#bbb] dark:text-[#444]">{d.charAt(0)}</span>
              </div>
            ))}
          </div>

          {/* Date cells */}
          <div className="grid grid-cols-7">
            {cells.map((date) => {
              const iso         = date.toISOString().slice(0, 10)
              const isThisMonth = date.getMonth() === calMonth
              const isToday     = iso === today
              const isDisabled  = disabledDates.has(iso) ||
                (step === 'end' && startDate !== null && iso < startDate)
              const isStart      = iso === startDate
              const isRangeEnd   = activeRangeEnd !== null && iso === activeRangeEnd && !isDisabled
              const isRangeStart = isStart && activeRangeEnd !== null
              const isInRange    = startDate !== null && activeRangeEnd !== null &&
                iso > startDate && iso < activeRangeEnd

              return (
                <div key={iso} className="h-9 flex items-center justify-center relative select-none">
                  {/* Horizontal range stripe */}
                  {(isInRange || isRangeStart || isRangeEnd) && (
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 h-8 bg-[#f0f0f0] dark:bg-[#252525] pointer-events-none ${
                        isRangeStart
                          ? 'left-1/2 right-0'
                          : isRangeEnd
                          ? 'left-0 right-1/2'
                          : 'left-0 right-0'
                      }`}
                    />
                  )}
                  <button
                    disabled={isDisabled}
                    onClick={() => !isDisabled && handleDayClick(iso)}
                    onMouseEnter={() => { if (step === 'end' && !isDisabled) setHoverEnd(iso) }}
                    onMouseLeave={() => { if (step === 'end') setHoverEnd(null) }}
                    className={[
                      'relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-[12px] transition-colors',
                      isStart || isRangeEnd
                        ? 'bg-[#111] dark:bg-[#e0e0e0] text-white dark:text-[#111] font-bold'
                        : isToday && !isDisabled
                        ? 'ring-1 ring-[#ccc] dark:ring-[#444]'
                        : '',
                      isDisabled
                        ? 'text-[#ccc] dark:text-[#333] cursor-not-allowed'
                        : !isStart && !isRangeEnd
                        ? isThisMonth
                          ? 'text-[#111] dark:text-[#e0e0e0] hover:bg-[#e8e8e8] dark:hover:bg-[#2a2a2a] cursor-pointer'
                          : 'text-[#bbb] dark:text-[#555] hover:bg-[#f4f4f4] dark:hover:bg-[#222] cursor-pointer'
                        : '',
                    ].join(' ')}
                  >
                    {date.getDate()}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Edit Date Range Modal ─────────────────────────────────────────────────────

function EditDateRangeModal({
  startISO,
  endISO,
  onSave,
  onClose,
}: {
  startISO: string
  endISO: string
  onSave: (start: string, end: string) => void
  onClose: () => void
}) {
  const [start, setStart] = useState(startISO)
  const [end,   setEnd]   = useState(endISO)
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    if (!start || !end)  { setError('Select both dates.'); return }
    if (end < start)     { setError('End date must be on or after start date.'); return }
    onSave(start, end)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xl w-full max-w-[380px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebebeb] dark:border-[#222]">
          <h2 className="text-[14px] font-bold text-[#111] dark:text-[#e0e0e0]">Edit Date Range</h2>
          <button onClick={onClose} className="text-[#bbb] dark:text-[#444] hover:text-[#555] dark:hover:text-[#999] transition-colors">
            <X size={17} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#aaa] dark:text-[#555] uppercase tracking-widest">Start Date</label>
            <input
              type="date"
              value={start}
              onChange={(e) => { setStart(e.target.value); setError(null) }}
              className="border border-[#ebebeb] dark:border-[#222] rounded-xl px-4 py-2.5 text-[13px] text-[#111] dark:text-[#e0e0e0] bg-white dark:bg-[#1a1a1a] focus:outline-none focus:border-[#111] dark:focus:border-[#e0e0e0] transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#aaa] dark:text-[#555] uppercase tracking-widest">End Date</label>
            <input
              type="date"
              value={end}
              min={start}
              onChange={(e) => { setEnd(e.target.value); setError(null) }}
              className="border border-[#ebebeb] dark:border-[#222] rounded-xl px-4 py-2.5 text-[13px] text-[#111] dark:text-[#e0e0e0] bg-white dark:bg-[#1a1a1a] focus:outline-none focus:border-[#111] dark:focus:border-[#e0e0e0] transition-colors"
            />
          </div>
          {error && <p className="text-[12px] text-[#c62828]">{error}</p>}
          <button
            onClick={handleSave}
            disabled={!start || !end}
            className="w-full py-2.5 rounded-xl bg-[#111] dark:bg-[#e0e0e0] text-white dark:text-[#111] text-[13px] font-semibold disabled:opacity-40 transition-opacity mt-1"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Day Shift Modal ───────────────────────────────────────────────────────────

function DayShiftModal({
  date,
  draft,
  pumps,
  initialSlot = 'morning',
  onUpdate,
  onClose,
}: {
  date: string
  draft: ScheduleDraft
  pumps: Pump[]
  initialSlot?: ShiftSlot
  onUpdate: (date: string, plan: DayPlan) => void
  onClose: () => void
}) {
  const initialPlan = draft.days[date] ?? emptyDay()
  const [plan, setPlan] = useState<DayPlan>(initialPlan)
  const [slot, setSlot] = useState<ShiftSlot>(initialSlot)

  const prevISO  = prevDay(date)
  const prevPlan = draft.days[prevISO]

  // Filter out users with approved time off on this date
  const { data: timeOffRequests = [] } = useTimeOffRequests()
  const unavailableIds = useMemo(() =>
    new Set(
      timeOffRequests
        .filter((r) => r.status === 'Approved' && r.date === date)
        .map((r) => r.user_id)
    ),
    [timeOffRequests, date]
  )
  const availableSupervisors  = draft.supervisors.filter((u) => !unavailableIds.has(u.id))
  const unavailableSups       = draft.supervisors.filter((u) =>  unavailableIds.has(u.id))
  const availableStaff        = draft.staff.filter((u) => !unavailableIds.has(u.id))
  const unavailableStaffList  = draft.staff.filter((u) =>  unavailableIds.has(u.id))
  const availableCashiers     = draft.cashiers.filter((u) => !unavailableIds.has(u.id))
  const unavailableCashierList = draft.cashiers.filter((u) =>  unavailableIds.has(u.id))

  const dayLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-JM', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  // Flag: worked previous evening (supervisor, staff, or cashier)
  function isFlagged(userId: string): boolean {
    if (slot !== 'morning') return false
    return prevPlan?.supEvening === userId
  }
  function isStaffFlagged(userId: string): boolean {
    if (slot !== 'morning') return false
    return prevPlan?.staffEvening.some((a) => a.userId === userId) ?? false
  }
  function isCashierFlagged(userId: string): boolean {
    if (slot !== 'morning') return false
    return prevPlan?.cashierEvening.some((a) => a.userId === userId) ?? false
  }

  // Supervisor helpers
  const currentSup = slot === 'morning' ? plan.supMorning : plan.supEvening
  function setSup(userId: string | null) {
    slot === 'morning'
      ? setPlan((p) => ({ ...p, supMorning: userId }))
      : setPlan((p) => ({ ...p, supEvening: userId }))
  }

  // Staff helpers
  const currentStaff    = slot === 'morning' ? plan.staffMorning    : plan.staffEvening
  const currentCashiers = slot === 'morning' ? plan.cashierMorning  : plan.cashierEvening

  function toggleStaffMember(user: User) {
    if (slot === 'morning') {
      setPlan((p) => {
        const exists = p.staffMorning.find((a) => a.userId === user.id)
        return {
          ...p,
          staffMorning: exists
            ? p.staffMorning.filter((a) => a.userId !== user.id)
            : [...p.staffMorning, { userId: user.id, userName: user.name, pumpIds: [] }],
        }
      })
    } else {
      setPlan((p) => {
        const exists = p.staffEvening.find((a) => a.userId === user.id)
        return {
          ...p,
          staffEvening: exists
            ? p.staffEvening.filter((a) => a.userId !== user.id)
            : [...p.staffEvening, { userId: user.id, userName: user.name, pumpIds: [] }],
        }
      })
    }
  }

  function togglePump(userId: string, pumpId: string) {
    const update = (list: AttendantAssignment[]) =>
      list.map((a) =>
        a.userId !== userId ? a : {
          ...a,
          pumpIds: a.pumpIds.includes(pumpId)
            ? a.pumpIds.filter((id) => id !== pumpId)
            : [...a.pumpIds, pumpId],
        }
      )
    slot === 'morning'
      ? setPlan((p) => ({ ...p, staffMorning: update(p.staffMorning) }))
      : setPlan((p) => ({ ...p, staffEvening: update(p.staffEvening) }))
  }

  function toggleCashierMember(user: User) {
    if (slot === 'morning') {
      setPlan((p) => {
        const exists = p.cashierMorning.find((a) => a.userId === user.id)
        return {
          ...p,
          cashierMorning: exists
            ? p.cashierMorning.filter((a) => a.userId !== user.id)
            : [...p.cashierMorning, { userId: user.id, userName: user.name, pumpIds: [] }],
        }
      })
    } else {
      setPlan((p) => {
        const exists = p.cashierEvening.find((a) => a.userId === user.id)
        return {
          ...p,
          cashierEvening: exists
            ? p.cashierEvening.filter((a) => a.userId !== user.id)
            : [...p.cashierEvening, { userId: user.id, userName: user.name, pumpIds: [] }],
        }
      })
    }
  }

  function handleSave() {
    onUpdate(date, plan)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xl w-full max-w-[520px] flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#ebebeb] dark:border-[#222] shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-bold text-[#111] dark:text-[#e0e0e0]">{dayLabel}</p>
            <button onClick={onClose} className="text-[#bbb] dark:text-[#444] hover:text-[#555] dark:hover:text-[#999] transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Shift tabs */}
          <div className="flex items-center gap-1 mt-3 bg-[#f4f4f4] dark:bg-[#222] rounded-lg p-0.5 w-fit">
            {(['morning', 'evening'] as ShiftSlot[]).map((s) => (
              <button key={s} onClick={() => setSlot(s)}
                className={`px-4 py-1.5 text-[12px] font-semibold rounded-md transition-colors ${
                  slot === s ? 'bg-white dark:bg-[#333] text-[#111] dark:text-[#e0e0e0] shadow-sm' : 'text-[#888] dark:text-[#666] hover:text-[#555] dark:hover:text-[#999]'
                }`}>
                {s === 'morning' ? 'AM' : 'PM'}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[#bbb] dark:text-[#444] mt-1.5">{SHIFT_LABELS[slot]}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── Supervisor section ─────────────────────────────────────────── */}
          <div className="px-6 py-4 border-b border-[#f0f0f0] dark:border-[#1e1e1e]">
            <p className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase mb-3">Supervisor</p>
            {availableSupervisors.length === 0 && unavailableSups.length === 0 ? (
              <p className="text-[13px] text-[#bbb] dark:text-[#444]">No supervisors in this schedule</p>
            ) : (
              <div className="flex flex-col gap-1">
                {availableSupervisors.map((u) => {
                  const selected  = currentSup === u.id
                  const flagged   = isFlagged(u.id)
                  return (
                    <button key={u.id} onClick={() => setSup(selected ? null : u.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                        selected
                          ? 'bg-[#111] dark:bg-[#e0e0e0]'
                          : 'hover:bg-[#f4f4f4] dark:hover:bg-[#222]'
                      }`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                        selected ? 'bg-white/20 dark:bg-black/20 text-white dark:text-[#111]' : 'bg-[#111] dark:bg-[#e0e0e0] text-white dark:text-[#111]'
                      }`}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <p className={`text-[13px] font-semibold flex-1 ${selected ? 'text-white dark:text-[#111]' : 'text-[#111] dark:text-[#e0e0e0]'}`}>
                        {u.name}
                      </p>
                      {flagged && (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-900/30 rounded-full shrink-0">
                          <AlertTriangle size={10} className="text-amber-500 shrink-0" />
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">Prev. evening</span>
                        </div>
                      )}
                      {selected && <Check size={13} className="text-white dark:text-[#111] shrink-0" />}
                    </button>
                  )
                })}
                {unavailableSups.length > 0 && (
                  <div className="mt-1.5 px-3 py-2 rounded-xl bg-[#fafafa] dark:bg-[#161616] border border-dashed border-[#e0e0e0] dark:border-[#2a2a2a]">
                    <p className="text-[10px] font-semibold text-[#bbb] dark:text-[#555]">
                      On approved leave: {unavailableSups.map((u) => u.name).join(', ')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Staff section ──────────────────────────────────────────────── */}
          <div className="px-6 py-4 border-b border-[#f0f0f0] dark:border-[#1e1e1e]">
            <p className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase mb-3">Attendants</p>
            {availableStaff.length === 0 && unavailableStaffList.length === 0 ? (
              <p className="text-[13px] text-[#bbb] dark:text-[#444]">No attendants in this schedule</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {availableStaff.map((u) => {
                  const assignment = currentStaff.find((a) => a.userId === u.id)
                  const selected   = !!assignment
                  const flagged    = isStaffFlagged(u.id)
                  return (
                    <div key={u.id} className={`rounded-xl border transition-colors ${
                      selected
                        ? 'border-[#ddd] dark:border-[#333] bg-[#fafafa] dark:bg-[#161616]'
                        : 'border-transparent'
                    }`}>
                      <button onClick={() => toggleStaffMember(u)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
                        <div className="w-7 h-7 rounded-full bg-[#111] dark:bg-[#e0e0e0] text-white dark:text-[#111] flex items-center justify-center text-[11px] font-bold shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] flex-1">{u.name}</p>
                        {flagged && (
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-900/30 rounded-full shrink-0">
                            <AlertTriangle size={10} className="text-amber-500 shrink-0" />
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">Prev. evening</span>
                          </div>
                        )}
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          selected ? 'bg-[#111] dark:bg-[#e0e0e0] border-[#111] dark:border-[#e0e0e0]' : 'border-[#ddd] dark:border-[#333]'
                        }`}>
                          {selected && <Check size={10} className="text-white dark:text-[#111]" strokeWidth={3} />}
                        </div>
                      </button>

                      {/* Pump assignment (service station only) */}
                      {selected && pumps.length > 0 && (
                        <div className="px-3 pb-3 flex flex-wrap gap-1.5">
                          {pumps.map((p) => {
                            const hasPump = assignment.pumpIds.includes(p.id)
                            return (
                              <button key={p.id} onClick={() => togglePump(u.id, p.id)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                                  hasPump
                                    ? 'bg-[#111] dark:bg-[#e0e0e0] text-white dark:text-[#111] border-[#111] dark:border-[#e0e0e0]'
                                    : 'border-[#ddd] dark:border-[#333] text-[#888] dark:text-[#666] hover:border-[#bbb] dark:hover:border-[#555]'
                                }`}>
                                {p.name}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
                {unavailableStaffList.length > 0 && (
                  <div className="mt-1 px-3 py-2 rounded-xl bg-[#fafafa] dark:bg-[#161616] border border-dashed border-[#e0e0e0] dark:border-[#2a2a2a]">
                    <p className="text-[10px] font-semibold text-[#bbb] dark:text-[#555]">
                      On approved leave: {unavailableStaffList.map((u) => u.name).join(', ')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Cashier section ────────────────────────────────────────────── */}
          <div className="px-6 py-4">
            <p className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase mb-3">Cashiers</p>
            {availableCashiers.length === 0 && unavailableCashierList.length === 0 ? (
              <p className="text-[13px] text-[#bbb] dark:text-[#444]">No cashiers in this schedule</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {availableCashiers.map((u) => {
                  const assignment = currentCashiers.find((a) => a.userId === u.id)
                  const selected   = !!assignment
                  const flagged    = isCashierFlagged(u.id)
                  return (
                    <button key={u.id} onClick={() => toggleCashierMember(u)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                        selected ? 'bg-[#111] dark:bg-[#e0e0e0]' : 'hover:bg-[#f4f4f4] dark:hover:bg-[#222]'
                      }`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                        selected ? 'bg-white/20 dark:bg-black/20 text-white dark:text-[#111]' : 'bg-[#111] dark:bg-[#e0e0e0] text-white dark:text-[#111]'
                      }`}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <p className={`text-[13px] font-semibold flex-1 ${selected ? 'text-white dark:text-[#111]' : 'text-[#111] dark:text-[#e0e0e0]'}`}>
                        {u.name}
                      </p>
                      {flagged && (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-900/30 rounded-full shrink-0">
                          <AlertTriangle size={10} className="text-amber-500 shrink-0" />
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">Prev. evening</span>
                        </div>
                      )}
                      {selected && <Check size={13} className="text-white dark:text-[#111] shrink-0" />}
                    </button>
                  )
                })}
                {unavailableCashierList.length > 0 && (
                  <div className="mt-1.5 px-3 py-2 rounded-xl bg-[#fafafa] dark:bg-[#161616] border border-dashed border-[#e0e0e0] dark:border-[#2a2a2a]">
                    <p className="text-[10px] font-semibold text-[#bbb] dark:text-[#555]">
                      On approved leave: {unavailableCashierList.map((u) => u.name).join(', ')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#ebebeb] dark:border-[#222] shrink-0">
          <button
            onClick={handleSave}
            className="w-full py-3 bg-[#111] dark:bg-[#e0e0e0] text-white dark:text-[#111] rounded-xl text-[13px] font-semibold hover:bg-[#333] dark:hover:bg-[#ccc] transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Month view ────────────────────────────────────────────────────────────────

function MonthView({
  year, month, shiftsByDate, today, selected, planningMode, draft, publishedSchedules, onSelect, onPlanDay, onSelectPublished,
}: {
  year: number
  month: number
  shiftsByDate: Map<string, Shift[]>
  today: string
  selected: string | null
  planningMode: boolean
  draft: ScheduleDraft | null
  publishedSchedules?: ScheduleDraft[]
  onSelect: (iso: string) => void
  onPlanDay: (iso: string, slot: ShiftSlot) => void
  onSelectPublished?: (iso: string) => void
}) {
  const cells = useMemo(() => buildMonthGrid(year, month), [year, month])

  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-7 border-b border-[#ebebeb] dark:border-[#222] shrink-0">
        {DAYS.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-bold text-[#bbb] dark:text-[#444] uppercase tracking-widest">{d}</div>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
      <div className="grid grid-cols-7 min-h-full" style={{ gridAutoRows: 'minmax(140px, 1fr)' }}>
        {cells.map((date) => {
          const iso          = date.toISOString().slice(0, 10)
          const shifts       = shiftsByDate.get(iso) ?? []
          const isToday      = iso === today
          const isSel        = iso === selected
          const inDraft           = draft ? isDayInDraft(iso, draft) : false
          const pubScheduleForDay = !inDraft ? findScheduleForDay(iso, publishedSchedules ?? []) : null
          const inPublished       = pubScheduleForDay !== null
          const isThisMonth  = date.getMonth() === month
          const overflow     = !isThisMonth

          const todayClass = isToday
            ? (planningMode
              ? 'text-amber-500 dark:text-amber-400 font-bold'
              : inPublished
                ? 'bg-emerald-500 text-white'
                : 'ring-1 ring-[#ccc] dark:ring-[#444] text-[#111] dark:text-[#e0e0e0]')
            : overflow
              ? 'text-[#ccc] dark:text-[#444]'
              : 'text-[#555] dark:text-[#999]'

          if (inDraft && draft) {
            const dayPlan             = draft.days[iso]
            const supMorningName      = dayPlan?.supMorning  ? draft.supervisors.find((u) => u.id === dayPlan.supMorning)?.name  ?? '' : ''
            const supEveningName      = dayPlan?.supEvening  ? draft.supervisors.find((u) => u.id === dayPlan.supEvening)?.name  ?? '' : ''
            const attMorningNames     = dayPlan?.staffMorning.map((a) => a.userName) ?? []
            const attEveningNames     = dayPlan?.staffEvening.map((a) => a.userName) ?? []
            const cashierMorningNames = dayPlan?.cashierMorning.map((a) => a.userName) ?? []
            const cashierEveningNames = dayPlan?.cashierEvening.map((a) => a.userName) ?? []

            return (
              <div key={iso} className={`flex flex-col border-b border-r border-[#f4f4f4] dark:border-[#1e1e1e] ${overflow ? 'bg-amber-50/30 dark:bg-amber-900/5' : 'bg-amber-50/60 dark:bg-amber-900/10'}`}>
                {/* Date number row */}
                <div className="px-2 pt-1.5 shrink-0">
                  <span className={`text-[12px] font-bold w-6 h-6 flex items-center justify-center rounded-full ${todayClass}`}>
                    {date.getDate()}
                  </span>
                </div>

                {/* Existing shift pills */}
                {shifts.length > 0 && (
                  <div className="flex flex-col gap-0.5 px-2 pb-1 shrink-0">
                    {shifts.slice(0, 1).map((s) => <ShiftPill key={s.id} shift={s} />)}
                    {shifts.length > 1 && <p className="text-[9px] text-[#bbb] dark:text-[#444] pl-1">+{shifts.length - 1}</p>}
                  </div>
                )}

                {/* Planning container */}
                <div className="flex-1 px-1.5 pb-1.5 min-h-0">
                  <div className="h-full flex flex-col rounded-xl border border-dashed border-amber-300 dark:border-amber-800/60 bg-white dark:bg-[#1a1a1a] overflow-hidden">

                    {/* AM section */}
                    <button
                      onClick={() => onPlanDay(iso, 'morning')}
                      className="flex-1 flex flex-col px-2 pt-1.5 pb-1.5 gap-1.5 text-left hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors"
                    >
                      <span className="text-[7px] font-bold text-amber-500 dark:text-amber-400 shrink-0">AM</span>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[7px] font-bold text-[#bbb] dark:text-[#444] uppercase tracking-widest">Supervisor</span>
                        {supMorningName ? (
                          <div className="flex items-center gap-1 min-w-0">
                            <div className="w-[14px] h-[14px] rounded-full bg-[#222] dark:bg-[#d4d4d4] text-white dark:text-[#111] flex items-center justify-center text-[6px] font-bold shrink-0">
                              {supMorningName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[8px] font-semibold text-[#222] dark:text-[#ddd] truncate">{supMorningName.split(' ')[0]}</span>
                          </div>
                        ) : (
                          <span className="text-[8px] text-[#ddd] dark:text-[#2a2a2a]">—</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[7px] font-bold text-[#bbb] dark:text-[#444] uppercase tracking-widest">Attendants</span>
                        {attMorningNames.length > 0 ? (
                          <div className="flex items-center gap-0.5 flex-wrap">
                            {attMorningNames.slice(0, 4).map((n, idx) => (
                              <div key={idx} className="w-[14px] h-[14px] rounded-full bg-[#aaa] dark:bg-[#666] text-white flex items-center justify-center text-[6px] font-bold shrink-0">
                                {n.charAt(0).toUpperCase()}
                              </div>
                            ))}
                            {attMorningNames.length > 4 && <span className="text-[7px] text-[#bbb] dark:text-[#444]">+{attMorningNames.length - 4}</span>}
                          </div>
                        ) : (
                          <span className="text-[8px] text-[#ddd] dark:text-[#2a2a2a]">—</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[7px] font-bold text-[#bbb] dark:text-[#444] uppercase tracking-widest">Cashiers</span>
                        {cashierMorningNames.length > 0 ? (
                          <div className="flex items-center gap-0.5 flex-wrap">
                            {cashierMorningNames.slice(0, 4).map((n, idx) => (
                              <div key={idx} className="w-[14px] h-[14px] rounded-full bg-blue-300 dark:bg-blue-700 text-white flex items-center justify-center text-[6px] font-bold shrink-0">
                                {n.charAt(0).toUpperCase()}
                              </div>
                            ))}
                            {cashierMorningNames.length > 4 && <span className="text-[7px] text-[#bbb] dark:text-[#444]">+{cashierMorningNames.length - 4}</span>}
                          </div>
                        ) : (
                          <span className="text-[8px] text-[#ddd] dark:text-[#2a2a2a]">—</span>
                        )}
                      </div>
                    </button>

                    {/* Divider */}
                    <div className="border-t border-amber-100 dark:border-amber-900/30 shrink-0" />

                    {/* PM section */}
                    <button
                      onClick={() => onPlanDay(iso, 'evening')}
                      className="flex-1 flex flex-col px-2 pt-1.5 pb-1.5 gap-1.5 text-left hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors"
                    >
                      <span className="text-[7px] font-bold text-amber-600 dark:text-amber-500 shrink-0">PM</span>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[7px] font-bold text-[#bbb] dark:text-[#444] uppercase tracking-widest">Supervisor</span>
                        {supEveningName ? (
                          <div className="flex items-center gap-1 min-w-0">
                            <div className="w-[14px] h-[14px] rounded-full bg-[#222] dark:bg-[#d4d4d4] text-white dark:text-[#111] flex items-center justify-center text-[6px] font-bold shrink-0">
                              {supEveningName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[8px] font-semibold text-[#222] dark:text-[#ddd] truncate">{supEveningName.split(' ')[0]}</span>
                          </div>
                        ) : (
                          <span className="text-[8px] text-[#ddd] dark:text-[#2a2a2a]">—</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[7px] font-bold text-[#bbb] dark:text-[#444] uppercase tracking-widest">Attendants</span>
                        {attEveningNames.length > 0 ? (
                          <div className="flex items-center gap-0.5 flex-wrap">
                            {attEveningNames.slice(0, 4).map((n, idx) => (
                              <div key={idx} className="w-[14px] h-[14px] rounded-full bg-[#aaa] dark:bg-[#666] text-white flex items-center justify-center text-[6px] font-bold shrink-0">
                                {n.charAt(0).toUpperCase()}
                              </div>
                            ))}
                            {attEveningNames.length > 4 && <span className="text-[7px] text-[#bbb] dark:text-[#444]">+{attEveningNames.length - 4}</span>}
                          </div>
                        ) : (
                          <span className="text-[8px] text-[#ddd] dark:text-[#2a2a2a]">—</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[7px] font-bold text-[#bbb] dark:text-[#444] uppercase tracking-widest">Cashiers</span>
                        {cashierEveningNames.length > 0 ? (
                          <div className="flex items-center gap-0.5 flex-wrap">
                            {cashierEveningNames.slice(0, 4).map((n, idx) => (
                              <div key={idx} className="w-[14px] h-[14px] rounded-full bg-blue-300 dark:bg-blue-700 text-white flex items-center justify-center text-[6px] font-bold shrink-0">
                                {n.charAt(0).toUpperCase()}
                              </div>
                            ))}
                            {cashierEveningNames.length > 4 && <span className="text-[7px] text-[#bbb] dark:text-[#444]">+{cashierEveningNames.length - 4}</span>}
                          </div>
                        ) : (
                          <span className="text-[8px] text-[#ddd] dark:text-[#2a2a2a]">—</span>
                        )}
                      </div>
                    </button>

                  </div>
                </div>
              </div>
            )
          }

          if (inPublished && pubScheduleForDay) {
            const pubPlan             = pubScheduleForDay.days[iso]
            const supMorningName      = pubPlan?.supMorning  ? pubScheduleForDay.supervisors.find((u) => u.id === pubPlan.supMorning)?.name  ?? '' : ''
            const supEveningName      = pubPlan?.supEvening  ? pubScheduleForDay.supervisors.find((u) => u.id === pubPlan.supEvening)?.name  ?? '' : ''
            const attMorningNames     = pubPlan?.staffMorning.map((a) => a.userName) ?? []
            const attEveningNames     = pubPlan?.staffEvening.map((a) => a.userName) ?? []
            const cashierMorningNames = pubPlan?.cashierMorning.map((a) => a.userName) ?? []
            const cashierEveningNames = pubPlan?.cashierEvening.map((a) => a.userName) ?? []
            const mColor              = SCHEDULE_COLORS[scheduleColorIdx(pubScheduleForDay)]

            // Spanning logic — rows wrap at Sun (0) / Sat (6) boundaries
            const dayOfWeek       = date.getDay()
            const isLastColInRow  = dayOfWeek === 6
            const actualPrevISO   = prevDay(iso)
            const actualNextISO   = new Date(new Date(iso + 'T00:00:00').setDate(new Date(iso + 'T00:00:00').getDate() + 1)).toISOString().slice(0, 10)
            const prevPubSched    = findScheduleForDay(actualPrevISO, publishedSchedules ?? [])
            const nextPubSched    = findScheduleForDay(actualNextISO, publishedSchedules ?? [])
            // Round caps only at the true schedule start/end — row boundaries stay flat
            const isPubStart      = prevPubSched !== pubScheduleForDay
            const isPubEnd        = nextPubSched !== pubScheduleForDay
            // Hide the cell-divider to the right when the next cell continues the same band
            const nextCellSamePub = !isLastColInRow && nextPubSched === pubScheduleForDay

            return (
              <div key={iso} className={`flex flex-col border-b border-[#f4f4f4] dark:border-[#1e1e1e] ${
                nextCellSamePub ? '' : 'border-r'
              }`}>
                <div className="px-2 pt-1.5 shrink-0">
                  <span className={`text-[12px] font-bold w-6 h-6 flex items-center justify-center rounded-full ${todayClass}`}>
                    {date.getDate()}
                  </span>
                </div>
                {shifts.length > 0 && (
                  <div className="flex flex-col gap-0.5 px-2 pb-1 shrink-0">
                    {shifts.slice(0, 1).map((s) => <ShiftPill key={s.id} shift={s} />)}
                    {shifts.length > 1 && <p className="text-[9px] text-[#bbb] dark:text-[#444] pl-1">+{shifts.length - 1}</p>}
                  </div>
                )}
                <button
                  onClick={() => onSelectPublished?.(iso)}
                  className="flex-1 pb-1 min-h-0 text-left w-full overflow-hidden"
                >
                  <div
                    className={`h-full flex flex-col overflow-hidden border-t border-b transition-opacity hover:opacity-90 ${
                      isPubStart ? 'border-l rounded-l-xl ml-1' : ''
                    } ${
                      isPubEnd ? 'border-r rounded-r-xl mr-1' : ''
                    }`}
                    style={{ backgroundColor: mColor.bg, borderColor: mColor.border }}
                  >
                    {/* AM */}
                    <div className="flex-1 flex flex-col px-2 pt-1.5 pb-1 gap-1 border-b" style={{ borderColor: mColor.border }}>
                      <span className="text-[7px] font-bold shrink-0" style={{ color: mColor.label }}>AM</span>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[7px] font-bold text-[#aaa] uppercase tracking-widest">Supervisor</span>
                        {supMorningName ? (
                          <div className="flex items-center gap-1 min-w-0">
                            <div className="w-[13px] h-[13px] rounded-full bg-[#333] text-white flex items-center justify-center text-[5px] font-bold shrink-0">{supMorningName.charAt(0).toUpperCase()}</div>
                            <span className="text-[7px] font-semibold text-[#333] truncate">{supMorningName.split(' ')[0]}</span>
                          </div>
                        ) : <span className="text-[7px] text-[#bbb]">—</span>}
                      </div>
                      {attMorningNames.length > 0 && (
                        <div className="flex items-center gap-0.5 flex-wrap">
                          {attMorningNames.slice(0, 4).map((n, idx) => (
                            <div key={idx} className="w-[12px] h-[12px] rounded-full bg-[#aaa] text-white flex items-center justify-center text-[5px] font-bold shrink-0">{n.charAt(0).toUpperCase()}</div>
                          ))}
                          {attMorningNames.length > 4 && <span className="text-[6px] text-[#aaa]">+{attMorningNames.length - 4}</span>}
                        </div>
                      )}
                    </div>
                    {/* PM */}
                    <div className="flex-1 flex flex-col px-2 pt-1.5 pb-1 gap-1">
                      <span className="text-[7px] font-bold shrink-0" style={{ color: mColor.label }}>PM</span>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[7px] font-bold text-[#aaa] uppercase tracking-widest">Supervisor</span>
                        {supEveningName ? (
                          <div className="flex items-center gap-1 min-w-0">
                            <div className="w-[13px] h-[13px] rounded-full bg-[#333] text-white flex items-center justify-center text-[5px] font-bold shrink-0">{supEveningName.charAt(0).toUpperCase()}</div>
                            <span className="text-[7px] font-semibold text-[#333] truncate">{supEveningName.split(' ')[0]}</span>
                          </div>
                        ) : <span className="text-[7px] text-[#bbb]">—</span>}
                      </div>
                      {attEveningNames.length > 0 && (
                        <div className="flex items-center gap-0.5 flex-wrap">
                          {attEveningNames.slice(0, 4).map((n, idx) => (
                            <div key={idx} className="w-[12px] h-[12px] rounded-full bg-[#aaa] text-white flex items-center justify-center text-[5px] font-bold shrink-0">{n.charAt(0).toUpperCase()}</div>
                          ))}
                          {attEveningNames.length > 4 && <span className="text-[6px] text-[#aaa]">+{attEveningNames.length - 4}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              </div>
            )
          }

          return (
            <button key={iso} onClick={() => onSelect(iso)}
              className={`flex flex-col items-start p-2 border-b border-r border-[#f4f4f4] dark:border-[#1e1e1e] text-left transition-colors ${
                overflow
                  ? 'bg-[#fafafa] dark:bg-[#111] hover:bg-[#f4f4f4] dark:hover:bg-[#161616]'
                  : isSel
                    ? 'bg-[#f4f4f4] dark:bg-[#222]'
                    : 'hover:bg-[#f9f9f9] dark:hover:bg-[#1a1a1a]'
              }`}>
              <span className={`text-[12px] font-bold mb-1.5 w-6 h-6 flex items-center justify-center rounded-full ${todayClass}`}>
                {date.getDate()}
              </span>
              <div className={`w-full flex flex-col gap-0.5 ${overflow ? 'opacity-40' : ''}`}>
                {shifts.slice(0, 2).map((s) => <ShiftPill key={s.id} shift={s} />)}
                {shifts.length > 2 && <p className="text-[10px] text-[#aaa] dark:text-[#555] pl-1">+{shifts.length - 2} more</p>}
              </div>
            </button>
          )
        })}
      </div>
      </div>
    </div>
  )
}

// ── Schedule colour palette (published schedules) ────────────────────────────

const SCHEDULE_COLORS = [
  { bg: '#f5f3ff', border: '#c4b5fd', label: '#7c3aed' }, // violet
  { bg: '#eff6ff', border: '#93c5fd', label: '#1d4ed8' }, // blue
  { bg: '#fdf2f8', border: '#f9a8d4', label: '#be185d' }, // pink
  { bg: '#fff7ed', border: '#fdba74', label: '#c2410c' }, // orange
  { bg: '#ecfdf5', border: '#6ee7b7', label: '#065f46' }, // emerald
  { bg: '#fefce8', border: '#fde047', label: '#a16207' }, // yellow
  { bg: '#e0f2fe', border: '#7dd3fc', label: '#0369a1' }, // sky
]

function scheduleColorIdx(schedule: ScheduleDraft): number {
  let h = 0
  for (let i = 0; i < schedule.startISO.length; i++) {
    h = (h * 31 + schedule.startISO.charCodeAt(i)) & 0xffff
  }
  return h % SCHEDULE_COLORS.length
}

// ── Week view (with optional schedule draft overlay) ──────────────────────────

function WeekView({
  anchor,
  customStart,
  shiftsByDate,
  today,
  selected,
  draft,
  publishedSchedules,
  onSelect,
  onPlanDay,
  onSelectPublished,
}: {
  anchor: Date
  customStart?: Date
  shiftsByDate: Map<string, Shift[]>
  today: string
  selected: string | null
  draft: ScheduleDraft | null
  publishedSchedules?: ScheduleDraft[]
  onSelect: (iso: string) => void
  onPlanDay: (iso: string, slot: ShiftSlot) => void
  onSelectPublished?: (iso: string) => void
}) {
  const days = useMemo(() => {
    if (customStart) {
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(customStart)
        d.setDate(customStart.getDate() + i)
        return d
      })
    }
    return buildWeekDays(anchor)
  }, [anchor, customStart])

  return (
    <div className="h-full flex flex-col">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-[#ebebeb] dark:border-[#222] shrink-0">
        {days.map((d) => {
          const iso        = d.toISOString().slice(0, 10)
          const isToday    = iso === today
          const inDraft    = draft ? isDayInDraft(iso, draft) : false
          const inPublished = !inDraft && findScheduleForDay(iso, publishedSchedules ?? []) !== null
          return (
            <div key={iso} className={`py-3 flex flex-col items-center gap-1 border-r border-[#f4f4f4] dark:border-[#1e1e1e] last:border-0 ${
              inDraft ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''
            }`}>
              <p className="text-[10px] font-bold text-[#bbb] dark:text-[#444] uppercase tracking-widest">{DAYS[d.getDay()]}</p>
              <span className={`text-[14px] font-bold w-8 h-8 flex items-center justify-center rounded-full ${
                isToday
                  ? inDraft
                    ? 'bg-amber-500 text-white'
                    : 'ring-1 ring-[#ccc] dark:ring-[#444] text-[#111] dark:text-[#e0e0e0]'
                  : 'text-[#555] dark:text-[#999]'
              }`}>
                {d.getDate()}
              </span>
            </div>
          )
        })}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 flex-1" style={{ minHeight: 0 }}>
        {days.map((d, dayIdx) => {
          const iso     = d.toISOString().slice(0, 10)
          const shifts  = shiftsByDate.get(iso) ?? []
          const isSel   = iso === selected
          const inDraft = draft ? isDayInDraft(iso, draft) : false

          const pubScheduleForDay = !inDraft ? findScheduleForDay(iso, publishedSchedules ?? []) : null
          const inPublished    = pubScheduleForDay !== null
          const activeSchedule = inDraft ? draft! : pubScheduleForDay
          const activePlan     = activeSchedule ? activeSchedule.days[iso] : undefined

          const supMorningName      = activePlan?.supMorning  ? activeSchedule!.supervisors.find((u) => u.id === activePlan.supMorning)?.name  ?? '' : ''
          const supEveningName      = activePlan?.supEvening  ? activeSchedule!.supervisors.find((u) => u.id === activePlan.supEvening)?.name  ?? '' : ''
          const attMorningNames     = activePlan?.staffMorning.map((a) => a.userName) ?? []
          const attEveningNames     = activePlan?.staffEvening.map((a) => a.userName) ?? []
          const cashierMorningNames = activePlan?.cashierMorning.map((a) => a.userName) ?? []
          const cashierEveningNames = activePlan?.cashierEvening.map((a) => a.userName) ?? []

          // Spanning-border logic for published cells
          const isLastCol        = dayIdx === days.length - 1
          // Actual calendar neighbours — used for rounded corners so they only appear at
          // the true start/end of the schedule, not at the edge of the visible view.
          const actualPrevISO    = new Date(new Date(iso + 'T00:00:00').setDate(new Date(iso + 'T00:00:00').getDate() - 1)).toISOString().slice(0, 10)
          const actualNextISO    = new Date(new Date(iso + 'T00:00:00').setDate(new Date(iso + 'T00:00:00').getDate() + 1)).toISOString().slice(0, 10)
          // Corners round only at the true start/end of THIS schedule (not adjacent schedules).
          const prevPubSchedule  = inPublished ? findScheduleForDay(actualPrevISO, publishedSchedules ?? []) : null
          const nextPubSchedule  = inPublished ? findScheduleForDay(actualNextISO, publishedSchedules ?? []) : null
          const isPubStart       = inPublished && prevPubSchedule !== pubScheduleForDay
          const isPubEnd         = inPublished && nextPubSchedule !== pubScheduleForDay
          const color            = pubScheduleForDay ? SCHEDULE_COLORS[scheduleColorIdx(pubScheduleForDay)] : SCHEDULE_COLORS[0]
          // Next *visible* column — only used to decide whether to hide the column divider.
          const nextVisibleISO        = !isLastCol ? days[dayIdx + 1].toISOString().slice(0, 10) : null
          const nextVisiblePubSchedule = nextVisibleISO ? findScheduleForDay(nextVisibleISO, publishedSchedules ?? []) : null
          const nextVisiblePub        = nextVisiblePubSchedule !== null && nextVisiblePubSchedule === pubScheduleForDay

          // Draft spanning — same logic: corners only at true start/end of the draft range
          const isDraftStart     = inDraft && draft ? iso === draft.startISO : false
          const isDraftEnd       = inDraft && draft ? iso === draft.endISO   : false
          const nextVisibleDraft = !isLastCol && draft
            ? isDayInDraft(days[dayIdx + 1].toISOString().slice(0, 10), draft)
            : false

          return (
            <div key={iso} className={`flex flex-col border-b border-[#f4f4f4] dark:border-[#1e1e1e] ${
              isLastCol
                ? ''
                : (inPublished && nextVisiblePub) || (inDraft && nextVisibleDraft)
                  ? 'border-r border-transparent'
                  : 'border-r border-[#f4f4f4] dark:border-[#1e1e1e]'
            }`}>

              {inDraft ? (
                /* Planning mode — same layout as published: fixed top strip + fixed-height spanning container */
                <>
                  {/* Fixed-height top strip */}
                  <div className="h-8 shrink-0 flex flex-col gap-0.5 px-2 pt-1.5 overflow-hidden">
                    {shifts.slice(0, 2).map((s) => <ShiftPill key={s.id} shift={s} />)}
                    {shifts.length > 2 && <p className="text-[9px] text-[#bbb] dark:text-[#444] pl-1">+{shifts.length - 2} more</p>}
                  </div>

                  <div className="flex-1 flex flex-col py-1">
                    <div
                      className={`flex-1 flex flex-col overflow-hidden border-t border-b border-dashed border-amber-300 dark:border-amber-800/60 bg-white dark:bg-[#1a1a1a] ${
                        isDraftStart ? 'border-l rounded-l-xl ml-1' : ''
                      } ${
                        isDraftEnd ? 'border-r rounded-r-xl mr-1' : ''
                      }`}
                    >
                      {/* AM section */}
                      <button
                        onClick={() => onPlanDay(iso, 'morning')}
                        className="flex-1 flex flex-col px-2.5 pt-2 pb-2 gap-2 text-left hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors overflow-hidden"
                      >
                        <span className="text-[7px] font-bold text-amber-500 dark:text-amber-400 shrink-0">AM</span>

                        {/* Supervisor */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[7px] font-bold text-[#bbb] dark:text-[#444] uppercase tracking-widest">Supervisor</span>
                          {supMorningName ? (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="w-[16px] h-[16px] rounded-full bg-[#222] dark:bg-[#d4d4d4] text-white dark:text-[#111] flex items-center justify-center text-[7px] font-bold shrink-0 leading-none">
                                {supMorningName.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-[9px] font-semibold text-[#222] dark:text-[#ddd] truncate leading-none">
                                {supMorningName.split(' ')[0]}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[8px] text-[#ddd] dark:text-[#2a2a2a]">—</span>
                          )}
                        </div>

                        {/* Attendants */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[7px] font-bold text-[#bbb] dark:text-[#444] uppercase tracking-widest">Attendants</span>
                          {attMorningNames.length > 0 ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              {attMorningNames.slice(0, 5).map((n, idx) => (
                                <div key={idx} className="w-[16px] h-[16px] rounded-full bg-[#aaa] dark:bg-[#666] text-white flex items-center justify-center text-[7px] font-bold shrink-0 leading-none">
                                  {n.charAt(0).toUpperCase()}
                                </div>
                              ))}
                              {attMorningNames.length > 5 && (
                                <span className="text-[7px] text-[#bbb] dark:text-[#444]">+{attMorningNames.length - 5}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[8px] text-[#ddd] dark:text-[#2a2a2a]">—</span>
                          )}
                        </div>

                        {/* Cashiers */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[7px] font-bold text-[#bbb] dark:text-[#444] uppercase tracking-widest">Cashiers</span>
                          {cashierMorningNames.length > 0 ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              {cashierMorningNames.slice(0, 5).map((n, idx) => (
                                <div key={idx} className="w-[16px] h-[16px] rounded-full bg-blue-300 dark:bg-blue-700 text-white flex items-center justify-center text-[7px] font-bold shrink-0 leading-none">
                                  {n.charAt(0).toUpperCase()}
                                </div>
                              ))}
                              {cashierMorningNames.length > 5 && (
                                <span className="text-[7px] text-[#bbb] dark:text-[#444]">+{cashierMorningNames.length - 5}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[8px] text-[#ddd] dark:text-[#2a2a2a]">—</span>
                          )}
                        </div>
                      </button>

                      {/* Divider */}
                      <div className="border-t border-amber-100 dark:border-amber-900/30 shrink-0" />

                      {/* PM section */}
                      <button
                        onClick={() => onPlanDay(iso, 'evening')}
                        className="flex-1 flex flex-col px-2.5 pt-2 pb-2 gap-2 text-left hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors overflow-hidden"
                      >
                        <span className="text-[7px] font-bold text-amber-600 dark:text-amber-500 shrink-0">PM</span>

                        {/* Supervisor */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[7px] font-bold text-[#bbb] dark:text-[#444] uppercase tracking-widest">Supervisor</span>
                          {supEveningName ? (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="w-[16px] h-[16px] rounded-full bg-[#222] dark:bg-[#d4d4d4] text-white dark:text-[#111] flex items-center justify-center text-[7px] font-bold shrink-0 leading-none">
                                {supEveningName.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-[9px] font-semibold text-[#222] dark:text-[#ddd] truncate leading-none">
                                {supEveningName.split(' ')[0]}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[8px] text-[#ddd] dark:text-[#2a2a2a]">—</span>
                          )}
                        </div>

                        {/* Attendants */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[7px] font-bold text-[#bbb] dark:text-[#444] uppercase tracking-widest">Attendants</span>
                          {attEveningNames.length > 0 ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              {attEveningNames.slice(0, 5).map((n, idx) => (
                                <div key={idx} className="w-[16px] h-[16px] rounded-full bg-[#aaa] dark:bg-[#666] text-white flex items-center justify-center text-[7px] font-bold shrink-0 leading-none">
                                  {n.charAt(0).toUpperCase()}
                                </div>
                              ))}
                              {attEveningNames.length > 5 && (
                                <span className="text-[7px] text-[#bbb] dark:text-[#444]">+{attEveningNames.length - 5}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[8px] text-[#ddd] dark:text-[#2a2a2a]">—</span>
                          )}
                        </div>

                        {/* Cashiers */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[7px] font-bold text-[#bbb] dark:text-[#444] uppercase tracking-widest">Cashiers</span>
                          {cashierEveningNames.length > 0 ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              {cashierEveningNames.slice(0, 5).map((n, idx) => (
                                <div key={idx} className="w-[16px] h-[16px] rounded-full bg-blue-300 dark:bg-blue-700 text-white flex items-center justify-center text-[7px] font-bold shrink-0 leading-none">
                                  {n.charAt(0).toUpperCase()}
                                </div>
                              ))}
                              {cashierEveningNames.length > 5 && (
                                <span className="text-[7px] text-[#bbb] dark:text-[#444]">+{cashierEveningNames.length - 5}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[8px] text-[#ddd] dark:text-[#2a2a2a]">—</span>
                          )}
                        </div>
                      </button>

                    </div>
                  </div>
                </>
              ) : inPublished ? (
                /* Published mode — short, centred, spans across column borders */
                <>
                  {/* Fixed-height top strip — always present so every column's band sits at the same Y */}
                  <div className="h-8 shrink-0 flex flex-col gap-0.5 px-2 pt-1.5 overflow-hidden">
                    {shifts.slice(0, 2).map((s) => <ShiftPill key={s.id} shift={s} />)}
                    {shifts.length > 2 && <p className="text-[9px] text-[#bbb] dark:text-[#444] pl-1">+{shifts.length - 2} more</p>}
                  </div>
                  <div className="flex-1 flex flex-col py-1">
                    <button
                      onClick={() => onSelectPublished?.(iso)}
                      className="text-left w-full overflow-hidden"
                    >
                      <div
                        className={`h-[280px] flex flex-col overflow-hidden border-t border-b transition-opacity hover:opacity-90 ${
                          isPubStart ? 'border-l rounded-l-xl ml-1' : ''
                        } ${
                          isPubEnd ? 'border-r rounded-r-xl mr-1' : ''
                        }`}
                        style={{ backgroundColor: color.bg, borderColor: color.border }}
                      >
                        {/* AM */}
                        <div className="flex-1 flex flex-col px-2.5 pt-2 pb-2 gap-1.5 border-b" style={{ borderColor: color.border }}>
                          <span className="text-[7px] font-bold shrink-0" style={{ color: color.label }}>AM</span>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[7px] font-bold text-[#aaa] uppercase tracking-widest">Supervisor</span>
                            {supMorningName ? (
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div className="w-[14px] h-[14px] rounded-full bg-[#333] text-white flex items-center justify-center text-[6px] font-bold shrink-0">{supMorningName.charAt(0).toUpperCase()}</div>
                                <span className="text-[8px] font-semibold text-[#333] truncate leading-none">{supMorningName.split(' ')[0]}</span>
                              </div>
                            ) : <span className="text-[8px] text-[#bbb]">—</span>}
                          </div>
                          {attMorningNames.length > 0 && (
                            <div className="flex items-center gap-0.5 flex-wrap">
                              {attMorningNames.slice(0, 5).map((n, idx) => (
                                <div key={idx} className="w-[13px] h-[13px] rounded-full bg-[#aaa] text-white flex items-center justify-center text-[5px] font-bold shrink-0">{n.charAt(0).toUpperCase()}</div>
                              ))}
                              {attMorningNames.length > 5 && <span className="text-[6px] text-[#aaa]">+{attMorningNames.length - 5}</span>}
                            </div>
                          )}
                        </div>
                        {/* PM */}
                        <div className="flex-1 flex flex-col px-2.5 pt-2 pb-2 gap-1.5">
                          <span className="text-[7px] font-bold shrink-0" style={{ color: color.label }}>PM</span>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[7px] font-bold text-[#aaa] uppercase tracking-widest">Supervisor</span>
                            {supEveningName ? (
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div className="w-[14px] h-[14px] rounded-full bg-[#333] text-white flex items-center justify-center text-[6px] font-bold shrink-0">{supEveningName.charAt(0).toUpperCase()}</div>
                                <span className="text-[8px] font-semibold text-[#333] truncate leading-none">{supEveningName.split(' ')[0]}</span>
                              </div>
                            ) : <span className="text-[8px] text-[#bbb]">—</span>}
                          </div>
                          {attEveningNames.length > 0 && (
                            <div className="flex items-center gap-0.5 flex-wrap">
                              {attEveningNames.slice(0, 5).map((n, idx) => (
                                <div key={idx} className="w-[13px] h-[13px] rounded-full bg-[#aaa] text-white flex items-center justify-center text-[5px] font-bold shrink-0">{n.charAt(0).toUpperCase()}</div>
                              ))}
                              {attEveningNames.length > 5 && <span className="text-[6px] text-[#aaa]">+{attEveningNames.length - 5}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  </div>
                </>
              ) : (
                /* Normal mode — full clickable cell */
                <button
                  onClick={() => onSelect(iso)}
                  className={`flex flex-col gap-1.5 p-3 text-left flex-1 hover:bg-[#f9f9f9] dark:hover:bg-[#1a1a1a] transition-colors ${isSel ? 'bg-[#f4f4f4] dark:bg-[#222]' : ''}`}
                >
                  {shifts.map((s) => <ShiftPill key={s.id} shift={s} />)}
                </button>
              )}
            </div>
          )
        })}
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

  const [view, setView]           = useState<ViewMode>('week')
  const [year, setYear]           = useState(now.getFullYear())
  const [month, setMonth]         = useState(now.getMonth())
  const [weekAnchor, setWeekAnchor] = useState(now)
  const [selected, setSelected]   = useState<string | null>(null)
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null)
  const [showGenerate, setShowGenerate]   = useState(false)
  const [showTimeOff, setShowTimeOff]     = useState(false)
  const [timeOffOpen, setTimeOffOpen]     = useState(false)

  // Schedule draft state
  const [draft, setDraft]         = useState<ScheduleDraft | null>(null)
  const [planDay, setPlanDay]     = useState<string | null>(null)
  const [planSlot, setPlanSlot]   = useState<ShiftSlot>('morning')
  const [draftMenuOpen, setDraftMenuOpen]       = useState(false)
  const [showEditDateRange, setShowEditDateRange] = useState(false)
  const draftMenuRef  = useRef<HTMLDivElement>(null)
  const [pubChipMenuOpen, setPubChipMenuOpen] = useState(false)
  const pubChipMenuRef = useRef<HTMLDivElement>(null)

  // Published schedules (array) — persisted in localStorage.
  // Migrates the old single-schedule key automatically.
  const [publishedSchedules, setPublishedSchedules] = useState<ScheduleDraft[]>(() => {
    try {
      const newRaw = localStorage.getItem('ss_published_schedules')
      if (newRaw) return JSON.parse(newRaw) as ScheduleDraft[]
      // Migrate old single-schedule key
      const oldRaw = localStorage.getItem('ss_published_schedule')
      if (oldRaw) {
        const single = JSON.parse(oldRaw) as ScheduleDraft
        return [single]
      }
      return []
    } catch { return [] }
  })
  const [selectedPublishedDay, setSelectedPublishedDay] = useState<string | null>(null)

  // Derived: which published schedule covers the currently selected day
  const selectedPubSchedule = selectedPublishedDay
    ? findScheduleForDay(selectedPublishedDay, publishedSchedules)
    : null

  function savePublishedSchedules(next: ScheduleDraft[]) {
    localStorage.setItem('ss_published_schedules', JSON.stringify(next))
    setPublishedSchedules(next)
  }

  useEffect(() => {
    if (!draftMenuOpen) return
    function handleClick(e: MouseEvent) {
      if (draftMenuRef.current && !draftMenuRef.current.contains(e.target as Node)) {
        setDraftMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [draftMenuOpen])

  useEffect(() => {
    if (!pubChipMenuOpen) return
    function handleClick(e: MouseEvent) {
      if (pubChipMenuRef.current && !pubChipMenuRef.current.contains(e.target as Node)) {
        setPubChipMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [pubChipMenuOpen])

  const { data: timeOffRequests = [] } = useTimeOffRequests()
  const { data: pumps = [] }           = usePumps()
  const pendingCount = timeOffRequests.filter((r) => r.status === 'Pending').length

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

  // If a shift container is selected, the right column shows only that shift.
  // Otherwise it falls back to listing every shift on the selected day.
  const selectedShiftObj = selectedShiftId ? shifts.find((s) => s.id === selectedShiftId) ?? null : null
  const selectedShifts: Shift[] = selectedShiftObj
    ? [selectedShiftObj]
    : selected ? (shiftsByDate.get(selected) ?? []) : []
  // The right-column day header uses whichever date is active.
  const panelDateISO = selectedShiftObj?.date ?? selected

  function prevPeriod() {
    if (view === 'month') {
      if (month === 0) { setYear((y) => y - 1); setMonth(11) } else setMonth((m) => m - 1)
    } else {
      const d = new Date(weekAnchor); d.setDate(d.getDate() - 7); setWeekAnchor(d)
    }
    setSelected(null); setSelectedShiftId(null)
  }

  function nextPeriod() {
    if (view === 'month') {
      if (month === 11) { setYear((y) => y + 1); setMonth(0) } else setMonth((m) => m + 1)
    } else {
      const d = new Date(weekAnchor); d.setDate(d.getDate() + 7); setWeekAnchor(d)
    }
    setSelected(null); setSelectedShiftId(null)
  }

  function goToday() {
    setYear(now.getFullYear()); setMonth(now.getMonth()); setWeekAnchor(now); setSelected(null); setSelectedShiftId(null)
  }

  function handleDraftCreate(newDraft: ScheduleDraft) {
    setDraft(newDraft)
    // Navigate to week view and jump to the week containing startISO
    setView('week')
    setWeekAnchor(new Date(newDraft.startISO + 'T00:00:00'))
    setSelected(null); setSelectedShiftId(null)
  }

  function handleDraftUpdate(date: string, plan: DayPlan) {
    setDraft((d) => d ? { ...d, days: { ...d.days, [date]: plan } } : d)
  }

  function handleEditDateRange(start: string, end: string) {
    setDraft((d) => d ? { ...d, startISO: start, endISO: end } : d)
    setWeekAnchor(new Date(start + 'T00:00:00'))
    setShowEditDateRange(false)
  }

  // When a draft is active in week view, start each page from the current weekAnchor
  const draftCustomStart = useMemo<Date | undefined>(() => {
    if (!draft || view !== 'week') return undefined
    return new Date(weekAnchor)
  }, [draft, view, weekAnchor])

  // Draft page navigation: show arrows only when there are pages before/after
  const draftHasPrev = !!(draft && view === 'week' &&
    weekAnchor.toISOString().slice(0, 10) > draft.startISO)
  const draftHasNext = !!(draft && view === 'week' && (() => {
    const next = new Date(weekAnchor)
    next.setDate(weekAnchor.getDate() + 7)
    return next.toISOString().slice(0, 10) <= draft.endISO
  })())

  const periodLabel = draft && view === 'week'
    ? (() => {
        // Show the current page window, capped at the draft's end date
        const s = new Date(weekAnchor)
        s.setHours(0, 0, 0, 0)
        const pageEnd = new Date(s)
        pageEnd.setDate(s.getDate() + 6)
        const draftEnd = new Date(draft.endISO + 'T00:00:00')
        const e = pageEnd < draftEnd ? pageEnd : draftEnd
        if (s.getMonth() === e.getMonth())
          return `${MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`
        return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`
      })()
    : view === 'month'
    ? `${MONTHS[month]} ${year}`
    : (() => {
        const days = buildWeekDays(weekAnchor)
        const s = days[0], e = days[6]
        if (s.getMonth() === e.getMonth())
          return `${MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`
        return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`
      })()

  return (
    <SelectedShiftContext.Provider value={{
      shiftId: selectedShiftId,
      select: setSelectedShiftId,
      getStationSupervisorForDate: (date) => {
        const day = shiftsByDate.get(date)
        if (!day) return null
        const stationShift = day.find((s) => s.shift_type !== 'convenience_store')
        return stationShift?.supervisor_name ?? null
      },
    }}>
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebebeb] dark:border-[#222] bg-white dark:bg-[#1a1a1a] flex-shrink-0 gap-4 flex-wrap">
        <div>
          {(storeLabel || isRequester) && (
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] dark:text-[#555] uppercase mb-0.5">
              {storeLabel ?? 'Service Station'}
            </p>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[20px] font-bold text-[#111] dark:text-[#e0e0e0]">Schedule</h1>
            {/* Published chip — rendered only for the currently selected schedule container */}
            {selectedPubSchedule && !draft && (() => {
              const schedColor = SCHEDULE_COLORS[scheduleColorIdx(selectedPubSchedule)]
              return (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#e0e0e0] dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] transition-colors">
                  <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: schedColor.label }}>
                    Published
                  </span>
                  <span className="text-[10px] text-[#aaa] dark:text-[#555]">
                    {new Date(selectedPubSchedule.startISO + 'T00:00:00').toLocaleDateString('en-JM', { month: 'short', day: 'numeric' })}
                    {'–'}
                    {new Date(selectedPubSchedule.endISO + 'T00:00:00').toLocaleDateString('en-JM', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <div ref={pubChipMenuRef} className="relative ml-0.5">
                    <button
                      onClick={() => setPubChipMenuOpen((o) => !o)}
                      className="w-5 h-5 flex items-center justify-center rounded-md text-[#aaa] dark:text-[#555] hover:bg-emerald-100 dark:hover:bg-emerald-900/40 hover:text-[#555] dark:hover:text-[#ccc] transition-colors"
                    >
                      <MoreHorizontal size={12} />
                    </button>
                    {pubChipMenuOpen && (
                      <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#1e1e1e] border border-[#e8e8e8] dark:border-[#2a2a2a] rounded-xl shadow-lg py-1 min-w-[140px] z-30">
                        <button
                          onClick={() => {
                            setDraft(selectedPubSchedule)
                            setWeekAnchor(new Date(selectedPubSchedule.startISO + 'T00:00:00'))
                            setView('week')
                            setSelectedPublishedDay(null)
                            setPubChipMenuOpen(false)
                          }}
                          className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] hover:bg-[#f9f9f9] dark:hover:bg-[#252525] transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => { window.print(); setPubChipMenuOpen(false) }}
                          className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] hover:bg-[#f9f9f9] dark:hover:bg-[#252525] transition-colors"
                        >
                          Print
                        </button>
                        <div className="border-t border-[#f0f0f0] dark:border-[#2a2a2a] my-1" />
                        <button
                          onClick={() => {
                            savePublishedSchedules(publishedSchedules.filter((s) => s !== selectedPubSchedule))
                            setSelectedPublishedDay(null)
                            setPubChipMenuOpen(false)
                          }}
                          className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          Unpublish
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
            {draft && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-widest text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2.5 py-1 rounded-full uppercase">
                  {draft.type === 'station' ? 'Service Station' : 'Convenience'} Draft
                </span>
                <div ref={draftMenuRef} className="relative">
                  <button
                    onClick={() => setDraftMenuOpen((o) => !o)}
                    className="w-6 h-6 flex items-center justify-center rounded-lg text-[#aaa] dark:text-[#555] hover:bg-[#f0f0f0] dark:hover:bg-[#222] hover:text-[#555] dark:hover:text-[#ccc] transition-colors"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {draftMenuOpen && (
                    <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#1e1e1e] border border-[#e8e8e8] dark:border-[#2a2a2a] rounded-xl shadow-lg py-1 min-w-[160px] z-30">
                      <button
                        onClick={() => {
                          if (draft) {
                            // Add this draft; remove any previously-published schedules
                            // that overlap with the new one.
                            const next = [
                              ...publishedSchedules.filter(
                                (s) => s.endISO < draft.startISO || s.startISO > draft.endISO
                              ),
                              draft,
                            ]
                            savePublishedSchedules(next)
                            setDraft(null)
                            setSelectedPublishedDay(null)
                          }
                          setDraftMenuOpen(false)
                        }}
                        className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                      >
                        Publish
                      </button>
                      <button
                        onClick={() => { setDraftMenuOpen(false); setShowEditDateRange(true) }}
                        className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] hover:bg-[#f9f9f9] dark:hover:bg-[#252525] transition-colors"
                      >
                        Edit date range
                      </button>
                      <button
                        onClick={() => { window.print(); setDraftMenuOpen(false) }}
                        className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] hover:bg-[#f9f9f9] dark:hover:bg-[#252525] transition-colors"
                      >
                        Print
                      </button>
                      <div className="border-t border-[#f0f0f0] dark:border-[#2a2a2a] my-1" />
                      <button
                        onClick={() => { setDraft(null); setDraftMenuOpen(false) }}
                        className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Publish (planning mode) | Create (normal mode) */}
          {draft ? (
            <button
              onClick={() => {
                const next = [
                  ...publishedSchedules.filter(
                    (s) => s.endISO < draft.startISO || s.startISO > draft.endISO
                  ),
                  draft,
                ]
                savePublishedSchedules(next)
                setDraft(null)
                setSelectedPublishedDay(null)
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-white dark:bg-[#1a1a1a] border border-[#ddd] dark:border-[#333] text-[#333] dark:text-[#ccc] text-[13px] font-semibold rounded-xl hover:bg-[#f9f9f9] dark:hover:bg-[#161616] transition-colors"
            >
              Publish
            </button>
          ) : (
            <button onClick={() => setShowGenerate(true)}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-white dark:bg-[#1a1a1a] border border-[#ddd] dark:border-[#333] text-[#333] dark:text-[#ccc] text-[13px] font-semibold rounded-xl hover:bg-[#f9f9f9] dark:hover:bg-[#161616] transition-colors">
              <Sparkles size={13} /> Create
            </button>
          )}

          {/* Period navigation */}
          {(!draft || draftHasPrev || view === 'month') && (
            <button onClick={prevPeriod} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] dark:text-[#666] hover:text-[#111] dark:hover:text-[#e0e0e0] hover:bg-[#f4f4f4] dark:hover:bg-[#222] transition-colors">
              <ChevronLeft size={16} />
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <span className={`text-[14px] font-bold text-[#111] dark:text-[#e0e0e0] ${draft && view === 'week' ? '' : 'min-w-[180px] text-center'}`}>
              {periodLabel}
            </span>
            {draft && view === 'week' && (
              <button
                onClick={() => { setDraftMenuOpen(false); setShowEditDateRange(true) }}
                title="Edit date range"
                className="w-6 h-6 flex items-center justify-center rounded-lg text-[#aaa] dark:text-[#555] hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
              >
                <Pencil size={12} />
              </button>
            )}
          </div>
          {(!draft || draftHasNext || view === 'month') && (
            <button onClick={nextPeriod} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] dark:text-[#666] hover:text-[#111] dark:hover:text-[#e0e0e0] hover:bg-[#f4f4f4] dark:hover:bg-[#222] transition-colors">
              <ChevronRight size={16} />
            </button>
          )}

          {/* Today */}
          <button onClick={goToday} className="px-3 py-1.5 text-[12px] font-semibold text-[#555] dark:text-[#999] border border-[#e0e0e0] dark:border-[#2a2a2a] rounded-lg hover:border-[#ccc] dark:hover:border-[#444] hover:text-[#111] dark:hover:text-[#e0e0e0] transition-colors ml-1">
            Today
          </button>

          {/* View toggle */}
          <div className="flex items-center bg-[#f4f4f4] dark:bg-[#222] rounded-lg p-0.5 ml-1">
            {(['week', 'month'] as ViewMode[]).map((v) => (
              <button key={v} onClick={() => { setView(v); setSelected(null); setSelectedShiftId(null) }}
                className={`px-3 py-1 text-[12px] font-semibold rounded-md capitalize transition-colors ${
                  view === v ? 'bg-white dark:bg-[#333] text-[#111] dark:text-[#e0e0e0] shadow-sm' : 'text-[#888] dark:text-[#666] hover:text-[#555] dark:hover:text-[#999]'
                }`}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#1a1a1a] min-w-0">
          <div className="flex-1 flex flex-col overflow-hidden">
            {isLoading ? (
              <div className="h-64 flex items-center justify-center"><LogoLoader /></div>
            ) : view === 'month' ? (
              <MonthView
                year={year} month={month}
                shiftsByDate={shiftsByDate}
                today={today}
                selected={selected}
                planningMode={!!draft}
                draft={draft}
                publishedSchedules={publishedSchedules}
                onSelect={(iso) => { setSelected((cur) => cur === iso ? null : iso); setSelectedShiftId(null); setSelectedPublishedDay(null) }}
                onPlanDay={(iso, slot) => { setPlanDay(iso); setPlanSlot(slot) }}
                onSelectPublished={(iso) => setSelectedPublishedDay((cur) => cur === iso ? null : iso)}
              />
            ) : (
              <WeekView
                anchor={weekAnchor}
                customStart={draftCustomStart}
                shiftsByDate={shiftsByDate}
                today={today}
                selected={selected}
                draft={draft}
                publishedSchedules={publishedSchedules}
                onSelect={(iso) => { setSelected((cur) => cur === iso ? null : iso); setSelectedShiftId(null); setSelectedPublishedDay(null) }}
                onPlanDay={(iso, slot) => { setPlanDay(iso); setPlanSlot(slot) }}
                onSelectPublished={(iso) => setSelectedPublishedDay((cur) => cur === iso ? null : iso)}
              />
            )}
          </div>

          {/* Draft legend strip */}
          {draft && view === 'week' && (
            <div className="border-t border-dashed border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-900/10 px-6 py-2.5 flex items-center gap-4 shrink-0">
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">Planning Mode</span>
              <span className="text-[10px] text-[#888] dark:text-[#666]">
                {draft.startISO === draft.endISO
                  ? new Date(draft.startISO + 'T00:00:00').toLocaleDateString('en-JM', { month: 'short', day: 'numeric' })
                  : `${new Date(draft.startISO + 'T00:00:00').toLocaleDateString('en-JM', { month: 'short', day: 'numeric' })} – ${new Date(draft.endISO + 'T00:00:00').toLocaleDateString('en-JM', { month: 'short', day: 'numeric', year: 'numeric' })}`
                }
              </span>
              <div className="flex items-center gap-3 ml-auto">
                <span className="text-[10px] text-[#888] dark:text-[#666]">
                  {draft.supervisors.length} sup · {draft.staff.length} att · {draft.cashiers.length} cshr
                </span>
              </div>
            </div>
          )}

          {/* Time off requests */}
          <div className="border-t border-[#e8e8e8] dark:border-[#222] shrink-0">
            {/* Collapsible header */}
            <button
              onClick={() => setTimeOffOpen((o) => !o)}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#fafafa] dark:hover:bg-[#1e1e1e] transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <ChevronRight
                  size={14}
                  className={`text-[#bbb] dark:text-[#555] transition-transform duration-200 shrink-0 ${timeOffOpen ? 'rotate-90' : ''}`}
                />
                <span className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">Time Off</span>
                <span className="text-[13px] font-medium text-[#aaa] dark:text-[#555]">| Requests</span>
                <span className="px-1.5 py-0.5 bg-[#f0f0f0] dark:bg-[#2a2a2a] rounded-full text-[10px] font-bold text-[#888] dark:text-[#666]">
                  {timeOffRequests.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {pendingCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 rounded-full text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    {pendingCount} pending
                  </span>
                )}
              </div>
            </button>

            {/* Collapsible body */}
            {timeOffOpen && (
              <div className="flex flex-col h-[320px] px-5 pb-5">
                <div className="flex-1 overflow-y-auto">
                  {timeOffRequests.length === 0 ? (
                    <div className="py-8 flex items-center justify-center">
                      <p className="text-[13px] font-medium text-[#bbb] dark:text-[#444]">No time off requests</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-[24px_1fr_90px_1fr_72px] gap-x-3 gap-y-0 mb-2 sticky top-0 bg-white dark:bg-[#1a1a1a] pt-1 pb-1">
                        {['#', 'Employee', 'Date', 'Reason', 'Status'].map((h) => (
                          <p key={h} className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase">{h}</p>
                        ))}
                      </div>
                      <div className="flex flex-col gap-0">
                        {timeOffRequests.map((r, i) => (
                          <div key={r.id} className={`grid grid-cols-[24px_1fr_90px_1fr_72px] gap-x-3 items-center py-2.5 ${i < timeOffRequests.length - 1 ? 'border-b border-[#f4f4f4] dark:border-[#1e1e1e]' : ''}`}>
                            <span className="text-[11px] text-[#ccc] dark:text-[#444] font-medium">{i + 1}</span>
                            <span className="text-[12px] font-semibold text-[#111] dark:text-[#e0e0e0] truncate">{r.user_name}</span>
                            <span className="text-[12px] text-[#666] dark:text-[#888]">
                              {new Date(r.date + 'T00:00:00').toLocaleDateString('en-JM', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className="text-[12px] text-[#888] dark:text-[#666] truncate">{r.reason || <span className="text-[#ccc] dark:text-[#444]">—</span>}</span>
                            {statusChip(r.status)}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-end border-t border-[#f0f0f0] dark:border-[#222] pt-3">
                  <p className="text-[13px] font-bold text-[#bbb] dark:text-[#444]">
                    {timeOffRequests.length} request{timeOffRequests.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Day detail panel (only when no draft active).
            A selected shift overrides the day list: the panel shows only that
            shift's container in the right column. */}
        {panelDateISO && !draft && !selectedPublishedDay && (
          <DayPanel
            date={new Date(panelDateISO + 'T00:00:00')}
            shifts={selectedShifts}
            onClose={() => { setSelected(null); setSelectedShiftId(null) }}
          />
        )}

        {/* Published day detail panel */}
        {selectedPublishedDay && selectedPubSchedule && !draft && (
          <PublishedDayPanel
            date={selectedPublishedDay}
            schedule={selectedPubSchedule}
            onClose={() => setSelectedPublishedDay(null)}
            onEdit={() => {
              setDraft(selectedPubSchedule)
              setWeekAnchor(new Date(selectedPubSchedule.startISO + 'T00:00:00'))
              setView('week')
              setSelectedPublishedDay(null)
            }}
          />
        )}
      </div>

      {/* Modals */}
      {showGenerate && (
        <CreateScheduleWizard onClose={() => setShowGenerate(false)} onCreate={handleDraftCreate} publishedSchedules={publishedSchedules} />
      )}
      {showEditDateRange && draft && (
        <EditDateRangeModal
          startISO={draft.startISO}
          endISO={draft.endISO}
          onSave={handleEditDateRange}
          onClose={() => setShowEditDateRange(false)}
        />
      )}
      {showTimeOff && (
        <TimeOffModal defaultDate={selected ?? today} onClose={() => setShowTimeOff(false)} />
      )}
      {planDay && draft && (
        <DayShiftModal
          date={planDay}
          draft={draft}
          pumps={pumps}
          initialSlot={planSlot}
          onUpdate={handleDraftUpdate}
          onClose={() => setPlanDay(null)}
        />
      )}
    </div>
    </SelectedShiftContext.Provider>
  )
}
