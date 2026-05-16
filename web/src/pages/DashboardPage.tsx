import { useState, useEffect } from 'react'
import { PumpsPanel, fuelPrices, type Fuel } from '../components/dashboard/PumpsPanel'
import { PumpDetailPanel, type NozzleRow } from '../components/dashboard/PumpDetailPanel'
import { TanksPanel, type TankGrade } from '../components/dashboard/TanksPanel'
import { TankDetailPanel } from '../components/dashboard/TankDetailPanel'

const NOZZLE_COUNT = 12
const emptyNozzles = (): NozzleRow[] =>
  Array.from({ length: NOZZLE_COUNT }, () => ({ opening: '', closing: '' }))
import { AccountsPanel, type AccountType } from '../components/dashboard/AccountsPanel'
import { AttendancePanel } from '../components/dashboard/AttendancePanel'
import { TotalSalesCard } from '../components/dashboard/TotalSalesCard'
import { RecentActivityCard } from '../components/dashboard/RecentActivityCard'
import { ActionBar } from '../components/dashboard/ActionBar'
import { usePumps, useShiftForDate } from '../hooks/useApi'
import { ArrowLeft } from 'lucide-react'
import { EditFuelPricesModal } from '../components/dashboard/EditFuelPricesModal'
import { ConvenienceStoreBreakdownModal } from '../components/dashboard/ConvenienceStoreBreakdownModal'

function NotConfigured({ label }: { label: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-white gap-4 p-8">
      <p className="text-[13px] font-semibold text-[#888] uppercase tracking-widest">{label} ARE NOT CONFIGURED</p>
      <button className="px-4 py-2 border border-[#ddd] rounded-xl text-[13px] font-semibold text-[#333] uppercase tracking-widest hover:bg-[#f4f4f4] transition-colors">
        CONTACT ADMINISTRATOR
      </button>
    </div>
  )
}

export function DashboardPage() {
  const [selectedFuel, setSelectedFuel] = useState<Fuel | null>(null)
  const [selectedTank, setSelectedTank] = useState<TankGrade>('87')
  const [selectedAccount, setSelectedAccount] = useState<AccountType>('Cash')
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 1237)
  const [calibrationModal, setCalibrationModal] = useState<'pumps' | 'tanks' | null>(null)
  const [showEditPrices, setShowEditPrices] = useState(false)
  const [showConvenienceBreakdown, setShowConvenienceBreakdown] = useState(false)

  const [nozzleReadings, setNozzleReadings] = useState<Record<string, NozzleRow[]>>({})
  const [tankReadings, setTankReadings] = useState<Record<string, { opening: string; closing: string }>>({})

  function getNozzles(fuelType: string): NozzleRow[] {
    return nozzleReadings[fuelType] ?? emptyNozzles()
  }
  function setNozzles(fuelType: string, rows: NozzleRow[]) {
    setNozzleReadings((prev) => ({ ...prev, [fuelType]: rows }))
  }
  function pumpTotalForGrade(fuelType: string): number {
    return getNozzles(fuelType).reduce((sum, n) => {
      const o = parseFloat(n.opening)
      const c = parseFloat(n.closing)
      return !isNaN(o) && !isNaN(c) && c >= o ? sum + (c - o) : sum
    }, 0)
  }
  function hasPumpDataForGrade(fuelType: string): boolean {
    return getNozzles(fuelType).some((n) => n.opening !== '' || n.closing !== '')
  }

  useEffect(() => {
    function onResize() {
      setIsNarrow(window.innerWidth < 1237)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const { data: shift } = useShiftForDate(today)
  const { data: pumps = [] } = usePumps()
  const firstPump = pumps[0]

  return (
    <div className="flex h-full overflow-hidden">

      {/* Main scrollable content */}
      <div className="flex-[2] min-w-0 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        <div className="p-6 flex flex-col gap-5">
          <ActionBar shiftId={shift?.id} />

          <div>
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-3">Service Station</p>
            <TotalSalesCard />
          </div>

          {isNarrow && (
            <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f0f0f0]">
                <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Readings</p>
              </div>
              <div className="flex">
                <button
                  onClick={() => setCalibrationModal('pumps')}
                  className="flex-1 px-5 py-4 text-[13px] font-semibold text-[#333] hover:bg-[#fafafa] transition-colors border-r border-[#f0f0f0] text-left"
                >
                  PUMPS
                </button>
                <button
                  onClick={() => setCalibrationModal('tanks')}
                  className="flex-1 px-5 py-4 text-[13px] font-semibold text-[#333] hover:bg-[#fafafa] transition-colors text-left"
                >
                  TANKS
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl overflow-hidden border border-[#ebebeb] h-[300px] flex flex-col">
            <AccountsPanel selected={selectedAccount} onSelect={setSelectedAccount} />
            <RecentActivityCard account={selectedAccount} />
          </div>

          <AttendancePanel shiftId={shift?.id} />

          <div>
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-3">Convenience Store</p>
            <button onClick={() => setShowConvenienceBreakdown(true)} className="bg-white rounded-2xl border border-[#ebebeb] p-6 text-left w-full hover:border-[#ccc] transition-colors">
              <p className="text-[13px] font-semibold text-[#888] mb-3">Total Sales</p>
              <p className="text-[42px] font-bold text-[#111] leading-none tracking-tight mb-5">
                J$ 0.00
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-[#f0f0f0]">
                <span className="text-[13px] font-medium text-[#888]">Balance</span>
                <span className="text-[13px] font-semibold text-[#333]">J$ 0.00</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Pumps column — hidden on narrow screens */}
      {!isNarrow && (
        <div className="flex-1 min-w-0 border-l border-[#e8e8e8] flex flex-col overflow-hidden">
          {pumps.length === 0 ? (
            <NotConfigured label="Pumps" />
          ) : (
            <>
              <PumpsPanel selected={selectedFuel} onSelect={setSelectedFuel} onEditPrice={() => setShowEditPrices(true)} />
              <div className="flex-1 overflow-hidden flex flex-col">
                {selectedFuel && firstPump && (
                  <PumpDetailPanel
                    pump={firstPump}
                    shiftId={shift?.id}
                    fuelType={selectedFuel.name}
                    nozzles={getNozzles(selectedFuel.name)}
                    onChange={(rows) => setNozzles(selectedFuel.name, rows)}
                    pricePerLitre={fuelPrices[selectedFuel.name]}
                  />
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Tanks column — hidden on narrow screens */}
      {!isNarrow && (
        <div className="flex-1 min-w-0 border-l border-[#e8e8e8] flex flex-col overflow-hidden">
          {false ? (
            <NotConfigured label="Tanks" />
          ) : (
            <>
              <TanksPanel selected={selectedTank} onSelect={setSelectedTank} />
              <div className="flex-1 overflow-hidden flex flex-col">
                  <TankDetailPanel
                    grade={selectedTank}
                    tankReading={tankReadings[selectedTank] ?? { opening: '', closing: '' }}
                    onReadingChange={(r) => setTankReadings((prev) => ({ ...prev, [selectedTank]: r }))}
                    actualLitresSold={hasPumpDataForGrade(selectedTank) ? pumpTotalForGrade(selectedTank) : null}
                  />
              </div>
            </>
          )}
        </div>
      )}

      {/* Pumps modal — narrow screens only */}
      {calibrationModal === 'pumps' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-[500px] h-[850px] overflow-y-auto shadow-xl">
            <div className="px-5 pt-4 pb-3 flex items-center justify-between">
              <button
                onClick={() => setCalibrationModal(null)}
                className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
              >
                <ArrowLeft size={13} />
                Go back
              </button>
              <button
                onClick={() => setCalibrationModal('tanks')}
                className="text-[13px] font-semibold text-[#333] border border-[#ddd] rounded-lg px-3 py-1 hover:bg-[#f4f4f4] transition-colors"
              >
                Switch to Tanks
              </button>
            </div>
            {pumps.length === 0 ? (
              <NotConfigured label="Pumps" />
            ) : (
              <>
                <div className="border-b border-[#f0f0f0]">
                  <PumpsPanel selected={selectedFuel} onSelect={setSelectedFuel} onEditPrice={() => setShowEditPrices(true)} />
                </div>
                <div className="h-[850px]">
                  {selectedFuel && firstPump && (
                    <PumpDetailPanel
                    pump={firstPump}
                    shiftId={shift?.id}
                    fuelType={selectedFuel.name}
                    nozzles={getNozzles(selectedFuel.name)}
                    onChange={(rows) => setNozzles(selectedFuel.name, rows)}
                    pricePerLitre={fuelPrices[selectedFuel.name]}
                  />
                  )}
                </div>
              </>
            )}
          </div>  
        </div>
      )}

      {/* Tanks modal — narrow screens only */}
      {calibrationModal === 'tanks' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-[500px] h-[850px] flex flex-col overflow-hidden shadow-xl">
            <div className="px-5 pt-4 pb-3 flex items-center justify-between flex-shrink-0">
              <button
                onClick={() => setCalibrationModal(null)}
                className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
              >
                <ArrowLeft size={13} />
                Go back
              </button>
              <button
                onClick={() => setCalibrationModal('pumps')}
                className="text-[13px] font-semibold text-[#333] border border-[#ddd] rounded-lg px-3 py-1 hover:bg-[#f4f4f4] transition-colors"
              >
                Switch to Pumps
              </button>
            </div>
            {false ? (
              <NotConfigured label="Tanks" />
            ) : (
              <>
                <div className="border-b border-[#f0f0f0] flex-shrink-0">
                  <TanksPanel selected={selectedTank} onSelect={setSelectedTank} />
                </div>
                <div className="flex-1 overflow-y-auto">
                    <TankDetailPanel
                    grade={selectedTank}
                    tankReading={tankReadings[selectedTank] ?? { opening: '', closing: '' }}
                    onReadingChange={(r) => setTankReadings((prev) => ({ ...prev, [selectedTank]: r }))}
                    actualLitresSold={hasPumpDataForGrade(selectedTank) ? pumpTotalForGrade(selectedTank) : null}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {showEditPrices && (
        <EditFuelPricesModal
          onClose={() => setShowEditPrices(false)}
        />
      )}
      {showConvenienceBreakdown && (
        <ConvenienceStoreBreakdownModal
          onClose={() => setShowConvenienceBreakdown(false)}
        />
      )}
    </div>
  )
}
