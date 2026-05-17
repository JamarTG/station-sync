import { useState } from 'react'
import { useAuth } from '../../lib/authContext'
import { useOpenShift, useShiftAttendance, usePumps } from '../../hooks/useApi'
import { AccountsPanel, type AccountType } from './AccountsPanel'
import { RecentActivityCard } from './RecentActivityCard'
import { DropModal } from './DropModal'
import { CashDepositModal } from './CashDropModal'
import { CardModal } from './CardModal'
import { ChargeModal } from './ChargeModal'
import { AdvanceModal } from './AdvanceModal'
import { FXModal } from './FXModal'
import { ReportIssueModal } from './ReportIssueModal'

type View = 'drop' | 'cash-deposit' | 'card' | 'charge' | 'advance' | 'fx' | null

export function AttendantDashboard() {
  const { user } = useAuth()
  const { data: shift } = useOpenShift()
  const { data: attendance = [] } = useShiftAttendance(shift?.id)
  const { data: pumps = [] } = usePumps()
  const [view, setView] = useState<View>(null)
  const [dropAttendant, setDropAttendant] = useState('')
  const [selectedAccount, setSelectedAccount] = useState<AccountType>('Cash')
  const [showReportIssue, setShowReportIssue] = useState(false)

  const myAttendance = attendance.filter((a) => a.user_id === user?.id)
  const myPumps = myAttendance
    .map((a) => pumps.find((p) => p.id === a.pump_id))
    .filter(Boolean)

  const btnClass = 'px-5 py-2.5 border border-[#ddd] rounded-xl text-[13px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors'

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col" style={{ scrollbarWidth: 'none' }}>
      <div className="p-6 flex flex-col gap-5 flex-1">

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setView('drop')} className={btnClass}>
            Record a drop
          </button>
          <button onClick={() => setShowReportIssue(true)} className={btnClass}>
            Report an issue
          </button>
        </div>

        {myPumps.length > 0 && (
          <div>
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-3">Your Assignment</p>
            <div className="flex gap-3 flex-wrap">
              {myPumps.map((pump) => (
                <div key={pump!.id} className="bg-white rounded-2xl border border-[#ebebeb] px-6 py-4">
                  <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Pump</p>
                  <p className="text-[22px] font-bold text-[#111] leading-none">{pump!.name}</p>
                  {pump!.description && (
                    <p className="text-[12px] font-medium text-[#888] mt-1">{pump!.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!shift && (
          <div className="bg-white rounded-2xl border border-[#ebebeb] p-6 flex items-center justify-center">
            <p className="text-[13px] font-medium text-[#bbb]">No active shift</p>
          </div>
        )}

        <div className="bg-white rounded-2xl overflow-hidden border border-[#ebebeb] flex-1 flex flex-col min-h-[300px]">
          <AccountsPanel selected={selectedAccount} onSelect={setSelectedAccount} />
          <RecentActivityCard account={selectedAccount} shiftId={shift?.id} />
        </div>

      </div>

      {view === 'drop' && (
        <DropModal
          onBack={() => setView(null)}
          onClose={() => setView(null)}
          onSelectCash={(a) => { setDropAttendant(a); setView('cash-deposit') }}
          onSelectCard={() => setView('card')}
          onSelectCharges={() => setView('charge')}
          onSelectAdvance={() => setView('advance')}
          onSelectFX={() => setView('fx')}
        />
      )}
      {view === 'cash-deposit' && (
        <CashDepositModal
          initialAttendant={dropAttendant}
          onBack={() => setView('drop')}
          onClose={() => setView(null)}
          shiftId={shift?.id}
        />
      )}
      {view === 'card' && (
        <CardModal
          onBack={() => setView('drop')}
          onClose={() => setView(null)}
          shiftId={shift?.id}
        />
      )}
      {view === 'charge' && (
        <ChargeModal
          onBack={() => setView('drop')}
          onClose={() => setView(null)}
          shiftId={shift?.id}
        />
      )}
      {view === 'advance' && (
        <AdvanceModal
          onBack={() => setView('drop')}
          onClose={() => setView(null)}
          shiftId={shift?.id}
        />
      )}
      {view === 'fx' && (
        <FXModal
          onBack={() => setView('drop')}
          onClose={() => setView(null)}
          shiftId={shift?.id}
        />
      )}
      {showReportIssue && (
        <ReportIssueModal onClose={() => setShowReportIssue(false)} />
      )}
    </div>
  )
}
