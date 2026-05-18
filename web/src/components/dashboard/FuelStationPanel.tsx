import { useState, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import { useFuels, useFuelSummary, useNozzles, useShiftFuelReceivals, useTanks } from '../../hooks/useApi'
import type { Pump, FuelSummary } from '../../lib/api'
import { PumpDetailPanel, type NozzleRow } from './PumpDetailPanel'
import { FuelReceivalModal } from './FuelReceivalModal'
import { EditFuelReceivalModal } from './EditFuelReceivalModal'
import { fmtInput, parseInput, fmtNum } from '../../lib/fmt'

const emptyNozzles = (count: number): NozzleRow[] => Array.from({ length: count }, () => ({ opening: '', closing: '' }))

type View = 'pumps' | 'tanks'
type TankGrade = '87' | '90' | 'ADO' | 'ULSD'

const grades: TankGrade[] = ['87', '90', 'ADO', 'ULSD']

function FuelDropdown({
  summaries,
  active,
  onChange,
}: {
  summaries: FuelSummary[]
  active: string | null
  onChange: (name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const activeSummary = summaries.find((s) => s.fuelType === active)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative flex-1 py-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 border border-[#ddd] rounded-lg px-3 py-1.5"
      >
        <span className="text-[13px] font-semibold text-[#111]">{active ?? '—'}</span>
        {activeSummary && (
          <span className="text-[11px] text-[#aaa] font-medium">
            J${activeSummary.pricePerLitre.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )}
        <ChevronDown size={12} className={clsx('text-[#888] transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-[#e0e0e0] rounded-xl shadow-md py-1 min-w-[160px]">
          {summaries.map((s) => (
            <button
              key={s.fuelType}
              onClick={() => { onChange(s.fuelType); setOpen(false) }}
              className={clsx(
                'w-full text-left px-4 py-2.5 flex items-center justify-between gap-4 transition-colors',
                s.fuelType === active ? 'bg-[#f5f5f5]' : 'hover:bg-[#f9f9f9]'
              )}
            >
              <span className="text-[13px] font-semibold text-[#111]">{s.fuelType}</span>
              <span className="text-[11px] text-[#aaa] font-medium">
                J${s.pricePerLitre.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  pump: Pump | undefined
  shiftId: string | undefined
}

export function FuelStationPanel({ pump, shiftId }: Props) {
  const [view, setView] = useState<View>('pumps')

  const { data: fuels = [] } = useFuels()
  const { data: summaries = [] } = useFuelSummary(pump?.id, shiftId)
  const { data: pumpNozzles = [] } = useNozzles()
  const { data: receivals = [] } = useShiftFuelReceivals(shiftId)
  const { data: tanks = [] } = useTanks()
  const [selectedFuelName, setSelectedFuelName] = useState<string | null>(null)
  const activeFuelName = selectedFuelName ?? summaries[0]?.fuelType ?? fuels[0]?.name ?? null

  const [grade, setGrade] = useState<TankGrade>('87')
  const [tankTouched, setTankTouched] = useState<Record<string, boolean>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  // Nozzle readings keyed by fuel type, tank dip readings keyed by grade
  const [nozzleReadings, setNozzleReadings] = useState<Record<string, NozzleRow[]>>({})
  const [tankReadings, setTankReadings] = useState<Record<string, { opening: string; closing: string }>>({})

  useEffect(() => {
    if (!shiftId) return
    setNozzleReadings({})
    setTankReadings({})
    try {
      const raw = localStorage.getItem(`pump_readings_${shiftId}`)
      if (raw) setNozzleReadings(JSON.parse(raw))
    } catch {}
    try {
      const raw = localStorage.getItem(`tank_readings_${shiftId}`)
      if (raw) setTankReadings(JSON.parse(raw))
    } catch {}
  }, [shiftId])

  function nozzleCountForFuel(fuelName: string): number {
    return pumpNozzles.filter((n) => n.fuel_name === fuelName).length
  }

  function getNozzles(fuelType: string): NozzleRow[] {
    return nozzleReadings[fuelType] ?? emptyNozzles(nozzleCountForFuel(fuelType))
  }

  function setNozzles(fuelType: string, rows: NozzleRow[]) {
    const next = { ...nozzleReadings, [fuelType]: rows }
    setNozzleReadings(next)
    if (shiftId) localStorage.setItem(`pump_readings_${shiftId}`, JSON.stringify(next))
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
          {view === 'pumps' && summaries.length > 0 ? (
            <>
              <div className="sm:hidden flex-1 border-b-2 border-[#f0f0f0]">
                <FuelDropdown summaries={summaries} active={activeFuelName} onChange={setSelectedFuelName} />
              </div>
              <div className="hidden sm:flex flex-1 min-w-0">
                {summaries.map((s) => {
                  const isActive = s.fuelType === activeFuelName
                  return (
                    <button
                      key={s.fuelType}
                      onClick={() => setSelectedFuelName(s.fuelType)}
                      className={clsx(
                        'flex-shrink-0 py-4 mr-4 flex flex-col items-start border-b-2 transition-colors whitespace-nowrap',
                        isActive ? 'border-[#111]' : 'border-[#f0f0f0]'
                      )}
                    >
                      <span className={clsx('text-[13px] font-semibold', isActive ? 'text-[#111]' : 'text-[#aaa]')}>
                        {s.fuelType}
                      </span>
                      <span className="text-[10px] font-medium text-[#bbb]">
                        J${s.pricePerLitre.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-1 min-w-0">
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
                        isActive ? 'border-[#111] text-[#111]' : 'border-[#f0f0f0] text-[#aaa] hover:text-[#555]'
                      )}
                    >
                      {tab}
                    </button>
                  )
                })
              )}
            </div>
          )}

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
            <PumpDetailPanel
              pump={pump}
              shiftId={shiftId}
              fuelType={activeFuelName}
              pricePerLitre={summaries.find((s) => s.fuelType === activeFuelName)?.pricePerLitre}
              nozzles={getNozzles(activeFuelName ?? '')}
              onChange={(rows) => setNozzles(activeFuelName ?? '', rows)}
            />
          )}

          {view === 'tanks' && (() => {
            const tr = tankReadings[grade] ?? { opening: '', closing: '' }
            const tOpen = parseFloat(tr.opening)
            const tClose = parseFloat(tr.closing)
            const tankHasData = tr.opening !== '' || tr.closing !== ''
            const tankError = tankTouched[grade] && !isNaN(tOpen) && !isNaN(tClose) && tClose > tOpen
            const gradeReceival = receivals.find((r) => r.fuel_name === grade) ?? null
            const gradeTank = tanks.find((t) => t.fuel_name === grade) ?? null
            const openLvl = gradeReceival?.opening_level ?? null
            const closeLvl = gradeReceival?.closing_level ?? null
            const fuelReceived = openLvl != null && closeLvl != null ? closeLvl - openLvl : null
            const suggestedLitres = !isNaN(tOpen) && !isNaN(tClose)
              ? (fuelReceived != null ? tOpen + fuelReceived - tClose : tOpen >= tClose ? tOpen - tClose : null)
              : null
            const actualLitres = hasPumpDataForGrade(grade) ? pumpTotalForGrade(grade) : null
            const variance = suggestedLitres != null && actualLitres != null ? suggestedLitres - actualLitres : null
            const wetStockPct = variance != null && actualLitres != null && actualLitres > 0
              ? (variance / actualLitres) * 100
              : null

            return (
            <>
              <table className="w-full bg-[#F4F4F4]">
                <thead>
                  <tr className="border-b border-[#ebebeb]">
                    <th className="pt-6 pb-3 text-[11px] font-semibold text-[#aaa] text-center tracking-widest pl-5">OPENING</th>
                    <th className="pt-6 pb-3 text-[11px] font-semibold text-[#aaa] text-center tracking-widest pr-5">CLOSING</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className={clsx(tankError ? 'bg-red-50' : 'bg-[#F4F4F4]')}>
                    <td className="py-4 text-center">
                      <input
                        type="text"
                        value={fmtInput(tr.opening)}
                        onChange={(e) => {
                          const next = { ...tankReadings, [grade]: { ...tr, opening: parseInput(e.target.value) } }
                          setTankReadings(next)
                          if (shiftId) localStorage.setItem(`tank_readings_${shiftId}`, JSON.stringify(next))
                        }}
                        onBlur={() => setTankTouched((prev) => ({ ...prev, [grade]: true }))}
                        placeholder="—"
                        className={clsx(
                          'w-24 text-center text-[13px] font-medium bg-transparent outline-none placeholder:text-[#ddd] focus:bg-[#f5f5f5] rounded-md px-1 py-0.5 transition-colors',
                          tankError ? 'text-red-500' : 'text-[#333]'
                        )}
                      />
                    </td>
                    <td className="py-4 text-center">
                      <input
                        type="text"
                        value={fmtInput(tr.closing)}
                        onChange={(e) => {
                          const next = { ...tankReadings, [grade]: { ...tr, closing: parseInput(e.target.value) } }
                          setTankReadings(next)
                          if (shiftId) localStorage.setItem(`tank_readings_${shiftId}`, JSON.stringify(next))
                        }}
                        onBlur={() => setTankTouched((prev) => ({ ...prev, [grade]: true }))}
                        placeholder="—"
                        className={clsx(
                          'w-24 text-center text-[13px] font-medium bg-transparent outline-none placeholder:text-[#ddd] focus:bg-[#f5f5f5] rounded-md px-1 py-0.5 transition-colors',
                          tankError ? 'text-red-500' : 'text-[#333]'
                        )}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="px-5 pt-4 pb-2 border-t border-[#f0f0f0] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-widest text-[#aaa]">SUGGESTED LITRES SOLD</span>
                  <span className="text-[12px] font-bold text-[#333]">
                    {suggestedLitres != null ? fmtNum(suggestedLitres) : <span className="text-[#bbb]">---</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-widest text-[#aaa]">ACTUAL LITRES SOLD</span>
                  <span className="text-[12px] font-bold text-[#333]">
                    {actualLitres != null ? fmtNum(actualLitres) : <span className="text-[#bbb]">---</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-widest text-[#aaa]">VARIANCE</span>
                  <span className={clsx('text-[12px] font-bold', variance != null ? (variance < 0 ? 'text-red-500' : 'text-[#333]') : 'text-[#bbb]')}>
                    {variance != null ? fmtNum(variance) : '---'}
                  </span>
                </div>
              </div>

              <div className="px-5 pt-2 pb-4 border-t border-[#f0f0f0]">
                <p className="text-[10px] font-semibold tracking-widest text-[#aaa] mb-1">WET STOCK SUMMARY</p>
                <p className={clsx('text-[28px] font-bold leading-none tracking-tight', wetStockPct == null ? 'text-[#111]' : wetStockPct > 1 ? 'text-blue-500' : wetStockPct > -0.5 ? 'text-yellow-500' : wetStockPct < -0.5 ? 'text-red-500' : 'text-[#111]')}>
                  {wetStockPct != null
                    ? `${wetStockPct >= 0 ? '+' : ''}${wetStockPct.toFixed(2)}%`
                    : tankHasData || hasPumpDataForGrade(grade) ? '—' : '+0.00%'}
                </p>
              </div>

              {(() => {
                const gradeReceival = receivals.find((r) => r.fuel_name === grade) ?? null
                const gradeTank = tanks.find((t) => t.fuel_name === grade) ?? null
                const fuelOrdered = gradeReceival?.litres_ordered ?? null
                const openLvl = gradeReceival?.opening_level ?? null
                const closeLvl = gradeReceival?.closing_level ?? null
                const fuelReceived = openLvl != null && closeLvl != null ? closeLvl - openLvl : null
                const receivalVariance = fuelReceived != null && fuelOrdered != null ? fuelReceived - fuelOrdered : null
                return (
                <div className="border-t border-[#ebebeb] px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[12px] font-bold tracking-widest text-[#111]">RECEIVAL LOG</p>
                    {gradeReceival ? (
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
                      <span className={clsx('text-[12px] font-bold', fuelOrdered != null ? 'text-[#333]' : 'text-[#bbb]')}>
                        {fuelOrdered != null ? fmtNum(fuelOrdered) : '---'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold tracking-widest text-[#aaa]">FUEL RECEIVED</span>
                      <span className={clsx('text-[12px] font-bold', fuelReceived != null ? 'text-[#333]' : 'text-[#bbb]')}>
                        {fuelReceived != null ? fmtNum(fuelReceived) : '---'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] font-semibold text-[#aaa] mb-1">Variance</p>
                  <p className={clsx('text-[28px] font-bold leading-none', receivalVariance == null ? 'text-[#bbb]' : receivalVariance < 0 ? 'text-red-500' : 'text-[#111]')}>
                    {receivalVariance != null ? fmtNum(receivalVariance) : '---'}
                  </p>
                  {showAdd && (
                    <FuelReceivalModal
                      onBack={() => setShowAdd(false)}
                      onClose={() => setShowAdd(false)}
                      initialTankId={gradeTank?.id}
                    />
                  )}
                  {showEdit && gradeReceival && (
                    <EditFuelReceivalModal
                      onClose={() => setShowEdit(false)}
                      initialReceival={gradeReceival}
                    />
                  )}
                </div>
                )
              })()}
            </>
            )
          })()}
        </div>
      </div>

    </>
  )
}
