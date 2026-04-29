import { useState } from 'react'
import { MoreHorizontal, Circle } from 'lucide-react'
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

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setRecordView('select')}
          className="px-5 py-2.5 border border-[#ddd] rounded-xl text-[13px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors"
        >
          Record a ...
        </button>
        <button className="hidden min-[474px]:block px-5 py-2.5 border border-[#ddd] rounded-xl text-[13px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors">
          Export
        </button>
        <button className="px-5 py-2.5 border border-[#ddd] rounded-xl text-[13px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors">
          Start a new shift
        </button>
        <button className="hidden min-[474px]:flex w-9 h-9 border border-[#ddd] rounded-xl items-center justify-center bg-white hover:bg-[#f9f9f9] transition-colors text-[#888]">
          <Circle size={16} />
        </button>
        <button className="w-9 h-9 border border-[#ddd] rounded-xl flex items-center justify-center bg-white hover:bg-[#f9f9f9] transition-colors text-[#888]">
          <MoreHorizontal size={16} />
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
    </>
  )
}
