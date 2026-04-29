import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { PricesPanel } from '../components/dashboard/PricesPanel'
import { PumpsPanel, type Fuel } from '../components/dashboard/PumpsPanel'
import { PumpDetailPanel } from '../components/dashboard/PumpDetailPanel'
import { TanksPanel, type TankGrade } from '../components/dashboard/TanksPanel'
import { TankDetailPanel } from '../components/dashboard/TankDetailPanel'
import { AccountsPanel, type AccountType } from '../components/dashboard/AccountsPanel'
import { TotalSalesCard } from '../components/dashboard/TotalSalesCard'
import { AttendantsCard } from '../components/dashboard/AttendantsCard'
import { RecentActivityCard } from '../components/dashboard/RecentActivityCard'
import { ActionBar } from '../components/dashboard/ActionBar'
import { useMinWidth } from '../hooks/useIsDesktop'
import { usePumps, useShiftForDate } from '../hooks/useApi'

export function DashboardPage() {
  const [selectedFuel, setSelectedFuel] = useState<Fuel | null>(null)
  const [selectedTank, setSelectedTank] = useState<TankGrade | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<AccountType>('Cash')

  const isDesktop = useMinWidth(1200)

  const today = new Date().toISOString().slice(0, 10)
  const { data: shift } = useShiftForDate(today)
  const { data: pumps = [] } = usePumps()
  const firstPump = pumps[0]

  function handleFuelSelect(fuel: Fuel | null) {
    setSelectedFuel(fuel)
    if (fuel) setSelectedTank(null)
  }

  function handleTankSelect(grade: TankGrade | null) {
    setSelectedTank(grade)
    if (grade) setSelectedFuel(null)
  }

  function closeDetail() {
    setSelectedFuel(null)
    setSelectedTank(null)
  }

  const showDetail = selectedFuel !== null || selectedTank !== null

  const detailContent = (
    <>
      {selectedFuel && firstPump && (
        <PumpDetailPanel pump={firstPump} shiftId={shift?.id} fuelType={selectedFuel.name} />
      )}
      {selectedTank && <TankDetailPanel grade={selectedTank} />}
    </>
  )

  return (
    <div className="p-4 min-[1200px]:p-6 flex flex-col gap-5">

      {/* Row 1 — actions */}
      <ActionBar />

      {/* Row 2 — summary panels (like CMP's Activities | Actions) */}
      <div className="grid grid-cols-1 min-[1200px]:grid-cols-2 gap-5">
        <TotalSalesCard />
        <AttendantsCard />
      </div>

      {/* Row 3 — operations (like WooCommerce's middle section) */}
      <div className="grid grid-cols-1 min-[900px]:grid-cols-3 gap-5">
        <PricesPanel />
        <PumpsPanel selected={selectedFuel} onSelect={handleFuelSelect} />
        <TanksPanel selected={selectedTank} onSelect={handleTankSelect} />
      </div>

      {/* Row 4 — accounts filter + activity table (like CMP's Scheduled Activities) */}
      <AccountsPanel selected={selectedAccount} onSelect={setSelectedAccount} />
      <RecentActivityCard account={selectedAccount} />

      {/* Detail panel — inline below table on desktop */}
      {showDetail && isDesktop && (
        <div className="grid grid-cols-1 min-[900px]:grid-cols-2 gap-5">
          {detailContent}
        </div>
      )}

      {/* Detail panel — modal on mobile */}
      {showDetail && !isDesktop && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm overflow-y-auto p-4"
          onClick={closeDetail}
        >
          <button
            onClick={closeDetail}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] bg-white hover:bg-[#f4f4f4] transition-colors mb-4"
          >
            <ArrowLeft size={13} />
            Go back
          </button>
          <div
            className="w-full max-w-sm mx-auto flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {detailContent}
          </div>
        </div>
      )}
    </div>
  )
}
