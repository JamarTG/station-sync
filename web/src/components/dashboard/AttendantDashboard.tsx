import { useState } from 'react'
import { useAuth } from '../../lib/authContext'
import {
  useOpenShift,
  useShiftAttendance,
  usePumps,
  useShiftDeposits,
  useFuelSummary,
} from '../../hooks/useApi'
import type { Deposit, Pump } from '../../lib/api'
import { CashDepositModal } from './CashDropModal'
import { CardModal } from './CardModal'
import { ChargeModal } from './ChargeModal'
import { FXModal } from './FXModal'
import { AdvanceModal } from './AdvanceModal'
import { ReportIssueModal } from './ReportIssueModal'

type RecordType = 'cash' | 'card' | 'charge' | 'fx' | 'advance' | null


function fmtTime(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const h = d.getHours()
  const m = d.getMinutes()
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function fmtJ(n: number): string {
  return `J$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

function ordinal(n: number): string {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

function parseMeta(d: Deposit): Record<string, unknown> {
  try { return d.metadata ? JSON.parse(d.metadata) : {} } catch { return {} }
}


export function AttendantDashboard() {
  const { user } = useAuth()
  const { data: shift } = useOpenShift()
  const { data: attendance = [] } = useShiftAttendance(shift?.id)
  const { data: pumps = [] } = usePumps()
  const { data: deposits = [] } = useShiftDeposits(shift?.id)
  const [selectedPumpIdx, setSelectedPumpIdx] = useState(0)
  const [recording, setRecording] = useState<RecordType>(null)
  const [showReportIssue, setShowReportIssue] = useState(false)

  const myAttendance = attendance.filter((a) => a.user_id === user?.id)
  const clockIn = myAttendance[0]?.clock_in

  const myPumpIds = myAttendance.map((a) => a.pump_id).filter(Boolean) as string[]
  const myPumpsWithIdx = myPumpIds
    .map((pid, i) => ({ pump: pumps.find((p) => p.id === pid), i }))
    .filter((x): x is { pump: Pump; i: number } => !!x.pump)
    .sort((a, b) => a.pump.name.localeCompare(b.pump.name, undefined, { numeric: true }))
  const myPumps = myPumpsWithIdx.map(({ pump }) => pump)

  const fs0 = useFuelSummary(myPumpIds[0], shift?.id)
  const fs1 = useFuelSummary(myPumpIds[1], shift?.id)
  const fs2 = useFuelSummary(myPumpIds[2], shift?.id)
  const fs3 = useFuelSummary(myPumpIds[3], shift?.id)
  const fs4 = useFuelSummary(myPumpIds[4], shift?.id)
  const fs5 = useFuelSummary(myPumpIds[5], shift?.id)
  const fs6 = useFuelSummary(myPumpIds[6], shift?.id)
  const fs7 = useFuelSummary(myPumpIds[7], shift?.id)

  const allSummaries = [
    fs0.data ?? [], fs1.data ?? [], fs2.data ?? [], fs3.data ?? [],
    fs4.data ?? [], fs5.data ?? [], fs6.data ?? [], fs7.data ?? [],
  ].slice(0, Math.max(myPumps.length, 1))

  const pumpTotals = allSummaries.map((summaries) => ({
    litres: summaries.reduce((s, fs) => s + fs.totalLitresSold, 0),
    sales: summaries.reduce((s, fs) => s + fs.totalSales, 0),
  }))

  const totalSales = pumpTotals.reduce((s, pt) => s + pt.sales, 0)

  const myDeposits = deposits.filter((d) => d.attendant_id === user?.id)
  const cashDeposits = myDeposits.filter((d) => d.type === 'Cash')
  const cardDeposits = myDeposits.filter((d) => d.type === 'Card')
  const chargeDeposits = myDeposits.filter((d) => d.type === 'Charge')
  const fxDeposits = myDeposits.filter((d) => d.type === 'FX')
  const advanceDeposits = myDeposits.filter((d) => d.type === 'Advance')

  const totalDeposited = cashDeposits.reduce((s, d) => s + d.amount, 0)

  const depositsByAttendant: Record<string, number> = {}
  for (const d of deposits) {
    if (d.type === 'Cash') {
      depositsByAttendant[d.attendant_id] = (depositsByAttendant[d.attendant_id] ?? 0) + d.amount
    }
  }
  const sortedTotals = Object.values(depositsByAttendant).sort((a, b) => b - a)
  const rank = totalDeposited > 0 ? sortedTotals.indexOf(totalDeposited) + 1 : 0

  const balance = totalSales - totalDeposited
  const selectedOrigIdx = myPumpsWithIdx[selectedPumpIdx]?.i ?? 0
  const selectedSummaries = allSummaries[selectedOrigIdx] ?? []
  const selectedPumpSales = pumpTotals[selectedOrigIdx]?.sales ?? 0

  const fuelSalesMap: Record<string, number> = {}
  const fuelLitresMap: Record<string, number> = {}
  for (const summaries of allSummaries) {
    for (const fs of summaries) {
      fuelSalesMap[fs.fuelType] = (fuelSalesMap[fs.fuelType] ?? 0) + fs.totalSales
      fuelLitresMap[fs.fuelType] = (fuelLitresMap[fs.fuelType] ?? 0) + fs.totalLitresSold
    }
  }
  const fuelBars = Object.entries(fuelSalesMap).sort(([, a], [, b]) => b - a)

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col" style={{ scrollbarWidth: 'none' }}>
      <div className="flex-1 p-5 flex gap-4">
        {/* Left column */}
        <div className="flex-[3] flex flex-col gap-4 min-w-0">
          {/* Action bar */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowReportIssue(true)}
              className="px-4 py-2 border border-[#ddd] rounded-xl text-[12px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors flex-shrink-0"
            >
              Report an issue
            </button>
            {clockIn && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase">Clock In</span>
                <span className="text-[12px] font-bold text-[#333]">{fmtTime(clockIn)}</span>
              </div>
            )}
          </div>

          {/* Total deposited */}
          <div className="bg-white rounded-2xl border border-[#ebebeb] p-5">
            <p className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase mb-2">Total Deposited</p>
            <p className="text-[26px] font-bold text-[#111] leading-none mb-4">{fmtJ(totalDeposited)}</p>
            <div className="flex items-center gap-5">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase mb-0.5">Total Sales</p>
                <p className="text-[15px] font-bold text-[#111]">{fmtJ(totalSales)}</p>
              </div>
              <div className="w-px h-8 bg-[#f0f0f0]" />
              <div>
                <p className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase mb-0.5">Balance</p>
                <p className={`text-[15px] font-bold ${balance < 0 ? 'text-red-500' : balance > 0 ? 'text-green-600' : 'text-[#111]'}`}>
                  {totalSales > 0 ? fmtJ(Math.abs(balance)) : '—'}
                </p>
              </div>
              <div className="w-px h-8 bg-[#f0f0f0]" />
              <div className="ml-auto">
                <p className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase mb-0.5">Leaderboard</p>
                <p className="text-[15px] font-bold text-[#111]">{rank > 0 ? ordinal(rank) : '—'}</p>
              </div>
            </div>
          </div>

          {/* Pumps panel */}
          {myPumps.length > 0 ? (
            <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col" style={{ height: '250px' }}>
              <div className="flex border-b border-[#f0f0f0] flex-shrink-0">
                {myPumps.map((pump, idx) => (
                  <button
                    key={pump.id}
                    onClick={() => setSelectedPumpIdx(idx)}
                    className={`flex-1 py-3 text-[11px] font-bold tracking-widest transition-colors border-b-2 ${
                      selectedPumpIdx === idx
                        ? 'text-[#111] border-[#111]'
                        : 'text-[#bbb] border-transparent hover:text-[#888]'
                    }`}
                  >
                    {pump.name.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto">
                {selectedSummaries.length > 0 ? selectedSummaries.map((fs) => (
                  <div key={fs.fuelType} className="flex items-center justify-between px-5 py-3 border-b border-[#f9f9f9]">
                    <span className="text-[11px] font-bold tracking-widest text-[#555] uppercase">{fs.fuelType}</span>
                    <div className="flex items-center gap-6">
                      <span className="text-[12px] font-semibold text-[#333]">{fmtJ(fs.totalSales)}</span>
                      <span className="text-[12px] font-semibold text-[#888] w-20 text-right">{fs.totalLitresSold.toFixed(2)} L</span>
                    </div>
                  </div>
                )) : (
                  <div className="py-6 text-center text-[12px] text-[#ccc] font-medium">No fuel data</div>
                )}
              </div>
              <div className="flex items-center justify-between px-5 py-3 bg-[#fafafa] border-t border-[#f0f0f0] flex-shrink-0">
                <span className="text-[11px] font-bold tracking-widest text-[#888] uppercase">Total</span>
                <div className="flex items-center gap-6">
                  <span className="text-[13px] font-bold text-[#111]">{fmtJ(selectedPumpSales)}</span>
                  <span className="text-[12px] font-bold text-[#888] w-20 text-right">{(pumpTotals[selectedOrigIdx]?.litres ?? 0).toFixed(2)} L</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#ebebeb] p-6 text-center">
              <p className="text-[13px] text-[#ccc] font-medium">No pump assigned</p>
            </div>
          )}

          {/* Fuel grade rankings */}
          {fuelBars.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#ebebeb] p-5">
              <p className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase mb-4">Fuel Rankings</p>
              <div className="flex flex-col gap-2">
                {fuelBars.map(([fuelType, sales], i) => {
                  const pct = totalSales > 0 ? ((sales / totalSales) * 100).toFixed(1) : '0.0'
                  const litres = fuelLitresMap[fuelType] ?? 0
                  return (
                    <div key={fuelType} className="flex items-center justify-between bg-[#f9f9f9] rounded-2xl py-4 px-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold tracking-widest text-[#ccc] uppercase">{ordinal(i + 1)}</span>
                        <span className="text-[22px] font-black text-[#111] tracking-tight leading-none">{fuelType}</span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-[18px] font-bold text-[#333] leading-none">{pct}%</span>
                        <span className="text-[11px] font-semibold text-[#aaa]">{litres.toFixed(2)} L</span>
                        <span className="text-[11px] font-semibold text-[#aaa]">{fmtJ(sales)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>

        {/* Right column */}
        <div className="flex-[2] min-w-0 border-l border-[#e8e8e8] overflow-y-auto scrollbar-hide -mr-5 -my-5 pl-5 py-5" style={{ scrollbarWidth: 'none' }}>

          {/* Cash */}
          <div className="p-5 border-b border-[#e8e8e8]">
            <p className="mb-4">
              <span className="text-[13px] font-bold text-[#111]">Cash</span>
              <span className="text-[13px] font-medium text-[#aaa]"> | Deposits</span>
            </p>
            {cashDeposits.length === 0 ? (
              <div className="py-4 flex items-center justify-center">
                <p className="text-[13px] font-medium text-[#bbb]">No cash deposits</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1 mb-3">
                {cashDeposits.slice(0, 3).map((d) => (
                  <div key={d.id} className="flex items-center justify-between py-1.5">
                    <p className="text-[13px] font-semibold text-[#111]">{fmtTime(d.created_at)}</p>
                    <p className="text-[13px] font-semibold text-[#333]">{fmtJ(d.amount)}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-end border-t border-[#f0f0f0] pt-3">
              <p className={`text-[13px] font-bold ${cashDeposits.length > 0 ? 'text-[#111]' : 'text-[#bbb]'}`}>{fmtJ(cashDeposits.reduce((s, d) => s + d.amount, 0))}</p>
            </div>
          </div>

          {/* Card */}
          <div className="p-5 border-b border-[#e8e8e8]">
            <p className="mb-4">
              <span className="text-[13px] font-bold text-[#111]">Card</span>
              <span className="text-[13px] font-medium text-[#aaa]"> | Deposits</span>
            </p>
            {cardDeposits.length === 0 ? (
              <div className="py-4 flex items-center justify-center">
                <p className="text-[13px] font-medium text-[#bbb]">No card deposits</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1 mb-3">
                {cardDeposits.slice(0, 3).map((d) => {
                  const meta = parseMeta(d)
                  return (
                    <div key={d.id} className="flex items-center justify-between py-1.5">
                      <p className="text-[13px] font-semibold text-[#111]">{String(meta.trans_no ?? fmtTime(d.created_at))}</p>
                      <p className="text-[13px] font-semibold text-[#333]">{fmtJ(d.amount)}</p>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="flex items-center justify-end border-t border-[#f0f0f0] pt-3">
              <p className={`text-[13px] font-bold ${cardDeposits.length > 0 ? 'text-[#111]' : 'text-[#bbb]'}`}>{fmtJ(cardDeposits.reduce((s, d) => s + d.amount, 0))}</p>
            </div>
          </div>

          {/* Charges */}
          <div className="p-5 border-b border-[#e8e8e8]">
            <p className="mb-4">
              <span className="text-[13px] font-bold text-[#111]">Charges</span>
              <span className="text-[13px] font-medium text-[#aaa]"> | Records</span>
            </p>
            {chargeDeposits.length === 0 ? (
              <div className="py-4 flex items-center justify-center">
                <p className="text-[13px] font-medium text-[#bbb]">No charges</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1 mb-3">
                {chargeDeposits.slice(0, 3).map((d) => {
                  const meta = parseMeta(d)
                  return (
                    <div key={d.id} className="flex items-center justify-between py-1.5">
                      <p className="text-[13px] font-semibold text-[#111]">{String(meta.fuel_type ?? '—')}</p>
                      <p className="text-[13px] font-semibold text-[#333]">{fmtJ(d.amount)}</p>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="flex items-center justify-end border-t border-[#f0f0f0] pt-3">
              <p className={`text-[13px] font-bold ${chargeDeposits.length > 0 ? 'text-[#111]' : 'text-[#bbb]'}`}>{fmtJ(chargeDeposits.reduce((s, d) => s + d.amount, 0))}</p>
            </div>
          </div>

          {/* Advance */}
          <div className="p-5 border-b border-[#e8e8e8]">
            <p className="mb-4">
              <span className="text-[13px] font-bold text-[#111]">Advance</span>
              <span className="text-[13px] font-medium text-[#aaa]"> | Records</span>
            </p>
            {advanceDeposits.length === 0 ? (
              <div className="py-4 flex items-center justify-center">
                <p className="text-[13px] font-medium text-[#bbb]">No advance records</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1 mb-3">
                {advanceDeposits.slice(0, 3).map((d) => {
                  const meta = parseMeta(d)
                  return (
                    <div key={d.id} className="flex items-center justify-between py-1.5">
                      <p className="text-[13px] font-semibold text-[#111]">{String(meta.fuel_type ?? '—')}</p>
                      <p className="text-[13px] font-semibold text-[#333]">{fmtJ(d.amount)}</p>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="flex items-center justify-end border-t border-[#f0f0f0] pt-3">
              <p className={`text-[13px] font-bold ${advanceDeposits.length > 0 ? 'text-[#111]' : 'text-[#bbb]'}`}>{fmtJ(advanceDeposits.reduce((s, d) => s + d.amount, 0))}</p>
            </div>
          </div>

          {/* FX */}
          <div className="p-5">
            <p className="mb-4">
              <span className="text-[13px] font-bold text-[#111]">FX</span>
              <span className="text-[13px] font-medium text-[#aaa]"> | Records</span>
            </p>
            {fxDeposits.length === 0 ? (
              <div className="py-4 flex items-center justify-center">
                <p className="text-[13px] font-medium text-[#bbb]">No FX records</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1 mb-3">
                {fxDeposits.slice(0, 3).map((d) => {
                  const meta = parseMeta(d)
                  return (
                    <div key={d.id} className="flex items-center justify-between py-1.5">
                      <p className="text-[13px] font-semibold text-[#111]">{String(meta.currency ?? '—')}</p>
                      <p className="text-[13px] font-semibold text-[#333]">{fmtJ(d.amount)}</p>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="flex items-center justify-end border-t border-[#f0f0f0] pt-3">
              <p className={`text-[13px] font-bold ${fxDeposits.length > 0 ? 'text-[#111]' : 'text-[#bbb]'}`}>{fmtJ(fxDeposits.reduce((s, d) => s + d.amount, 0))}</p>
            </div>
          </div>

        </div>
      </div>

      <div className="py-3 text-center border-t border-[#f4f4f4] flex-shrink-0">
        <span className="text-[10px] font-medium text-[#ccc] tracking-widest">&copy; 2025 STATIONSYNC</span>
      </div>

      {recording === 'cash' && (
        <CashDepositModal
          initialAttendant={user?.name ?? ''}
          onBack={() => setRecording(null)}
          onClose={() => setRecording(null)}
          shiftId={shift?.id}
        />
      )}
      {recording === 'card' && (
        <CardModal
          onBack={() => setRecording(null)}
          onClose={() => setRecording(null)}
          shiftId={shift?.id}
        />
      )}
      {recording === 'charge' && (
        <ChargeModal
          onBack={() => setRecording(null)}
          onClose={() => setRecording(null)}
          shiftId={shift?.id}
        />
      )}
      {recording === 'advance' && (
        <AdvanceModal
          onBack={() => setRecording(null)}
          onClose={() => setRecording(null)}
          shiftId={shift?.id}
        />
      )}
      {recording === 'fx' && (
        <FXModal
          onBack={() => setRecording(null)}
          onClose={() => setRecording(null)}
          shiftId={shift?.id}
        />
      )}
      {showReportIssue && (
        <ReportIssueModal onClose={() => setShowReportIssue(false)} />
      )}
    </div>
  )
}
