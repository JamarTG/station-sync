import { useState } from 'react'
import { EndShiftModal } from './EndShiftModal'
import { ReportIssueModal } from './ReportIssueModal'
import { RecordModal } from './RecordModal'
import { DropModal } from './DropModal'
import { CashDepositModal } from './CashDropModal'
import { ExpenditureModal } from './ExpenditureModal'
import { ChargeModal } from './ChargeModal'
import { CardModal } from './CardModal'
import { AdvanceModal } from './AdvanceModal'
import { FuelReceivalModal } from './FuelReceivalModal'
import { FXModal } from './FXModal'
import { DepositModal } from './DepositModal'

type RecordView = 'select' | 'drop' | 'cash-deposit' | 'expenditure' | 'charge' | 'card' | 'advance' | 'fuel-receival' | 'fx' | 'deposit' | null

export function ActionBar() {
  const [recordView, setRecordView] = useState<RecordView>(null)
  const [dropAttendant, setDropAttendant] = useState('')
  const [showEndShift, setShowEndShift] = useState(false)
  const [showReportIssue, setShowReportIssue] = useState(false)

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setRecordView('select')}
          className="px-5 py-2.5 border border-[#ddd] rounded-xl text-[13px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors"
        >
          Record a ...
        </button>
        <button
          onClick={() => setShowEndShift(true)}
          className="px-5 py-2.5 border border-[#ddd] rounded-xl text-[13px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors"
        >
          End shift
        </button>
        <button
          onClick={() => setShowReportIssue(true)}
          className="px-5 py-2.5 border border-[#ddd] rounded-xl text-[13px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors"
        >
          Report an issue
        </button>
      </div>

      {recordView === 'select' && (
        <RecordModal
          onClose={() => setRecordView(null)}
          onSelectDrop={() => setRecordView('drop')}
          onSelectExpenditure={() => setRecordView('expenditure')}
          onSelectFuelReceival={() => setRecordView('fuel-receival')}
          onSelectDeposit={() => setRecordView('deposit')}
        />
      )}
      {recordView === 'drop' && (
        <DropModal
          onBack={() => setRecordView('select')}
          onClose={() => setRecordView(null)}
          onSelectCash={(a) => { setDropAttendant(a); setRecordView('cash-deposit') }}
          onSelectCharges={() => setRecordView('charge')}
          onSelectCard={() => setRecordView('card')}
          onSelectAdvance={() => setRecordView('advance')}
          onSelectFX={() => setRecordView('fx')}
        />
      )}
      {recordView === 'cash-deposit' && (
        <CashDepositModal
          initialAttendant={dropAttendant}
          onBack={() => setRecordView('drop')}
          onClose={() => setRecordView(null)}
        />
      )}
      {recordView === 'expenditure' && (
        <ExpenditureModal
          onBack={() => setRecordView('select')}
          onClose={() => setRecordView(null)}
        />
      )}
      {recordView === 'charge' && (
        <ChargeModal
          onBack={() => setRecordView('drop')}
          onClose={() => setRecordView(null)}
        />
      )}
      {recordView === 'card' && (
        <CardModal
          onBack={() => setRecordView('drop')}
          onClose={() => setRecordView(null)}
        />
      )}
      {recordView === 'advance' && (
        <AdvanceModal
          onBack={() => setRecordView('drop')}
          onClose={() => setRecordView(null)}
        />
      )}
      {recordView === 'fuel-receival' && (
        <FuelReceivalModal
          onBack={() => setRecordView('select')}
          onClose={() => setRecordView(null)}
        />
      )}
      {recordView === 'fx' && (
        <FXModal
          onBack={() => setRecordView('drop')}
          onClose={() => setRecordView(null)}
        />
      )}
      {recordView === 'deposit' && (
        <DepositModal
          onBack={() => setRecordView('select')}
          onClose={() => setRecordView(null)}
        />
      )}
      {showEndShift && (
        <EndShiftModal onClose={() => setShowEndShift(false)} />
      )}
      {showReportIssue && (
        <ReportIssueModal onClose={() => setShowReportIssue(false)} />
      )}
    </>
  )
}
