import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DollarSign, Users, Calculator, Settings, BarChart2, Shield, FileText,
  Check, Lock, Play, Eye, Edit2, Loader2,
  AlertTriangle, CheckCircle, Clock, XCircle, TrendingUp,
  Download, Info, Banknote, Zap,
} from 'lucide-react'
import clsx from 'clsx'
import {
  getPayrollConfig, upsertPayrollConfig,
  getTaxRuleSets, createTaxRuleSet, activateTaxRuleSet, getTaxRules, upsertTaxRule,
  getCompensation, upsertCompensation,
  getPayrollRuns, createPayrollRun, approvePayrollRun, lockPayrollRun,
  getPayrollRunLines, overrideRunLine, getPayrollAnalytics, getPayrollAuditLog,
  PAY_FREQUENCIES, FREQUENCY_PERIODS, getUsers,
  type PayFrequency, type TaxRuleSet, type TaxRule,
  type EmployeeCompensation, type PayrollRun, type PayrollRunLine,
  type PayrollAnalytics,
} from '../lib/api'

// ─── Client-side salary + tax engine ─────────────────────────────────────────
// Mirrors the Go engine exactly. Used for instant local preview — no network
// round-trip on every keystroke. The server confirms via POST /salary-preview.

interface LocalTaxCfg {
  nisRate: number; nisCap: number
  nhtRate: number
  edTaxRate: number
  payeThreshold: number; payeBracket: number
  payeRate1: number; payeRate2: number
}

const JA_TAX_DEFAULTS: LocalTaxCfg = {
  nisRate: 0.03, nisCap: 5_000_000,
  nhtRate: 0.02,
  edTaxRate: 0.0225,
  payeThreshold: 1_799_376, payeBracket: 6_000_000,
  payeRate1: 0.25, payeRate2: 0.30,
}

function calcDeductionsClient(
  periodGross: number, freq: PayFrequency, cfg = JA_TAX_DEFAULTS
) {
  const P = FREQUENCY_PERIODS[freq]
  const nisCap = (cfg.nisCap * cfg.nisRate) / P
  const nis = r2(Math.min(periodGross * cfg.nisRate, nisCap))
  const statutory = periodGross - nis
  const nht = r2(periodGross * cfg.nhtRate)
  const edTax = r2(statutory * cfg.edTaxRate)
  const annualStat = statutory * P
  let annualPAYE = 0
  if (annualStat > cfg.payeThreshold) {
    const taxable = annualStat - cfg.payeThreshold
    annualPAYE =
      annualStat <= cfg.payeBracket
        ? taxable * cfg.payeRate1
        : (cfg.payeBracket - cfg.payeThreshold) * cfg.payeRate1 +
          (taxable - (cfg.payeBracket - cfg.payeThreshold)) * cfg.payeRate2
  }
  const paye = r2(annualPAYE / P)
  const total = r2(nis + nht + edTax + paye)
  return {
    nis, nht, edTax, paye, total,
    net: r2(periodGross - total),
    effectiveRate: r2(periodGross > 0 ? (total / periodGross) * 100 : 0),
  }
}

/**
 * Reverse calculation — Newton-Raphson iteration.
 *
 * Given a desired take-home (net) pay, find the gross that produces it.
 *
 * Initial estimate (below PAYE threshold, so no PAYE):
 *   Net ≈ G · k   where k = 1 − NIS·(1−EdTax) − NHT − EdTax
 *   G₀  = Net / k
 *
 * Newton step (numerical derivative):
 *   ∂Net/∂G ≈ [net(G+1) − net(G)]
 *   G_{n+1} = G_n − (net(G_n) − target) / (∂Net/∂G)
 *
 * Converges in 3–8 iterations for all JA salary ranges.
 */
function reverseCalcClient(targetNet: number, freq: PayFrequency, cfg = JA_TAX_DEFAULTS): number {
  const k = 1 - cfg.nisRate * (1 - cfg.edTaxRate) - cfg.nhtRate - cfg.edTaxRate
  let g = k > 0.01 ? targetNet / k : targetNet / 0.9
  for (let i = 0; i < 50; i++) {
    const { net: n1 } = calcDeductionsClient(g, freq, cfg)
    const err = n1 - targetNet
    if (Math.abs(err) < 0.01) break
    const { net: n2 } = calcDeductionsClient(g + 1, freq, cfg)
    const dNet = n2 - n1
    if (Math.abs(dNet) < 0.0001) break
    g -= err / dNet
    if (g < 0) g = targetNet
  }
  return r2(g)
}

function computeBreakdown(grossAtFreq: number, freq: PayFrequency) {
  const annual = r2(grossAtFreq * FREQUENCY_PERIODS[freq])
  return {
    annual,
    monthly: r2(annual / 12),
    weekly:  r2(annual / 52),
    daily:   r4(annual / 260),   // 52 wks × 5 days
    hourly:  r4(annual / 2080),  // 52 wks × 5 days × 8 hrs
  }
}

function r2(v: number) { return Math.round(v * 100) / 100 }
function r4(v: number) { return Math.round(v * 10000) / 10000 }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, dp = 0) {
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}
function fmtPct(n: number) { return `${n.toFixed(2)}%` }

const FREQ_LABEL: Record<PayFrequency, string> = {
  Weekly: 'Weekly', BiWeekly: 'Bi-Weekly', Fortnightly: 'Fortnightly',
  SemiMonthly: 'Semi-Monthly', Monthly: 'Monthly',
}
const TAX_LABELS: Record<string, string> = {
  NIS: 'NIS', NHT: 'NHT', EDTAX: 'Education Tax', PAYE_L1: 'PAYE (25% band)', PAYE_L2: 'PAYE (30% band)',
}
const TAX_INFO: Record<string, string> = {
  NIS:    'Applied to gross. Capped at annual_cap × rate / periods.',
  NHT:    'Applied to gross. No earnings ceiling.',
  EDTAX:  'Applied to statutory income (gross − NIS).',
  PAYE_L1:'Lower band. threshold = lower bound. upper_limit = bracket ceiling.',
  PAYE_L2:'Upper band. threshold = where this rate applies from.',
}

const RUN_STATUS: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  Draft:      { label: 'Draft',      cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400',          icon: Clock },
  Calculated: { label: 'Calculated', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',          icon: Calculator },
  Approved:   { label: 'Approved',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', icon: CheckCircle },
  Locked:     { label: 'Locked',     cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',  icon: Lock },
  Paid:       { label: 'Paid',       cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',      icon: Check },
  Cancelled:  { label: 'Cancelled',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',             icon: XCircle },
}

function RunStatusBadge({ status }: { status: string }) {
  const cfg = RUN_STATUS[status] ?? RUN_STATUS['Draft']
  const Icon = cfg.icon
  return (
    <span className={clsx('inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full', cfg.cls)}>
      <Icon size={10} />{cfg.label}
    </span>
  )
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('bg-white dark:bg-[#111] border border-[#ebebeb] dark:border-[#222] rounded-2xl', className)}>{children}</div>
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#aaa]">{children}</th>
}
function Loading() {
  return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-[#ccc] dark:text-[#444]" /></div>
}
function Empty({ msg }: { msg: string }) {
  return <div className="py-14 text-center text-[13px] font-semibold text-[#bbb]">{msg}</div>
}

// ─── Salary Calculator Widget ─────────────────────────────────────────────────

interface CalcState { entered: string; freq: PayFrequency; afterTax: boolean; payType: 'Salary' | 'Hourly' }

function SalaryCalc({ state, onChange }: { state: CalcState; onChange: (s: CalcState) => void }) {
  const entered = parseFloat(state.entered) || 0
  const gross = state.afterTax && entered > 0 ? reverseCalcClient(entered, state.freq) : entered
  const breakdown = gross > 0 ? computeBreakdown(gross, state.freq) : null
  const ded = breakdown ? calcDeductionsClient(breakdown.monthly, 'Monthly') : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">Pay Frequency</label>
          <select value={state.freq} onChange={(e) => onChange({ ...state, freq: e.target.value as PayFrequency })}
            className="w-full px-3 py-2 text-[13px] font-semibold bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none">
            {PAY_FREQUENCIES.map((f) => <option key={f} value={f}>{FREQ_LABEL[f]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">
            {state.afterTax ? 'Desired Take-Home' : `${FREQ_LABEL[state.freq]} Amount`}
          </label>
          <input type="number" min="0" step="0.01" value={state.entered}
            onChange={(e) => onChange({ ...state, entered: e.target.value })}
            placeholder="0.00"
            className="w-full px-3 py-2 text-[13px] font-semibold bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none" />
        </div>
      </div>

      {/* After-tax toggle */}
      <div
        onClick={() => onChange({ ...state, afterTax: !state.afterTax })}
        className={clsx('flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors select-none',
          state.afterTax ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' : 'border-[#e8e8e8] dark:border-[#2a2a2a] hover:bg-[#fafafa] dark:hover:bg-[#161616]'
        )}
      >
        <div className={clsx('w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
          state.afterTax ? 'bg-[#111] dark:bg-white border-[#111] dark:border-white' : 'border-[#ccc] dark:border-[#444]')}>
          {state.afterTax && <Check size={11} className="text-white dark:text-[#111]" />}
        </div>
        <div>
          <p className="text-[13px] font-bold text-[#111] dark:text-white">Salary Entered Is After Tax</p>
          <p className="text-[11px] text-[#888] mt-0.5">Enter desired take-home — system reverse-calculates gross via Newton-Raphson (converges ≤ 8 iterations).</p>
        </div>
      </div>

      {state.afterTax && gross > 0 && (
        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-[11px]">
          <p className="font-bold text-amber-700 dark:text-amber-400 mb-0.5">Reverse Calculation Result</p>
          <p className="text-amber-600 dark:text-amber-500">
            Entered <span className="font-bold">${fmt(entered, 2)}</span> net →
            Required gross <span className="font-black">${fmt(gross, 2)}</span>.
            The gross is then taxed normally to yield exactly your target net.
          </p>
        </div>
      )}

      {/* Salary equivalents grid */}
      {breakdown && (
        <div className="rounded-xl border border-[#f0f0f0] dark:border-[#222] overflow-hidden">
          <div className="px-4 py-2 bg-[#fafafa] dark:bg-[#0d0d0d] border-b border-[#f0f0f0] dark:border-[#222] flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#aaa]">Salary Equivalents (Gross)</p>
          </div>
          <div className="grid grid-cols-5 divide-x divide-[#f0f0f0] dark:divide-[#222]">
            {[
              { label: 'Annual',   v: breakdown.annual,  dp: 0 },
              { label: 'Monthly',  v: breakdown.monthly, dp: 0 },
              { label: 'Weekly',   v: breakdown.weekly,  dp: 0 },
              { label: 'Daily',    v: breakdown.daily,   dp: 2 },
              { label: 'Hourly',   v: breakdown.hourly,  dp: 2 },
            ].map(({ label, v, dp }) => (
              <div key={label} className="px-2 py-3 text-center">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#bbb]">{label}</p>
                <p className="text-[12px] font-black text-[#111] dark:text-white tabular-nums mt-1">${fmt(v, dp)}</p>
              </div>
            ))}
          </div>
          <div className="px-4 py-1.5 bg-[#fafafa] dark:bg-[#0d0d0d] border-t border-[#f0f0f0] dark:border-[#222]">
            <p className="text-[9px] text-[#bbb] text-center">
              Annual = {FREQ_LABEL[state.freq]} × {FREQUENCY_PERIODS[state.freq]} · Daily = Annual÷260 · Hourly = Annual÷2080
            </p>
          </div>
        </div>
      )}

      {/* Monthly deduction preview */}
      {ded && (
        <div className="rounded-xl border border-[#f0f0f0] dark:border-[#222] overflow-hidden">
          <div className="px-4 py-2 bg-[#fafafa] dark:bg-[#0d0d0d] border-b border-[#f0f0f0] dark:border-[#222] flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#aaa]">Monthly Deduction Preview</p>
            <span className="text-[10px] font-bold text-[#aaa]">Effective rate: {fmtPct(ded.effectiveRate)}</span>
          </div>
          <div className="px-4 py-3 space-y-2">
            {[
              { label: 'NIS (3%)', v: ded.nis, color: '#3b82f6' },
              { label: 'NHT (2%)', v: ded.nht, color: '#8b5cf6' },
              { label: 'Education Tax (2.25%)', v: ded.edTax, color: '#f59e0b' },
              { label: 'PAYE', v: ded.paye, color: '#ef4444' },
            ].map(({ label, v, color }) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[12px] text-[#555] dark:text-[#aaa] flex-1">{label}</span>
                <span className="text-[12px] font-bold text-[#111] dark:text-white tabular-nums">${fmt(v, 2)}</span>
              </div>
            ))}
            <div className="pt-2 mt-1 border-t border-[#f0f0f0] dark:border-[#222] flex justify-between">
              <span className="text-[12px] font-bold text-[#555] dark:text-[#aaa]">Total Deductions</span>
              <span className="text-[13px] font-black text-red-600 dark:text-red-400 tabular-nums">${fmt(ded.total, 2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[12px] font-bold text-[#555] dark:text-[#aaa]">Monthly Net Pay</span>
              <span className="text-[14px] font-black text-emerald-600 dark:text-emerald-400 tabular-nums">${fmt(ded.net, 2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Payroll Runs
// ═══════════════════════════════════════════════════════════════════════════════

function RunsTab() {
  const qc = useQueryClient()
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [viewLine, setViewLine]   = useState<PayrollRunLine | null>(null)
  const [editLine, setEditLine]   = useState<PayrollRunLine | null>(null)

  const { data: runs, isLoading } = useQuery({ queryKey: ['payroll-runs'], queryFn: getPayrollRuns })
  const { data: lines, isLoading: linesLoad } = useQuery({
    queryKey: ['payroll-lines', selectedRun?.id],
    queryFn: () => getPayrollRunLines(selectedRun!.id),
    enabled: !!selectedRun,
  })

  const approveMut = useMutation({ mutationFn: approvePayrollRun, onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-runs'] }) })
  const lockMut   = useMutation({ mutationFn: lockPayrollRun,   onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-runs'] }) })

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-5">
      {/* Runs list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-bold text-[#111] dark:text-white">All Payroll Runs</p>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#111] dark:bg-white text-white dark:text-[#111] rounded-xl text-[12px] font-bold hover:opacity-90 transition-opacity">
            <Play size={12} /> New Run
          </button>
        </div>
        {isLoading ? <Loading /> : (
          <Card className="overflow-hidden">
            <table className="w-full text-[12px]">
              <thead><tr className="border-b border-[#f0f0f0] dark:border-[#222]">
                <Th>Label</Th><Th>Frequency</Th><Th>Employees</Th><Th>Total Net</Th><Th>Status</Th><Th>Date</Th>
              </tr></thead>
              <tbody>
                {(runs ?? []).map((run) => (
                  <tr key={run.id} onClick={() => setSelectedRun(run)}
                    className={clsx('border-b border-[#f8f8f8] dark:border-[#1a1a1a] cursor-pointer transition-colors',
                      selectedRun?.id === run.id ? 'bg-[#f4f4f4] dark:bg-[#1a1a1a]' : 'hover:bg-[#fafafa] dark:hover:bg-[#161616]')}>
                    <td className="px-4 py-3 font-semibold text-[#111] dark:text-white">{run.label}</td>
                    <td className="px-4 py-3 text-[#555] dark:text-[#aaa]">{FREQ_LABEL[run.frequency as PayFrequency] ?? run.frequency}</td>
                    <td className="px-4 py-3 tabular-nums">{run.employee_count}</td>
                    <td className="px-4 py-3 font-bold tabular-nums">${fmt(run.total_net)}</td>
                    <td className="px-4 py-3"><RunStatusBadge status={run.status} /></td>
                    <td className="px-4 py-3 text-[#888]">{new Date(run.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(runs ?? []).length === 0 && <Empty msg="No payroll runs yet. Click 'New Run' to generate payroll." />}
          </Card>
        )}
      </div>

      {/* Run detail panel */}
      {selectedRun && (
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[14px] font-bold text-[#111] dark:text-white">{selectedRun.label}</p>
                <p className="text-[11px] text-[#888] mt-0.5">{FREQ_LABEL[selectedRun.frequency as PayFrequency]}</p>
              </div>
              <RunStatusBadge status={selectedRun.status} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                ['Gross',      `$${fmt(selectedRun.total_gross)}`],
                ['Net',        `$${fmt(selectedRun.total_net)}`],
                ['Deductions', `$${fmt(selectedRun.total_deductions)}`],
                ['Empr Cost',  `$${fmt(selectedRun.total_employer_cost)}`],
              ].map(([l, v]) => (
                <div key={l} className="bg-[#f8f8f8] dark:bg-[#1a1a1a] rounded-xl px-3 py-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#aaa]">{l}</p>
                  <p className="text-[14px] font-black text-[#111] dark:text-white tabular-nums">{v}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              {selectedRun.status === 'Calculated' && (
                <button onClick={() => approveMut.mutate(selectedRun.id)} disabled={approveMut.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-[12px] font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50">
                  <CheckCircle size={11} /> Approve
                </button>
              )}
              {selectedRun.status === 'Approved' && (
                <button onClick={() => lockMut.mutate(selectedRun.id)} disabled={lockMut.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-xl text-[12px] font-bold hover:bg-purple-700 transition-colors disabled:opacity-50">
                  <Lock size={11} /> Lock Payroll
                </button>
              )}
              {selectedRun.status === 'Locked' && (
                <button className="flex items-center gap-1.5 px-3 py-2 bg-[#111] dark:bg-white text-white dark:text-[#111] rounded-xl text-[12px] font-bold hover:opacity-80 transition-opacity">
                  <Download size={11} /> Export Bank File
                </button>
              )}
            </div>

            {/* State machine */}
            <p className="text-[10px] text-[#bbb]">
              {['Draft','Calculated','Approved','Locked','Paid'].map((s, i, a) => (
                <span key={s}><span className={clsx('font-bold', selectedRun.status === s && 'text-[#111] dark:text-white')}>{s}</span>{i < a.length - 1 && ' → '}</span>
              ))}
            </p>
          </Card>

          {/* Employee lines */}
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[#f0f0f0] dark:border-[#222]">
              <p className="text-[12px] font-bold text-[#111] dark:text-white">Lines ({selectedRun.employee_count})</p>
            </div>
            {linesLoad ? <Loading /> : (
              <table className="w-full text-[11px]">
                <thead><tr className="border-b border-[#f0f0f0] dark:border-[#222]">
                  <Th>Name</Th><Th>Gross</Th><Th>OT Pay</Th><Th>Net</Th><th />
                </tr></thead>
                <tbody>
                  {(lines ?? []).map((line) => (
                    <tr key={line.id} className="border-b border-[#f8f8f8] dark:border-[#1a1a1a]">
                      <td className="px-3 py-2.5 font-semibold text-[#111] dark:text-white">
                        {line.user_name}
                        {line.is_overridden && <span className="ml-1 text-[9px] font-bold text-amber-500">edited</span>}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">${fmt(line.total_gross)}</td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {line.overtime_pay > 0
                          ? <span className="font-bold text-amber-600 dark:text-amber-400">${fmt(line.overtime_pay, 2)}</span>
                          : <span className="text-[#ccc]">—</span>}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums font-bold text-emerald-600 dark:text-emerald-400">${fmt(line.net_pay)}</td>
                      <td className="px-3 py-2.5 flex items-center gap-1">
                        <button onClick={() => setViewLine(line)}
                          className="p-1 rounded-lg hover:bg-[#f0f0f0] dark:hover:bg-[#222] transition-colors" title="View payslip">
                          <Eye size={12} className="text-[#888]" />
                        </button>
                        {(selectedRun?.status !== 'Locked' && selectedRun?.status !== 'Paid') && (
                          <button onClick={() => setEditLine(line)}
                            className="p-1 rounded-lg hover:bg-[#f0f0f0] dark:hover:bg-[#222] transition-colors" title="Edit earnings">
                            <Edit2 size={12} className="text-[#888]" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {showCreate && (
        <CreateRunModal onClose={() => setShowCreate(false)}
          onCreated={(run) => { qc.invalidateQueries({ queryKey: ['payroll-runs'] }); setSelectedRun(run); setShowCreate(false) }} />
      )}
      {viewLine && <PayslipModal line={viewLine} run={selectedRun!} onClose={() => setViewLine(null)} />}
      {editLine && selectedRun && (
        <EditLineModal
          line={editLine} run={selectedRun}
          onClose={() => setEditLine(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['payroll-lines', selectedRun.id] }); qc.invalidateQueries({ queryKey: ['payroll-runs'] }); setEditLine(null) }}
        />
      )}
    </div>
  )
}

// ─── EditLineModal — adjust overtime, bonus, other earnings for one employee ──

function EditLineModal({ line, run, onClose, onSaved }: {
  line: PayrollRunLine; run: PayrollRun; onClose: () => void; onSaved: () => void
}) {
  const qc = useQueryClient()
  const { data: cfg } = useQuery({ queryKey: ['payroll-config'], queryFn: getPayrollConfig })

  const otMultiplier   = cfg?.overtime_multiplier   ?? 1.5
  const dblMultiplier  = cfg?.double_time_multiplier ?? 2.0

  const [otHours,   setOtHours]   = useState(String(line.overtime_hours || ''))
  const [otType,    setOtType]    = useState<'standard' | 'double'>('standard')
  const [bonus,     setBonus]     = useState(String(line.bonus || ''))
  const [otherEarn, setOtherEarn] = useState(String(line.other_earnings || ''))
  const [otherDed,  setOtherDed]  = useState(String(line.other_deductions || ''))
  const [reason,    setReason]    = useState(line.override_reason ?? '')

  // Compensation data to show hourly rate if available
  const { data: comps } = useQuery({ queryKey: ['payroll-comp'], queryFn: getCompensation })
  const empComp = (comps ?? []).find((c) => c.user_id === line.user_id)
  const hourlyRate = empComp?.hourly_rate ?? 0

  const activeMultiplier = otType === 'double' ? dblMultiplier : otMultiplier
  const hours = parseFloat(otHours) || 0

  // Client-side OT preview: hours × hourly_rate × multiplier
  const otPreview = hourlyRate > 0 && hours > 0
    ? Math.round(hours * hourlyRate * activeMultiplier * 100) / 100
    : null

  const mut = useMutation({
    mutationFn: () => overrideRunLine(run.id, line.id, {
      overtime_hours:   hours,
      // Don't send overtime_pay — let server compute from hours × hourly_rate × multiplier
      // (server uses the correct multiplier based on payroll_config)
      bonus:            parseFloat(bonus) || 0,
      other_earnings:   parseFloat(otherEarn) || 0,
      other_deductions: parseFloat(otherDed) || 0,
      override_reason:  reason || undefined,
    }),
    onSuccess: onSaved,
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-[#111] rounded-2xl border border-[#ebebeb] dark:border-[#222] w-full max-w-md my-4 p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="text-[15px] font-bold text-[#111] dark:text-white">Edit Earnings — {line.user_name}</p>
          <p className="text-[12px] text-[#888]">{run.label}</p>
        </div>

        {/* Overtime section */}
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-2">Overtime Type</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'standard' as const, label: 'Standard OT', sub: `${otMultiplier}× — weekday beyond 8h` },
                { id: 'double'   as const, label: 'Double Time',  sub: `${dblMultiplier}× — public holiday` },
              ].map(({ id, label, sub }) => (
                <button key={id} onClick={() => setOtType(id)}
                  className={clsx('px-3 py-2.5 rounded-xl text-left border transition-colors',
                    otType === id ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700' : 'border-[#e0e0e0] dark:border-[#333] hover:bg-[#fafafa] dark:hover:bg-[#1a1a1a]')}>
                  <p className="text-[12px] font-bold text-[#111] dark:text-white">{label}</p>
                  <p className="text-[10px] text-[#888] mt-0.5">{sub}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">Overtime Hours</label>
            <input type="number" min="0" step="0.5" value={otHours} onChange={(e) => setOtHours(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 text-[13px] font-semibold bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#111] dark:focus:ring-white" />
          </div>

          {/* OT pay preview */}
          {hours > 0 && (
            <div className={clsx('px-4 py-3 rounded-xl border text-[12px]',
              'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800')}>
              <p className="font-bold text-amber-700 dark:text-amber-400 mb-1">Overtime Pay Calculation</p>
              {hourlyRate > 0 ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-amber-600 dark:text-amber-500">
                    <span>{hours}h</span>
                    <span className="text-[#aaa]">×</span>
                    <span>${fmt(hourlyRate, 2)}/hr</span>
                    <span className="text-[#aaa]">×</span>
                    <span className="font-black">{activeMultiplier}×</span>
                    <span className="text-[#aaa]">=</span>
                    <span className="font-black text-amber-700 dark:text-amber-300">${fmt(otPreview ?? 0, 2)}</span>
                  </div>
                  <p className="text-[10px] text-amber-600 dark:text-amber-500">
                    Server will confirm this amount on save using the configured {otType === 'double' ? 'double-time' : 'overtime'} multiplier.
                  </p>
                </div>
              ) : (
                <p className="text-amber-600 dark:text-amber-500">
                  Hourly rate not configured for this employee. Server will use compensation record to compute OT pay automatically.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Other adjustments */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">Bonus ($)</label>
            <input type="number" min="0" step="0.01" value={bonus} onChange={(e) => setBonus(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-[13px] bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">Other Earnings ($)</label>
            <input type="number" min="0" step="0.01" value={otherEarn} onChange={(e) => setOtherEarn(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-[13px] bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">Other Deductions ($)</label>
            <input type="number" min="0" step="0.01" value={otherDed} onChange={(e) => setOtherDed(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-[13px] bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">Reason (optional)</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Shift coverage"
              className="w-full px-3 py-2 text-[13px] bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none" />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[13px] font-bold text-[#555] dark:text-[#aaa] hover:bg-[#f4f4f4] dark:hover:bg-[#1a1a1a] transition-colors">Cancel</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending}
            className="flex-1 px-4 py-2.5 bg-[#111] dark:bg-white text-white dark:text-[#111] rounded-xl text-[13px] font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
            {mut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateRunModal({ onClose, onCreated }: { onClose: () => void; onCreated: (r: PayrollRun) => void }) {
  const [label, setLabel] = useState('')
  const [freq, setFreq] = useState<PayFrequency>('Monthly')
  const mut = useMutation({ mutationFn: createPayrollRun, onSuccess: onCreated })
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#111] rounded-2xl border border-[#ebebeb] dark:border-[#222] w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="text-[16px] font-bold text-[#111] dark:text-white">New Payroll Run</p>
          <p className="text-[12px] text-[#888]">Calculates all statutory deductions for active employees using the current tax rule set.</p>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">Label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)}
            placeholder={`Payroll Run ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`}
            className="w-full px-3 py-2 text-[13px] bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">Frequency</label>
          <select value={freq} onChange={(e) => setFreq(e.target.value as PayFrequency)}
            className="w-full px-3 py-2 text-[13px] font-semibold bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none">
            {PAY_FREQUENCIES.map((f) => <option key={f} value={f}>{FREQ_LABEL[f]}</option>)}
          </select>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[13px] font-bold text-[#555] dark:text-[#aaa] hover:bg-[#f4f4f4] dark:hover:bg-[#1a1a1a] transition-colors">Cancel</button>
          <button onClick={() => mut.mutate({ label: label || undefined, frequency: freq })} disabled={mut.isPending}
            className="flex-1 px-4 py-2.5 bg-[#111] dark:bg-white text-white dark:text-[#111] rounded-xl text-[13px] font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
            {mut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
            {mut.isPending ? 'Generating…' : 'Generate Payroll'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PayslipModal({ line, run, onClose }: { line: PayrollRunLine; run: PayrollRun; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#111] rounded-2xl border border-[#ebebeb] dark:border-[#222] w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-[#f0f0f0] dark:border-[#222] flex items-center justify-between">
          <div>
            <p className="text-[15px] font-black text-[#111] dark:text-white">Payslip</p>
            <p className="text-[12px] text-[#888]">{run.label} · {run.frequency}</p>
          </div>
          <RunStatusBadge status={run.status} />
        </div>
        <div className="px-6 py-4 border-b border-[#f0f0f0] dark:border-[#222]">
          <p className="text-[14px] font-bold text-[#111] dark:text-white">{line.user_name}</p>
          {run.period_start && <p className="text-[11px] text-[#888]">{run.period_start} → {run.period_end}</p>}
        </div>
        {/* Earnings */}
        <div className="px-6 py-4 space-y-2 border-b border-[#f0f0f0] dark:border-[#222]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#aaa] mb-2">Earnings</p>
          {([['Base Salary', line.base_gross], line.overtime_pay > 0 && [`Overtime (${line.overtime_hours}h)`, line.overtime_pay], line.bonus > 0 && ['Bonus', line.bonus]] as [string, number][]).filter(Boolean).map(([label, val]) => (
            <div key={label} className="flex justify-between text-[12px]">
              <span className="text-[#555] dark:text-[#aaa]">{label}</span>
              <span className="font-bold tabular-nums">${fmt(val, 2)}</span>
            </div>
          ))}
          <div className="pt-2 border-t border-[#f0f0f0] dark:border-[#222] flex justify-between text-[13px] font-bold">
            <span>Total Gross</span><span>${fmt(line.total_gross, 2)}</span>
          </div>
        </div>
        {/* Deductions */}
        <div className="px-6 py-4 space-y-2 border-b border-[#f0f0f0] dark:border-[#222]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#aaa] mb-2">Statutory Deductions</p>
          {[['NIS (3%)', line.nis_employee], ['NHT (2%)', line.nht_employee], ['Education Tax (2.25%)', line.edtax_employee], ['PAYE', line.paye]].map(([l, v]) => (
            <div key={l as string} className="flex justify-between text-[12px]">
              <span className="text-[#555] dark:text-[#aaa]">{l}</span>
              <span className="font-bold tabular-nums text-red-600 dark:text-red-400">(${fmt(v as number, 2)})</span>
            </div>
          ))}
          <div className="pt-2 border-t border-[#f0f0f0] dark:border-[#222] flex justify-between text-[13px] font-bold">
            <span>Total Deductions</span><span className="text-red-600 dark:text-red-400">(${fmt(line.total_deductions, 2)})</span>
          </div>
        </div>
        {/* Net */}
        <div className="px-6 py-4 bg-emerald-50 dark:bg-emerald-950/30 flex justify-between items-center">
          <span className="text-[15px] font-black text-[#111] dark:text-white">Net Pay</span>
          <span className="text-[20px] font-black text-emerald-600 dark:text-emerald-400 tabular-nums">${fmt(line.net_pay, 2)}</span>
        </div>
        <div className="px-6 py-3 border-t border-[#f0f0f0] dark:border-[#222]">
          <p className="text-[10px] text-[#bbb]">Employer cost: <span className="font-bold text-[#888]">${fmt(line.employer_cost, 2)}</span> (incl. employer NIS/NHT/EdTax)</p>
          {line.is_overridden && <p className="text-[10px] font-bold text-amber-500 mt-0.5">⚠ Manually overridden{line.override_reason ? `: ${line.override_reason}` : ''}</p>}
        </div>
        <div className="px-6 pb-5">
          <button onClick={onClose} className="w-full px-4 py-2.5 border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[13px] font-bold text-[#555] dark:text-[#aaa] hover:bg-[#f4f4f4] dark:hover:bg-[#1a1a1a] transition-colors">Close</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Compensation
// ═══════════════════════════════════════════════════════════════════════════════

function CompensationTab() {
  const qc = useQueryClient()
  const [editTarget, setEditTarget] = useState<{ id: string; name: string } | null>(null)
  const { data: comps, isLoading } = useQuery({ queryKey: ['payroll-comp'], queryFn: getCompensation })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: getUsers })

  const configuredIds = new Set((comps ?? []).map((c) => c.user_id))
  const unconfigured = (users ?? []).filter((u) => u.role !== 'Super Admin' && !configuredIds.has(u.id) && u.active !== false)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[13px] font-bold text-[#111] dark:text-white">Employee Compensation</p>
          <p className="text-[11px] text-[#888]">Set salary, frequency, and optional after-tax target per employee.</p>
        </div>
      </div>

      {unconfigured.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
          <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-bold text-amber-700 dark:text-amber-400">{unconfigured.length} employee{unconfigured.length !== 1 ? 's' : ''} without compensation</p>
            <p className="text-[11px] text-amber-600 dark:text-amber-500">{unconfigured.slice(0, 3).map((u) => u.name).join(', ')}{unconfigured.length > 3 ? ` +${unconfigured.length - 3} more` : ''}</p>
          </div>
        </div>
      )}

      {isLoading ? <Loading /> : (
        <Card className="overflow-hidden">
          <table className="w-full text-[12px]">
            <thead><tr className="border-b border-[#f0f0f0] dark:border-[#222]">
              <Th>Employee</Th><Th>Frequency</Th><Th>Entered</Th><Th>Annual Gross</Th><Th>Monthly</Th><Th>Hourly</Th><Th>Since</Th><th />
            </tr></thead>
            <tbody>
              {(comps ?? []).map((c) => (
                <tr key={c.id} className="border-b border-[#f8f8f8] dark:border-[#1a1a1a] hover:bg-[#fafafa] dark:hover:bg-[#161616]">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#111] dark:text-white">{c.user_name}</p>
                    <p className="text-[10px] text-[#aaa]">{c.user_role}</p>
                  </td>
                  <td className="px-4 py-3 text-[#555] dark:text-[#aaa]">{FREQ_LABEL[c.frequency as PayFrequency]}</td>
                  <td className="px-4 py-3 font-bold tabular-nums">
                    ${fmt(c.entered_amount, 2)}
                    {c.is_after_tax && <span className="ml-1 text-[9px] font-bold text-blue-500 uppercase">net</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums">${fmt(c.annual_gross)}</td>
                  <td className="px-4 py-3 tabular-nums">${fmt(c.monthly_gross)}</td>
                  <td className="px-4 py-3 tabular-nums">${c.hourly_rate.toFixed(2)}</td>
                  <td className="px-4 py-3 text-[#888]">{c.effective_from}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditTarget({ id: c.user_id, name: c.user_name ?? '' })}
                      className="p-1.5 rounded-lg hover:bg-[#f0f0f0] dark:hover:bg-[#222] transition-colors">
                      <Edit2 size={11} className="text-[#888]" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(comps ?? []).length === 0 && <Empty msg="No compensation configured yet." />}
        </Card>
      )}

      {/* Quick-add unconfigured */}
      {unconfigured.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-[#aaa] uppercase tracking-widest mb-2">Add Compensation</p>
          <div className="flex flex-wrap gap-2">
            {unconfigured.map((u) => (
              <button key={u.id} onClick={() => setEditTarget({ id: u.id, name: u.name })}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-[#ccc] dark:border-[#444] rounded-xl text-[12px] font-semibold text-[#555] dark:text-[#aaa] hover:border-[#888] hover:text-[#111] dark:hover:text-white transition-colors">
                + {u.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {editTarget && (
        <CompModal
          userId={editTarget.id} userName={editTarget.name}
          existing={(comps ?? []).find((c) => c.user_id === editTarget.id)}
          onClose={() => setEditTarget(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['payroll-comp'] }); setEditTarget(null) }}
        />
      )}
    </div>
  )
}

function CompModal({ userId, userName, existing, onClose, onSaved }: {
  userId: string; userName: string; existing?: EmployeeCompensation; onClose: () => void; onSaved: () => void
}) {
  const [calc, setCalc] = useState<CalcState>({
    entered: existing ? String(existing.entered_amount) : '',
    freq: (existing?.frequency as PayFrequency) ?? 'Monthly',
    afterTax: existing?.is_after_tax ?? false,
    payType: (existing?.pay_type as 'Salary' | 'Hourly') ?? 'Salary',
  })
  const [effectiveFrom, setEffFrom] = useState(existing?.effective_from ?? new Date().toISOString().slice(0, 10))
  const mut = useMutation({
    mutationFn: () => upsertCompensation(userId, {
      frequency: calc.freq, pay_type: calc.payType,
      entered_amount: parseFloat(calc.entered) || 0,
      is_after_tax: calc.afterTax, effective_from: effectiveFrom,
    }),
    onSuccess: onSaved,
  })
  const valid = (parseFloat(calc.entered) || 0) > 0

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-[#111] rounded-2xl border border-[#ebebeb] dark:border-[#222] w-full max-w-xl my-4 p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="text-[16px] font-bold text-[#111] dark:text-white">Compensation — {userName}</p>
          <p className="text-[12px] text-[#888]">Configure salary and frequency. Toggle "After Tax" to enter desired net pay.</p>
        </div>
        <div className="flex gap-2">
          {(['Salary', 'Hourly'] as const).map((t) => (
            <button key={t} onClick={() => setCalc((s) => ({ ...s, payType: t }))}
              className={clsx('flex-1 py-2 rounded-xl text-[12px] font-bold border transition-colors',
                calc.payType === t ? 'bg-[#111] dark:bg-white text-white dark:text-[#111] border-[#111] dark:border-white' : 'border-[#e0e0e0] dark:border-[#333] text-[#888] hover:text-[#111] dark:hover:text-white')}>
              {t}
            </button>
          ))}
        </div>
        <SalaryCalc state={calc} onChange={setCalc} />
        <div>
          <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">Effective From</label>
          <input type="date" value={effectiveFrom} onChange={(e) => setEffFrom(e.target.value)}
            className="w-full px-3 py-2 text-[13px] bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none" />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[13px] font-bold text-[#555] dark:text-[#aaa] hover:bg-[#f4f4f4] dark:hover:bg-[#1a1a1a] transition-colors">Cancel</button>
          <button onClick={() => mut.mutate()} disabled={!valid || mut.isPending}
            className="flex-1 px-4 py-2.5 bg-[#111] dark:bg-white text-white dark:text-[#111] rounded-xl text-[13px] font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
            {mut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Save Compensation
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Tax Configuration
// ═══════════════════════════════════════════════════════════════════════════════

function TaxConfigTab() {
  const qc = useQueryClient()
  const [viewSetId, setViewSetId] = useState<string | null>(null)
  const [showNewSet, setShowNewSet] = useState(false)
  const [editRule, setEditRule] = useState<TaxRule | null>(null)
  const { data: sets } = useQuery({ queryKey: ['tax-rule-sets'], queryFn: getTaxRuleSets })
  const activeSet = (sets ?? []).find((s) => s.is_active)
  const currentSetId = viewSetId ?? activeSet?.id ?? null
  const { data: rules } = useQuery({ queryKey: ['tax-rules', currentSetId], queryFn: () => getTaxRules(currentSetId!), enabled: !!currentSetId })
  const activateMut = useMutation({ mutationFn: activateTaxRuleSet, onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-rule-sets'] }) })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <p className="text-[13px] font-bold text-[#111] dark:text-white">Tax Rule Sets</p>
          <select value={currentSetId ?? ''} onChange={(e) => setViewSetId(e.target.value || null)}
            className="px-3 py-1.5 text-[12px] font-semibold bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none">
            {(sets ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}{s.is_active ? ' ✓' : ''}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          {currentSetId && !(sets ?? []).find((s) => s.id === currentSetId)?.is_active && (
            <button onClick={() => activateMut.mutate(currentSetId)} disabled={activateMut.isPending}
              className="px-3 py-1.5 text-[12px] font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors">
              Activate
            </button>
          )}
          <button onClick={() => setShowNewSet(true)}
            className="px-3 py-1.5 text-[12px] font-bold border border-[#e0e0e0] dark:border-[#333] text-[#555] dark:text-[#aaa] rounded-xl hover:bg-[#f4f4f4] dark:hover:bg-[#1a1a1a] transition-colors">
            + New Rule Set
          </button>
        </div>
      </div>

      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
        <Info size={14} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
          All tax rates are stored in the database — <strong>no values are hardcoded</strong>. Rates below are JA FY 2025/26 defaults.
          Create a new rule set for future fiscal years; activate it when ready. Each payroll run records which set was active at generation time.
        </p>
      </div>

      {currentSetId && (
        <Card className="overflow-hidden">
          <table className="w-full text-[12px]">
            <thead><tr className="border-b border-[#f0f0f0] dark:border-[#222]">
              <Th>Type</Th><Th>Rate</Th><Th>Annual Cap / Threshold</Th><Th>Upper Limit</Th><Th>Basis</Th><Th>Applies To</Th><th />
            </tr></thead>
            <tbody>
              {(rules ?? []).map((rule) => (
                <tr key={rule.id} className="border-b border-[#f8f8f8] dark:border-[#1a1a1a]">
                  <td className="px-4 py-3">
                    <p className="font-bold text-[#111] dark:text-white">{TAX_LABELS[rule.tax_type] ?? rule.tax_type}</p>
                    <p className="text-[10px] text-[#bbb]">{TAX_INFO[rule.tax_type]}</p>
                  </td>
                  <td className="px-4 py-3 font-black tabular-nums">{(rule.rate * 100).toFixed(4)}%</td>
                  <td className="px-4 py-3 tabular-nums text-[#555] dark:text-[#aaa]">
                    {rule.annual_cap != null ? `$${fmt(rule.annual_cap)} cap` : rule.threshold != null ? `$${fmt(rule.threshold)} threshold` : '—'}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[#555] dark:text-[#aaa]">{rule.upper_limit != null ? `$${fmt(rule.upper_limit)}` : '—'}</td>
                  <td className="px-4 py-3 text-[#888]">{rule.basis}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', {
                      'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400': rule.applies_to === 'employee',
                      'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400': rule.applies_to === 'employer',
                    })}>{rule.applies_to}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditRule(rule)} className="p-1.5 rounded-lg hover:bg-[#f0f0f0] dark:hover:bg-[#222] transition-colors">
                      <Edit2 size={11} className="text-[#888]" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {editRule && (
        <EditRuleModal rule={editRule} onClose={() => setEditRule(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['tax-rules', currentSetId] }); setEditRule(null) }} />
      )}
      {showNewSet && (
        <NewSetModal onClose={() => setShowNewSet(false)}
          onCreated={(s) => { qc.invalidateQueries({ queryKey: ['tax-rule-sets'] }); setViewSetId(s.id); setShowNewSet(false) }} />
      )}
    </div>
  )
}

function EditRuleModal({ rule, onClose, onSaved }: { rule: TaxRule; onClose: () => void; onSaved: () => void }) {
  const [rate, setRate] = useState(String(rule.rate * 100))
  const [threshold, setThreshold] = useState(rule.threshold != null ? String(rule.threshold) : '')
  const [upper, setUpper] = useState(rule.upper_limit != null ? String(rule.upper_limit) : '')
  const [cap, setCap] = useState(rule.annual_cap != null ? String(rule.annual_cap) : '')
  const mut = useMutation({
    mutationFn: () => upsertTaxRule(rule.rule_set_id, {
      tax_type: rule.tax_type, rate: parseFloat(rate) / 100,
      threshold: threshold ? parseFloat(threshold) : null,
      upper_limit: upper ? parseFloat(upper) : null,
      annual_cap: cap ? parseFloat(cap) : null,
      basis: rule.basis, applies_to: rule.applies_to,
    }),
    onSuccess: onSaved,
  })
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#111] rounded-2xl border border-[#ebebeb] dark:border-[#222] w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-[15px] font-bold text-[#111] dark:text-white">Edit — {TAX_LABELS[rule.tax_type]}</p>
        <div className="grid grid-cols-2 gap-3">
          {[['Rate (%)', rate, setRate], ...(rule.annual_cap != null ? [['Annual Cap ($)', cap, setCap]] : []), ...(rule.threshold != null ? [['Threshold ($)', threshold, setThreshold]] : []), ...(rule.upper_limit != null ? [['Upper Limit ($)', upper, setUpper]] : [])].map(([label, val, setter]) => (
            <div key={label as string}>
              <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">{label}</label>
              <input type="number" step="any" value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                className="w-full px-3 py-2 text-[13px] bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none" />
            </div>
          ))}
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[13px] font-bold text-[#555] dark:text-[#aaa] hover:bg-[#f4f4f4] dark:hover:bg-[#1a1a1a] transition-colors">Cancel</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending}
            className="flex-1 px-4 py-2.5 bg-[#111] dark:bg-white text-white dark:text-[#111] rounded-xl text-[13px] font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity">
            {mut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save
          </button>
        </div>
      </div>
    </div>
  )
}

function NewSetModal({ onClose, onCreated }: { onClose: () => void; onCreated: (s: TaxRuleSet) => void }) {
  const [name, setName] = useState('')
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10))
  const mut = useMutation({ mutationFn: () => createTaxRuleSet({ name, effective_from: from }), onSuccess: onCreated })
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#111] rounded-2xl border border-[#ebebeb] dark:border-[#222] w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-[15px] font-bold text-[#111] dark:text-white">New Tax Rule Set</p>
        <div>
          <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="JA FY 2026/27"
            className="w-full px-3 py-2 text-[13px] bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">Effective From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="w-full px-3 py-2 text-[13px] bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none" />
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[13px] font-bold text-[#555] dark:text-[#aaa] hover:bg-[#f4f4f4] dark:hover:bg-[#1a1a1a] transition-colors">Cancel</button>
          <button onClick={() => mut.mutate()} disabled={!name || mut.isPending}
            className="flex-1 px-4 py-2.5 bg-[#111] dark:bg-white text-white dark:text-[#111] rounded-xl text-[13px] font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity">
            {mut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Create
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Settings
// ═══════════════════════════════════════════════════════════════════════════════

function SettingsTab() {
  const qc = useQueryClient()
  const { data: cfg, isLoading } = useQuery({ queryKey: ['payroll-config'], queryFn: getPayrollConfig })
  const [freq, setFreq]               = useState<PayFrequency>('Monthly')
  const [currency, setCurrency]       = useState('JMD')
  const [otMultiplier, setOtMultiplier]     = useState('1.50')
  const [dblMultiplier, setDblMultiplier]   = useState('2.00')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (cfg) {
      setFreq(cfg.frequency as PayFrequency)
      setCurrency(cfg.currency)
      setOtMultiplier(String(cfg.overtime_multiplier ?? 1.5))
      setDblMultiplier(String(cfg.double_time_multiplier ?? 2.0))
    }
  }, [cfg])

  const mut = useMutation({
    mutationFn: () => upsertPayrollConfig({
      frequency: freq, currency,
      overtime_multiplier: parseFloat(otMultiplier) || 1.5,
      double_time_multiplier: parseFloat(dblMultiplier) || 2.0,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-config'] }); setSaved(true); setTimeout(() => setSaved(false), 2000) },
  })

  if (isLoading) return <Loading />

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <p className="text-[13px] font-bold text-[#111] dark:text-white">Payroll Settings</p>
        <p className="text-[11px] text-[#888]">Company-wide defaults for new payroll runs.</p>
      </div>
      <Card className="p-6 space-y-5">
        <div>
          <label className="block text-[12px] font-bold text-[#555] dark:text-[#aaa] mb-2">Default Pay Frequency</label>
          <div className="grid grid-cols-3 gap-2">
            {PAY_FREQUENCIES.map((f) => (
              <button key={f} onClick={() => setFreq(f)}
                className={clsx('py-2.5 px-3 rounded-xl text-[12px] font-bold border transition-colors',
                  freq === f ? 'bg-[#111] dark:bg-white text-white dark:text-[#111] border-[#111] dark:border-white' : 'border-[#e0e0e0] dark:border-[#333] text-[#888] hover:text-[#111] dark:hover:text-white')}>
                <p>{FREQ_LABEL[f]}</p>
                <p className="text-[9px] font-normal opacity-60">{FREQUENCY_PERIODS[f]}× / year</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-bold text-[#555] dark:text-[#aaa] mb-2">Currency</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-3 py-2 text-[13px] font-semibold bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none">
            <option value="JMD">JMD — Jamaican Dollar</option>
            <option value="USD">USD — US Dollar</option>
          </select>
        </div>

        {/* Overtime multipliers */}
        <div>
          <label className="block text-[12px] font-bold text-[#555] dark:text-[#aaa] mb-1">Overtime Multipliers</label>
          <p className="text-[11px] text-[#aaa] mb-3">
            Formula: <code className="text-blue-500 font-mono">OT Pay = Hours × Hourly Rate × Multiplier</code>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#888] dark:text-[#666] mb-1.5">
                Standard Overtime
              </label>
              <div className="relative">
                <input
                  type="number" step="0.01" min="1" max="5"
                  value={otMultiplier}
                  onChange={(e) => setOtMultiplier(e.target.value)}
                  className="w-full px-3 py-2 pr-10 text-[13px] font-bold bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#111] dark:focus:ring-white"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#aaa]">×</span>
              </div>
              <p className="text-[10px] text-[#bbb] mt-1">
                JA default 1.5× — weekday OT beyond 8h/day or 40h/week
              </p>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#888] dark:text-[#666] mb-1.5">
                Double Time
              </label>
              <div className="relative">
                <input
                  type="number" step="0.01" min="1" max="5"
                  value={dblMultiplier}
                  onChange={(e) => setDblMultiplier(e.target.value)}
                  className="w-full px-3 py-2 pr-10 text-[13px] font-bold bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#111] dark:focus:ring-white"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#aaa]">×</span>
              </div>
              <p className="text-[10px] text-[#bbb] mt-1">
                JA default 2.0× — public holidays &amp; contractual rest day
              </p>
            </div>
          </div>

          {/* Live preview */}
          {parseFloat(otMultiplier) > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              {[
                { label: 'Example at $500/hr, 3h OT', hours: 3, rate: 500, mult: parseFloat(otMultiplier), tag: 'Standard' },
                { label: 'Example at $500/hr, 3h DT', hours: 3, rate: 500, mult: parseFloat(dblMultiplier), tag: 'Double time' },
              ].map(({ label, hours, rate, mult, tag }) => (
                <div key={tag} className="px-3 py-2 bg-[#f8f8f8] dark:bg-[#1a1a1a] rounded-xl">
                  <p className="text-[#aaa] mb-0.5">{label}</p>
                  <p className="font-mono font-bold text-[#111] dark:text-white">
                    ${hours} × ${rate} × {mult}× = <span className="text-emerald-600 dark:text-emerald-400">${fmt(hours * rate * mult, 2)}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Formula reference */}
        <div className="bg-[#fafafa] dark:bg-[#0d0d0d] border border-[#ebebeb] dark:border-[#1e1e1e] rounded-xl p-4 space-y-1.5">
          <p className="text-[10px] font-bold text-[#888] uppercase tracking-widest mb-2">Salary Conversion Formulas</p>
          {[['Weekly × 52',        '= Annual'],['Bi-Weekly × 26',    '= Annual'],
            ['Semi-Monthly × 24',  '= Annual'],['Monthly × 12',      '= Annual'],
            ['Annual ÷ 260',       '= Daily rate (52wks × 5days)'],
            ['Annual ÷ 2080',      '= Hourly rate (52wks × 5days × 8hrs)'],
          ].map(([f, r]) => (
            <div key={f} className="flex items-center gap-2 text-[11px]">
              <code className="text-blue-600 dark:text-blue-400 font-mono">{f}</code>
              <span className="text-[#aaa]">{r}</span>
            </div>
          ))}
        </div>

        <button onClick={() => mut.mutate()} disabled={mut.isPending}
          className={clsx('w-full py-2.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all',
            saved ? 'bg-emerald-600 text-white' : 'bg-[#111] dark:bg-white text-white dark:text-[#111] hover:opacity-90')}>
          {mut.isPending ? <Loader2 size={13} className="animate-spin" /> : saved ? <><Check size={13} /> Saved!</> : 'Save Settings'}
        </button>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Analytics
// ═══════════════════════════════════════════════════════════════════════════════

function AnalyticsTab() {
  const { data: a, isLoading } = useQuery({ queryKey: ['payroll-analytics'], queryFn: getPayrollAnalytics })
  if (isLoading) return <Loading />
  if (!a) return <Empty msg="No payroll data available yet." />
  const analytics = a as PayrollAnalytics
  const maxGross = Math.max(...(analytics.monthly_costs?.map((m) => m.total_gross) ?? [1]), 1)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Gross',     v: `$${fmt(analytics.total_gross)}`,   icon: DollarSign },
          { label: 'Total Net',       v: `$${fmt(analytics.total_net)}`,      icon: CheckCircle },
          { label: 'Headcount',       v: String(analytics.head_count),         icon: Users },
          { label: 'Avg Per Employee',v: `$${fmt(analytics.avg_salary)}`,      icon: TrendingUp },
        ].map(({ label, v, icon: Icon }) => (
          <Card key={label} className="p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#f4f4f4] dark:bg-[#1a1a1a] flex items-center justify-center flex-shrink-0">
              <Icon size={14} className="text-[#555] dark:text-[#aaa]" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#aaa]">{label}</p>
              <p className="text-[17px] font-black text-[#111] dark:text-white tabular-nums">{v}</p>
            </div>
          </Card>
        ))}
      </div>

      {(analytics.monthly_costs ?? []).length > 0 && (
        <Card className="p-5">
          <p className="text-[12px] font-bold text-[#111] dark:text-white mb-4">Monthly Payroll Cost (Last 12 Runs)</p>
          <div className="flex items-end gap-2" style={{ height: 160 }}>
            {analytics.monthly_costs.map((m) => {
              const pct = (m.total_gross / maxGross) * 100
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="hidden group-hover:block absolute -top-7 bg-[#111] dark:bg-white text-white dark:text-[#111] text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap z-10">
                    ${fmt(m.total_gross)}
                  </div>
                  <div className="w-full rounded-t-md bg-blue-500 dark:bg-blue-600 min-h-[4px]" style={{ height: `${pct * 1.4}px` }} />
                  <span className="text-[9px] font-bold text-[#bbb]">{m.month.slice(5)}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <p className="text-[12px] font-bold text-[#111] dark:text-white mb-4">Deduction Breakdown (Latest Run)</p>
        <div className="space-y-3">
          {[
            { l: 'NIS',           v: analytics.total_nis,    c: '#3b82f6' },
            { l: 'NHT',           v: analytics.total_nht,    c: '#8b5cf6' },
            { l: 'Education Tax', v: analytics.total_edtax,  c: '#f59e0b' },
            { l: 'PAYE',          v: analytics.total_paye,   c: '#ef4444' },
          ].map(({ l, v, c }) => {
            const pct = analytics.total_gross > 0 ? v / analytics.total_gross * 100 : 0
            return (
              <div key={l} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c }} />
                <span className="w-28 text-[12px] font-semibold text-[#555] dark:text-[#aaa]">{l}</span>
                <div className="flex-1 h-2 rounded-full bg-[#f0f0f0] dark:bg-[#222] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(pct * 8, 100)}%`, backgroundColor: c }} />
                </div>
                <span className="w-20 text-right text-[12px] font-bold tabular-nums text-[#111] dark:text-white">${fmt(v)}</span>
                <span className="w-10 text-right text-[11px] text-[#aaa] tabular-nums">{fmtPct(pct)}</span>
              </div>
            )
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-[#f0f0f0] dark:border-[#222] grid grid-cols-2 gap-4 text-[12px]">
          <div>
            <p className="text-[#aaa]">Total Employer Cost</p>
            <p className="text-[15px] font-black text-[#111] dark:text-white tabular-nums">${fmt(analytics.total_employer_cost)}</p>
          </div>
          <div>
            <p className="text-[#aaa]">Net / Gross Ratio</p>
            <p className="text-[15px] font-black text-[#111] dark:text-white tabular-nums">
              {analytics.total_gross > 0 ? fmtPct(analytics.total_net / analytics.total_gross * 100) : '—'}
            </p>
          </div>
        </div>
      </Card>

      {/* AI insights callout */}
      <Card className="p-5 border-dashed">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
            <Zap size={14} className="text-white" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-[#111] dark:text-white">AI Payroll Insights (Roadmap)</p>
            <p className="text-[12px] text-[#888] mt-1 leading-relaxed">
              Planned: overtime anomaly detection · labor cost % forecasting · PAYE threshold breach alerts ·
              NIS cap warnings · month-over-month variance analysis · payroll cost as % of revenue.
              Insights are generated per run automatically once the AI engine is connected.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Audit Log
// ═══════════════════════════════════════════════════════════════════════════════

function AuditTab() {
  const { data: entries, isLoading } = useQuery({ queryKey: ['payroll-audit'], queryFn: getPayrollAuditLog })
  const ACTION_CLR: Record<string, string> = {
    created: 'text-emerald-600 dark:text-emerald-400', updated: 'text-blue-600 dark:text-blue-400',
    upserted: 'text-blue-600 dark:text-blue-400', Approved: 'text-emerald-600 dark:text-emerald-400',
    Locked: 'text-purple-600 dark:text-purple-400', overridden: 'text-amber-600 dark:text-amber-400',
    activated: 'text-green-600 dark:text-green-400', deleted: 'text-red-600 dark:text-red-400',
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-bold text-[#111] dark:text-white">Audit Log</p>
        <p className="text-[11px] text-[#888]">Last 100 events · Immutable · Append-only</p>
      </div>
      {isLoading ? <Loading /> : (
        <Card className="overflow-hidden">
          <table className="w-full text-[12px]">
            <thead><tr className="border-b border-[#f0f0f0] dark:border-[#222]">
              <Th>Time</Th><Th>Actor</Th><Th>Entity</Th><Th>Action</Th><Th>Reason</Th>
            </tr></thead>
            <tbody>
              {(entries ?? []).map((e) => (
                <tr key={e.id} className="border-b border-[#f8f8f8] dark:border-[#1a1a1a]">
                  <td className="px-4 py-3 text-[#888] whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-semibold text-[#111] dark:text-white">{e.actor_name || '—'}</td>
                  <td className="px-4 py-3"><span className="font-mono text-[10px] bg-[#f4f4f4] dark:bg-[#1a1a1a] px-1.5 py-0.5 rounded text-[#555] dark:text-[#aaa]">{e.entity_type}</span></td>
                  <td className="px-4 py-3"><span className={clsx('font-bold', ACTION_CLR[e.action] ?? 'text-[#555] dark:text-[#aaa]')}>{e.action}</span></td>
                  <td className="px-4 py-3 text-[#888]">{e.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(entries ?? []).length === 0 && <Empty msg="No audit events yet." />}
        </Card>
      )}
      <div className="bg-[#fafafa] dark:bg-[#0d0d0d] border border-[#ebebeb] dark:border-[#1e1e1e] rounded-xl p-4">
        <p className="text-[10px] font-bold text-[#888] uppercase tracking-widest mb-2">What Is Tracked</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-[#888]">
          {['Salary changes (before/after)', 'Tax rate modifications', 'Payroll run transitions', 'Manual line overrides', 'Tax rule set activations', 'Payroll config changes'].map((item) => (
            <div key={item} className="flex items-start gap-1.5"><Check size={10} className="text-emerald-500 flex-shrink-0 mt-0.5" />{item}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════════

type Tab = 'runs' | 'compensation' | 'tax' | 'settings' | 'analytics' | 'audit'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'runs',         label: 'Payroll Runs',  icon: Play },
  { id: 'compensation', label: 'Compensation',   icon: Banknote },
  { id: 'tax',          label: 'Tax Config',     icon: Shield },
  { id: 'settings',     label: 'Settings',       icon: Settings },
  { id: 'analytics',    label: 'Analytics',      icon: BarChart2 },
  { id: 'audit',        label: 'Audit Log',      icon: FileText },
]

export function PayrollPage() {
  const [tab, setTab] = useState<Tab>('runs')
  const { data: analytics } = useQuery({ queryKey: ['payroll-analytics'], queryFn: getPayrollAnalytics })
  const a = analytics as PayrollAnalytics | undefined

  return (
    <div className="px-5 py-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-[20px] font-black text-[#111] dark:text-white">Payroll</h1>
          <p className="text-[12px] text-[#888] mt-0.5">JA statutory deductions · DB-driven tax engine · Full audit trail</p>
        </div>
        {a && a.total_gross > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[#f4f4f4] dark:bg-[#1a1a1a] border border-[#ebebeb] dark:border-[#222] rounded-xl">
            <DollarSign size={13} className="text-[#888]" />
            <span className="text-[12px] font-bold text-[#111] dark:text-white">${fmt(a.total_gross)} gross · {a.head_count} employees</span>
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

      {tab === 'runs'         && <RunsTab />}
      {tab === 'compensation' && <CompensationTab />}
      {tab === 'tax'          && <TaxConfigTab />}
      {tab === 'settings'     && <SettingsTab />}
      {tab === 'analytics'    && <AnalyticsTab />}
      {tab === 'audit'        && <AuditTab />}
    </div>
  )
}
