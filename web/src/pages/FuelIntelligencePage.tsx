import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Droplets, TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  Truck, RotateCcw, ChevronRight, Flame, Gauge, Package, ShoppingBag,
  Info, Bell, BellOff, AlertCircle, Loader2, ArrowLeft,
} from 'lucide-react'
import clsx from 'clsx'
import {
  getFuelFPS, getFuelTanksSummary, getFuelGradeAnalytics,
  getFuelDeliverySummary, getFuelReorderStatus, getFuelAlerts,
  resolveFuelAlert, checkFuelAlerts,
  type FPSResult, type TankSummary, type GradeAnalytics,
  type DeliverySummary, type ReorderStatus, type FuelAlert,
} from '../lib/api'

// ─── Tab config ───────────────────────────────────────────────────────────────

type Tab = 'overview' | 'tanks' | 'grades' | 'deliveries' | 'reorder' | 'alerts'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview',   label: 'Overview',   icon: Gauge },
  { id: 'tanks',      label: 'Tanks',      icon: Droplets },
  { id: 'grades',     label: 'Grades',     icon: ShoppingBag },
  { id: 'deliveries', label: 'Deliveries', icon: Truck },
  { id: 'reorder',    label: 'Reorder',    icon: RotateCcw },
  { id: 'alerts',     label: 'Alerts',     icon: Bell },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, dp = 0) {
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`
}

function gradeColor(grade: string) {
  switch (grade) {
    case 'A+': return 'text-emerald-600 dark:text-emerald-400'
    case 'A':  return 'text-green-600 dark:text-green-400'
    case 'B':  return 'text-blue-600 dark:text-blue-400'
    case 'C':  return 'text-yellow-600 dark:text-yellow-400'
    case 'D':  return 'text-orange-600 dark:text-orange-400'
    default:   return 'text-red-600 dark:text-red-400'
  }
}

function gradeBg(grade: string) {
  switch (grade) {
    case 'A+': return 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
    case 'A':  return 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
    case 'B':  return 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
    case 'C':  return 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800'
    case 'D':  return 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800'
    default:   return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
  }
}

function inventoryStatusColor(s: string) {
  switch (s) {
    case 'critical': return 'text-red-600 dark:text-red-400'
    case 'low':      return 'text-orange-600 dark:text-orange-400'
    case 'high':     return 'text-blue-600 dark:text-blue-400'
    default:         return 'text-emerald-600 dark:text-emerald-400'
  }
}

function varianceClassColor(v: string) {
  switch (v) {
    case 'critical': return 'text-red-600 dark:text-red-400'
    case 'warning':  return 'text-yellow-600 dark:text-yellow-400'
    default:         return 'text-emerald-600 dark:text-emerald-400'
  }
}

function urgencyConfig(u: string) {
  switch (u) {
    case 'critical': return { label: 'Critical', cls: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' }
    case 'urgent':   return { label: 'Urgent',   cls: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' }
    case 'soon':     return { label: 'Soon',     cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400' }
    default:         return { label: 'Normal',   cls: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' }
  }
}

function severityConfig(s: string) {
  switch (s) {
    case 'critical': return { icon: AlertCircle, cls: 'text-red-500',    dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' }
    case 'warning':  return { icon: AlertTriangle, cls: 'text-yellow-500', dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400' }
    default:         return { icon: Info, cls: 'text-blue-500',  dot: 'bg-blue-500',  badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' }
  }
}

// ─── FPS Gauge ────────────────────────────────────────────────────────────────

function FPSGauge({ fps, grade }: { fps: number; grade: string }) {
  const r = 80
  const circ = 2 * Math.PI * r
  const arc = circ * 0.75 // 270° arc
  const progress = arc * Math.min(fps / 100, 1)
  const offset = circ - progress

  const strokeColor =
    fps >= 90 ? '#10b981' :
    fps >= 80 ? '#22c55e' :
    fps >= 70 ? '#3b82f6' :
    fps >= 60 ? '#eab308' :
    fps >= 50 ? '#f97316' :
    '#ef4444'

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={200} height={160} viewBox="0 0 200 160" className="overflow-visible">
        {/* Track */}
        <circle
          cx={100} cy={120} r={r}
          fill="none"
          stroke="currentColor"
          className="text-[#f0f0f0] dark:text-[#222]"
          strokeWidth={14}
          strokeDasharray={`${arc} ${circ - arc}`}
          strokeDashoffset={circ * 0.125}
          strokeLinecap="round"
          transform="rotate(135 100 120)"
        />
        {/* Progress */}
        <circle
          cx={100} cy={120} r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth={14}
          strokeDasharray={`${progress} ${circ - progress}`}
          strokeDashoffset={circ * 0.125}
          strokeLinecap="round"
          transform="rotate(135 100 120)"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        {/* Score */}
        <text x={100} y={112} textAnchor="middle" className="fill-current text-[#111] dark:text-white" fontSize={36} fontWeight={700} fontFamily="Manrope">
          {fps.toFixed(1)}
        </text>
        <text x={100} y={130} textAnchor="middle" className="fill-current text-[#888]" fontSize={11} fontFamily="Manrope">
          / 100
        </text>
      </svg>
      <div className={clsx('text-4xl font-black', gradeColor(grade))}>{grade}</div>
      <p className="text-xs font-semibold text-[#888] uppercase tracking-widest">Fuel Performance Score</p>
    </div>
  )
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ label, score, max, color = '#3b82f6' }: { label: string; score: number; max: number; color?: string }) {
  const pct = max > 0 ? (score / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 text-right text-[12px] font-semibold text-[#555] dark:text-[#aaa] truncate">{label}</div>
      <div className="flex-1 h-2 rounded-full bg-[#f0f0f0] dark:bg-[#222] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="w-16 text-[12px] font-bold text-[#111] dark:text-white tabular-nums text-right">
        {score.toFixed(1)} <span className="font-normal text-[#aaa]">/ {max}</span>
      </div>
    </div>
  )
}

// ─── Level Bar ────────────────────────────────────────────────────────────────

function LevelBar({ pct, status }: { pct: number; status: string }) {
  const color =
    status === 'critical' ? '#ef4444' :
    status === 'low'      ? '#f97316' :
    status === 'high'     ? '#3b82f6' :
    '#10b981'

  return (
    <div className="w-full h-1.5 rounded-full bg-[#f0f0f0] dark:bg-[#222] overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
      />
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ fps }: { fps: FPSResult | undefined }) {
  if (!fps) return <EmptyState message="No performance data available for the last 30 days." />

  const components = [
    { label: 'Inventory Accuracy', score: fps.score_inventory_accuracy, max: 25, color: '#10b981' },
    { label: 'Fuel Loss Control',  score: fps.score_fuel_loss,          max: 25, color: '#3b82f6' },
    { label: 'Delivery Efficiency',score: fps.score_delivery_efficiency, max: 15, color: '#8b5cf6' },
    { label: 'Tank Utilization',   score: fps.score_tank_utilization,    max: 15, color: '#f59e0b' },
    { label: 'Sales Performance',  score: fps.score_sales_performance,   max: 10, color: '#ec4899' },
    { label: 'Compliance',         score: fps.score_compliance,          max: 10, color: '#06b6d4' },
  ]

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[auto_1fr] gap-6">
      {/* Left: Gauge */}
      <div className={clsx('rounded-2xl border p-8 flex flex-col items-center justify-center min-w-[280px]', gradeBg(fps.grade))}>
        <FPSGauge fps={fps.fps_total} grade={fps.grade} />
        <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-2 text-center">
          <MetricCell label="Tanks Scored" value={String(fps.total_tanks_scored)} />
          <MetricCell label="Avg Variance" value={fmtPct(fps.avg_variance_pct)} />
          <MetricCell label="Deliveries" value={String(fps.total_deliveries)} />
          <MetricCell label="Compliance Rate" value={fmtPct(fps.compliance_rate)} />
        </div>
      </div>

      {/* Right: Component scores */}
      <div className="bg-white dark:bg-[#111] border border-[#ebebeb] dark:border-[#222] rounded-2xl p-6 flex flex-col gap-4">
        <div>
          <p className="text-[13px] font-bold text-[#111] dark:text-white">Component Breakdown</p>
          <p className="text-[11px] text-[#888] mt-0.5">Last 30 days — 100 points total</p>
        </div>
        <div className="flex flex-col gap-4 mt-2">
          {components.map((c) => (
            <ScoreBar key={c.label} label={c.label} score={c.score} max={c.max} color={c.color} />
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-[#f0f0f0] dark:border-[#222] flex items-center justify-between">
          <span className="text-[13px] font-bold text-[#555] dark:text-[#aaa]">Total FPS</span>
          <span className="text-[18px] font-black text-[#111] dark:text-white tabular-nums">
            {fps.fps_total.toFixed(1)} <span className={clsx('ml-1 text-[15px]', gradeColor(fps.grade))}>{fps.grade}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#888] uppercase tracking-wider">{label}</p>
      <p className="text-[15px] font-black text-[#111] dark:text-white tabular-nums">{value}</p>
    </div>
  )
}

// ─── Tanks Tab ────────────────────────────────────────────────────────────────

function TanksTab({ tanks }: { tanks: TankSummary[] | undefined }) {
  if (!tanks?.length) return <EmptyState message="No tank data found." />

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {tanks.map((t) => (
        <TankCard key={t.tank_id} tank={t} />
      ))}
    </div>
  )
}

function TankCard({ tank: t }: { tank: TankSummary }) {
  return (
    <div className="bg-white dark:bg-[#111] border border-[#ebebeb] dark:border-[#222] rounded-2xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[14px] font-bold text-[#111] dark:text-white">{t.tank_name}</p>
          <p className="text-[12px] font-semibold text-[#888] mt-0.5">{t.fuel_name}</p>
        </div>
        <div className={clsx('text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide', {
          'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400':    t.inventory_status === 'critical',
          'bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400': t.inventory_status === 'low',
          'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400': t.inventory_status === 'high',
          'bg-green-100 text-green-600 dark:bg-green-950/40 dark:text-green-400': t.inventory_status === 'normal',
        })}>
          {t.inventory_status}
        </div>
      </div>

      {/* Level bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] font-semibold text-[#888]">
          <span>{fmt(t.current_level_litres, 0)} L</span>
          <span>{fmtPct(t.current_pct)}</span>
        </div>
        <LevelBar pct={t.current_pct} status={t.inventory_status} />
        <div className="flex justify-between text-[10px] text-[#bbb]">
          <span>0</span>
          <span>Ullage: {fmt(t.ullage_litres, 0)} L</span>
          <span>{fmt(t.capacity_litres, 0)} L</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 text-[12px]">
        <div>
          <p className="text-[10px] font-bold text-[#bbb] uppercase tracking-wider mb-0.5">Avg Variance</p>
          <p className={clsx('font-bold', varianceClassColor(t.variance_class))}>
            {fmtPct(Math.abs(t.avg_variance_pct))}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-[#bbb] uppercase tracking-wider mb-0.5">Daily Usage</p>
          <p className="font-bold text-[#111] dark:text-white">{fmt(t.avg_daily_usage_litres, 0)} L</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-[#bbb] uppercase tracking-wider mb-0.5">Days Until Empty</p>
          <p className="font-bold text-[#111] dark:text-white">{t.days_until_empty > 999 ? '—' : `${t.days_until_empty.toFixed(0)}d`}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-[#bbb] uppercase tracking-wider mb-0.5">Utilization</p>
          <p className="font-bold text-[#111] dark:text-white">{fmtPct(t.avg_utilization_pct)}</p>
        </div>
      </div>

      {/* Tank FPS */}
      <div className="flex items-center justify-between pt-3 border-t border-[#f4f4f4] dark:border-[#222]">
        <span className="text-[11px] font-semibold text-[#888]">Tank FPS</span>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 rounded-full bg-[#f0f0f0] dark:bg-[#222] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(t.tank_fps, 100)}%`, backgroundColor: t.tank_fps >= 70 ? '#10b981' : t.tank_fps >= 50 ? '#f59e0b' : '#ef4444' }}
            />
          </div>
          <span className="text-[13px] font-black text-[#111] dark:text-white">{t.tank_fps.toFixed(0)}</span>
        </div>
      </div>

      {t.reorder_suggested && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
          <RotateCcw size={12} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
            Reorder suggested — {fmt(t.reorder_point_litres, 0)} L ROP
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Grades Tab ───────────────────────────────────────────────────────────────

function GradesTab({ grades }: { grades: GradeAnalytics[] | undefined }) {
  if (!grades?.length) return <EmptyState message="No grade analytics available." />

  return (
    <div className="flex flex-col gap-4">
      {grades.map((g) => (
        <GradeCard key={g.fuel_id} grade={g} />
      ))}
    </div>
  )
}

function GradeCard({ grade: g }: { grade: GradeAnalytics }) {
  const profitPositive = g.gross_profit >= 0
  return (
    <div className="bg-white dark:bg-[#111] border border-[#ebebeb] dark:border-[#222] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[15px] font-bold text-[#111] dark:text-white">{g.fuel_name}</p>
          <p className="text-[12px] text-[#888] mt-0.5">
            Revenue share: <span className="font-bold text-[#555] dark:text-[#aaa]">{fmtPct(g.revenue_share_pct)}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold text-[#bbb] uppercase tracking-wider">Turnover</p>
          <p className="text-[16px] font-black text-[#111] dark:text-white">{g.inventory_turnover.toFixed(2)}×</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <GradeStat label="Volume Sold" value={`${fmt(g.total_litres_sold, 0)} L`} />
        <GradeStat label="Revenue" value={`$${fmt(g.total_revenue, 0)}`} />
        <GradeStat
          label="Gross Profit"
          value={`$${fmt(Math.abs(g.gross_profit), 0)}`}
          sub={fmtPct(g.margin_pct)}
          positive={profitPositive}
        />
        <GradeStat label="Shrinkage" value={fmtPct(g.shrinkage_pct)} warn={g.shrinkage_pct > 0.5} />
      </div>

      <div className="mt-4 flex items-center gap-6 text-[12px]">
        <div className="flex items-center gap-1.5">
          {g.revenue_growth_pct >= 0
            ? <TrendingUp size={13} className="text-green-500" />
            : <TrendingDown size={13} className="text-red-500" />}
          <span className={clsx('font-bold', g.revenue_growth_pct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
            {g.revenue_growth_pct >= 0 ? '+' : ''}{fmtPct(g.revenue_growth_pct)} revenue
          </span>
          <span className="text-[#bbb]">vs prior period</span>
        </div>
        <div className="flex items-center gap-1.5">
          {g.volume_growth_pct >= 0
            ? <TrendingUp size={13} className="text-green-500" />
            : <TrendingDown size={13} className="text-red-500" />}
          <span className={clsx('font-bold', g.volume_growth_pct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
            {g.volume_growth_pct >= 0 ? '+' : ''}{fmtPct(g.volume_growth_pct)} volume
          </span>
        </div>
      </div>
    </div>
  )
}

function GradeStat({ label, value, sub, positive, warn }: {
  label: string; value: string; sub?: string; positive?: boolean; warn?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] font-bold text-[#bbb] uppercase tracking-wider mb-1">{label}</p>
      <p className={clsx('text-[14px] font-black', warn ? 'text-red-600 dark:text-red-400' : positive === false ? 'text-red-600 dark:text-red-400' : 'text-[#111] dark:text-white')}>
        {value}
      </p>
      {sub && <p className="text-[11px] font-semibold text-[#888] mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Deliveries Tab ───────────────────────────────────────────────────────────

function DeliveriesTab({ summary }: { summary: DeliverySummary | undefined }) {
  if (!summary) return <EmptyState message="No delivery data available." />

  return (
    <div className="flex flex-col gap-5">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard label="Total Deliveries" value={String(summary.total_deliveries)} icon={Truck} />
        <SummaryCard label="Overall Accuracy" value={fmtPct(summary.overall_accuracy_pct)} icon={CheckCircle}
          accent={summary.overall_accuracy_pct >= 98 ? 'green' : summary.overall_accuracy_pct >= 95 ? 'yellow' : 'red'} />
        <SummaryCard label="Short Deliveries" value={String(summary.short_deliveries)} icon={AlertTriangle}
          accent={summary.short_deliveries > 0 ? 'orange' : 'green'} />
        <SummaryCard label="Total Shortfall" value={`${fmt(summary.total_shortfall_litres, 0)} L`} icon={Droplets}
          accent={summary.total_shortfall_litres > 0 ? 'red' : 'green'} />
      </div>

      {/* Records table */}
      <div className="bg-white dark:bg-[#111] border border-[#ebebeb] dark:border-[#222] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#f0f0f0] dark:border-[#222]">
          <p className="text-[13px] font-bold text-[#111] dark:text-white">Delivery Records</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#f0f0f0] dark:border-[#222]">
                {['Date', 'Tank', 'Fuel', 'Supplier', 'Invoice', 'Ordered', 'Measured', 'Accuracy', 'Cost'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#aaa]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.records.map((r) => (
                <tr key={r.id} className="border-b border-[#f8f8f8] dark:border-[#1a1a1a] hover:bg-[#fafafa] dark:hover:bg-[#161616] transition-colors">
                  <td className="px-4 py-3 text-[#555] dark:text-[#aaa]">{r.shift_date}</td>
                  <td className="px-4 py-3 font-semibold text-[#111] dark:text-white">{r.tank_name}</td>
                  <td className="px-4 py-3 text-[#555] dark:text-[#aaa]">{r.fuel_name}</td>
                  <td className="px-4 py-3 text-[#555] dark:text-[#aaa]">{r.supplier_name || '—'}</td>
                  <td className="px-4 py-3 text-[#555] dark:text-[#aaa]">{r.invoice_no || '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{fmt(r.litres_ordered, 0)} L</td>
                  <td className="px-4 py-3 tabular-nums">{fmt(r.litres_measured, 0)} L</td>
                  <td className="px-4 py-3">
                    <span className={clsx('font-bold tabular-nums', {
                      'text-green-600 dark:text-green-400':  r.accuracy_class === 'accurate',
                      'text-red-600 dark:text-red-400':      r.accuracy_class === 'short',
                      'text-blue-600 dark:text-blue-400':    r.accuracy_class === 'surplus',
                    })}>
                      {fmtPct(r.accuracy_pct)}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[#555] dark:text-[#aaa]">${fmt(r.total_cost, 0)}</td>
                </tr>
              ))}
              {summary.records.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[#bbb] text-[12px]">No delivery records found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, icon: Icon, accent = 'default' }: {
  label: string; value: string; icon: React.ElementType; accent?: 'green' | 'yellow' | 'orange' | 'red' | 'default'
}) {
  const iconCls =
    accent === 'green'  ? 'text-green-500' :
    accent === 'yellow' ? 'text-yellow-500' :
    accent === 'orange' ? 'text-orange-500' :
    accent === 'red'    ? 'text-red-500' :
    'text-[#aaa]'

  return (
    <div className="bg-white dark:bg-[#111] border border-[#ebebeb] dark:border-[#222] rounded-2xl p-4 flex items-start gap-3">
      <div className="w-8 h-8 rounded-xl bg-[#f4f4f4] dark:bg-[#1a1a1a] flex items-center justify-center flex-shrink-0">
        <Icon size={14} className={iconCls} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#aaa]">{label}</p>
        <p className="text-[16px] font-black text-[#111] dark:text-white mt-0.5 tabular-nums">{value}</p>
      </div>
    </div>
  )
}

// ─── Reorder Tab ──────────────────────────────────────────────────────────────

function ReorderTab({ statuses }: { statuses: ReorderStatus[] | undefined }) {
  if (!statuses?.length) return <EmptyState message="No reorder data available." />

  const sorted = [...statuses].sort((a, b) => {
    const order = { critical: 0, urgent: 1, soon: 2, normal: 3 }
    return (order[a.urgency as keyof typeof order] ?? 3) - (order[b.urgency as keyof typeof order] ?? 3)
  })

  return (
    <div className="flex flex-col gap-4">
      {sorted.map((s) => (
        <ReorderCard key={s.tank_id} status={s} />
      ))}
    </div>
  )
}

function ReorderCard({ status: s }: { status: ReorderStatus }) {
  const urg = urgencyConfig(s.urgency)
  const fillPct = s.capacity_litres > 0 ? (s.current_litres / s.capacity_litres) * 100 : 0
  const ropPct  = s.capacity_litres > 0 ? (s.reorder_point_litres / s.capacity_litres) * 100 : 0

  return (
    <div className="bg-white dark:bg-[#111] border border-[#ebebeb] dark:border-[#222] rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-bold text-[#111] dark:text-white">{s.tank_name}</p>
            <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide', urg.cls)}>
              {urg.label}
            </span>
          </div>
          <p className="text-[12px] text-[#888] mt-0.5">{s.fuel_name}</p>
        </div>
        {s.reorder_suggested && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
            <RotateCcw size={11} className="text-amber-600 dark:text-amber-400" />
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">Order Now</span>
          </div>
        )}
      </div>

      {/* Level bar with ROP marker */}
      <div className="mb-3 space-y-1">
        <div className="relative h-2.5 rounded-full bg-[#f0f0f0] dark:bg-[#222] overflow-visible">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(fillPct, 100)}%`,
              backgroundColor: s.urgency === 'critical' ? '#ef4444' : s.urgency === 'urgent' ? '#f97316' : '#10b981',
            }}
          />
          {/* ROP marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-amber-500 dark:bg-amber-400 rounded-full"
            style={{ left: `${Math.min(ropPct, 100)}%` }}
            title={`Reorder Point: ${fmt(s.reorder_point_litres, 0)} L`}
          />
        </div>
        <div className="flex justify-between text-[10px] text-[#bbb]">
          <span>{fmt(s.current_litres, 0)} L current</span>
          <span className="text-amber-500">↑ ROP: {fmt(s.reorder_point_litres, 0)} L</span>
          <span>{fmt(s.capacity_litres, 0)} L capacity</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
        <div>
          <p className="text-[10px] font-bold text-[#bbb] uppercase tracking-wider mb-1">Daily Usage</p>
          <p className="font-bold text-[#111] dark:text-white">{fmt(s.avg_daily_usage_litres, 0)} L</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-[#bbb] uppercase tracking-wider mb-1">Days Until Empty</p>
          <p className="font-bold text-[#111] dark:text-white">{s.days_until_empty > 999 ? '—' : `${s.days_until_empty.toFixed(0)}d`}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-[#bbb] uppercase tracking-wider mb-1">Lead Time</p>
          <p className="font-bold text-[#111] dark:text-white">{s.lead_time_days}d</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-[#bbb] uppercase tracking-wider mb-1">Order Qty</p>
          <p className="font-bold text-[#111] dark:text-white">{fmt(s.reorder_qty_litres, 0)} L</p>
        </div>
      </div>
    </div>
  )
}

// ─── Alerts Tab ───────────────────────────────────────────────────────────────

function AlertsTab({
  alerts,
  onResolve,
  onCheck,
  isChecking,
}: {
  alerts: FuelAlert[] | undefined
  onResolve: (id: string) => void
  onCheck: () => void
  isChecking: boolean
}) {
  const [showResolved, setShowResolved] = useState(false)

  const filtered = alerts?.filter((a) => a.resolved === showResolved) ?? []

  const unresolvedCount = alerts?.filter((a) => !a.resolved).length ?? 0

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowResolved(false)}
            className={clsx('px-4 py-2 rounded-xl text-[12px] font-bold transition-colors', !showResolved
              ? 'bg-[#111] dark:bg-white text-white dark:text-[#111]'
              : 'text-[#888] hover:text-[#111] dark:hover:text-white'
            )}
          >
            Active
            {unresolvedCount > 0 && (
              <span className="ml-2 text-[10px] font-black bg-red-500 text-white rounded-full px-1.5 py-0.5">{unresolvedCount}</span>
            )}
          </button>
          <button
            onClick={() => setShowResolved(true)}
            className={clsx('px-4 py-2 rounded-xl text-[12px] font-bold transition-colors', showResolved
              ? 'bg-[#111] dark:bg-white text-white dark:text-[#111]'
              : 'text-[#888] hover:text-[#111] dark:hover:text-white'
            )}
          >
            Resolved
          </button>
        </div>

        <button
          onClick={onCheck}
          disabled={isChecking}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold border border-[#e0e0e0] dark:border-[#333] text-[#555] dark:text-[#aaa] hover:bg-[#f4f4f4] dark:hover:bg-[#1a1a1a] transition-colors disabled:opacity-50 cursor-pointer"
        >
          {isChecking
            ? <Loader2 size={12} className="animate-spin" />
            : <Bell size={12} />}
          Run Alert Check
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <BellOff size={28} className="text-[#ddd] dark:text-[#333]" />
          <p className="text-[13px] font-semibold text-[#bbb]">
            {showResolved ? 'No resolved alerts' : 'No active alerts — all clear'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((a) => (
            <AlertCard key={a.id} alert={a} onResolve={onResolve} />
          ))}
        </div>
      )}
    </div>
  )
}

function AlertCard({ alert: a, onResolve }: { alert: FuelAlert; onResolve: (id: string) => void }) {
  const cfg = severityConfig(a.severity)
  const Icon = cfg.icon

  return (
    <div className={clsx(
      'bg-white dark:bg-[#111] border rounded-2xl p-4 flex items-start gap-4',
      a.resolved ? 'border-[#ebebeb] dark:border-[#222] opacity-60' : {
        'border-red-200 dark:border-red-900':    a.severity === 'critical',
        'border-yellow-200 dark:border-yellow-900': a.severity === 'warning',
        'border-blue-200 dark:border-blue-900':  a.severity === 'info',
      }
    )}>
      <div className={clsx('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0', {
        'bg-red-50 dark:bg-red-950/30':    a.severity === 'critical',
        'bg-yellow-50 dark:bg-yellow-950/30': a.severity === 'warning',
        'bg-blue-50 dark:bg-blue-950/30':  a.severity === 'info',
      })}>
        <Icon size={14} className={cfg.cls} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-[13px] font-bold text-[#111] dark:text-white">{a.title}</p>
              <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide', cfg.badge)}>
                {a.severity}
              </span>
            </div>
            <p className="text-[12px] text-[#666] dark:text-[#888]">{a.message}</p>
            {a.tank_name && (
              <p className="text-[11px] font-semibold text-[#aaa] mt-1 flex items-center gap-1">
                <Droplets size={10} /> {a.tank_name}
              </p>
            )}
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-[10px] text-[#bbb]">{new Date(a.created_at).toLocaleString()}</p>
            {a.value != null && a.threshold != null && (
              <p className="text-[10px] font-semibold text-[#aaa] mt-0.5">
                {a.value.toFixed(1)} / {a.threshold.toFixed(1)}
              </p>
            )}
          </div>
        </div>
      </div>

      {!a.resolved && (
        <button
          onClick={() => onResolve(a.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-[#555] dark:text-[#aaa] border border-[#e0e0e0] dark:border-[#333] hover:bg-[#f4f4f4] dark:hover:bg-[#1a1a1a] transition-colors flex-shrink-0 cursor-pointer"
        >
          <CheckCircle size={11} />
          Resolve
        </button>
      )}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Package size={32} className="text-[#ddd] dark:text-[#333]" />
      <p className="text-[13px] font-semibold text-[#bbb]">{message}</p>
    </div>
  )
}

// ─── Loading ──────────────────────────────────────────────────────────────────

function Loading() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={24} className="animate-spin text-[#ccc] dark:text-[#444]" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function FuelIntelligencePage({ onBack }: { onBack?: () => void } = {}) {
  const [tab, setTab] = useState<Tab>('overview')
  const qc = useQueryClient()

  const { data: fps,        isLoading: fpsLoading }  = useQuery({ queryKey: ['fuel-fps'],       queryFn: getFuelFPS })
  const { data: tanks }                               = useQuery({ queryKey: ['fuel-tanks'],     queryFn: getFuelTanksSummary,     enabled: tab === 'tanks' || tab === 'overview' })
  const { data: grades }                              = useQuery({ queryKey: ['fuel-grades'],    queryFn: getFuelGradeAnalytics,   enabled: tab === 'grades' })
  const { data: deliveries }                          = useQuery({ queryKey: ['fuel-deliveries'],queryFn: getFuelDeliverySummary,  enabled: tab === 'deliveries' })
  const { data: reorder }                             = useQuery({ queryKey: ['fuel-reorder'],   queryFn: getFuelReorderStatus,    enabled: tab === 'reorder' })
  const { data: alerts }                              = useQuery({ queryKey: ['fuel-alerts'],    queryFn: () => getFuelAlerts(),   enabled: tab === 'alerts' })

  const resolveMut = useMutation({
    mutationFn: resolveFuelAlert,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fuel-alerts'] }),
  })

  const checkMut = useMutation({
    mutationFn: checkFuelAlerts,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fuel-alerts'] }),
  })

  const unresolvedAlertCount = alerts?.filter((a) => !a.resolved).length ?? 0

  return (
    <div className="px-5 py-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 mb-2 text-[12px] font-bold text-[#888] hover:text-[#111] dark:hover:text-white transition-colors"
            >
              <ArrowLeft size={14} /> Go back
            </button>
          )}
          <h1 className="text-[20px] font-black text-[#111] dark:text-white">Fuel Intelligence</h1>
          <p className="text-[12px] text-[#888] mt-0.5">Performance scoring, inventory analytics, and alerts</p>
        </div>
        {fps && (
          <div className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl border text-[13px] font-bold', gradeBg(fps.grade))}>
            <Flame size={13} className={gradeColor(fps.grade)} />
            <span className={gradeColor(fps.grade)}>FPS {fps.fps_total.toFixed(1)}</span>
            <span className={clsx('text-[15px] font-black', gradeColor(fps.grade))}>{fps.grade}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isAlerts = id === 'alerts'
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition-colors relative',
                tab === id
                  ? 'bg-[#111] dark:bg-white text-white dark:text-[#111]'
                  : 'text-[#888] hover:text-[#111] dark:hover:text-white hover:bg-[#f4f4f4] dark:hover:bg-[#1a1a1a]'
              )}
            >
              <Icon size={13} />
              {label}
              {isAlerts && unresolvedAlertCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">
                  {unresolvedAlertCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (fpsLoading ? <Loading /> : <OverviewTab fps={fps} />)}
      {tab === 'tanks' && <TanksTab tanks={tanks} />}
      {tab === 'grades' && <GradesTab grades={grades} />}
      {tab === 'deliveries' && <DeliveriesTab summary={deliveries} />}
      {tab === 'reorder' && <ReorderTab statuses={reorder} />}
      {tab === 'alerts' && (
        <AlertsTab
          alerts={alerts}
          onResolve={(id) => resolveMut.mutate(id)}
          onCheck={() => checkMut.mutate()}
          isChecking={checkMut.isPending}
        />
      )}

      {/* FPS info footer */}
      {tab === 'overview' && fps && (
        <div className="mt-6 bg-[#fafafa] dark:bg-[#0d0d0d] border border-[#ebebeb] dark:border-[#1e1e1e] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info size={13} className="text-[#aaa]" />
            <p className="text-[12px] font-bold text-[#555] dark:text-[#888]">How FPS is calculated</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-2 text-[11px] text-[#888]">
            {[
              ['Inventory Accuracy', '25 pts', 'Variance between theoretical vs actual closing levels'],
              ['Fuel Loss Control',  '25 pts', 'Shrinkage / unaccounted fuel over received volume'],
              ['Delivery Efficiency','15 pts', 'Measured vs invoiced delivery accuracy'],
              ['Tank Utilization',   '15 pts', 'Average fill level relative to capacity'],
              ['Sales Performance',  '10 pts', 'Volume sold vs historical trend'],
              ['Compliance',         '10 pts', 'Shift data completeness rate'],
            ].map(([name, pts, desc]) => (
              <div key={name}>
                <p className="font-bold text-[#333] dark:text-[#ccc]">{name} <span className="font-normal text-[#aaa]">({pts})</span></p>
                <p className="mt-0.5 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-[#ebebeb] dark:border-[#222] grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px] text-center">
            {[['A+', '≥ 90'], ['A', '≥ 80'], ['B', '≥ 70'], ['C', '≥ 60'], ['D', '≥ 50'], ['F', '< 50']].map(([g, r]) => (
              <div key={g}>
                <span className={clsx('text-[15px] font-black', gradeColor(g))}>{g}</span>
                <span className="text-[#bbb] ml-1">{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
