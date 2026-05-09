import { useState, useRef, useEffect } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { EndShiftModal } from './EndShiftModal'
import { NewShiftLoginModal } from './NewShiftLoginModal'
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

interface Props {
  shiftEnded?: boolean
  canEndShift?: boolean
  onShiftEnd?: () => void
  onNewShift?: () => void
}

export function ActionBar({ shiftEnded, canEndShift = false, onShiftEnd, onNewShift }: Props) {
  const [recordView, setRecordView] = useState<RecordView>(null)
  const [dropAttendant, setDropAttendant] = useState('')
  const [showEndShift, setShowEndShift] = useState(false)
  const [showNewShiftLogin, setShowNewShiftLogin] = useState(false)
  const [showReportIssue, setShowReportIssue] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const btnClass = 'px-5 py-2.5 border border-[#ddd] rounded-xl text-[13px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors'

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {!shiftEnded && (
          <button onClick={() => setRecordView('select')} className={btnClass}>
            Record a ...
          </button>
        )}

        {/* Visible at ≥416px */}
        <button
          onClick={() => shiftEnded ? setShowNewShiftLogin(true) : canEndShift ? setShowEndShift(true) : undefined}
          disabled={!shiftEnded && !canEndShift}
          title={!shiftEnded && !canEndShift ? 'Enter all pump nozzle readings before ending the shift' : undefined}
          className={`hidden min-[416px]:block ${btnClass} disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {shiftEnded ? 'Start a new shift' : 'End shift'}
        </button>
        <button onClick={() => setShowReportIssue(true)} className={`hidden min-[416px]:block ${btnClass}`}>
          Report an issue
        </button>

        {/* Collapsed ... menu at <416px */}
        <div ref={moreRef} className="relative min-[416px]:hidden">
          <button
            onClick={() => setMoreOpen((o) => !o)}
            className={btnClass}
          >
            <MoreHorizontal size={15} />
          </button>
          {moreOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-[#e0e0e0] rounded-xl shadow-lg py-1 min-w-[160px] z-50">
              <button
                onClick={() => { setMoreOpen(false); shiftEnded ? setShowNewShiftLogin(true) : canEndShift ? setShowEndShift(true) : undefined }}
                disabled={!shiftEnded && !canEndShift}
                className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {shiftEnded ? 'Start a new shift' : 'End shift'}
              </button>
              <button
                onClick={() => { setMoreOpen(false); setShowReportIssue(true) }}
                className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors"
              >
                Report an issue
              </button>
            </div>
          )}
        </div>
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
        <EndShiftModal onClose={() => setShowEndShift(false)} onConfirm={onShiftEnd} />
      )}
      {showReportIssue && (
        <ReportIssueModal onClose={() => setShowReportIssue(false)} />
      )}
      {showNewShiftLogin && (
        <NewShiftLoginModal onClose={() => setShowNewShiftLogin(false)} onConfirm={() => { onNewShift?.(); setShowNewShiftLogin(false) }} />
      )}
    </>
  )
}
