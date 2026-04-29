import { useState } from 'react'
import type { TankGrade } from './TanksPanel'
import { FuelReceivalModal } from './FuelReceivalModal'
import { EditFuelReceivalModal } from './EditFuelReceivalModal'

const gradeLabels: Record<TankGrade, string> = {
  '87': 'UNLEADED 87',
  '90': 'UNLEADED 90',
  'ADO': 'AUTO DIESEL',
  'ULSD': 'ULTRA LOW SULPHUR',
}

interface Props {
  grade: TankGrade
}

export function TankDetailPanel({ grade }: Props) {
  const [hasReceival, setHasReceival] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      {/* Dip readings card */}
      <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#f0f0f0]">
          <p className="text-[12px] font-bold text-[#111] tracking-widest">{gradeLabels[grade]}</p>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-[#f0f0f0]">
              <th className="py-3 text-[11px] font-semibold text-[#aaa] text-center tracking-widest pl-5">
                OPENING
              </th>
              <th className="py-3 text-[11px] font-semibold text-[#aaa] text-center tracking-widest pr-5">
                CLOSING
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#f9f9f9]">
              <td className="py-4 text-center">
                <input
                  type="text"
                  placeholder="—"
                  className="w-24 text-center text-[13px] font-medium text-[#333] bg-transparent outline-none placeholder:text-[#ddd] focus:bg-[#f5f5f5] rounded-md px-1 py-0.5 transition-colors"
                />
              </td>
              <td className="py-4 text-center">
                <input
                  type="text"
                  placeholder="—"
                  className="w-24 text-center text-[13px] font-medium text-[#333] bg-transparent outline-none placeholder:text-[#ddd] focus:bg-[#f5f5f5] rounded-md px-1 py-0.5 transition-colors"
                />
              </td>
            </tr>
          </tbody>
        </table>

        <div className="px-5 pt-4 pb-2 border-t border-[#f0f0f0] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-widest text-[#aaa]">SUGGESTED LITRES SOLD</span>
            <span className="text-[12px] font-bold text-[#bbb]">---</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-widest text-[#aaa]">ACTUAL LITRES SOLD</span>
            <span className="text-[12px] font-bold text-[#bbb]">---</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-widest text-[#aaa]">VARIANCE</span>
            <span className="text-[12px] font-bold text-[#bbb]">---</span>
          </div>
        </div>

        <div className="px-5 pt-2 pb-5">
          <p className="text-[10px] font-semibold tracking-widest text-[#aaa] mb-1">WET STOCK SUMMARY</p>
          <p className="text-[28px] font-bold text-[#111] leading-none tracking-tight">+0.00%</p>
        </div>
      </div>

      {/* Receival log card */}
      <div className="bg-white rounded-2xl border border-[#ebebeb] p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[12px] font-bold tracking-widest text-[#111]">RECEIVAL LOG</p>
          {hasReceival ? (
            <button
              onClick={() => setShowEdit(true)}
              className="text-[12px] font-semibold text-[#333] border border-[#ddd] rounded-lg px-3 py-1 hover:bg-[#f4f4f4] transition-colors"
            >
              Edit
            </button>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="text-[12px] font-semibold text-[#333] border border-[#ddd] rounded-lg px-3 py-1 hover:bg-[#f4f4f4] transition-colors"
            >
              Add
            </button>
          )}
        </div>
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-widest text-[#aaa]">FUEL ORDERED</span>
            <span className="text-[12px] font-bold text-[#bbb]">---</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-widest text-[#aaa]">FUEL RECEIVED</span>
            <span className="text-[12px] font-bold text-[#bbb]">---</span>
          </div>
        </div>
        <p className="text-[11px] font-semibold text-[#aaa] mb-1">Variance</p>
        <p className="text-[28px] font-bold text-[#111] leading-none">0.00</p>
      </div>
      {showAdd && (
        <FuelReceivalModal
          onBack={() => setShowAdd(false)}
          onClose={() => setShowAdd(false)}
          onSubmit={() => setHasReceival(true)}
        />
      )}
      {showEdit && (
        <EditFuelReceivalModal
          onClose={() => setShowEdit(false)}
          onSubmit={() => setShowEdit(false)}
        />
      )}
    </div>
  )
}
