import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { FuelReceivalModal } from './FuelReceivalModal'
import { EditFuelReceivalModal } from './EditFuelReceivalModal'

type TankGrade = '87' | '90' | 'ADO' | 'ULSD'

const grades: TankGrade[] = ['87', '90', 'ADO', 'ULSD']

const gradeLabels: Record<TankGrade, string> = {
  '87': 'UNLEADED 87',
  '90': 'UNLEADED 90',
  'ADO': 'AUTO DIESEL',
  'ULSD': 'ULTRA LOW SULPHUR',
}

export function TankDetailPanel() {
  const [grade, setGrade] = useState<TankGrade>('87')
  const [hasReceival, setHasReceival] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  useEffect(() => {
    setHasReceival(false)
    setShowAdd(false)
    setShowEdit(false)
  }, [grade])

  return (
    <div className="flex flex-col gap-4">
      {/* Dip readings card */}
      <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden">
        {/* Grade tabs */}
        <div className="flex items-center border-b border-[#f0f0f0] px-5">
          {grades.map((g) => {
            const isActive = grade === g
            return (
              <button
                key={g}
                onClick={() => setGrade(g)}
                className={clsx(
                  'relative flex-shrink-0 py-4 mr-5 text-[13px] font-semibold transition-colors whitespace-nowrap',
                  isActive ? 'text-[#111]' : 'text-[#aaa] hover:text-[#555]'
                )}
              >
                {g}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#111] translate-y-px" />
                )}
              </button>
            )
          })}
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
            <span className="text-[11px] font-semibold tracking-widest text-[#aaa]">
              SUGGESTED LITRES SOLD
            </span>
            <span className="text-[12px] font-bold text-[#bbb]">---</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-widest text-[#aaa]">
              ACTUAL LITRES SOLD
            </span>
            <span className="text-[12px] font-bold text-[#bbb]">---</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-widest text-[#aaa]">VARIANCE</span>
            <span className="text-[12px] font-bold text-[#bbb]">---</span>
          </div>
        </div>

        <div className="px-5 pt-2 pb-5">
          <p className="text-[10px] font-semibold tracking-widest text-[#aaa] mb-1">
            WET STOCK SUMMARY
          </p>
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
          onSubmit={() => { setHasReceival(true); setShowAdd(false) }}
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
