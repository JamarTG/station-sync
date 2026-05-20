import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { ReportsDashboard } from '../components/dashboard/ReportsDashboard'
import { AttendantDashboard } from '../components/dashboard/AttendantDashboard'
import { CashierDashboard } from '../components/dashboard/CashierDashboard'
import { PumpsPanel, type Fuel } from '../components/dashboard/PumpsPanel'
import { PumpDetailPanel, type NozzleRow } from '../components/dashboard/PumpDetailPanel'
import { TanksPanel } from '../components/dashboard/TanksPanel'
import { TankDetailPanel } from '../components/dashboard/TankDetailPanel'
import { AccountsPanel, type AccountType } from '../components/dashboard/AccountsPanel'
import { TotalSalesCard } from '../components/dashboard/TotalSalesCard'
import { RecentActivityCard } from '../components/dashboard/RecentActivityCard'
import { ActionBar } from '../components/dashboard/ActionBar'
import { usePumps, useFuels, useNozzles, useOpenShift, useOpenCStoreShift, useShiftFuelPrices, useShiftAttendance, useTanks, useShiftTankLogs, useShiftFuelReceivals } from '../hooks/useApi'
import { closeShift, upsertTankLog, upsertNozzleLog, type Tank } from '../lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { EditFuelPricesModal } from '../components/dashboard/EditFuelPricesModal'
import { ConvenienceStoreBreakdownModal } from '../components/dashboard/ConvenienceStoreBreakdownModal'
import { ReportIssueModal } from '../components/dashboard/ReportIssueModal'
import { NewShiftLoginModal } from '../components/dashboard/NewShiftLoginModal'


const idleBtnClass = 'px-4 py-2 border border-[#ddd] rounded-xl text-[12px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors'

function SupervisorIdleView({ tanks, stationShiftOpen, cstoreShiftOpen }: { tanks: Tank[]; stationShiftOpen: boolean; cstoreShiftOpen: boolean }) {
  const navigate = useNavigate()
  const [showReportIssue, setShowReportIssue] = useState(false)
  const [showNewShiftLogin, setShowNewShiftLogin] = useState(false)

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col" style={{ scrollbarWidth: 'none' }}>
      <div className="p-5 space-y-8 flex-1">

        <section>
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-3">Service Station</p>
          <div className="flex gap-2 flex-wrap mb-4">
            <button onClick={() => setShowReportIssue(true)} className={idleBtnClass}>Report an issue</button>
            <button onClick={() => navigate({ to: '/schedule' })} className={idleBtnClass}>Request day off</button>
            <button onClick={() => setShowNewShiftLogin(true)} className={idleBtnClass}>{stationShiftOpen ? 'Takeover shift' : 'Start a new shift'}</button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-[#ebebeb] p-5">
              <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-3">
                Sales <span className="font-medium text-[#ccc] normal-case tracking-normal">| Previous shift</span>
              </p>
              <p className="text-[28px] font-bold text-[#111] leading-none mb-5">J$0.00</p>
              <div className="space-y-2 text-[12px] font-medium text-[#bbb]">
                <p>Shortages</p>
                <p>Overages</p>
                <p>Balance</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-[#ebebeb] p-5">
              <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-3">
                Tanks <span className="font-medium text-[#ccc] normal-case tracking-normal">| Previous shift</span>
              </p>
              <div className="space-y-2">
                {tanks.map((t) => (
                  <p key={t.id} className="text-[13px] font-medium text-[#555]">{t.fuel_name}</p>
                ))}
                {tanks.length === 0 && <p className="text-[13px] text-[#ccc]">No tanks configured</p>}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-[#ebebeb] p-5 flex flex-col">
              <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-3">
                Sales Breakdown <span className="font-medium text-[#ccc] normal-case tracking-normal">| Previous shift</span>
              </p>
              <div className="flex-1 flex items-center justify-center py-4">
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#e8e8e8" strokeWidth="8" />
                </svg>
              </div>
            </div>
          </div>
        </section>

        <section>
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-3">Convenience Store</p>
          <div className="flex gap-2 flex-wrap mb-4">
            <button onClick={() => setShowReportIssue(true)} className={idleBtnClass}>Report an issue</button>
            <button onClick={() => setShowNewShiftLogin(true)} className={idleBtnClass}>
              {cstoreShiftOpen ? 'Takeover shift' : 'Start a new shift'}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-[#ebebeb] p-5">
              <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-3">
                Sales <span className="font-medium text-[#ccc] normal-case tracking-normal">| Previous shift</span>
              </p>
              <p className="text-[28px] font-bold text-[#111] leading-none mb-5">J$0.00</p>
              <div className="space-y-2 text-[12px] font-medium text-[#bbb]">
                <p>Balance</p>
                <p>Top Product</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-[#ebebeb] p-5">
              <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-3">
                Customer <span className="font-medium text-[#ccc] normal-case tracking-normal">| Outstanding Balances</span>
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-[#ebebeb] p-5 flex flex-col">
              <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-3">
                Sales Breakdown <span className="font-medium text-[#ccc] normal-case tracking-normal">| Previous shift</span>
              </p>
              <div className="flex-1 flex items-center justify-center py-4">
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#e8e8e8" strokeWidth="8" />
                </svg>
              </div>
            </div>
          </div>
        </section>

      </div>

      <div className="py-3 text-center border-t border-[#f4f4f4] flex-shrink-0">
        <span className="text-[10px] font-medium text-[#ccc] tracking-widest">&copy; 2025 STATIONSYNC</span>
      </div>

      {showReportIssue && <ReportIssueModal onClose={() => setShowReportIssue(false)} />}
      {showNewShiftLogin && <NewShiftLoginModal onClose={() => setShowNewShiftLogin(false)} onConfirm={() => setShowNewShiftLogin(false)} />}
    </div>
  )
}

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

const managerRoles = new Set(['Super Admin', 'Admin', 'Manager'])

export function DashboardPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [selectedFuel, setSelectedFuel] = useState<Fuel | null>(null)
  const [selectedTank, setSelectedTank] = useState<Tank | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<AccountType>('Cash')
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 1237)
  const [calibrationModal, setCalibrationModal] = useState<'pumps' | 'tanks' | null>(null)
  const [showEditPrices, setShowEditPrices] = useState(false)
  const [showConvenienceBreakdown, setShowConvenienceBreakdown] = useState(false)
  const [shiftEnded, setShiftEnded] = useState(false)

  const [nozzleReadings, setNozzleReadings] = useState<Record<string, NozzleRow[]>>({})
  const [tankReadings, setTankReadings] = useState<Record<string, { opening: string; closing: string }>>({})
  const [savedPumpOpenings, setSavedPumpOpenings] = useState<Record<string, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem('ss_pump_closing_openings') ?? 'null') ?? {} } catch { return {} }
  })
  const [savedTankOpenings, setSavedTankOpenings] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('ss_tank_closing_openings') ?? 'null') ?? {} } catch { return {} }
  })

  const { data: shift, refetch: refetchShift } = useOpenShift()
  const { data: cstoreShift } = useOpenCStoreShift()
  const { data: pumps = [] } = usePumps()
  const { data: fuels = [] } = useFuels()
  const { data: tanks = [] } = useTanks()
  const { data: fuelPricesData = [] } = useShiftFuelPrices(shift?.id)
  const { data: shiftAttendance = [] } = useShiftAttendance(shift?.id)
  const { data: tankLogsData = [] } = useShiftTankLogs(shift?.id)
  const { data: receivalsData = [] } = useShiftFuelReceivals(shift?.id)

  const firstPump = pumps[0]

  const { data: pumpNozzles = [] } = useNozzles()

  function buildNozzleRows(fuelName: string, openings: string[] = []): NozzleRow[] {
    return pumpNozzles
      .filter((n) => n.fuel_name === fuelName)
      .map((n) => ({ nozzle: n, pumpIndex: pumps.findIndex((p) => p.id === n.pump_id) }))
      .filter((r) => r.pumpIndex >= 0)
      .sort((a, b) => a.pumpIndex - b.pumpIndex)
      .map(({ nozzle, pumpIndex }, i) => ({ nozzleId: nozzle.id, opening: openings[i] ?? '', closing: '', pumpNumber: pumpIndex + 1 }))
  }

  const fuelPrices: Record<string, number> = fuelPricesData.length > 0
    ? Object.fromEntries(fuelPricesData.map((fp) => [fp.fuel_name, fp.price]))
    : Object.fromEntries(fuels.map((f) => [f.name, 0]))

  const allFuelGrades = fuels.map((f) => f.name)

  // Map attendant name → pump indices (1-based) from live attendance data
  const attendantPumpMap: Record<string, number[]> = shiftAttendance
    .filter((a) => a.pump_id)
    .reduce<Record<string, number[]>>((acc, a) => {
      const idx = pumps.findIndex((p) => p.id === a.pump_id)
      if (idx < 0) return acc
      const pumpNumber = idx + 1
      if (!acc[a.user_name]) acc[a.user_name] = []
      if (!acc[a.user_name].includes(pumpNumber)) acc[a.user_name].push(pumpNumber)
      return acc
    }, {})

  function getNozzles(fuelType: string): NozzleRow[] {
    return nozzleReadings[fuelType] ?? buildNozzleRows(fuelType)
  }
  function setNozzles(fuelType: string, rows: NozzleRow[]) {
    const next = { ...nozzleReadings, [fuelType]: rows }
    setNozzleReadings(next)
    if (shift?.id) localStorage.setItem(`pump_readings_${shift.id}`, JSON.stringify(next))
  }

  async function handleShiftEnd() {
    if (!shift?.id) return

    for (const grade of allFuelGrades) {
      for (const row of getNozzles(grade)) {
        if (row.nozzleId && row.opening !== '' && row.closing !== '') {
          await upsertNozzleLog(shift.id, {
            nozzle_id: row.nozzleId,
            starting_reading: parseFloat(row.opening),
            ending_reading: parseFloat(row.closing),
          })
        }
      }
    }

    const newPumpOpenings: Record<string, string[]> = {}
    for (const grade of allFuelGrades) {
      newPumpOpenings[grade] = getNozzles(grade).map((n) => n.closing)
    }
    setSavedPumpOpenings(newPumpOpenings)
    localStorage.setItem('ss_pump_closing_openings', JSON.stringify(newPumpOpenings))

    const newTankOpenings: Record<string, string> = {}
    for (const tank of tanks) {
      newTankOpenings[tank.id] = tankReadings[tank.id]?.closing ?? ''
    }
    setSavedTankOpenings(newTankOpenings)
    localStorage.setItem('ss_tank_closing_openings', JSON.stringify(newTankOpenings))

    await closeShift(shift.id)
    queryClient.invalidateQueries({ queryKey: ['shifts', 'open'] })
    setShiftEnded(true)
  }

  function handleNewShift() {
    const newNozzleReadings: Record<string, NozzleRow[]> = {}
    for (const grade of allFuelGrades) {
      newNozzleReadings[grade] = buildNozzleRows(grade, savedPumpOpenings[grade] ?? [])
    }
    setNozzleReadings(newNozzleReadings)
    if (shift?.id) localStorage.setItem(`pump_readings_${shift.id}`, JSON.stringify(newNozzleReadings))

    const newTankReadings: Record<string, { opening: string; closing: string }> = {}
    for (const tank of tanks) {
      newTankReadings[tank.id] = { opening: savedTankOpenings[tank.id] ?? '', closing: '' }
    }
    setTankReadings(newTankReadings)

    setShiftEnded(false)
  }

  async function handleTankSave(r: { opening: string; closing: string }) {
    if (!shift?.id || !selectedTank) return
    const opening = r.opening !== '' ? parseFloat(r.opening) : null
    const closing = r.closing !== '' ? parseFloat(r.closing) : null
    await upsertTankLog(shift.id, {
      tank_id: selectedTank.id,
      opening_level: opening !== null && !isNaN(opening) ? opening : null,
      closing_level: closing !== null && !isNaN(closing) ? closing : null,
    })
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
  function allNozzlesComplete(fuelType: string): boolean {
    return getNozzles(fuelType).every((n) => n.opening !== '' && n.closing !== '')
  }
  function activeNozzlesComplete(fuelType: string): boolean {
    const active = getNozzles(fuelType).filter((n) => n.opening !== '' || n.closing !== '')
    return active.length > 0 && active.every((n) => n.opening !== '' && n.closing !== '')
  }

  const attendantGradeSalesMap: Record<string, Record<string, number>> = Object.fromEntries(
    Object.entries(attendantPumpMap).map(([name, pump]) => [
      name,
      Object.fromEntries(
        allFuelGrades.map((fuel) => {
          const litres = getNozzles(fuel)
            .filter((n) => n.pumpNumber !== undefined && pump.includes(n.pumpNumber))
            .reduce((sum, n) => {
              const o = parseFloat(n.opening)
              const c = parseFloat(n.closing)
              return sum + (!isNaN(o) && !isNaN(c) && c >= o ? c - o : 0)
            }, 0)
          return [fuel, litres * (fuelPrices[fuel] ?? 0)]
        })
      ),
    ])
  )
  const attendantSales = Object.fromEntries(
    Object.entries(attendantGradeSalesMap).map(([name, grades]) => [
      name,
      Object.values(grades).reduce((s, v) => s + v, 0),
    ])
  )
  const totalSalesAcrossPumps = allFuelGrades.reduce((sum, grade) => {
    if (!allNozzlesComplete(grade)) return sum
    return sum + pumpTotalForGrade(grade) * (fuelPrices[grade] ?? 0)
  }, 0)
  const totalLitresAcrossPumps = allFuelGrades.reduce((sum, grade) => {
    if (!allNozzlesComplete(grade)) return sum
    return sum + pumpTotalForGrade(grade)
  }, 0)
  const hasSalesData = allFuelGrades.some((g) => allNozzlesComplete(g) && hasPumpDataForGrade(g))
  const gradeSales: Record<string, number | null> = Object.fromEntries(
    allFuelGrades.map((grade) => [
      grade,
      allNozzlesComplete(grade) ? pumpTotalForGrade(grade) * (fuelPrices[grade] ?? 0) : null,
    ])
  )

  useEffect(() => {
    if (!shift?.id) return
    setNozzleReadings({})
    try {
      const raw = localStorage.getItem(`pump_readings_${shift.id}`)
      if (raw) setNozzleReadings(JSON.parse(raw))
    } catch {}
  }, [shift?.id])

  useEffect(() => {
    if (shift === undefined) refetchShift()
  }, [shift])

  useEffect(() => {
    if (tanks.length > 0 && !selectedTank) setSelectedTank(tanks[0])
  }, [tanks])

  useEffect(() => {
    if (!tankLogsData.length) return
    setTankReadings((prev) => {
      const next = { ...prev }
      for (const log of tankLogsData) {
        next[log.tank_id] = {
          opening: log.opening_level != null ? String(log.opening_level) : '',
          closing: log.closing_level != null ? String(log.closing_level) : '',
        }
      }
      return next
    })
  }, [tankLogsData])

  useEffect(() => {
    function onResize() {
      setIsNarrow(window.innerWidth < 1237)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function handleFuelSelect(fuel: Fuel) {
    setSelectedFuel(fuel)
    const match = tanks.find((t) => t.fuel_id === fuel.id)
    if (match) setSelectedTank(match)
  }

  function handleTankSelect(tank: Tank) {
    setSelectedTank(tank)
    const match = fuels.find((f) => f.id === tank.fuel_id)
    if (match) setSelectedFuel(match)
  }

  if (user && managerRoles.has(user.role)) return <ReportsDashboard />
  if (user?.role === 'Attendant') return <AttendantDashboard />
  if (user?.role === 'Cashier') return <CashierDashboard />

  if (!shift || shift.supervisor_id !== user?.id) {
    return <SupervisorIdleView tanks={tanks} stationShiftOpen={!!shift} cstoreShiftOpen={!!cstoreShift} />
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* Main scrollable content */}
      <div className="flex-[2] min-w-0 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        <div className="p-6 flex flex-col gap-5">
          <ActionBar shiftEnded={shiftEnded} canEndShift={allFuelGrades.every((g) => activeNozzlesComplete(g)) && tanks.every((t) => (tankReadings[t.id]?.opening ?? '') !== '' && (tankReadings[t.id]?.closing ?? '') !== '')} onShiftEnd={handleShiftEnd} onNewShift={handleNewShift} />

          <div>
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-3">Service Station</p>
            <TotalSalesCard totalSales={hasSalesData ? totalSalesAcrossPumps : 0} totalLitres={hasSalesData ? totalLitresAcrossPumps : 0} attendantSales={attendantSales} gradeSales={gradeSales} attendantGradeSales={attendantGradeSalesMap} shiftId={shift?.id} />
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
            <RecentActivityCard account={selectedAccount} readOnly={shiftEnded} attendantSales={attendantSales} attendantGradeSales={attendantGradeSalesMap} shiftId={shift?.id} />
          </div>

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
              <PumpsPanel selected={selectedFuel} onSelect={handleFuelSelect} onEditPrice={() => setShowEditPrices(true)} price={selectedFuel ? (fuelPrices[selectedFuel.name] || null) : null} />
              <div className="flex-1 overflow-hidden flex flex-col">
                {selectedFuel && firstPump && (
                  <PumpDetailPanel
                    pump={firstPump}
                    shiftId={shift?.id}
                    fuelType={selectedFuel.name}
                    nozzles={getNozzles(selectedFuel.name)}
                    onChange={(rows) => setNozzles(selectedFuel.name, rows)}
                    pricePerLitre={fuelPrices[selectedFuel.name]}
                    readOnly={shiftEnded}
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
              <TanksPanel tanks={tanks} selected={selectedTank} onSelect={handleTankSelect} />
              <div className="flex-1 overflow-hidden flex flex-col">
                  <TankDetailPanel
                    tank={selectedTank}
                    tankReading={tankReadings[selectedTank?.id ?? ''] ?? { opening: '', closing: '' }}
                    onReadingChange={(r) => selectedTank && setTankReadings((prev) => ({ ...prev, [selectedTank.id]: r }))}
                    onSave={handleTankSave}
                    actualLitresSold={selectedTank && hasPumpDataForGrade(selectedTank.fuel_name) ? pumpTotalForGrade(selectedTank.fuel_name) : null}
                    receival={receivalsData.find((r) => r.fuel_name === selectedTank?.fuel_name) ?? null}
                    shiftId={shift?.id}
                    readOnly={shiftEnded}
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
                  <PumpsPanel selected={selectedFuel} onSelect={handleFuelSelect} onEditPrice={() => setShowEditPrices(true)} price={selectedFuel ? (fuelPrices[selectedFuel.name] || null) : null} />
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
                    readOnly={shiftEnded}
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
                  <TanksPanel tanks={tanks} selected={selectedTank} onSelect={handleTankSelect} />
                </div>
                <div className="flex-1 overflow-y-auto">
                    <TankDetailPanel
                    tank={selectedTank}
                    tankReading={tankReadings[selectedTank?.id ?? ''] ?? { opening: '', closing: '' }}
                    onReadingChange={(r) => selectedTank && setTankReadings((prev) => ({ ...prev, [selectedTank.id]: r }))}
                    onSave={handleTankSave}
                    actualLitresSold={selectedTank && hasPumpDataForGrade(selectedTank.fuel_name) ? pumpTotalForGrade(selectedTank.fuel_name) : null}
                    receival={receivalsData.find((r) => r.fuel_name === selectedTank?.fuel_name) ?? null}
                    shiftId={shift?.id}
                    readOnly={shiftEnded}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {showEditPrices && (
        <EditFuelPricesModal
          fuels={fuels}
          initialPrices={fuelPricesData}
          shiftId={shift?.id}
          onClose={() => setShowEditPrices(false)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['shifts', shift?.id, 'fuel-prices'] })}
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
