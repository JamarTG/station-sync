import { useState } from 'react'
import { UserPlus, Receipt, CreditCard, Megaphone, Sparkles, ChevronDown, ChevronUp, Plus, Search, X } from 'lucide-react'
import { SetupBanner } from './SetupBanner'
import { useAuth } from '../../lib/authContext'
import { useOpenShift, useShiftDeposits, useTanks, useBranches, useShiftTankLogs, usePumps, useFuelSummary } from '../../hooks/useApi'

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

const MONTHLY_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHLY_SALES       = [840000, 920000, 780000, 1100000,  990000, 1250000, 1180000, 1340000, 1290000, 1050000, 1420000, 1580000]
const MONTHLY_EXPENDITURE = [120000, 180000,  95000,  220000,  175000,  310000,  280000,  390000,  340000,  260000,  420000,  480000]

const QUICK_ACTIONS = [
  { icon: UserPlus,  label: 'Invite member' },
  { icon: Receipt,   label: 'Add expense' },
  { icon: CreditCard, label: 'Record payment' },
  { icon: Megaphone, label: 'Make an announcement' },
  { icon: Sparkles,  label: 'Generate...' },
]

function ActionPill({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#ddd] rounded-xl text-[13px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors whitespace-nowrap flex-shrink-0">
      <Icon size={13} className="text-[#888]" />
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

function CashPanel({ cashDeposits }: { cashDeposits: { id: string; attendant_name: string; amount: number }[] }) {
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

function SalesPanel() {
  const [tab, setTab] = useState<'fuel' | 'cstore'>('fuel')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  return (
    <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col h-[400px]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0] flex-shrink-0">
        <p className="text-[13px] font-bold text-[#111]">
          Sales <span className="font-medium text-[#aaa]">| {tab === 'fuel' ? 'Service Station' : 'Convenience Store'}</span>
        </p>
        <div className="flex items-center gap-1">
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
          <button className="flex items-center border border-[#ddd] rounded-lg overflow-hidden">
            <span onClick={() => setSortDir('desc')} className={`px-2 py-1.5 hover:bg-[#f4f4f4] border-r border-[#ddd] transition-colors cursor-pointer ${sortDir === 'desc' ? 'bg-[#f4f4f4]' : ''}`}>
              <ChevronDown size={12} className="text-[#666]" />
            </span>
            <span onClick={() => setSortDir('asc')} className={`px-2 py-1.5 hover:bg-[#f4f4f4] transition-colors cursor-pointer ${sortDir === 'asc' ? 'bg-[#f4f4f4]' : ''}`}>
              <ChevronUp size={12} className="text-[#666]" />
            </span>
          </button>
          <button className="w-7 h-7 border border-[#ddd] rounded-lg flex items-center justify-center hover:bg-[#f4f4f4] transition-colors text-[#666]">
            <Plus size={13} />
          </button>
          <button className="w-7 h-7 border border-[#ddd] rounded-lg flex items-center justify-center hover:bg-[#f4f4f4] transition-colors text-[#666]">
            <Search size={13} />
          </button>
        </div>
      </div>
      <div className="grid px-5 py-2 border-b border-[#f8f8f8] flex-shrink-0" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {['Branch', 'Date', 'Time', 'Amount'].map((c) => (
          <p key={c} className="text-[10px] font-bold tracking-widest text-[#ccc] uppercase">{c}</p>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide flex items-center justify-center" style={{ scrollbarWidth: 'none' }}>
        <p className="text-[12px] font-medium text-[#ccc]">No sales recorded yet</p>
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

  return (
    <div className="flex flex-col gap-3">
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
              fill={activeIndex < 0 || i === activeIndex ? '#111' : '#e8e8e8'}
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
      </svg>

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

export function ReportsDashboard() {
  const { user } = useAuth()
  const { data: shift } = useOpenShift()
  const { data: deposits = [] } = useShiftDeposits(shift?.id)
  const { data: tanks = [] } = useTanks()
  const { data: branches = [] } = useBranches()
  const { data: tankLogs = [] } = useShiftTankLogs(shift?.id)
  const { data: pumps = [] } = usePumps()

  // Fixed hooks for up to 8 pumps (rules of hooks — always called)
  const fs0 = useFuelSummary(pumps[0]?.id, shift?.id)
  const fs1 = useFuelSummary(pumps[1]?.id, shift?.id)
  const fs2 = useFuelSummary(pumps[2]?.id, shift?.id)
  const fs3 = useFuelSummary(pumps[3]?.id, shift?.id)
  const fs4 = useFuelSummary(pumps[4]?.id, shift?.id)
  const fs5 = useFuelSummary(pumps[5]?.id, shift?.id)
  const fs6 = useFuelSummary(pumps[6]?.id, shift?.id)
  const fs7 = useFuelSummary(pumps[7]?.id, shift?.id)

  const allSummaries = [fs0, fs1, fs2, fs3, fs4, fs5, fs6, fs7].map((q) => q.data ?? [])

  const fuelSalesMap: Record<string, number> = {}
  const fuelLitresMap: Record<string, number> = {}
  for (const summaries of allSummaries) {
    for (const fs of summaries) {
      fuelSalesMap[fs.fuelType] = (fuelSalesMap[fs.fuelType] ?? 0) + fs.totalSales
      fuelLitresMap[fs.fuelType] = (fuelLitresMap[fs.fuelType] ?? 0) + fs.totalLitresSold
    }
  }
  const fuelBars = Object.entries(fuelSalesMap).sort(([, a], [, b]) => b - a)
  const totalFuelSales = fuelBars.reduce((s, [, v]) => s + v, 0)

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? '--'

  const cashDeposits   = deposits.filter((d) => d.type === 'Cash')
  const chargeDeposits = deposits.filter((d) => d.type === 'Charge')

  const staffSalesMap: Record<string, number> = {}
  for (const d of deposits) {
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
    <div className="h-full overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
      <div className="p-6 flex flex-col gap-6">

        <SetupBanner />

        {/* Insights header */}
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-0.5">Dashboard</p>
            <h1 className="text-[26px] font-bold text-[#111] leading-tight">
              {getGreeting()}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
            </h1>
          </div>

          {/* Quick actions */}
          <div
            className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1"
            style={{ scrollbarWidth: 'none' }}
          >
            {QUICK_ACTIONS.map((a) => (
              <ActionPill key={a.label} icon={a.icon} label={a.label} />
            ))}
          </div>

          {/* Insight cards */}
          <div className="grid grid-cols-2 min-[900px]:grid-cols-5 gap-3">
            <InsightCard label="Best Sales Day"  value="Wed"    sub="Based on history" />
            <InsightCard label="Avg Daily — 87"  value="1,240 L" sub="Last 30 days" />
            <InsightCard label="Avg Daily — 90"  value="890 L"   sub="Last 30 days" />
            <InsightCard label="Avg Daily — ULSD" value="2,100 L" sub="Last 30 days" />
            <InsightCard label="Active Staff"    value={deposits.length > 0 ? String(new Set(deposits.map((d) => d.attendant_id)).size) : '--'} sub="Current shift" />
          </div>
        </div>

        {/* Three-column grid */}
        <div className="grid grid-cols-1 min-[1000px]:grid-cols-3 gap-4 items-start">

          {/* Left column */}
          <div className="flex flex-col gap-4">
            <CashPanel cashDeposits={cashDeposits} />

            <SalesPanel />

            <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col h-[400px]">
              <div className="flex-shrink-0"><CardHeader title="Charges" subtitle="Credit" showActions /></div>
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
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl border border-[#ebebeb] p-5">
              <p className="text-[13px] font-bold text-[#111] mb-0.5">
                Fuel Sales <span className="font-medium text-[#aaa]">| Monthly</span>
              </p>
              <p className="text-[11px] font-medium text-[#bbb] mb-4">J$ revenue — current year</p>
              <FuelSalesChart
                barData={MONTHLY_LABELS.map((label, i) => ({ label, value: MONTHLY_SALES[i] }))}
                lineData={MONTHLY_EXPENDITURE}
                activeIndex={new Date().getMonth()}
              />
            </div>

            <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col h-[400px]">
              <div className="flex-shrink-0">
                <CardHeader title="Wet Stock" subtitle="Service Station" />
                <ColHead cols={['Branch', 'Date', '%']} />
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide flex items-center justify-center" style={{ scrollbarWidth: 'none' }}>
                <p className="text-[12px] font-medium text-[#ccc]">No wet stock data</p>
              </div>
            </div>
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
