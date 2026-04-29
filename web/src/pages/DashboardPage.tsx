import { useState } from 'react'
import clsx from 'clsx'
import { X } from 'lucide-react'
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
  const isWide = useMinWidth(1686)

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
    <div className="p-4 min-[1200px]:p-6 overflow-x-auto">
      <div
        className={clsx(
          'grid gap-4 min-[1200px]:gap-5',
          'grid-cols-1 max-w-[600px] min-[1200px]:max-w-none',
          showDetail && isWide
            ? 'min-[1200px]:grid-cols-[600px_400px_400px]'
            : 'min-[1200px]:grid-cols-[600px_400px]',
        )}
      >
        {/* Column 1 — main content */}
        <div className="flex flex-col gap-4">
          <ActionBar />
          <TotalSalesCard />
          <div className="min-[1200px]:hidden">
            <PricesPanel />
          </div>
          <AttendantsCard />
          <div className="min-[1200px]:hidden">
            <PumpsPanel selected={selectedFuel} onSelect={handleFuelSelect} />
          </div>
          <div className="min-[1200px]:hidden">
            <TanksPanel selected={selectedTank} onSelect={handleTankSelect} />
          </div>
          <div className="min-[1200px]:hidden">
            <AccountsPanel selected={selectedAccount} onSelect={setSelectedAccount} />
          </div>
          <RecentActivityCard account={selectedAccount} />
        </div>

        {/* Column 2 — service station sidebar */}
        <div className="flex flex-col gap-4">
          <div className="hidden min-[1200px]:block">
            <PricesPanel />
          </div>
          <div className="hidden min-[1200px]:block">
            <PumpsPanel selected={selectedFuel} onSelect={handleFuelSelect} />
          </div>
          <div className="hidden min-[1200px]:block">
            <TanksPanel selected={selectedTank} onSelect={handleTankSelect} />
          </div>
          <div className="hidden min-[1200px]:block">
            <AccountsPanel selected={selectedAccount} onSelect={setSelectedAccount} />
          </div>
        </div>

        {/* Column 3 — detail panel (≥1686px only) */}
        {showDetail && isWide && (
          <div className="flex flex-col gap-4">
            {detailContent}
          </div>
        )}
      </div>

      {/* Modal — shown when detail is open and screen < 1686px */}
      {showDetail && !isWide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={closeDetail}
        >
          <div
            className="relative w-full max-w-sm max-h-[90vh] overflow-y-auto flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeDetail}
              className="absolute -top-1 -right-1 z-10 w-8 h-8 rounded-full bg-white border border-[#ebebeb] flex items-center justify-center shadow-sm hover:bg-[#f4f4f4] transition-colors"
            >
              <X size={14} className="text-[#555]" />
            </button>
            {detailContent}
          </div>
        </div>
      )}
    </div>
  )
}
