import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '../../lib/authContext'
import { usePumps, useFuels, useUsers } from '../../hooks/useApi'

interface Task {
  id: string
  label: string
  description: string
  tab: string
}

const tasks: Task[] = [
  { id: 'business', label: 'Add business details',  description: 'Address and contact info',              tab: 'business' },
  { id: 'pumps',    label: 'Configure pumps',        description: 'Add your fuel pumps and nozzles',       tab: 'forecourt' },
  { id: 'fuels',    label: 'Set up fuel grades',     description: 'Define available fuel types',           tab: 'forecourt' },
  { id: 'team',     label: 'Invite team members',    description: 'Add supervisors and staff',             tab: 'team' },
  { id: 'payroll',  label: 'Configure payroll',      description: 'Set pay periods, rates and deductions', tab: 'payroll' },
  { id: 'fx',       label: 'Configure FX rates',     description: 'Set exchange rates for foreign currency transactions', tab: 'profile' },
]

const DISMISSED_KEY = 'setup_banner_dismissed'

export function SetupBanner() {
  const { user } = useAuth()
  const { data: pumps = [] } = usePumps()
  const { data: fuels = [] } = useFuels()
  const { data: users = [] } = useUsers()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === '1')
  const [expanded, setExpanded] = useState(true)

  const completed: Record<string, boolean> = {
    business: !!(user?.business_address_line1),
    pumps:    pumps.length > 0,
    fuels:    fuels.length > 0,
    team:     users.some((u) => u.role !== 'Super Admin'),
    payroll:  localStorage.getItem('payroll_configured') === '1',
    fx:       localStorage.getItem('fx_configured') === '1',
  }

  const doneCount = Object.values(completed).filter(Boolean).length
  const allDone = doneCount === tasks.length

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setDismissed(true)
  }

  if (dismissed || allDone) return null

  const pct = Math.round((doneCount / tasks.length) * 100)

  return (
    <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <p className="text-[13px] font-bold text-[#111]">Complete your setup</p>
              <span className="text-[11px] font-bold text-[#888]">{doneCount} of {tasks.length} done</span>
            </div>
            <div className="w-full bg-[#f0f0f0] rounded-full h-1.5">
              <div
                className="bg-[#111] h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#bbb] hover:text-[#111] hover:bg-[#f4f4f4] transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={dismiss}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#bbb] hover:text-[#111] hover:bg-[#f4f4f4] transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Steps */}
      {expanded && (
        <div className="border-t border-[#f4f4f4] divide-y divide-[#f4f4f4]">
          {tasks.map((task) => {
            const done = completed[task.id]
            return (
              <Link
                key={task.id}
                to="/settings"
                search={{ tab: task.tab }}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#fafafa] transition-colors"
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                  done ? 'bg-[#111] border-[#111]' : 'border-[#ddd] bg-white'
                }`}>
                  {done && <Check size={10} strokeWidth={3} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-semibold ${done ? 'text-[#aaa] line-through' : 'text-[#111]'}`}>
                    {task.label}
                  </p>
                  <p className="text-[11px] font-medium text-[#bbb] mt-0.5">{task.description}</p>
                </div>
                {!done && (
                  <span className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase flex-shrink-0">
                    Set up →
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
