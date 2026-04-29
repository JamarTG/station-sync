import { useState } from 'react'
import { AttendantModal } from './AttendantModal'
import { ManageAttendantsModal } from './ManageAttendantsModal'

const attendants = [
  { name: 'T. Brisco', amount: 0.0, sign: '+' },
  { name: 'S. Smith', amount: -0.0, sign: '-' },
  { name: 'S. Lawes', amount: -0.0, sign: '-' },
  { name: 'A. Lewis', amount: 0.0, sign: '+' },
]

function formatAmount(sign: string, amount: number) {
  return `J$ ${sign}${Math.abs(amount).toFixed(2)}`
}

export function AttendantsCard() {
  const [selected, setSelected] = useState<string | null>(null)
  const [showManage, setShowManage] = useState(false)

  return (
    <>
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[13px] font-semibold text-[#888]">Attendants</p>
          <button
            onClick={() => setShowManage(true)}
            className="text-[12px] font-semibold text-[#333] border border-[#ddd] rounded-lg px-3 py-1 hover:bg-[#f4f4f4] transition-colors"
          >
            Manage
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {attendants.map((a) => (
            <button
              key={a.name}
              onClick={() => setSelected(a.name)}
              className="flex items-center justify-between bg-white border border-[#ebebeb] rounded-xl px-4 py-3 hover:border-[#ccc] hover:bg-[#fafafa] transition-colors text-left w-full"
            >
              <span className="text-[13px] font-semibold text-[#333]">{a.name}</span>
              <span className="text-[12px] font-semibold text-[#333]">
                {formatAmount(a.sign, a.amount)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <AttendantModal name={selected} onClose={() => setSelected(null)} />
      )}
      {showManage && (
        <ManageAttendantsModal onClose={() => setShowManage(false)} />
      )}
    </>
  )
}
