import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays, DollarSign, TrendingUp, Users, Shield, Sparkles,
  Loader2, Check, AlertTriangle, Plus, Trash2, ChevronRight, Info,
  CalendarCheck, Sun, Moon, Coffee, Clock, X,
} from 'lucide-react'
import clsx from 'clsx'
import {
  getHolidayCalendar, listHolidays, createHoliday, deleteHoliday,
  getHolidayPayRules, upsertHolidayPayRules, previewHolidayPay,
  getHolidaySignups, createHolidaySignup, reviewHolidaySignup,
  getHolidayForecast, getHolidayAnalytics, getHolidayCompliance, getHolidayInsights,
  type ResolvedHoliday, type HolidayPayRules, type HolidayPayResult,
  type HolidayForecast, type HolidayAnalytics, type HolidayComplianceAlert,
} from '../lib/api'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, dp = 0) {
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}
function fmtDate(s: string) {
  const d = new Date(s + 'T00:00:00')
  return d.toLocaleDateString('en-JM', { weekday: 'short', month: 'short', day: 'numeric' })
}
function daysUntil(s: string) {
  const d = new Date(s + 'T00:00:00')
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - now.getTime()) / 86400000)
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('bg-white dark:bg-[#111] border border-[#ebebeb] dark:border-[#222] rounded-2xl', className)}>{children}</div>
}
function Loading() {
  return <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-[#ccc] dark:text-[#444]" /></div>
}
function Empty({ msg }: { msg: string }) {
  return <div className="py-12 text-center text-[13px] font-semibold text-[#bbb]">{msg}</div>
}

const TYPE_BADGE: Record<string, string> = {
  public:    'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  observed:  'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400',
  company:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  emergency: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Calendar
// ═══════════════════════════════════════════════════════════════════════════════

function CalendarTab() {
  const qc = useQueryClient()
  const [year, setYear] = useState(new Date().getFullYear())
  const [showAdd, setShowAdd] = useState(false)
  const { data, isLoading } = useQuery({ queryKey: ['holiday-calendar', year], queryFn: () => getHolidayCalendar(year) })
  const { data: rawHolidays } = useQuery({ queryKey: ['holidays-raw'], queryFn: listHolidays })

  const delMut = useMutation({
    mutationFn: deleteHoliday,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['holiday-calendar'] }); qc.invalidateQueries({ queryKey: ['holidays-raw'] }) },
  })

  const companyRows = (rawHolidays ?? []).filter((h) => h.business_id !== null)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setYear((y) => y - 1)} className="px-3 py-1.5 rounded-xl border border-[#e0e0e0] dark:border-[#333] text-[13px] font-bold text-[#888] hover:text-[#111] dark:hover:text-white">‹</button>
          <span className="text-[16px] font-black text-[#111] dark:text-white tabular-nums w-16 text-center">{year}</span>
          <button onClick={() => setYear((y) => y + 1)} className="px-3 py-1.5 rounded-xl border border-[#e0e0e0] dark:border-[#333] text-[13px] font-bold text-[#888] hover:text-[#111] dark:hover:text-white">›</button>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#111] dark:bg-white text-white dark:text-[#111] rounded-xl text-[12px] font-bold hover:opacity-90 transition-opacity">
          <Plus size={13} /> Add Company / Emergency Holiday
        </button>
      </div>

      {isLoading ? <Loading /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(data?.holidays ?? []).map((hol) => {
            const du = daysUntil(hol.observed_date ?? hol.date)
            const isCompanyRow = companyRows.find((c) => c.name === hol.name)
            return (
              <Card key={hol.name + hol.date} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-[#111] dark:text-white truncate">{hol.name}</p>
                    <p className="text-[12px] text-[#888] mt-0.5">{fmtDate(hol.date)}</p>
                  </div>
                  <span className={clsx('text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0', TYPE_BADGE[hol.holiday_type])}>
                    {hol.holiday_type}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {hol.observed_date && (
                    <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 px-2 py-0.5 rounded-full">
                      Observed {fmtDate(hol.observed_date)}
                    </span>
                  )}
                  {hol.is_weekend && !hol.observed_date && (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">Weekend</span>
                  )}
                  {hol.category === 'variable' && (
                    <span className="text-[10px] font-semibold text-[#aaa]">computed</span>
                  )}
                  {du >= 0 && du <= 60 && (
                    <span className="text-[10px] font-bold text-[#555] dark:text-[#aaa]">in {du}d</span>
                  )}
                </div>
                {isCompanyRow && (
                  <button onClick={() => delMut.mutate(isCompanyRow.id)}
                    className="mt-2 flex items-center gap-1 text-[10px] font-bold text-red-500 hover:text-red-600">
                    <Trash2 size={10} /> Remove
                  </button>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {showAdd && <AddHolidayModal onClose={() => setShowAdd(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ['holiday-calendar'] }); qc.invalidateQueries({ queryKey: ['holidays-raw'] }); setShowAdd(false) }} />}
    </div>
  )
}

function AddHolidayModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'recurring' | 'oneoff'>('oneoff')
  const [holidayDate, setHolidayDate] = useState('')
  const [monthOf, setMonthOf] = useState('')
  const [dayOf, setDayOf] = useState('')
  const [type, setType] = useState<'company' | 'emergency'>('company')
  const [observed, setObserved] = useState('next_monday')

  const mut = useMutation({
    mutationFn: () => createHoliday({
      name,
      holiday_type: type,
      category: mode === 'oneoff' ? 'declared' : 'fixed',
      holiday_date: mode === 'oneoff' ? holidayDate : undefined,
      month_of: mode === 'recurring' ? parseInt(monthOf) : undefined,
      day_of: mode === 'recurring' ? parseInt(dayOf) : undefined,
      is_recurring: mode === 'recurring',
      observed_rule: observed,
    }),
    onSuccess: onSaved,
  })
  const valid = name && (mode === 'oneoff' ? holidayDate : monthOf && dayOf)

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#111] rounded-2xl border border-[#ebebeb] dark:border-[#222] w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-[16px] font-bold text-[#111] dark:text-white">Add Holiday</p>
          <button onClick={onClose}><X size={18} className="text-[#bbb]" /></button>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Founder's Day"
            className="w-full px-3 py-2 text-[13px] bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none" />
        </div>
        <div className="flex gap-2">
          {(['oneoff', 'recurring'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={clsx('flex-1 py-2 rounded-xl text-[12px] font-bold border transition-colors',
                mode === m ? 'bg-[#111] dark:bg-white text-white dark:text-[#111] border-[#111] dark:border-white' : 'border-[#e0e0e0] dark:border-[#333] text-[#888]')}>
              {m === 'oneoff' ? 'One-off date' : 'Recurring (annual)'}
            </button>
          ))}
        </div>
        {mode === 'oneoff' ? (
          <div>
            <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">Date</label>
            <input type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)}
              className="w-full px-3 py-2 text-[13px] bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">Month (1-12)</label>
              <input type="number" min="1" max="12" value={monthOf} onChange={(e) => setMonthOf(e.target.value)}
                className="w-full px-3 py-2 text-[13px] bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">Day (1-31)</label>
              <input type="number" min="1" max="31" value={dayOf} onChange={(e) => setDayOf(e.target.value)}
                className="w-full px-3 py-2 text-[13px] bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none" />
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as 'company' | 'emergency')}
              className="w-full px-3 py-2 text-[13px] font-semibold bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none">
              <option value="company">Company</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">If weekend</label>
            <select value={observed} onChange={(e) => setObserved(e.target.value)}
              className="w-full px-3 py-2 text-[13px] font-semibold bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none">
              <option value="none">No shift</option>
              <option value="next_monday">→ Next Monday</option>
              <option value="nearest_weekday">→ Nearest weekday</option>
            </select>
          </div>
        </div>
        <button onClick={() => mut.mutate()} disabled={!valid || mut.isPending}
          className="w-full py-2.5 bg-[#111] dark:bg-white text-white dark:text-[#111] rounded-xl text-[13px] font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity">
          {mut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Add Holiday
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Pay Rules
// ═══════════════════════════════════════════════════════════════════════════════

function PayRulesTab() {
  const qc = useQueryClient()
  const { data: rules, isLoading } = useQuery({ queryKey: ['holiday-pay-rules'], queryFn: getHolidayPayRules })
  const [draft, setDraft] = useState<HolidayPayRules | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => { if (rules) setDraft(rules) }, [rules])

  const mut = useMutation({
    mutationFn: () => upsertHolidayPayRules(draft!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['holiday-pay-rules'] }); setSaved(true); setTimeout(() => setSaved(false), 2000) },
  })

  if (isLoading || !draft) return <Loading />

  const multipliers: { key: keyof HolidayPayRules; label: string; icon: React.ElementType; desc: string }[] = [
    { key: 'regular_multiplier',     label: 'Regular Holiday',  icon: Sun,    desc: 'Worked-holiday base rate' },
    { key: 'overtime_multiplier',    label: 'Holiday Overtime', icon: Clock,  desc: 'OT hours on a holiday' },
    { key: 'rest_day_multiplier',    label: 'Rest-Day Holiday', icon: Coffee, desc: 'Holiday on contractual rest day' },
    { key: 'night_shift_multiplier', label: 'Night Shift',      icon: Moon,   desc: 'Holiday night-shift hours' },
  ]

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
        <Info size={14} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
          All premium rates are stored in the database — no code changes needed.
          Formula: <code className="font-mono">Holiday Pay = Hours × Hourly Rate × Multiplier</code>
        </p>
      </div>

      <Card className="p-6 space-y-5">
        <p className="text-[13px] font-bold text-[#111] dark:text-white">Premium Multipliers</p>
        <div className="grid grid-cols-2 gap-4">
          {multipliers.map(({ key, label, icon: Icon, desc }) => (
            <div key={key}>
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">
                <Icon size={12} /> {label}
              </label>
              <div className="relative">
                <input type="number" step="0.05" min="1" max="5"
                  value={draft[key] as number}
                  onChange={(e) => setDraft({ ...draft, [key]: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 pr-8 text-[14px] font-black bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#111] dark:focus:ring-white" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#aaa]">×</span>
              </div>
              <p className="text-[10px] text-[#bbb] mt-1">{desc}</p>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-[#f0f0f0] dark:border-[#222]">
          <p className="text-[13px] font-bold text-[#111] dark:text-white mb-3">Employees Who Don't Work the Holiday</p>
          <div className="flex gap-2 mb-3">
            {(['paid', 'partial', 'unpaid'] as const).map((p) => (
              <button key={p} onClick={() => setDraft({ ...draft, absent_policy: p })}
                className={clsx('flex-1 py-2 rounded-xl text-[12px] font-bold border capitalize transition-colors',
                  draft.absent_policy === p ? 'bg-[#111] dark:bg-white text-white dark:text-[#111] border-[#111] dark:border-white' : 'border-[#e0e0e0] dark:border-[#333] text-[#888]')}>
                {p} holiday
              </button>
            ))}
          </div>
          {draft.absent_policy === 'partial' && (
            <div>
              <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">Partial Pay %</label>
              <input type="number" min="0" max="100" value={draft.absent_partial_pct}
                onChange={(e) => setDraft({ ...draft, absent_partial_pct: parseFloat(e.target.value) || 0 })}
                className="w-32 px-3 py-2 text-[13px] bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none" />
            </div>
          )}
        </div>

        {/* Night window */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#f0f0f0] dark:border-[#222]">
          <div>
            <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">Night premium starts (hr)</label>
            <input type="number" min="0" max="23" value={draft.night_shift_start}
              onChange={(e) => setDraft({ ...draft, night_shift_start: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 text-[13px] bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">Night premium ends (hr)</label>
            <input type="number" min="0" max="23" value={draft.night_shift_end}
              onChange={(e) => setDraft({ ...draft, night_shift_end: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 text-[13px] bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none" />
          </div>
        </div>

        <button onClick={() => mut.mutate()} disabled={mut.isPending}
          className={clsx('w-full py-2.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all',
            saved ? 'bg-emerald-600 text-white' : 'bg-[#111] dark:bg-white text-white dark:text-[#111] hover:opacity-90')}>
          {mut.isPending ? <Loader2 size={13} className="animate-spin" /> : saved ? <><Check size={13} /> Saved!</> : 'Save Pay Rules'}
        </button>
      </Card>

      <PayPreviewCard rules={draft} />
    </div>
  )
}

function PayPreviewCard({ rules }: { rules: HolidayPayRules }) {
  const [hourly, setHourly] = useState('500')
  const [hours, setHours] = useState('8')
  const [ot, setOt] = useState('0')
  const [night, setNight] = useState('0')
  const [restDay, setRestDay] = useState(false)
  const [result, setResult] = useState<HolidayPayResult | null>(null)

  const mut = useMutation({
    mutationFn: () => previewHolidayPay({
      base_hourly: parseFloat(hourly) || 0,
      regular_hours: parseFloat(hours) || 0,
      overtime_hours: parseFloat(ot) || 0,
      night_hours: parseFloat(night) || 0,
      is_rest_day: restDay,
    }),
    onSuccess: setResult,
  })

  return (
    <Card className="p-6 space-y-4">
      <p className="text-[13px] font-bold text-[#111] dark:text-white">Premium Pay Calculator</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Hourly Rate', val: hourly, set: setHourly },
          { label: 'Reg Hours', val: hours, set: setHours },
          { label: 'OT Hours', val: ot, set: setOt },
          { label: 'Night Hours', val: night, set: setNight },
        ].map(({ label, val, set }) => (
          <div key={label}>
            <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1">{label}</label>
            <input type="number" min="0" value={val} onChange={(e) => set(e.target.value)}
              className="w-full px-2.5 py-1.5 text-[13px] bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-lg text-[#111] dark:text-white focus:outline-none" />
          </div>
        ))}
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={restDay} onChange={(e) => setRestDay(e.target.checked)} className="accent-[#111] dark:accent-white" />
        <span className="text-[12px] font-semibold text-[#555] dark:text-[#aaa]">Falls on contractual rest day ({rules.rest_day_multiplier}×)</span>
      </label>
      <button onClick={() => mut.mutate()} disabled={mut.isPending}
        className="px-4 py-2 bg-[#111] dark:bg-white text-white dark:text-[#111] rounded-xl text-[12px] font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-2 transition-opacity">
        {mut.isPending ? <Loader2 size={12} className="animate-spin" /> : <DollarSign size={12} />} Calculate
      </button>

      {result && (
        <div className="rounded-xl border border-[#f0f0f0] dark:border-[#222] overflow-hidden">
          <div className="divide-y divide-[#f0f0f0] dark:divide-[#222]">
            {[
              ['Regular Pay (base)', result.regular_pay],
              [`Holiday Premium (${result.multiplier_used}×)`, result.holiday_premium],
              ['Holiday Overtime', result.holiday_overtime],
              ['Night Premium', result.night_premium],
            ].map(([label, val]) => (
              <div key={label as string} className="flex justify-between px-4 py-2 text-[12px]">
                <span className="text-[#555] dark:text-[#aaa]">{label}</span>
                <span className="font-bold tabular-nums text-[#111] dark:text-white">${fmt(val as number, 2)}</span>
              </div>
            ))}
            <div className="flex justify-between px-4 py-3 bg-emerald-50 dark:bg-emerald-950/30">
              <span className="text-[13px] font-black text-[#111] dark:text-white">Holiday Total</span>
              <span className="text-[15px] font-black text-emerald-600 dark:text-emerald-400 tabular-nums">${fmt(result.holiday_total, 2)}</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Forecast
// ═══════════════════════════════════════════════════════════════════════════════

function ForecastTab({ upcoming }: { upcoming: ResolvedHoliday[] }) {
  const [date, setDate] = useState(upcoming[0]?.observed_date ?? upcoming[0]?.date ?? '')
  const { data, isLoading } = useQuery({
    queryKey: ['holiday-forecast', date],
    queryFn: () => getHolidayForecast(date),
    enabled: !!date,
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-[12px] font-bold text-[#555] dark:text-[#aaa]">Holiday:</label>
        <select value={date} onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 text-[13px] font-semibold bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none">
          {upcoming.map((h) => {
            const d = h.observed_date ?? h.date
            return <option key={d} value={d}>{h.name} — {fmtDate(d)}</option>
          })}
        </select>
      </div>

      {isLoading ? <Loading /> : !data ? <Empty msg="Select a holiday to forecast." /> : (
        <>
          {/* Company totals */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(() => {
              const totals = (data.forecasts ?? []).reduce((acc, f) => ({
                regular: acc.regular + f.est_regular_cost,
                premium: acc.premium + f.est_premium_cost,
                ot: acc.ot + f.est_overtime_cost,
                total: acc.total + f.est_total_labor_cost,
              }), { regular: 0, premium: 0, ot: 0, total: 0 })
              return [
                { label: 'Regular Cost', v: totals.regular },
                { label: 'Premium Cost', v: totals.premium },
                { label: 'Overtime Cost', v: totals.ot },
                { label: 'Total Labour', v: totals.total },
              ].map(({ label, v }) => (
                <Card key={label} className="p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#aaa]">{label}</p>
                  <p className="text-[16px] font-black text-[#111] dark:text-white tabular-nums mt-0.5">${fmt(v)}</p>
                </Card>
              ))
            })()}
          </div>

          {/* Per-branch */}
          <Card className="overflow-hidden">
            <table className="w-full text-[12px]">
              <thead><tr className="border-b border-[#f0f0f0] dark:border-[#222]">
                {['Branch', 'Scheduled', 'Demand', 'Gap', 'Premium Cost', 'Total Cost'].map((th) => (
                  <th key={th} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#aaa]">{th}</th>
                ))}
              </tr></thead>
              <tbody>
                {(data.forecasts ?? []).map((f) => (
                  <tr key={f.branch_id ?? f.branch_name} className="border-b border-[#f8f8f8] dark:border-[#1a1a1a]">
                    <td className="px-4 py-3 font-semibold text-[#111] dark:text-white">{f.branch_name}</td>
                    <td className="px-4 py-3 tabular-nums">{f.scheduled_staff}</td>
                    <td className="px-4 py-3 tabular-nums">{f.forecast_demand}</td>
                    <td className="px-4 py-3">
                      {f.is_understaffed
                        ? <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400"><AlertTriangle size={11} />−{f.staffing_gap}</span>
                        : <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">OK</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[#555] dark:text-[#aaa]">${fmt(f.est_premium_cost)}</td>
                    <td className="px-4 py-3 tabular-nums font-bold text-[#111] dark:text-white">${fmt(f.est_total_labor_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(data.forecasts ?? []).length === 0 && <Empty msg="No branches to forecast." />}
          </Card>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Analytics
// ═══════════════════════════════════════════════════════════════════════════════

function AnalyticsTab() {
  const [year] = useState(new Date().getFullYear())
  const { data, isLoading } = useQuery({ queryKey: ['holiday-analytics', year], queryFn: () => getHolidayAnalytics(year) })

  if (isLoading) return <Loading />
  if (!data || data.length === 0) return <Empty msg="No past-holiday data yet for this year." />

  return (
    <Card className="overflow-hidden">
      <table className="w-full text-[12px]">
        <thead><tr className="border-b border-[#f0f0f0] dark:border-[#222]">
          {['Holiday', 'Labour Cost', 'Premium', 'Worked/Scheduled', 'Attendance', 'Revenue', 'vs Normal Day'].map((th) => (
            <th key={th} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#aaa]">{th}</th>
          ))}
        </tr></thead>
        <tbody>
          {data.map((a) => (
            <tr key={a.holiday_date} className="border-b border-[#f8f8f8] dark:border-[#1a1a1a]">
              <td className="px-4 py-3">
                <p className="font-semibold text-[#111] dark:text-white">{a.holiday_name}</p>
                <p className="text-[10px] text-[#aaa]">{fmtDate(a.holiday_date)}</p>
              </td>
              <td className="px-4 py-3 tabular-nums font-bold">${fmt(a.total_labor_cost)}</td>
              <td className="px-4 py-3 tabular-nums text-[#555] dark:text-[#aaa]">${fmt(a.premium_cost)}</td>
              <td className="px-4 py-3 tabular-nums">{a.staff_worked}/{a.staff_scheduled}</td>
              <td className="px-4 py-3 tabular-nums">{a.attendance_rate.toFixed(0)}%</td>
              <td className="px-4 py-3 tabular-nums">${fmt(a.total_revenue)}</td>
              <td className="px-4 py-3">
                {a.vs_normal_day_pct !== 0 && (
                  <span className={clsx('flex items-center gap-1 text-[11px] font-bold',
                    a.vs_normal_day_pct > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                    <TrendingUp size={11} />{a.vs_normal_day_pct > 0 ? '+' : ''}{a.vs_normal_day_pct.toFixed(0)}%
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Sign-ups
// ═══════════════════════════════════════════════════════════════════════════════

function SignupsTab({ upcoming }: { upcoming: ResolvedHoliday[] }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['holiday-signups'], queryFn: () => getHolidaySignups() })
  const [showVolunteer, setShowVolunteer] = useState(false)

  const reviewMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => reviewHolidaySignup(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holiday-signups'] }),
  })

  const STATUS_BADGE: Record<string, string> = {
    requested: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    approved:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    rejected:  'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
    cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-bold text-[#111] dark:text-white">Holiday Shift Sign-ups</p>
        <button onClick={() => setShowVolunteer(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#111] dark:bg-white text-white dark:text-[#111] rounded-xl text-[12px] font-bold hover:opacity-90 transition-opacity">
          <CalendarCheck size={13} /> Volunteer for a Holiday
        </button>
      </div>

      {isLoading ? <Loading /> : (
        <Card className="overflow-hidden">
          <table className="w-full text-[12px]">
            <thead><tr className="border-b border-[#f0f0f0] dark:border-[#222]">
              {['Employee', 'Holiday Date', 'Type', 'Status', ''].map((th) => (
                <th key={th} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#aaa]">{th}</th>
              ))}
            </tr></thead>
            <tbody>
              {(data ?? []).map((s) => (
                <tr key={s.id} className="border-b border-[#f8f8f8] dark:border-[#1a1a1a]">
                  <td className="px-4 py-3 font-semibold text-[#111] dark:text-white">{s.user_name || s.user_id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-[#555] dark:text-[#aaa]">{fmtDate(s.holiday_date)}</td>
                  <td className="px-4 py-3 capitalize text-[#888]">{s.assignment}</td>
                  <td className="px-4 py-3"><span className={clsx('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full', STATUS_BADGE[s.status])}>{s.status}</span></td>
                  <td className="px-4 py-3">
                    {s.status === 'requested' && (
                      <div className="flex gap-1">
                        <button onClick={() => reviewMut.mutate({ id: s.id, status: 'approved' })}
                          className="p-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 hover:bg-emerald-200"><Check size={12} /></button>
                        <button onClick={() => reviewMut.mutate({ id: s.id, status: 'rejected' })}
                          className="p-1 rounded-lg bg-red-100 dark:bg-red-950/40 text-red-600 hover:bg-red-200"><X size={12} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data ?? []).length === 0 && <Empty msg="No holiday sign-ups yet." />}
        </Card>
      )}

      {showVolunteer && (
        <VolunteerModal upcoming={upcoming} onClose={() => setShowVolunteer(false)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['holiday-signups'] }); setShowVolunteer(false) }} />
      )}
    </div>
  )
}

function VolunteerModal({ upcoming, onClose, onSaved }: { upcoming: ResolvedHoliday[]; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(upcoming[0]?.observed_date ?? upcoming[0]?.date ?? '')
  const mut = useMutation({
    mutationFn: () => createHolidaySignup({ holiday_date: date, assignment: 'voluntary' }),
    onSuccess: onSaved,
  })
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#111] rounded-2xl border border-[#ebebeb] dark:border-[#222] w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-[15px] font-bold text-[#111] dark:text-white">Volunteer for a Holiday Shift</p>
        <div>
          <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">Holiday</label>
          <select value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 text-[13px] font-semibold bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none">
            {upcoming.map((h) => {
              const d = h.observed_date ?? h.date
              return <option key={d} value={d}>{h.name} — {fmtDate(d)}</option>
            })}
          </select>
        </div>
        <button onClick={() => mut.mutate()} disabled={!date || mut.isPending}
          className="w-full py-2.5 bg-[#111] dark:bg-white text-white dark:text-[#111] rounded-xl text-[13px] font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity">
          {mut.isPending ? <Loader2 size={13} className="animate-spin" /> : <CalendarCheck size={13} />} Submit Request
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sidebar: AI Insights + Compliance
// ═══════════════════════════════════════════════════════════════════════════════

function InsightsPanel() {
  const { data: insights } = useQuery({ queryKey: ['holiday-insights'], queryFn: getHolidayInsights })
  const { data: compliance } = useQuery({ queryKey: ['holiday-compliance', new Date().getFullYear()], queryFn: () => getHolidayCompliance(new Date().getFullYear()) })

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Sparkles size={13} className="text-white" />
          </div>
          <p className="text-[12px] font-bold text-[#111] dark:text-white">AI Holiday Intelligence</p>
        </div>
        {!insights ? <Loading /> : (
          <div className="space-y-3 text-[11px]">
            {insights.warnings.map((w, i) => (
              <p key={`w${i}`} className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
                <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />{w}
              </p>
            ))}
            {insights.headlines.map((hl, i) => (
              <p key={`h${i}`} className="text-[#555] dark:text-[#aaa] leading-relaxed">• {hl}</p>
            ))}
            {insights.projections.map((p, i) => (
              <p key={`p${i}`} className="text-blue-600 dark:text-blue-400 leading-relaxed italic">{p}</p>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={13} className="text-[#aaa]" />
          <p className="text-[12px] font-bold text-[#111] dark:text-white">Compliance</p>
          {(compliance?.length ?? 0) > 0 && (
            <span className="ml-auto text-[10px] font-black bg-amber-500 text-white rounded-full px-1.5 py-0.5">{compliance!.length}</span>
          )}
        </div>
        {!compliance || compliance.length === 0 ? (
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><Check size={12} /> No compliance issues detected.</p>
        ) : (
          <div className="space-y-2">
            {compliance.slice(0, 8).map((a, i) => (
              <div key={i} className="text-[11px] text-[#555] dark:text-[#aaa] border-l-2 border-amber-400 pl-2">
                {a.message}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════════

type Tab = 'calendar' | 'pay-rules' | 'forecast' | 'signups' | 'analytics'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'calendar',  label: 'Calendar',   icon: CalendarDays },
  { id: 'pay-rules', label: 'Pay Rules',  icon: DollarSign },
  { id: 'forecast',  label: 'Forecast',   icon: TrendingUp },
  { id: 'signups',   label: 'Sign-ups',   icon: Users },
  { id: 'analytics', label: 'Analytics',  icon: TrendingUp },
]

export function HolidaysPage() {
  const [tab, setTab] = useState<Tab>('calendar')
  const { data: upcoming } = useQuery({ queryKey: ['holiday-upcoming'], queryFn: () => getUpcomingHolidays(120) })
  const upcomingList = upcoming ?? []

  return (
    <div className="px-5 py-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-[20px] font-black text-[#111] dark:text-white">Holidays & Premium Pay</h1>
          <p className="text-[12px] text-[#888] mt-0.5">Jamaican public holidays · configurable premium rates · forecasting · compliance</p>
        </div>
        {upcomingList[0] && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[#f4f4f4] dark:bg-[#1a1a1a] border border-[#ebebeb] dark:border-[#222] rounded-xl">
            <CalendarDays size={13} className="text-[#888]" />
            <span className="text-[12px] font-bold text-[#111] dark:text-white">
              Next: {upcomingList[0].name} in {daysUntil(upcomingList[0].observed_date ?? upcomingList[0].date)}d
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition-colors',
              tab === id ? 'bg-[#111] dark:bg-white text-white dark:text-[#111]' : 'text-[#888] hover:text-[#111] dark:hover:text-white hover:bg-[#f4f4f4] dark:hover:bg-[#1a1a1a]')}>
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
        <div>
          {tab === 'calendar'  && <CalendarTab />}
          {tab === 'pay-rules' && <PayRulesTab />}
          {tab === 'forecast'  && <ForecastTab upcoming={upcomingList} />}
          {tab === 'signups'   && <SignupsTab upcoming={upcomingList} />}
          {tab === 'analytics' && <AnalyticsTab />}
        </div>
        <InsightsPanel />
      </div>
    </div>
  )
}
