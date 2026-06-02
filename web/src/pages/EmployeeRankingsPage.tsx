import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Flame, ShoppingCart, Fuel,
  Zap, ShieldCheck, CheckCircle, Info, ChevronRight, ArrowLeft,
} from 'lucide-react'
import clsx from 'clsx'
import { LogoLoader } from '../components/StationSyncLogo'
import {
  getCPSRankings, getAPSRankings, getCashierStats, getAttendantStats,
  getCPSTierDistribution, getAPSTierDistribution,
  getRankings, getSupervisorSPS,
  type EmployeeRankingEntry, type EmployeeTier, type RankingPeriod, type RankingScope,
  type CoachingInsight, type RankingEntry,
} from '../lib/api'

// ─── Design system ────────────────────────────────────────────────────────────

/**
 * Tier system — 8 levels (Bronze → Legend)
 *
 * Tier      Score    Behaviour
 * ──────    ──────   ──────────────────────────────────────────────
 * Bronze    < 40     Developing — consistent coaching focus
 * Silver    40-54    Competent — meeting basic expectations
 * Gold      55-67    Proficient — exceeding some categories
 * Platinum  68-77    Advanced — top-half performer
 * Diamond   78-85    Expert — top-20% company
 * Elite     86-92    Top performer — mentorship opportunity
 * Master    93-96    Elite — considered for training roles
 * Legend    97-100   Exceptional — benchmark for the company
 *
 * Promotion: score must exceed tier minimum for 3 consecutive shifts
 * Demotion:  score falls below tier minimum for 5 consecutive shifts
 */

const TIER_CONFIG: Record<EmployeeTier, {
  min: number; badge: string; bar: string; bg: string; label: string
}> = {
  Bronze:   { min:  0, badge: 'bg-amber-700 text-amber-100',        bar: '#b45309', bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900',   label: 'Bronze' },
  Silver:   { min: 40, badge: 'bg-slate-400 text-white',            bar: '#94a3b8', bg: 'bg-slate-50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800',   label: 'Silver' },
  Gold:     { min: 55, badge: 'bg-yellow-500 text-white',           bar: '#eab308', bg: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900', label: 'Gold' },
  Platinum: { min: 68, badge: 'bg-cyan-600 text-white',             bar: '#0891b2', bg: 'bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-900',       label: 'Platinum' },
  Diamond:  { min: 78, badge: 'bg-blue-600 text-white',             bar: '#2563eb', bg: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900',       label: 'Diamond' },
  Elite:    { min: 86, badge: 'bg-violet-600 text-white',           bar: '#7c3aed', bg: 'bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-900', label: 'Elite' },
  Master:   { min: 93, badge: 'bg-pink-600 text-white',             bar: '#db2777', bg: 'bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-900',       label: 'Master' },
  Legend:   { min: 97, badge: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white', bar: '#f97316', bg: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900', label: 'Legend' },
}

const TIER_ORDER: EmployeeTier[] = ['Legend', 'Master', 'Elite', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze']

function TierBadge({ tier, small }: { tier: EmployeeTier; small?: boolean }) {
  const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG.Bronze
  return (
    <span className={clsx('inline-flex items-center font-bold rounded-full uppercase tracking-wide',
      small ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-2.5 py-1', cfg.badge)}>
      {cfg.label}
    </span>
  )
}

function ScoreBar({ score, tier }: { score: number; tier: EmployeeTier }) {
  const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG.Bronze
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-[#f0f0f0] dark:bg-[#222] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(score, 100)}%`, backgroundColor: cfg.bar }} />
      </div>
      <span className="text-[12px] font-black text-[#111] dark:text-white tabular-nums w-10 text-right">
        {score.toFixed(1)}
      </span>
    </div>
  )
}

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-[16px]">🥇</span>
  if (rank === 2) return <span className="text-[16px]">🥈</span>
  if (rank === 3) return <span className="text-[16px]">🥉</span>
  return <span className="text-[12px] font-black text-[#aaa] tabular-nums w-7 text-center">#{rank}</span>
}

function CWBar({ cw }: { cw: number }) {
  return (
    <div className="flex items-center gap-1.5" title={`Confidence weight: ${(cw * 100).toFixed(0)}% — needs ${Math.ceil(40 * cw / Math.max(1 - cw, 0.001) * (1 - cw))} more shifts for full weight`}>
      <div className="w-14 h-1 rounded-full bg-[#f0f0f0] dark:bg-[#222] overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(cw * 100, 100)}%` }} />
      </div>
      <span className="text-[9px] font-bold text-[#aaa]">{(cw * 100).toFixed(0)}%</span>
    </div>
  )
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

function fmt(n: number, dp = 0) {
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('bg-white dark:bg-[#111] border border-[#ebebeb] dark:border-[#222] rounded-2xl', className)}>{children}</div>
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#aaa]">{children}</th>
}
function Loading() {
  return <div className="flex items-center justify-center py-20"><LogoLoader /></div>
}

// ─── Tier Distribution Chart ──────────────────────────────────────────────────

function TierDistributionChart({ data }: { data: Record<string, number> | undefined }) {
  if (!data) return null
  const total = Object.values(data).reduce((s, n) => s + n, 0)
  if (total === 0) return null
  return (
    <div className="space-y-2">
      {TIER_ORDER.map((tier) => {
        const count = data[tier] ?? 0
        const pct = total > 0 ? count / total * 100 : 0
        const cfg = TIER_CONFIG[tier]
        return (
          <div key={tier} className="flex items-center gap-2">
            <span className="w-16 text-[11px] font-bold text-[#555] dark:text-[#aaa] text-right">{tier}</span>
            <div className="flex-1 h-2 rounded-full bg-[#f0f0f0] dark:bg-[#222] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: cfg.bar }} />
            </div>
            <span className="w-8 text-[11px] font-bold text-[#111] dark:text-white tabular-nums text-right">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── CPS Detail Panel ─────────────────────────────────────────────────────────

function CPSDetailPanel({ employeeId }: { employeeId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['cashier-stats', employeeId],
    queryFn: () => getCashierStats(employeeId),
  })

  if (isLoading) return <Loading />
  if (!data) return null

  const { stats, recent_scores, coaching } = data
  const tierCfg = TIER_CONFIG[stats.current_tier] ?? TIER_CONFIG.Bronze

  const components = [
    { label: 'Cash Accuracy',     key: 'score_cash_accuracy',       max: 25, color: '#10b981' },
    { label: 'Transaction Quality', key: 'score_transaction_quality', max: 20, color: '#3b82f6' },
    { label: 'Sales Effectiveness', key: 'score_sales_effectiveness', max: 20, color: '#8b5cf6' },
    { label: 'Attendance',          key: 'score_attendance',          max: 15, color: '#f59e0b' },
    { label: 'Customer Service',    key: 'score_customer_service',    max: 10, color: '#ec4899' },
    { label: 'Compliance',          key: 'score_compliance',          max:  5, color: '#06b6d4' },
    { label: 'Team',                key: 'score_team',                max:  5, color: '#84cc16' },
  ] as const

  const lastScore = recent_scores?.[0]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={clsx('rounded-2xl border p-5', tierCfg.bg)}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[16px] font-black text-[#111] dark:text-white">{stats.cashier_name}</p>
            <p className="text-[11px] text-[#888] mt-0.5">Cashier · {stats.total_shifts} shifts</p>
          </div>
          <TierBadge tier={stats.current_tier} />
        </div>
        <div className="flex items-end gap-3">
          <span className="text-[36px] font-black text-[#111] dark:text-white">{stats.cps_lifetime_final.toFixed(1)}</span>
          <span className="text-[13px] text-[#888] mb-1.5">/ 100</span>
        </div>
        <CWBar cw={stats.confidence_weight} />
        <p className="text-[10px] text-[#aaa] mt-1">
          Rank #{stats.company_rank} company · Peak {stats.cps_peak.toFixed(1)} · ${fmt(stats.total_revenue_processed)} processed
        </p>
      </div>

      {/* Component breakdown from last shift */}
      {lastScore && (
        <Card className="p-4">
          <p className="text-[11px] font-bold text-[#aaa] uppercase tracking-widest mb-3">Last Shift Breakdown</p>
          <div className="space-y-2.5">
            {components.map(({ label, key, max, color }) => {
              const score = (lastScore as any)[key] as number ?? 0
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-28 text-[11px] text-[#555] dark:text-[#aaa] text-right">{label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-[#f0f0f0] dark:bg-[#222] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${score / max * 100}%`, backgroundColor: color }} />
                  </div>
                  <span className="text-[11px] font-bold tabular-nums w-12 text-right text-[#111] dark:text-white">{score.toFixed(1)}/{max}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Recent sparkline */}
      {(recent_scores ?? []).length > 1 && (
        <Card className="p-4">
          <p className="text-[11px] font-bold text-[#aaa] uppercase tracking-widest mb-3">Recent Shifts</p>
          <div className="flex items-end gap-1.5 h-12">
            {[...(recent_scores ?? [])].reverse().map((s, i) => (
              <div key={s.shift_id ?? i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                <div className="hidden group-hover:block absolute -top-7 bg-[#111] dark:bg-white text-white dark:text-[#111] text-[9px] font-bold px-1.5 py-0.5 rounded z-10 whitespace-nowrap">
                  {s.cps_shift_final?.toFixed(1)}
                </div>
                <div className="w-full rounded-sm"
                  style={{
                    height: `${Math.max(4, ((s.cps_shift_final ?? 0) / 100) * 48)}px`,
                    backgroundColor: (s.cps_shift_final ?? 0) >= 90 ? '#10b981' : (s.cps_shift_final ?? 0) >= 70 ? '#3b82f6' : '#f59e0b',
                  }} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* AI Coaching */}
      {coaching && (
        <CoachingCard coaching={coaching} />
      )}
    </div>
  )
}

// ─── APS Detail Panel ─────────────────────────────────────────────────────────

function APSDetailPanel({ employeeId }: { employeeId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['attendant-stats', employeeId],
    queryFn: () => getAttendantStats(employeeId),
  })

  if (isLoading) return <Loading />
  if (!data) return null

  const { stats } = data
  const tierCfg = TIER_CONFIG[stats.current_tier] ?? TIER_CONFIG.Bronze

  return (
    <div className="space-y-4">
      <div className={clsx('rounded-2xl border p-5', tierCfg.bg)}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[16px] font-black text-[#111] dark:text-white">{stats.attendant_name}</p>
            <p className="text-[11px] text-[#888] mt-0.5">Attendant · {stats.total_shifts} shifts</p>
          </div>
          <TierBadge tier={stats.current_tier} />
        </div>
        <div className="flex items-end gap-3">
          <span className="text-[36px] font-black text-[#111] dark:text-white">{stats.aps_lifetime_final.toFixed(1)}</span>
          <span className="text-[13px] text-[#888] mb-1.5">/ 100</span>
        </div>
        <CWBar cw={stats.confidence_weight} />
        <div className="grid grid-cols-2 gap-3 mt-3 text-center">
          <div>
            <p className="text-[10px] text-[#aaa] uppercase tracking-wider">Fuel Dispensed</p>
            <p className="text-[13px] font-black text-[#111] dark:text-white">{fmt(stats.total_fuel_dispensed_litres)} L</p>
          </div>
          <div>
            <p className="text-[10px] text-[#aaa] uppercase tracking-wider">Vehicles Served</p>
            <p className="text-[13px] font-black text-[#111] dark:text-white">{fmt(stats.total_vehicles_served)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Supervisor (SPS) ─────────────────────────────────────────────────────────

/** Map an SPS RankingEntry onto the shared EmployeeRankingEntry shape so the
 *  same leaderboard table renders supervisors, cashiers, and attendants. */
function mapSPSEntry(e: RankingEntry): EmployeeRankingEntry {
  return {
    rank: e.rank,
    employee_id: e.supervisor_id,
    employee_name: e.supervisor_name,
    role: 'Supervisor',
    current_tier: e.current_tier,
    lifetime_final: e.sps_lifetime_final,
    raw_ewma: e.sps_raw_ewma,
    peak: e.sps_peak,
    total_shifts: e.total_shifts,
    confidence_weight: e.confidence_weight,
    current_perfect_streak: e.current_perfect_streak,
    best_perfect_streak: e.best_perfect_streak,
  }
}

function SupervisorDetailPanel({ employeeId }: { employeeId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['supervisor-sps', employeeId],
    queryFn: () => getSupervisorSPS(employeeId),
  })

  if (isLoading) return <Loading />
  if (!data) return null

  const { stats, recent_scores } = data
  const tierCfg = TIER_CONFIG[stats.current_tier] ?? TIER_CONFIG.Bronze

  return (
    <div className="space-y-4">
      <div className={clsx('rounded-2xl border p-5', tierCfg.bg)}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[16px] font-black text-[#111] dark:text-white">{stats.supervisor_name}</p>
            <p className="text-[11px] text-[#888] mt-0.5">Supervisor · {stats.total_shifts} shifts</p>
          </div>
          <TierBadge tier={stats.current_tier} />
        </div>
        <div className="flex items-end gap-3">
          <span className="text-[36px] font-black text-[#111] dark:text-white">{stats.sps_lifetime_final.toFixed(1)}</span>
          <span className="text-[13px] text-[#888] mb-1.5">/ 100</span>
        </div>
        <CWBar cw={stats.confidence_weight} />
        <p className="text-[10px] text-[#aaa] mt-1">
          Rank #{stats.company_rank} company · Peak {stats.sps_peak.toFixed(1)} · ${fmt(stats.total_revenue_managed)} managed
        </p>
      </div>

      {(recent_scores ?? []).length > 1 && (
        <Card className="p-4">
          <p className="text-[11px] font-bold text-[#aaa] uppercase tracking-widest mb-3">Recent Shifts</p>
          <div className="flex items-end gap-1.5 h-12">
            {[...(recent_scores ?? [])].reverse().map((s, i) => (
              <div key={s.shift_id ?? i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                <div className="hidden group-hover:block absolute -top-7 bg-[#111] dark:bg-white text-white dark:text-[#111] text-[9px] font-bold px-1.5 py-0.5 rounded z-10 whitespace-nowrap">
                  {s.sps_final?.toFixed(1)}
                </div>
                <div className="w-full rounded-sm"
                  style={{
                    height: `${Math.max(4, ((s.sps_final ?? 0) / 100) * 48)}px`,
                    backgroundColor: (s.sps_final ?? 0) >= 90 ? '#10b981' : (s.sps_final ?? 0) >= 70 ? '#3b82f6' : '#f59e0b',
                  }} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── AI Coaching Card ─────────────────────────────────────────────────────────

function CoachingCard({ coaching }: { coaching: CoachingInsight }) {
  const [open, setOpen] = useState(false)
  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#fafafa] dark:hover:bg-[#161616] transition-colors text-left">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
          <Zap size={13} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-[#111] dark:text-white">AI Coaching Insight</p>
          <p className="text-[11px] text-[#888] truncate">{coaching.summary}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {coaching.score_delta !== 0 && (
            <span className={clsx('text-[11px] font-black', coaching.score_delta > 0 ? 'text-emerald-600' : 'text-red-500')}>
              {coaching.score_delta > 0 ? '+' : ''}{coaching.score_delta.toFixed(1)}
            </span>
          )}
          <ChevronRight size={13} className={clsx('text-[#aaa] transition-transform', open && 'rotate-90')} />
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-[#f0f0f0] dark:border-[#222] pt-3">
          {coaching.strengths.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Strengths</p>
              {coaching.strengths.map((s, i) => (
                <p key={i} className="text-[11px] text-[#555] dark:text-[#aaa] flex items-start gap-1.5">
                  <CheckCircle size={10} className="text-emerald-500 flex-shrink-0 mt-0.5" />{s}
                </p>
              ))}
            </div>
          )}
          {coaching.improvements.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Focus Areas</p>
              {coaching.improvements.map((s, i) => (
                <p key={i} className="text-[11px] text-[#555] dark:text-[#aaa]">• {s}</p>
              ))}
            </div>
          )}
          {coaching.actions.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Action Steps</p>
              {coaching.actions.map((a, i) => (
                <p key={i} className="text-[11px] text-[#555] dark:text-[#aaa] flex items-start gap-1.5">
                  <span className="font-black text-blue-500">{i + 1}.</span>{a}
                </p>
              ))}
            </div>
          )}
          {coaching.comparisons.length > 0 && (
            <div>
              {coaching.comparisons.map((c, i) => (
                <p key={i} className="text-[11px] text-[#aaa] italic">{c}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ─── Leaderboard Table ────────────────────────────────────────────────────────

function LeaderboardTable({
  entries, loading, onSelect, selectedId, type,
}: {
  entries: EmployeeRankingEntry[] | undefined
  loading: boolean
  onSelect: (e: EmployeeRankingEntry) => void
  selectedId: string | null
  type: 'sps' | 'cps' | 'aps'
}) {
  if (loading) return <Loading />
  const label = type.toUpperCase()

  return (
    <Card className="overflow-hidden">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-[#f0f0f0] dark:border-[#222]">
            <Th>#</Th>
            <Th>Employee</Th>
            <Th>Tier</Th>
            <Th>{label} Score</Th>
            <Th>Confidence</Th>
            <Th>Shifts</Th>
            <Th>Streak</Th>
          </tr>
        </thead>
        <tbody>
          {(entries ?? []).map((e) => (
            <tr key={e.employee_id}
              onClick={() => onSelect(e)}
              className={clsx('border-b border-[#f8f8f8] dark:border-[#1a1a1a] cursor-pointer transition-colors',
                selectedId === e.employee_id ? 'bg-[#f4f4f4] dark:bg-[#1a1a1a]' : 'hover:bg-[#fafafa] dark:hover:bg-[#161616]')}>
              <td className="px-4 py-3"><RankMedal rank={e.rank} /></td>
              <td className="px-4 py-3">
                <p className="font-semibold text-[#111] dark:text-white">{e.employee_name}</p>
                <p className="text-[10px] text-[#aaa]">{e.role}</p>
              </td>
              <td className="px-4 py-3"><TierBadge tier={e.current_tier} small /></td>
              <td className="px-4 py-3 w-40">
                <ScoreBar score={e.lifetime_final} tier={e.current_tier} />
              </td>
              <td className="px-4 py-3"><CWBar cw={e.confidence_weight} /></td>
              <td className="px-4 py-3 tabular-nums text-[#888]">{e.total_shifts}</td>
              <td className="px-4 py-3">
                {e.current_perfect_streak > 0 && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    <Flame size={11} />{e.current_perfect_streak}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(entries ?? []).length === 0 && (
        <div className="py-14 text-center text-[13px] font-semibold text-[#bbb]">No data yet for this period.</div>
      )}
    </Card>
  )
}

// ─── Info Panel ───────────────────────────────────────────────────────────────

function CPSInfoPanel() {
  return (
    <Card className="p-5 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Info size={13} className="text-[#aaa]" />
        <p className="text-[12px] font-bold text-[#555] dark:text-[#888]">CPS Scoring System</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
        {[
          ['Cash Accuracy', '25 pts', 'Drawer variance. 0 pts at ≥1% variance. Zero-variance bonus +1.'],
          ['Transaction Quality', '20 pts', 'Unsupervised voids/refunds rate. 0 pts at ≥2% suspicious rate.'],
          ['Sales Effectiveness', '20 pts', 'Normalised by station average — SER = employee SPT / station avg SPT.'],
          ['Attendance', '15 pts', 'Punctuality −0.5/late minute. No-show −3. Early departure −2.'],
          ['Customer Service', '10 pts', 'Feedback ratio, complaint rate, resolution rate.'],
          ['Compliance', '5 pts', 'Checklist completion × 5 − violations.'],
          ['Team', '5 pts', '40% peer + 60% supervisor rating, each normalised 0–5.'],
        ].map(([cat, pts, desc]) => (
          <div key={cat}>
            <p className="font-bold text-[#333] dark:text-[#ccc]">{cat} <span className="font-normal text-[#aaa]">({pts})</span></p>
            <p className="mt-0.5 text-[#888] leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-[#bbb] mt-3">
        Lifetime: EWMA(α=0.06) · CW(n) = n/(n+40) · Score = CW×EWMA + (1−CW)×LeagueAvg
      </p>
    </Card>
  )
}

function APSInfoPanel() {
  return (
    <Card className="p-5 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Info size={13} className="text-[#aaa]" />
        <p className="text-[12px] font-bold text-[#555] dark:text-[#888]">APS Scoring System</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
        {[
          ['Fuel Accountability', '25 pts', 'Meter vs tank variance. 0 pts at ≥1% variance. Zero-variance bonus +1.'],
          ['Forecourt Ops', '20 pts', 'Inspections (8pts) + cleanliness rating/5 × 6 + task completion × 6.'],
          ['Productivity', '20 pts', 'Normalised: score = min(20, 10 × VPH_emp / VPH_station_avg). Removes size bias.'],
          ['Attendance', '15 pts', 'Same formula as CPS.'],
          ['Customer Service', '10 pts', 'Same formula as CPS.'],
          ['Safety', '7 pts', 'Checklist 5pts + PPE 2pts + hazard report bonus − incident penalty ×3.'],
          ['Team', '3 pts', 'Same ratio as CPS team formula, scaled to 3 max.'],
        ].map(([cat, pts, desc]) => (
          <div key={cat}>
            <p className="font-bold text-[#333] dark:text-[#ccc]">{cat} <span className="font-normal text-[#aaa]">({pts})</span></p>
            <p className="mt-0.5 text-[#888] leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-[#bbb] mt-3">
        Productivity normalisation ensures attendants at quiet stations are never disadvantaged vs busy stations.
      </p>
    </Card>
  )
}

function SPSInfoPanel() {
  return (
    <Card className="p-5 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Info size={13} className="text-[#aaa]" />
        <p className="text-[12px] font-bold text-[#555] dark:text-[#888]">SPS Scoring System</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
        {[
          ['Sales', '20 pts', 'Normalised vs supervisor 10-shift rolling avg (SER). Removes station-size bias.'],
          ['Cash Variance', 'incl.', 'Drawer accuracy across the shift.'],
          ['Fuel Variance', '15 pts', 'Tank logs vs nozzle dispensed reconciliation.'],
          ['Attendance', '12 pts', 'Shift closed correctly & on time.'],
          ['Team & Tasks', 'incl.', 'Attendant count, task completion, handover quality.'],
          ['Incidents / Safety', 'penalty', 'Deductions for unresolved issues during the shift window.'],
        ].map(([cat, pts, desc]) => (
          <div key={cat}>
            <p className="font-bold text-[#333] dark:text-[#ccc]">{cat} <span className="font-normal text-[#aaa]">({pts})</span></p>
            <p className="mt-0.5 text-[#888] leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-[#bbb] mt-3">
        Lifetime: EWMA(α=0.06) · CW(n) = n/(n+40) · Score = CW×EWMA + (1−CW)×LeagueAvg
      </p>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type RoleTab = 'supervisor' | 'cashier' | 'attendant'

export function EmployeeRankingsPage({ onBack }: { onBack?: () => void } = {}) {
  const [roleTab, setRoleTab]       = useState<RoleTab>('supervisor')
  const [scope, setScope]           = useState<RankingScope>('company')
  const [period, setPeriod]         = useState<RankingPeriod>('alltime')
  const [selected, setSelected]     = useState<EmployeeRankingEntry | null>(null)
  const [showInfo, setShowInfo]     = useState(false)

  const { data: spsRaw, isLoading: spsLoad } = useQuery({
    queryKey: ['sps-rankings', scope],
    queryFn: () => getRankings(scope),
    enabled: roleTab === 'supervisor',
  })
  const { data: cpsEntries, isLoading: cpsLoad } = useQuery({
    queryKey: ['cps-rankings', scope, period],
    queryFn: () => getCPSRankings(scope, period),
    enabled: roleTab === 'cashier',
  })
  const { data: apsEntries, isLoading: apsLoad } = useQuery({
    queryKey: ['aps-rankings', scope, period],
    queryFn: () => getAPSRankings(scope, period),
    enabled: roleTab === 'attendant',
  })
  const { data: cpsTiers } = useQuery({
    queryKey: ['cps-tiers'],
    queryFn: getCPSTierDistribution,
    enabled: roleTab === 'cashier',
  })
  const { data: apsTiers } = useQuery({
    queryKey: ['aps-tiers'],
    queryFn: getAPSTierDistribution,
    enabled: roleTab === 'attendant',
  })

  // Supervisor entries come from the SPS endpoint, mapped to the shared shape.
  const spsEntries = spsRaw?.map(mapSPSEntry)
  // SPS has no tier-distribution endpoint — derive it from the entries.
  const spsTiers = spsEntries?.reduce<Record<string, number>>((acc, e) => {
    acc[e.current_tier] = (acc[e.current_tier] ?? 0) + 1
    return acc
  }, {})

  const entries  = roleTab === 'supervisor' ? spsEntries : roleTab === 'cashier' ? cpsEntries : apsEntries
  const loading  = roleTab === 'supervisor' ? spsLoad    : roleTab === 'cashier' ? cpsLoad    : apsLoad
  const tiers    = roleTab === 'supervisor' ? spsTiers   : roleTab === 'cashier' ? cpsTiers   : apsTiers
  const totalEmp = entries?.length ?? 0

  return (
    <div className="px-5 py-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 mb-2 text-[12px] font-bold text-[#888] hover:text-[#111] dark:hover:text-white transition-colors"
            >
              <ArrowLeft size={14} /> Go back
            </button>
          )}
          <h1 className="text-[20px] font-black text-[#111] dark:text-white">Rankings</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowInfo((s) => !s)}
            className={clsx('px-3 py-1.5 rounded-xl text-[12px] font-bold border transition-colors',
              showInfo ? 'bg-[#111] dark:bg-white text-white dark:text-[#111] border-[#111] dark:border-white' : 'border-[#e0e0e0] dark:border-[#333] text-[#888] hover:text-[#111] dark:hover:text-white')}>
            <Info size={12} className="inline mr-1" />How scoring works
          </button>
        </div>
      </div>

      {/* Role tabs */}
      <div className="flex items-center gap-2 mb-5">
        {[
          { id: 'supervisor' as const, label: 'Supervisors (SPS)', icon: ShieldCheck },
          { id: 'cashier' as const, label: 'Cashiers (CPS)', icon: ShoppingCart },
          { id: 'attendant' as const, label: 'Attendants (APS)', icon: Fuel },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setRoleTab(id); setSelected(null) }}
            className={clsx('flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-colors',
              roleTab === id ? 'bg-[#111] dark:bg-white text-white dark:text-[#111]' : 'text-[#888] hover:text-[#111] dark:hover:text-white hover:bg-[#f4f4f4] dark:hover:bg-[#1a1a1a]')}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {/* Scope */}
        <div className="flex items-center gap-1 bg-[#f4f4f4] dark:bg-[#1a1a1a] rounded-xl p-1">
          {(['company', 'branch'] as RankingScope[]).map((s) => (
            <button key={s} onClick={() => setScope(s)}
              className={clsx('px-3 py-1.5 rounded-lg text-[12px] font-bold capitalize transition-colors',
                scope === s ? 'bg-white dark:bg-[#111] text-[#111] dark:text-white shadow-sm' : 'text-[#888]')}>
              {s}
            </button>
          ))}
        </div>
        {/* Period — SPS is all-time only, so hide it for supervisors */}
        {roleTab !== 'supervisor' && (
          <div className="flex items-center gap-1 bg-[#f4f4f4] dark:bg-[#1a1a1a] rounded-xl p-1">
            {(['alltime', 'monthly', 'quarterly', 'annual'] as RankingPeriod[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={clsx('px-3 py-1.5 rounded-lg text-[12px] font-bold capitalize transition-colors',
                  period === p ? 'bg-white dark:bg-[#111] text-[#111] dark:text-white shadow-sm' : 'text-[#888]')}>
                {p === 'alltime' ? 'All-time' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        )}
        <p className="text-[12px] text-[#aaa]">{totalEmp} ranked</p>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5">
        {/* Leaderboard */}
        <div className="space-y-4">
          <LeaderboardTable
            entries={entries} loading={loading}
            onSelect={setSelected} selectedId={selected?.employee_id ?? null}
            type={roleTab === 'supervisor' ? 'sps' : roleTab === 'cashier' ? 'cps' : 'aps'}
          />
          {showInfo && (roleTab === 'supervisor' ? <SPSInfoPanel /> : roleTab === 'cashier' ? <CPSInfoPanel /> : <APSInfoPanel />)}
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Tier distribution */}
          <Card className="p-5">
            <p className="text-[12px] font-bold text-[#111] dark:text-white mb-4">
              Tier Distribution
            </p>
            <TierDistributionChart data={tiers} />
            <div className="mt-4 pt-3 border-t border-[#f0f0f0] dark:border-[#222] space-y-1">
              {TIER_ORDER.map((t) => {
                const cfg = TIER_CONFIG[t]
                return (
                  <div key={t} className="flex items-center justify-between text-[10px]">
                    <TierBadge tier={t} small />
                    <span className="text-[#aaa]">{t === 'Legend' ? '97–100' : `${cfg.min}–${TIER_CONFIG[TIER_ORDER[TIER_ORDER.indexOf(t) - 1] as EmployeeTier]?.min ?? 100}`}</span>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Selected employee detail */}
          {selected && (
            <div>
              <p className="text-[11px] font-bold text-[#aaa] uppercase tracking-widest mb-3">Employee Detail</p>
              {roleTab === 'supervisor'
                ? <SupervisorDetailPanel employeeId={selected.employee_id} />
                : roleTab === 'cashier'
                ? <CPSDetailPanel employeeId={selected.employee_id} />
                : <APSDetailPanel employeeId={selected.employee_id} />}
            </div>
          )}

          {!selected && (
            <div className="py-8 text-center text-[13px] font-semibold text-[#ccc] dark:text-[#444]">
              Select an employee to view their breakdown and coaching insights
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
