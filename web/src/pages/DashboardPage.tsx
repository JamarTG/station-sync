import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { PricesPanel } from '../components/dashboard/PricesPanel'
import { PumpsPanel, type Pump } from '../components/dashboard/PumpsPanel'
import { PumpDetailPanel } from '../components/dashboard/PumpDetailPanel'
import { TanksPanel, type TankGrade } from '../components/dashboard/TanksPanel'
import { TankDetailPanel } from '../components/dashboard/TankDetailPanel'
import { AccountsPanel, type AccountType } from '../components/dashboard/AccountsPanel'
import { TotalSalesCard } from '../components/dashboard/TotalSalesCard'
import { AttendantsCard } from '../components/dashboard/AttendantsCard'
import { RecentActivityCard } from '../components/dashboard/RecentActivityCard'
import { ActionBar } from '../components/dashboard/ActionBar'
import { useMinWidth } from '../hooks/useIsDesktop'
import { apiFetch, type Shift } from '../lib/api'

export function DashboardPage() {
  const [selectedPump, setSelectedPump] = useState<Pump | null>(null)
  const [selectedTank, setSelectedTank] = useState<TankGrade | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<AccountType>('Cash')
  const [currentShiftId, setCurrentShiftId] = useState<string | null>(null)

  const isDesktop = useMinWidth(1200)
  const isWide = useMinWidth(1686)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    apiFetch<Shift[]>(`/shifts?date=${today}`)
      .then((shifts) => setCurrentShiftId(shifts[0]?.id ?? null))
      .catch(() => {})
  }, [])

  function handlePumpSelect(pump: Pump | null) {
    setSelectedPump(pump)
    if (pump) setSelectedTank(null)
  }

  function handleTankSelect(grade: TankGrade | null) {
    setSelectedTank(grade)
    if (grade) setSelectedPump(null)
  }

  function closeDetail() {
    setSelectedPump(null)
    setSelectedTank(null)
  }

  const showDetail = selectedPump !== null || selectedTank !== null

  useEffect(() => {
    if (!showDetail || isWide) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDetail() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showDetail, isWide])

  const detailContent = (
    <>
      {selectedPump && <PumpDetailPanel pump={selectedPump} shiftId={currentShiftId} />}
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
            <PumpsPanel selected={selectedPump} onSelect={handlePumpSelect} />
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
            <PumpsPanel selected={selectedPump} onSelect={handlePumpSelect} />
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
