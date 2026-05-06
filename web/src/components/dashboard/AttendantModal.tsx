import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { ManageAttendantsModal } from './ManageAttendantsModal'

const fuelGrades = ['87', '90', 'ADO', 'ULSD']
const depositTypes = ['CASH', 'CARD', 'FX', 'ADVANCE', 'CHARGES']

interface Props {
  name: string
  onClose: () => void
}

function Row({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[13px] font-medium text-[#222]">{label}</span>
      <span className="text-[13px] font-medium text-[#bbb]">--</span>
    </div>
  )
}

export function AttendantModal({ name, onClose }: Props) {
  useEscapeKey(onClose)
  const [showManage, setShowManage] = useState(false)

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[420px] max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8">
          <div className="flex items-center mb-7">
            <button
              onClick={onClose}
              className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
            >
              <ArrowLeft size={13} />
              Go back
            </button>
          </div>
          <p className="text-[12px] font-medium text-[#aaa] mb-1">Attendant</p>
          <div className="flex items-center justify-between mb-7">
            <h2 className="text-[28px] font-bold text-[#111] leading-none">{name}</h2>
            <button
              onClick={() => setShowManage(true)}
              className="text-[12px] font-semibold text-[#333] border border-[#ddd] rounded-lg px-3 py-1 hover:bg-[#f4f4f4] transition-colors"
            >
              Manage
            </button>
          </div>

          {/* Amount Sold */}
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">
            Amount Sold
          </p>
          <div className="divide-y divide-[#f0f0f0] mb-6">
            {fuelGrades.map((g) => <Row key={g} label={g} />)}
          </div>

          {/* Amount Deposited */}
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">
            Amount Deposited
          </p>
          <div className="divide-y divide-[#f0f0f0] mb-7">
            {depositTypes.map((d) => <Row key={d} label={d} />)}
          </div>

          {/* Total */}
          <p className="text-[13px] font-semibold text-[#888] mb-1">Total</p>
          <p className="text-[36px] font-bold text-[#111] leading-none tracking-tight mb-5">
            J$0.00
          </p>

          {/* Balance */}
          <div className="pt-4 border-t border-[#ebebeb] flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#888]">Balance</span>
            <span className="text-[13px] font-bold text-[#333]">J$0.00</span>
          </div>
        </div>
      </div>
    </div>
    {showManage && <ManageAttendantsModal onClose={() => setShowManage(false)} />}
    </>
  )
}
