import { useState } from 'react'
import { Plus, ChevronRight } from 'lucide-react'

type Tab = 'employees' | 'payroll'

const PLACEHOLDER_EMPLOYEES = [
  { id: '1', name: 'Samantha Clarke',  role: 'Cashier',      active: true  },
  { id: '2', name: 'Devon Reid',       role: 'Stock Clerk',  active: true  },
  { id: '3', name: 'Tiana Francis',    role: 'Supervisor',   active: true  },
  { id: '4', name: 'Marcus Brown',     role: 'Cashier',      active: false },
]

function roleBadgeColor(role: string) {
  switch (role) {
    case 'Supervisor':  return 'bg-[#f0f0f0] text-[#555]'
    case 'Cashier':     return 'bg-[#d1e7dd] text-[#0a5435]'
    case 'Stock Clerk': return 'bg-[#cfe2ff] text-[#0a3d91]'
    default:            return 'bg-[#f0f0f0] text-[#555]'
  }
}

export function ConvenienceStaffPage() {
  const [tab, setTab] = useState<Tab>('employees')

  const active   = PLACEHOLDER_EMPLOYEES.filter((e) => e.active)
  const inactive = PLACEHOLDER_EMPLOYEES.filter((e) => !e.active)

  return (
    <div className="p-6 max-w-[960px] mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Convenience Store</p>
          <h1 className="text-[28px] font-bold text-[#111] leading-tight">Staff</h1>
        </div>
        {tab === 'employees' && (
          <button
            disabled
            className="flex items-center gap-2 px-5 py-2.5 bg-[#111] text-white text-[13px] font-semibold rounded-xl opacity-40 cursor-not-allowed"
          >
            <Plus size={14} /> Add Employee
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#ebebeb]">
        {(['employees', 'payroll'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-[13px] font-semibold border-b-2 -mb-px capitalize transition-colors ${
              tab === t
                ? 'border-[#111] text-[#111]'
                : 'border-transparent text-[#aaa] hover:text-[#555]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'employees' && (
        <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden">
          {/* Coming-soon notice */}
          <div className="px-5 py-3 border-b border-[#f4f4f4] bg-[#fafafa]">
            <p className="text-[11px] font-semibold text-[#bbb] uppercase tracking-widest">Preview — not yet implemented</p>
          </div>

          {/* Active employees */}
          {active.map((emp) => (
            <button
              key={emp.id}
              disabled
              className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-[#f4f4f4] last:border-0 cursor-not-allowed opacity-60"
            >
              <div className="w-9 h-9 rounded-full bg-[#111] text-white flex items-center justify-center text-[13px] font-bold shrink-0">
                {emp.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[14px] font-semibold text-[#111] truncate">{emp.name}</p>
                <p className="text-[12px] text-[#999]">{emp.role}</p>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${roleBadgeColor(emp.role)}`}>
                {emp.role}
              </span>
              <ChevronRight size={14} className="text-[#ccc] shrink-0" />
            </button>
          ))}

          {/* Inactive section */}
          {inactive.length > 0 && (
            <>
              <div className="px-5 py-2 bg-[#fafafa] border-t border-b border-[#f0f0f0]">
                <p className="text-[11px] font-semibold text-[#bbb] uppercase tracking-widest">Inactive</p>
              </div>
              {inactive.map((emp) => (
                <button
                  key={emp.id}
                  disabled
                  className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-[#f4f4f4] last:border-0 cursor-not-allowed opacity-40"
                >
                  <div className="w-9 h-9 rounded-full bg-[#ddd] text-[#999] flex items-center justify-center text-[13px] font-bold shrink-0">
                    {emp.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[14px] font-semibold text-[#111] truncate">{emp.name}</p>
                    <p className="text-[12px] text-[#999]">{emp.role}</p>
                  </div>
                  <ChevronRight size={14} className="text-[#ccc] shrink-0" />
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {tab === 'payroll' && (
        <div className="bg-white rounded-2xl border border-[#ebebeb] flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-[14px] font-semibold text-[#bbb]">Payroll — coming soon</p>
          <p className="text-[12px] text-[#ccc]">Convenience store payroll will be configured separately from the service station.</p>
        </div>
      )}
    </div>
  )
}
