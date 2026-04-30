import { TotalSalesCard } from '../components/dashboard/TotalSalesCard'
import { AttendantsCard } from '../components/dashboard/AttendantsCard'
import { RecentActivityCard } from '../components/dashboard/RecentActivityCard'
import { ActionBar } from '../components/dashboard/ActionBar'
import { FuelStationPanel } from '../components/dashboard/FuelStationPanel'
import { usePumps, useShiftForDate } from '../hooks/useApi'

export function DashboardPage() {
  const today = new Date().toISOString().slice(0, 10)
  const { data: shift } = useShiftForDate(today)
  const { data: pumps = [] } = usePumps()
  const firstPump = pumps[0]

  return (
    <div className="p-4 min-[1200px]:p-6 min-h-full min-[1200px]:h-full flex flex-col min-[1200px]:overflow-hidden">
      <div className="grid gap-4 min-[1200px]:gap-5 min-[1200px]:items-stretch grid-cols-1 min-[1200px]:grid-cols-[1fr_380px] flex-1 min-h-0">
        <div className="flex flex-col gap-4 min-h-0">
          <ActionBar />
          <TotalSalesCard />
          <div className="min-[1200px]:hidden">
            <FuelStationPanel pump={firstPump} shiftId={shift?.id} />
          </div>
          <AttendantsCard />
          <div className="flex-1 flex flex-col min-h-0">
            <RecentActivityCard />
          </div>
        </div>

        <div className="hidden min-[1200px]:flex flex-col gap-4 min-h-0">
          <FuelStationPanel pump={firstPump} shiftId={shift?.id} />
        </div>
      </div>
    </div>
  )
}
