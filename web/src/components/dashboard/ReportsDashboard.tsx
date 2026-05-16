import { BarChart3, TrendingUp, Fuel, Users, CreditCard, Wallet } from 'lucide-react'
import { SetupBanner } from './SetupBanner'

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#ebebeb] p-6">
      <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-3">{label}</p>
      <p className="text-[32px] font-bold text-[#111] leading-none tracking-tight">{value}</p>
      {sub && <p className="text-[12px] font-medium text-[#aaa] mt-2">{sub}</p>}
    </div>
  )
}

function SectionLabel({ label }: { label: string }) {
  return <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-3">{label}</p>
}

export function ReportsDashboard() {
  const quickLinks = [
    { icon: BarChart3, label: 'Sales Report' },
    { icon: Fuel, label: 'Fuel Report' },
    { icon: Users, label: 'Attendant Report' },
    { icon: Wallet, label: 'Cash Report' },
    { icon: CreditCard, label: 'Card Report' },
    { icon: TrendingUp, label: 'Trend Analysis' },
  ]

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
      <div className="p-6 max-w-[900px] mx-auto flex flex-col gap-8">

        <SetupBanner />

        <div>
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Overview</p>
          <h1 className="text-[28px] font-bold text-[#111] leading-tight">Reports</h1>
        </div>

        <div>
          <SectionLabel label="This Period" />
          <div className="grid grid-cols-2 min-[640px]:grid-cols-3 gap-4">
            <StatCard label="Total Sales" value="--" sub="No data yet" />
            <StatCard label="Total Litres" value="--" sub="No data yet" />
            <StatCard label="Shifts" value="--" sub="No data yet" />
          </div>
        </div>

        <div>
          <SectionLabel label="Reports" />
          <div className="grid grid-cols-2 min-[540px]:grid-cols-3 gap-3">
            {quickLinks.map(({ icon: Icon, label }) => (
              <button
                key={label}
                disabled
                className="bg-white rounded-2xl border border-[#ebebeb] p-5 text-left flex items-center gap-3 opacity-40 cursor-not-allowed"
              >
                <div className="w-8 h-8 rounded-xl bg-[#f4f4f4] flex items-center justify-center flex-shrink-0">
                  <Icon size={15} className="text-[#555]" />
                </div>
                <p className="text-[13px] font-semibold text-[#333]">{label}</p>
              </button>
            ))}
          </div>
          <p className="text-[12px] text-[#bbb] font-medium mt-4">Detailed reports are coming soon.</p>
        </div>

        <div>
          <SectionLabel label="Recent Shifts" />
          <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
              <p className="text-[13px] font-semibold text-[#333]">Date</p>
              <p className="text-[13px] font-semibold text-[#333]">Total Sales</p>
            </div>
            <div className="px-5 py-8 flex items-center justify-center">
              <p className="text-[13px] font-medium text-[#bbb]">No shifts recorded yet</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
