import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { useFuels, useFuelSummary } from '../../hooks/useApi'
import type { Pump } from '../../lib/api'
import { PumpDetailPanel } from './PumpDetailPanel'
import { FuelReceivalModal } from './FuelReceivalModal'
import { EditFuelReceivalModal } from './EditFuelReceivalModal'

type View = 'pumps' | 'tanks'
type TankGrade = '87' | '90' | 'ADO' | 'ULSD'

const grades: TankGrade[] = ['87', '90', 'ADO', 'ULSD']

interface Props {
  pump: Pump | undefined
  shiftId: string | undefined
}

export function FuelStationPanel({ pump, shiftId }: Props) {
  const [view, setView] = useState<View>('pumps')

  const { data: fuels = [] } = useFuels()
  const { data: summaries = [] } = useFuelSummary(pump?.id, shiftId)
  const [selectedFuelName, setSelectedFuelName] = useState<string | null>(null)
  const activeFuelName = selectedFuelName ?? summaries[0]?.fuelType ?? fuels[0]?.name ?? null

  const [grade, setGrade] = useState<TankGrade>('87')
  const [hasReceival, setHasReceival] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  useEffect(() => {
    setHasReceival(false)
    setShowAdd(false)
    setShowEdit(false)
  }, [grade])

  const tabs = view === 'pumps' ? fuels.map((f) => f.name) : grades
  const activeTab = view === 'pumps' ? activeFuelName : grade

  function handleTabClick(tab: string) {
    if (view === 'pumps') setSelectedFuelName(tab)
    else setGrade(tab as TankGrade)
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="flex items-center px-5 flex-shrink-0">
          <div className="flex flex-1 overflow-x-auto min-w-0">
            {tabs.length === 0 ? (
              <span className="py-4 text-[13px] text-[#ccc] font-medium border-b-2 border-[#f0f0f0]">
                No fuels configured
              </span>
            ) : (
              tabs.map((tab) => {
                const isActive = tab === activeTab
                return (
                  <button
                    key={tab}
                    onClick={() => handleTabClick(tab)}
                    className={clsx(
                      'flex-shrink-0 py-4 mr-4 text-[13px] font-semibold transition-colors whitespace-nowrap border-b-2',
                      isActive
                        ? 'border-[#111] text-[#111]'
                        : 'border-[#f0f0f0] text-[#aaa] hover:text-[#555]'
                    )}
                  >
                    {tab}
                  </button>
                )
              })
            )}
          </div>
          <div className="flex items-center pl-3 py-3 border-b-2 border-[#f0f0f0] flex-shrink-0">
            <div className="flex items-center border border-[#e0e0e0] rounded-lg overflow-hidden">
              <button
                onClick={() => setView('pumps')}
                className={clsx(
                  'px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  view === 'pumps' ? 'bg-[#111] text-white' : 'text-[#888] hover:bg-[#f4f4f4]'
                )}
              >
                Pumps
              </button>
              <button
                onClick={() => setView('tanks')}
                className={clsx(
                  'px-2.5 py-1 text-[11px] font-semibold transition-colors border-l border-[#e0e0e0]',
                  view === 'tanks' ? 'bg-[#111] text-white' : 'text-[#888] hover:bg-[#f4f4f4]'
                )}
              >
                Tanks
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {view === 'pumps' && (
            <PumpDetailPanel pump={pump} shiftId={shiftId} fuelType={activeFuelName} summaries={summaries} />
          )}

          {view === 'tanks' && (
            <>
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

              <div className="px-5 pt-2 pb-4 border-t border-[#f0f0f0]">
                <p className="text-[10px] font-semibold tracking-widest text-[#aaa] mb-1">
                  WET STOCK SUMMARY
                </p>
                <p className="text-[28px] font-bold text-[#111] leading-none tracking-tight">+0.00%</p>
              </div>

              <div className="border-t border-[#ebebeb] px-5 py-4">
                <div className="flex items-center justify-between mb-3">
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
                <div className="space-y-2 mb-3">
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
            </>
          )}
        </div>
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
    </>
  )
}
