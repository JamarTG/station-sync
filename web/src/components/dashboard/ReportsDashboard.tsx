import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronUp, Plus, Search, X } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { SetupBanner } from './SetupBanner'
import { useAuth } from '../../lib/authContext'
import { useOpenShift, useShiftDeposits, useTanks, useBranches, useShiftTankLogs, useAllTimeFuelRankings, useShiftsInRange, useProducts, useIssues } from '../../hooks/useApi'
import type { Deposit } from '../../lib/api'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const fmtJ = (n: number) => `J$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

function ordinal(n: number) {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

const MONTHLY_LABELS      = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHLY_SALES       = [840000, 920000, 780000, 1100000, 990000, 1250000, 1180000, 1340000, 1290000, 1050000, 1420000, 1580000]
const MONTHLY_EXPENDITURE = [120000, 180000,  95000,  220000, 175000,  310000,  280000,  390000,  340000,  260000,  420000,  480000]

const WEEKLY_LABELS      = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKLY_SALES       = [182000, 210000, 195000, 230000, 278000, 310000, 145000]
const WEEKLY_EXPENDITURE = [ 28000,  35000,  22000,  41000,  38000,  52000,  18000]


const QUICK_ACTIONS = ['Invite member', 'Add expense', 'Make an announcement']

function ActionPill({ label }: { label: string }) {
  return (
    <button className="px-4 py-2 border border-[#ddd] rounded-xl text-[12px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors whitespace-nowrap flex-shrink-0">
      {label}
    </button>
  )
}

function InsightCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#ebebeb] p-5 flex flex-col gap-2 min-w-0">
      <p className="text-[10px] font-bold tracking-widest text-[#aaa] uppercase leading-none truncate">{label}</p>
      <p className="text-[26px] font-black leading-none tracking-tight text-[#111]">{value}</p>
      {sub && <p className="text-[11px] font-medium text-[#bbb] leading-none">{sub}</p>}
    </div>
  )
}

function CardHeader({ title, subtitle, showActions }: { title: string; subtitle: string; showActions?: boolean }) {
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
      <p className="text-[13px] font-bold text-[#111]">
        {title} <span className="font-medium text-[#aaa]">| {subtitle}</span>
      </p>
      {showActions && (
        searching ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="h-7 px-2.5 border border-[#ddd] rounded-lg text-[13px] text-[#333] placeholder-[#bbb] outline-none focus:border-[#aaa] w-36"
            />
            <button
              onClick={() => { setSearching(false); setSearchQuery('') }}
              className="w-7 h-7 border border-[#ddd] rounded-lg flex items-center justify-center hover:bg-[#f4f4f4] transition-colors text-[#888]"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button className="flex items-center border border-[#ddd] rounded-lg overflow-hidden">
              <span
                onClick={() => setSortDir('desc')}
                className={`px-2 py-1.5 hover:bg-[#f4f4f4] border-r border-[#ddd] transition-colors cursor-pointer ${sortDir === 'desc' ? 'bg-[#f4f4f4]' : ''}`}
              >
                <ChevronDown size={12} className="text-[#666]" />
              </span>
              <span
                onClick={() => setSortDir('asc')}
                className={`px-2 py-1.5 hover:bg-[#f4f4f4] transition-colors cursor-pointer ${sortDir === 'asc' ? 'bg-[#f4f4f4]' : ''}`}
              >
                <ChevronUp size={12} className="text-[#666]" />
              </span>
            </button>
            <button className="w-7 h-7 border border-[#ddd] rounded-lg flex items-center justify-center hover:bg-[#f4f4f4] transition-colors text-[#666]">
              <Plus size={13} />
            </button>
            <button
              onClick={() => setSearching(true)}
              className="w-7 h-7 border border-[#ddd] rounded-lg flex items-center justify-center hover:bg-[#f4f4f4] transition-colors text-[#666]"
            >
              <Search size={13} />
            </button>
          </div>
        )
      )}
    </div>
  )
}

function EmptyRow({ msg }: { msg: string }) {
  return (
    <div className="px-5 py-6 flex items-center justify-center">
      <p className="text-[12px] font-medium text-[#ccc]">{msg}</p>
    </div>
  )
}

function StaffLeaderboard({ fuelRows, fuelTotal }: {
  fuelRows: [string, number][]
  fuelTotal: number
}) {
  const [tab, setTab] = useState<'fuel' | 'cstore'>('fuel')
  const rows = tab === 'fuel' ? fuelRows : []
  const total = tab === 'fuel' ? fuelTotal : 0

  return (
    <div className="bg-white rounded-2xl border border-[#ebebeb] p-5 flex flex-col h-[450px]">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <p className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase">Staff Leaderboard</p>
        <div className="flex items-center border border-[#ddd] rounded-lg overflow-hidden">
          <button
            onClick={() => setTab('fuel')}
            className={`px-3 py-1.5 text-[11px] font-bold transition-colors ${tab === 'fuel' ? 'bg-[#111] text-white' : 'text-[#888] hover:bg-[#f4f4f4]'}`}
          >
            Fuel
          </button>
          <button
            onClick={() => setTab('cstore')}
            className={`px-3 py-1.5 text-[11px] font-bold transition-colors border-l border-[#ddd] ${tab === 'cstore' ? 'bg-[#111] text-white' : 'text-[#888] hover:bg-[#f4f4f4]'}`}
          >
            C. Store
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
      {rows.length === 0 ? (
        <div className="h-full flex items-center justify-center">
          <p className="text-[12px] font-medium text-[#ccc]">No data available</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map(([name, amount], i) => {
            const pct = total > 0 ? ((amount / total) * 100).toFixed(1) : '0.0'
            return (
              <div key={name} className="flex items-center justify-between bg-[#f9f9f9] rounded-2xl py-4 px-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold tracking-widest text-[#ccc] uppercase">{ordinal(i + 1)}</span>
                  <span className="text-[22px] font-black text-[#111] tracking-tight leading-none">{name.split(' ')[0]}</span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[18px] font-bold text-[#333] leading-none">{pct}%</span>
                  <span className="text-[11px] font-semibold text-[#aaa]">{fmtJ(amount)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      </div>
    </div>
  )
}

function CashPanel({ cashDeposits }: { cashDeposits: Deposit[] }) {
  const [tab, setTab] = useState<'fuel' | 'cstore'>('fuel')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const visible = tab === 'fuel' ? cashDeposits : []

  return (
    <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col h-[400px]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0] flex-shrink-0">
        <p className="text-[13px] font-bold text-[#111]">
          Cash <span className="font-medium text-[#aaa]">| Deposits</span>
        </p>
        {searching ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="h-7 px-2.5 border border-[#ddd] rounded-lg text-[13px] text-[#333] placeholder-[#bbb] outline-none focus:border-[#aaa] w-36"
            />
            <button
              onClick={() => { setSearching(false); setSearchQuery('') }}
              className="w-7 h-7 border border-[#ddd] rounded-lg flex items-center justify-center hover:bg-[#f4f4f4] transition-colors text-[#888]"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <div className="flex items-center border border-[#ddd] rounded-lg overflow-hidden">
              <button
                onClick={() => tab === 'fuel' ? setTab('cstore') : setTab('fuel')}
                className="flex items-center"
              >
                <span onClick={(e) => { e.stopPropagation(); setTab('fuel') }} className={`px-3 py-1.5 text-[11px] font-bold transition-colors ${tab === 'fuel' ? 'bg-[#111] text-white' : 'text-[#888] hover:bg-[#f4f4f4]'}`}>
                  Fuel
                </span>
                <span onClick={(e) => { e.stopPropagation(); setTab('cstore') }} className={`px-3 py-1.5 text-[11px] font-bold transition-colors border-l border-[#ddd] ${tab === 'cstore' ? 'bg-[#111] text-white' : 'text-[#888] hover:bg-[#f4f4f4]'}`}>
                  C. Store
                </span>
              </button>
            </div>
            <button className="flex items-center border border-[#ddd] rounded-lg overflow-hidden">
              <span onClick={() => setSortDir('desc')} className={`px-2 py-1.5 hover:bg-[#f4f4f4] border-r border-[#ddd] transition-colors cursor-pointer ${sortDir === 'desc' ? 'bg-[#f4f4f4]' : ''}`}>
                <ChevronDown size={12} className="text-[#666]" />
              </span>
              <span onClick={() => setSortDir('asc')} className={`px-2 py-1.5 hover:bg-[#f4f4f4] transition-colors cursor-pointer ${sortDir === 'asc' ? 'bg-[#f4f4f4]' : ''}`}>
                <ChevronUp size={12} className="text-[#666]" />
              </span>
            </button>
            <button
              onClick={() => setSearching(true)}
              className="w-7 h-7 border border-[#ddd] rounded-lg flex items-center justify-center hover:bg-[#f4f4f4] transition-colors text-[#666]"
            >
              <Search size={13} />
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        {visible.length === 0 ? (
          <div className="px-5 py-6 flex items-center justify-center h-full">
            <p className="text-[12px] font-medium text-[#ccc]">{tab === 'fuel' ? 'No cash deposits' : 'No data available'}</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {visible.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-5 py-3 border-b border-[#f8f8f8]">
                <p className="text-[12px] font-semibold text-[#111]">{d.attendant_name}</p>
                <p className="text-[12px] font-semibold text-[#444]">{fmtJ(d.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-5 py-3 border-t border-[#f0f0f0] flex-shrink-0">
        <p className="text-[11px] font-medium text-[#aaa]">Total</p>
        <p className={`text-[13px] font-bold ${visible.length > 0 ? 'text-[#111]' : 'text-[#ccc]'}`}>
          {fmtJ(visible.reduce((s, d) => s + d.amount, 0))}
        </p>
      </div>
    </div>
  )
}

function SalesPanel({ deposits }: { deposits: Deposit[] }) {
  const [tab, setTab] = useState<'fuel' | 'cstore'>('fuel')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const rows = [...deposits.filter((d) => d.type !== 'Expenditure')]
    .sort((a, b) => sortDir === 'desc'
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-JM', { month: 'short', day: 'numeric' })

  return (
    <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col h-[400px]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0] flex-shrink-0">
        <p className="text-[13px] font-bold text-[#111]">
          Sales <span className="font-medium text-[#aaa]">| {tab === 'fuel' ? 'Service Station' : 'Convenience Store'}</span>
        </p>
        <div className="flex items-center gap-1">
          <div className="flex items-center border border-[#ddd] rounded-lg overflow-hidden">
            <button onClick={() => setTab('fuel')} className={`px-3 py-1.5 text-[11px] font-bold transition-colors ${tab === 'fuel' ? 'bg-[#111] text-white' : 'text-[#888] hover:bg-[#f4f4f4]'}`}>Fuel</button>
            <button onClick={() => setTab('cstore')} className={`px-3 py-1.5 text-[11px] font-bold transition-colors border-l border-[#ddd] ${tab === 'cstore' ? 'bg-[#111] text-white' : 'text-[#888] hover:bg-[#f4f4f4]'}`}>C. Store</button>
          </div>
          <button className="flex items-center border border-[#ddd] rounded-lg overflow-hidden">
            <span onClick={() => setSortDir('desc')} className={`px-2 py-1.5 hover:bg-[#f4f4f4] border-r border-[#ddd] transition-colors cursor-pointer ${sortDir === 'desc' ? 'bg-[#f4f4f4]' : ''}`}>
              <ChevronDown size={12} className="text-[#666]" />
            </span>
            <span onClick={() => setSortDir('asc')} className={`px-2 py-1.5 hover:bg-[#f4f4f4] transition-colors cursor-pointer ${sortDir === 'asc' ? 'bg-[#f4f4f4]' : ''}`}>
              <ChevronUp size={12} className="text-[#666]" />
            </span>
          </button>
        </div>
      </div>
      <div className="grid px-5 py-2 border-b border-[#f8f8f8] flex-shrink-0" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
        {['Attendant', 'Type', 'Date', 'Amount'].map((c) => (
          <p key={c} className="text-[10px] font-bold tracking-widest text-[#ccc] uppercase">{c}</p>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        {tab === 'cstore' || rows.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[12px] font-medium text-[#ccc]">{tab === 'cstore' ? 'No data available' : 'No sales recorded yet'}</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {rows.map((d) => (
              <div key={d.id} className="grid px-5 py-3 border-b border-[#f8f8f8]" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
                <p className="text-[12px] font-semibold text-[#111] truncate">{d.attendant_name}</p>
                <p className="text-[12px] font-semibold text-[#666]">{d.type}</p>
                <p className="text-[12px] font-semibold text-[#666]">{fmtDate(d.created_at)}</p>
                <p className="text-[12px] font-semibold text-[#444]">{fmtJ(d.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ColHead({ cols }: { cols: string[] }) {
  return (
    <div className="grid px-5 py-2 border-b border-[#f8f8f8]" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>
      {cols.map((c) => (
        <p key={c} className="text-[10px] font-bold tracking-widest text-[#ccc] uppercase">{c}</p>
      ))}
    </div>
  )
}

function TableRow({ cells, last }: { cells: string[]; last?: boolean }) {
  return (
    <div
      className={`grid px-5 py-3 ${!last ? 'border-b border-[#f8f8f8]' : ''}`}
      style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}
    >
      {cells.map((cell, j) => (
        <p key={j} className={`text-[12px] font-semibold truncate ${j === 0 ? 'text-[#111]' : 'text-[#666]'}`}>{cell}</p>
      ))}
    </div>
  )
}

function FuelSalesChart({
  barData,
  lineData,
  activeIndex = -1,
}: {
  barData: { label: string; value: number }[]
  lineData: number[]
  activeIndex?: number
}) {
  const [hovered, setHovered] = useState<number | null>(null)

  const W = 320, H = 130, padT = 10, padB = 18
  const chartH = H - padT - padB
  const n = barData.length
  const slotW = W / n
  const max = Math.max(...barData.map((d) => d.value), ...lineData, 1)

  const linePts = lineData.map((v, i) => {
    const x = (i + 0.5) * slotW
    const y = padT + chartH * (1 - v / max)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const h = hovered

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {barData.map((d, i) => {
            const bw = slotW * 0.55
            const x = i * slotW + (slotW - bw) / 2
            const bh = Math.max((d.value / max) * chartH, 2)
            const y = padT + chartH - bh
            return (
              <rect
                key={d.label}
                x={x.toFixed(1)} y={y.toFixed(1)}
                width={bw.toFixed(1)} height={bh.toFixed(1)}
                fill={hovered === null ? (activeIndex < 0 || i === activeIndex ? '#111' : '#e8e8e8') : (i === hovered ? '#111' : '#e8e8e8')}
                rx={2}
              />
            )
          })}

          <polyline
            points={linePts}
            fill="none"
            stroke="#aaa"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {lineData.map((v, i) => {
            const x = (i + 0.5) * slotW
            const y = padT + chartH * (1 - v / max)
            return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={2} fill="#aaa" />
          })}

          {barData.map((d, i) => (
            <text
              key={d.label}
              x={((i + 0.5) * slotW).toFixed(1)}
              y={H - 2}
              textAnchor="middle"
              fontSize={7}
              fill="#ccc"
              fontWeight="700"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {d.label.toUpperCase()}
            </text>
          ))}

          {/* Invisible hover zones */}
          {barData.map((_, i) => (
            <rect
              key={`hz-${i}`}
              x={(i * slotW).toFixed(1)} y={0}
              width={slotW.toFixed(1)} height={H}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'default' }}
            />
          ))}
        </svg>

        {/* Tooltip */}
        {hovered !== null && (
          <div
            className="absolute -top-1 pointer-events-none -translate-x-1/2 -translate-y-full"
            style={{ left: `${((hovered! + 0.5) / n) * 100}%` }}
          >
            <div className="bg-[#111] text-white rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap">
              <p className="text-[11px] font-bold">{fmtJ(barData[hovered!].value)}</p>
              {lineData[hovered!] != null && (
                <p className="text-[10px] font-medium text-[#aaa]">Exp: {fmtJ(lineData[hovered!])}</p>
              )}
            </div>
            <div className="w-2 h-2 bg-[#111] rotate-45 mx-auto -mt-1" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-[#111]" />
          <span className="text-[10px] font-semibold text-[#aaa]">Fuel Sales</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-px bg-[#aaa]" />
          <span className="text-[10px] font-semibold text-[#aaa]">Expenditure</span>
        </div>
      </div>
    </div>
  )
}

const TYPE_COLORS: Record<string, string> = {
  Cash:        '#111',
  Card:        '#444',
  Charge:      '#888',
  FX:          '#aaa',
  Advance:     '#bbb',
  Expenditure: '#ddd',
}

const SHIFT_PERIODS = ['AM', 'PM', 'PM2'] as const
type ShiftPeriod = typeof SHIFT_PERIODS[number]

const DEFAULT_SHIFTS = [
  { name: 'Morning', start: '06:00', end: '14:00' },
  { name: 'Evening', start: '14:00', end: '22:00' },
  { name: 'Night',   start: '22:00', end: '06:00' },
]

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function depositInShift(createdAt: string, start: string, end: string): boolean {
  const date = new Date(createdAt)
  const mins = date.getHours() * 60 + date.getMinutes()
  const s = timeToMins(start)
  const e = timeToMins(end)
  return s < e ? mins >= s && mins < e : mins >= s || mins < e  // handles overnight spans
}

function SalesBreakdownCard({ deposits }: { deposits: Deposit[] }) {
  const [period, setPeriod] = useState<ShiftPeriod>('AM')

  function cyclePeriod() {
    setPeriod((p) => SHIFT_PERIODS[(SHIFT_PERIODS.indexOf(p) + 1) % SHIFT_PERIODS.length])
  }

  const savedShifts: { name: string; start: string; end: string }[] = (() => {
    try { return JSON.parse(localStorage.getItem('ss_station_shifts') ?? 'null') ?? [] } catch { return [] }
  })()
  const shiftConfigs = savedShifts.length >= 3 ? savedShifts : DEFAULT_SHIFTS
  const shiftIdx = SHIFT_PERIODS.indexOf(period)
  const activeShift = shiftConfigs[shiftIdx] ?? shiftConfigs[0]

  const shiftDeposits = activeShift.start && activeShift.end
    ? deposits.filter((d) => depositInShift(d.created_at, activeShift.start, activeShift.end))
    : deposits

  const ORDER = ['Cash', 'Card', 'Charge', 'FX', 'Advance', 'Expenditure']

  const totals: Record<string, number> = {}
  for (const d of shiftDeposits) {
    totals[d.type] = (totals[d.type] ?? 0) + d.amount
  }

  const segments = ORDER
    .filter((t) => (totals[t] ?? 0) > 0)
    .map((t) => ({ type: t, amount: totals[t], color: TYPE_COLORS[t] ?? '#eee' }))

  const grand = segments.reduce((s, seg) => s + seg.amount, 0)

  const R = 42, CX = 60, CY = 60
  const circ = 2 * Math.PI * R
  let cum = 0
  const arcs = segments.map((seg) => {
    const pct = grand > 0 ? seg.amount / grand : 0
    const dash = pct * circ
    const dashOffset = circ / 4 - cum
    cum += dash
    return { ...seg, pct, dash, dashOffset }
  })

  const isEmpty = segments.length === 0

  return (
    <div className="bg-white rounded-2xl border border-[#ebebeb] p-5">
      <p className="text-[13px] font-bold text-[#111] mb-0.5">
        Sales Breakdown{' '}
        <button onClick={cyclePeriod} className="font-medium text-[#aaa] hover:text-[#555] transition-colors">
          | {period}
        </button>
      </p>
      <p className="text-[11px] font-medium text-[#bbb] mb-4">
        {activeShift.name} · {activeShift.start} – {activeShift.end}
      </p>
      {isEmpty ? (
        <div className="py-6 flex items-center justify-center">
          <p className="text-[12px] font-medium text-[#ccc]">No deposits for {activeShift.name} shift</p>
        </div>
      ) : (
        <div className="flex items-center gap-5">
          <svg width={120} height={120} viewBox="0 0 120 120" className="flex-shrink-0">
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f0f0f0" strokeWidth={13} />
            {arcs.map((arc, i) => (
              <circle
                key={i}
                cx={CX} cy={CY} r={R}
                fill="none"
                stroke={arc.color}
                strokeWidth={13}
                strokeDasharray={`${arc.dash.toFixed(2)} ${circ.toFixed(2)}`}
                strokeDashoffset={arc.dashOffset.toFixed(2)}
              />
            ))}
            <text x={CX} y={CY - 4} textAnchor="middle" fontSize={11} fontWeight="800" fill="#111" fontFamily="ui-sans-serif,system-ui,sans-serif">
              {fmtJ(grand)}
            </text>
            <text x={CX} y={CY + 9} textAnchor="middle" fontSize={7} fontWeight="700" fill="#bbb" fontFamily="ui-sans-serif,system-ui,sans-serif">TOTAL</text>
          </svg>
          <div className="flex flex-col gap-2.5 flex-1 min-w-0">
            {arcs.map((arc) => (
              <div key={arc.type} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: arc.color }} />
                <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                  <p className="text-[12px] font-semibold text-[#111]">{arc.type}</p>
                  <p className="text-[11px] font-medium text-[#aaa] whitespace-nowrap">{(arc.pct * 100).toFixed(0)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FuelSalesCard() {
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly')
  const isWeekly = view === 'weekly'
  const labels = isWeekly ? WEEKLY_LABELS : MONTHLY_LABELS
  const sales  = isWeekly ? WEEKLY_SALES  : MONTHLY_SALES
  const expend = isWeekly ? WEEKLY_EXPENDITURE : MONTHLY_EXPENDITURE
  const activeIdx = isWeekly ? (new Date().getDay() + 6) % 7 : new Date().getMonth()

  return (
    <div className="bg-white rounded-2xl border border-[#ebebeb] p-5">
      <p className="text-[13px] font-bold text-[#111] mb-0.5">
        Fuel Sales{' '}
        <span className="font-medium text-[#aaa]">|{' '}
          <button
            onClick={() => setView('weekly')}
            className={`transition-colors ${isWeekly ? 'text-[#111] font-semibold' : 'hover:text-[#888]'}`}
          >Weekly</button>
          {' / '}
          <button
            onClick={() => setView('monthly')}
            className={`transition-colors ${!isWeekly ? 'text-[#111] font-semibold' : 'hover:text-[#888]'}`}
          >Monthly</button>
        </span>
      </p>
      <p className="text-[11px] font-medium text-[#bbb] mb-4">
        J$ revenue — {isWeekly ? 'current week' : 'current year'}
      </p>
      <FuelSalesChart
        key={view}
        barData={labels.map((label, i) => ({ label, value: sales[i] }))}
        lineData={expend}
        activeIndex={activeIdx}
      />
    </div>
  )
}

function ProductLeaderboard() {
  const [tab, setTab] = useState<'units' | 'revenue'>('revenue')

  const rows: [string, number][] = []
  const total = rows.reduce((s, [, v]) => s + v, 0)

  return (
    <div className="bg-white rounded-2xl border border-[#ebebeb] p-5 flex flex-col h-[450px]">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <p className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase">Product Leaderboard</p>
        <div className="flex items-center border border-[#ddd] rounded-lg overflow-hidden">
          <button
            onClick={() => setTab('revenue')}
            className={`px-3 py-1.5 text-[11px] font-bold transition-colors ${tab === 'revenue' ? 'bg-[#111] text-white' : 'text-[#888] hover:bg-[#f4f4f4]'}`}
          >
            Revenue
          </button>
          <button
            onClick={() => setTab('units')}
            className={`px-3 py-1.5 text-[11px] font-bold transition-colors border-l border-[#ddd] ${tab === 'units' ? 'bg-[#111] text-white' : 'text-[#888] hover:bg-[#f4f4f4]'}`}
          >
            Units
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        {rows.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-[12px] font-medium text-[#ccc]">No data available</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map(([name, value], i) => {
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
              return (
                <div key={name} className="flex items-center justify-between bg-[#f9f9f9] rounded-2xl py-4 px-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold tracking-widest text-[#ccc] uppercase">{ordinal(i + 1)}</span>
                    <span className="text-[18px] font-black text-[#111] tracking-tight leading-none">{name}</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[18px] font-bold text-[#333] leading-none">{pct}%</span>
                    <span className="text-[11px] font-semibold text-[#aaa]">
                      {tab === 'revenue' ? fmtJ(value) : `${value} units`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function LowStockDashboardPanel() {
  const { data: products = [] } = useProducts()
  const low = products.filter((p) => p.stock_qty < 10).sort((a, b) => a.stock_qty - b.stock_qty)

  return (
    <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col flex-1 min-h-[270px]">
      <div className="px-5 py-4 border-b border-[#f0f0f0] flex-shrink-0">
        <p className="text-[13px] font-bold text-[#111]">
          Products <span className="font-medium text-[#aaa]">| Low Stock</span>
        </p>
      </div>
      {low.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[12px] font-medium text-[#ccc]">All stocked up</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[1fr_auto] gap-3 px-5 py-2.5 border-b border-[#f0f0f0] flex-shrink-0">
            <p className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase">Name</p>
            <p className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase text-right">Stock</p>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            {low.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3 border-b border-[#f8f8f8] last:border-0">
                <p className="text-[12px] font-semibold text-[#111] truncate">{p.name}</p>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-3 ${
                  p.stock_qty === 0 ? 'bg-red-50 text-red-500' : 'bg-[#fff3cd] text-[#856404]'
                }`}>
                  {p.stock_qty === 0 ? 'Out' : p.stock_qty}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const STATUS_STYLES: Record<string, string> = {
  'Open':        'bg-red-50 text-red-500',
  'In Progress': 'bg-[#fff3cd] text-[#856404]',
  'Resolved':    'bg-green-50 text-green-600',
}

function IssuesDashboardPanel() {
  const { data: issues = [] } = useIssues()
  const open = issues.filter((i) => i.status !== 'Resolved')

  return (
    <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col h-[570px]">
      <div className="px-5 py-4 border-b border-[#f0f0f0] flex items-center justify-between flex-shrink-0">
        <p className="text-[13px] font-bold text-[#111]">
          Issues <span className="font-medium text-[#aaa]">| Open</span>
        </p>
        {open.length > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500">
            {open.length}
          </span>
        )}
      </div>
      {issues.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[12px] font-medium text-[#ccc]">No issues reported</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          {issues.map((issue) => (
            <div key={issue.id} className="px-5 py-3 border-b border-[#f8f8f8] last:border-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[12px] font-semibold text-[#111] leading-tight flex-1 truncate">
                  {issue.description}
                </p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_STYLES[issue.status] ?? 'bg-[#f0f0f0] text-[#888]'}`}>
                  {issue.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-[#bbb]">{issue.category}</span>
                <span className="text-[#ddd]">·</span>
                <span className="text-[10px] font-medium text-[#bbb]">{issue.reporter_name}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ShiftDepositLoader({ shiftId, onLoad }: { shiftId: string; onLoad: (id: string, data: Deposit[]) => void }) {
  const { data } = useShiftDeposits(shiftId)
  const ref = useRef(onLoad)
  ref.current = onLoad
  useEffect(() => { if (data !== undefined) ref.current(shiftId, data) }, [shiftId, data])
  return null
}

export function ReportsDashboard() {
  const { user } = useAuth()
  const { data: shift } = useOpenShift()
  const { data: deposits = [] } = useShiftDeposits(shift?.id)
  const { data: tanks = [] } = useTanks()
  const { data: branches = [] } = useBranches()
  const { data: tankLogs = [] } = useShiftTankLogs(shift?.id)
  const { data: fuelRankings = [] } = useAllTimeFuelRankings()
  const fuelBars      = fuelRankings.map((r) => [r.fuel_type, r.total_sales] as [string, number])
  const fuelLitresMap = Object.fromEntries(fuelRankings.map((r) => [r.fuel_type, r.total_litres]))
  const totalFuelSales = fuelBars.reduce((s, [, v]) => s + v, 0)

  // Accumulate deposits across all shifts this week
  const { weekStart, weekEnd } = useMemo(() => {
    const now = new Date()
    const sun = new Date(now); sun.setDate(now.getDate() - now.getDay())
    return { weekStart: localDate(sun), weekEnd: localDate(now) }
  }, [])
  const { data: weekShifts = [] } = useShiftsInRange(weekStart, weekEnd)
  const [depositsByShift, setDepositsByShift] = useState<Record<string, Deposit[]>>({})
  const handleLoad = useRef((id: string, data: Deposit[]) => {
    setDepositsByShift((prev) => ({ ...prev, [id]: data }))
  })
  const allDeposits = useMemo(() => Object.values(depositsByShift).flat(), [depositsByShift])

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? '--'

  const cashDeposits   = allDeposits.filter((d) => d.type === 'Cash')
  const chargeDeposits = allDeposits.filter((d) => d.type === 'Charge')

  const staffSalesMap: Record<string, number> = {}
  for (const d of allDeposits) {
    if (['Cash', 'Card', 'Charge', 'FX', 'Advance'].includes(d.type)) {
      staffSalesMap[d.attendant_name] = (staffSalesMap[d.attendant_name] ?? 0) + d.amount
    }
  }
  const staffBars = Object.entries(staffSalesMap).sort(([, a], [, b]) => b - a)
  const totalStaffDeposited = staffBars.reduce((s, [, v]) => s + v, 0)

  const totalCharge = chargeDeposits.reduce((s, d) => s + d.amount, 0)

  const tankRows = tanks.map((t) => {
    const log = tankLogs.find((l) => l.tank_id === t.id)
    const level = log?.closing_level ?? log?.opening_level
    const availStr = level != null ? `${level.toLocaleString('en-US')} L` : '--'
    const pctStr = level != null && t.capacity_litres > 0
      ? `${((level / t.capacity_litres) * 100).toFixed(0)}%`
      : '--'
    return [branchName(t.branch_id), t.fuel_name, availStr, pctStr]
  })

  return (
    <div className="h-full overflow-y-auto scrollbar-hide bg-white" style={{ scrollbarWidth: 'none' }}>
      {weekShifts.map((s) => (
        <ShiftDepositLoader key={s.id} shiftId={s.id} onLoad={handleLoad.current} />
      ))}
      <div className="p-6 flex flex-col gap-6">

        <SetupBanner />

        {/* Insights header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-[26px] font-bold text-[#111] leading-tight">
              {getGreeting()}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
            </h1>
            <button className="px-4 py-2 border border-[#ddd] rounded-xl text-[12px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors flex-shrink-0">
              Start a new branch
            </button>
          </div>

          {/* Quick actions */}
          <div
            className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1"
            style={{ scrollbarWidth: 'none' }}
          >
            {QUICK_ACTIONS.map((label) => (
              <ActionPill key={label} label={label} />
            ))}
          </div>

          {/* Insight cards */}
          <div className="grid grid-cols-2 min-[900px]:grid-cols-5 gap-3">
            <InsightCard label="Best Sales Day"  value="Wed"    sub="Based on history" />
            <InsightCard label="Avg Daily — 87"  value="1,240 L" sub="Last 30 days" />
            <InsightCard label="Avg Daily — 90"  value="890 L"   sub="Last 30 days" />
            <InsightCard label="Avg Daily — ULSD" value="2,100 L" sub="Last 30 days" />
            <InsightCard label="Active Staff"    value={allDeposits.length > 0 ? String(new Set(allDeposits.map((d) => d.attendant_id)).size) : '--'} sub="This week" />
          </div>
        </div>

        {/* Three-column grid */}
        <div className="grid grid-cols-1 min-[1000px]:grid-cols-3 gap-4 items-start">

          {/* Left column */}
          <div className="flex flex-col gap-4 min-h-0">
            <CashPanel cashDeposits={cashDeposits} />

            <SalesPanel deposits={allDeposits} />

            <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col h-[400px]">
              <div className="flex-shrink-0"><CardHeader title="Charges" subtitle="Credit" /></div>
              <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
                {chargeDeposits.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-[12px] font-medium text-[#ccc]">No charges recorded</p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {chargeDeposits.map((d) => (
                      <div key={d.id} className="flex items-center justify-between px-5 py-3 border-b border-[#f8f8f8]">
                        <p className="text-[12px] font-semibold text-[#111]">{d.attendant_name}</p>
                        <p className="text-[12px] font-semibold text-[#444]">{fmtJ(d.amount)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-t border-[#f0f0f0] flex-shrink-0">
                <p className="text-[11px] font-medium text-[#aaa]">Total</p>
                <p className={`text-[13px] font-bold ${chargeDeposits.length > 0 ? 'text-[#111]' : 'text-[#ccc]'}`}>
                  {fmtJ(totalCharge)}
                </p>
              </div>
            </div>

            <LowStockDashboardPanel />

          </div>

          {/* Middle column */}
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden">
              <CardHeader title="Tank" subtitle="Service Station" />
              {tankRows.length === 0 ? (
                <>
                  <ColHead cols={['Branch', 'Fuel', 'Available', '%']} />
                  <EmptyRow msg="No tanks configured" />
                </>
              ) : (
                <>
                  <ColHead cols={['Branch', 'Fuel', 'Available', '%']} />
                  {tankRows.map((row, i) => (
                    <TableRow key={i} cells={row as string[]} last={i === tankRows.length - 1} />
                  ))}
                </>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-[#ebebeb] p-5">
              <p className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase mb-4">Fuel Rankings</p>
              {fuelBars.length === 0 ? (
                <div className="py-6 flex items-center justify-center">
                  <p className="text-[12px] font-medium text-[#ccc]">No fuel data</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {fuelBars.map(([fuelType, sales], i) => {
                    const pct = totalFuelSales > 0 ? ((sales / totalFuelSales) * 100).toFixed(1) : '0.0'
                    const litres = fuelLitresMap[fuelType] ?? 0
                    return (
                      <div key={fuelType} className="flex items-center justify-between bg-[#f9f9f9] rounded-2xl py-4 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-bold tracking-widest text-[#ccc] uppercase">{ordinal(i + 1)}</span>
                          <span className="text-[22px] font-black text-[#111] tracking-tight leading-none">{fuelType}</span>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-[18px] font-bold text-[#333] leading-none">{pct}%</span>
                          <span className="text-[11px] font-semibold text-[#aaa]">{litres.toFixed(2)} L</span>
                          <span className="text-[11px] font-semibold text-[#aaa]">{fmtJ(sales)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <StaffLeaderboard fuelRows={staffBars} fuelTotal={totalStaffDeposited} />
            <ProductLeaderboard />
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            <FuelSalesCard />
            <SalesBreakdownCard deposits={deposits} />

            <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col h-[400px]">
              <div className="flex-shrink-0">
                <CardHeader title="Wet Stock" subtitle="Service Station" />
                <ColHead cols={['Branch', 'Date', '%']} />
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide flex items-center justify-center" style={{ scrollbarWidth: 'none' }}>
                <p className="text-[12px] font-medium text-[#ccc]">No wet stock data</p>
              </div>
            </div>

            <IssuesDashboardPanel />

          </div>

        </div>

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-[12px] font-medium text-[#ccc]">© 2025 STATIONSYNC</p>
        </div>

      </div>
    </div>
  )
}
