import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, Circle, User } from 'lucide-react'
import { useShiftsInRange } from '../hooks/useApi'
import type { Shift } from '../lib/api'

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
  const end   = toISO(year, month + 1, 0) // day 0 of next month = last day of this month
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

// ── Shift pill ────────────────────────────────────────────────────────────────

function ShiftPill({ shift }: { shift: Shift }) {
  const open = shift.end_time == null
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold truncate ${
      open ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-[#f0f0f0] text-[#555]'
    }`}>
      {open
        ? <Circle size={8} className="fill-[#2e7d32] shrink-0" />
        : <CheckCircle2 size={8} className="shrink-0" />}
      {fmt12(shift.start_time)}
      {shift.end_time && <span className="text-[#aaa]">– {fmt12(shift.end_time)}</span>}
    </div>
  )
}

// ── Day detail panel ──────────────────────────────────────────────────────────

function DayPanel({ date, shifts, onClose }: { date: Date; shifts: Shift[]; onClose: () => void }) {
  const label = date.toLocaleDateString('en-JM', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="w-[280px] shrink-0 border-l border-[#ebebeb] bg-white flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#f4f4f4]">
        <p className="text-[13px] font-bold text-[#111]">{label}</p>
        <button onClick={onClose} className="text-[#bbb] hover:text-[#555] text-[18px] leading-none">&times;</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {shifts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <p className="text-[13px] font-semibold text-[#bbb]">No shift</p>
            <p className="text-[11px] text-[#ccc]">No shift was recorded for this day.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {shifts.map((s) => (
              <div key={s.id} className="bg-[#fafafa] rounded-xl border border-[#ebebeb] p-4">
                <div className="flex items-center gap-2 mb-3">
                  {s.end_time == null
                    ? <span className="text-[10px] font-bold tracking-widest uppercase text-[#2e7d32] bg-[#e8f5e9] px-2 py-0.5 rounded-full">Open</span>
                    : <span className="text-[10px] font-bold tracking-widest uppercase text-[#555] bg-[#f0f0f0] px-2 py-0.5 rounded-full">Closed</span>}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="text-[#aaa] shrink-0" />
                    <span className="text-[12px] text-[#555]">
                      {fmt12(s.start_time)}
                      {s.end_time && <> &ndash; {fmt12(s.end_time)}</>}
                    </span>
                  </div>
                  {s.supervisor_name && (
                    <div className="flex items-center gap-2">
                      <User size={12} className="text-[#aaa] shrink-0" />
                      <span className="text-[12px] text-[#555]">{s.supervisor_name}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
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
    <div className="flex-1 overflow-auto">
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
    <div className="flex-1 overflow-auto">
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

// ── Main page ─────────────────────────────────────────────────────────────────

export function SchedulePage() {
  const now   = new Date()
  const today = now.toISOString().slice(0, 10)

  const [view, setView]         = useState<ViewMode>('month')
  const [year, setYear]         = useState(now.getFullYear())
  const [month, setMonth]       = useState(now.getMonth())
  const [weekAnchor, setWeekAnchor] = useState(now)
  const [selected, setSelected] = useState<string | null>(null)

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
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase leading-none mb-0.5">Service Station</p>
            <h1 className="text-[20px] font-bold text-[#111] leading-tight">Schedule</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
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

          {/* View toggle */}
          <div className="flex items-center bg-[#f4f4f4] rounded-lg p-0.5 ml-1">
            {(['month', 'week'] as ViewMode[]).map((v) => (
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
        <div className="flex flex-col flex-1 overflow-hidden bg-white">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
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
    </div>
  )
}
