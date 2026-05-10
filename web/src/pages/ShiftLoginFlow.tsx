import { useState, Fragment } from 'react'
import { Plus, X, ChevronRight } from 'lucide-react'
import { StationSyncLogo } from '../components/StationSyncLogo'
import { getShiftData, saveShiftData, defaultFuelPrices, type AttendantEntry } from '../lib/shiftStore'

interface Props {
  onComplete: () => void
}

type Step = 'takeover' | 'attendants' | 'prices'

const ATTENDANTS = [
  'S. Lawes', 'S. Smith', 'T. Brisco', 'M. Brown',
  'D. Johnson', 'A. Clarke', 'R. Thompson', 'K. Williams',
]

const PUMPS = ['1', '2', '3', '4', '5', '6']

const gradeLabels: Record<string, string> = {
  '87': 'Unleaded 87',
  '90': 'Unleaded 90',
  'ADO': 'Auto Diesel',
  'ULSD': 'Ultra Low Sulphur',
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function currentTime(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function GlassBackground() {
  return (
    <>
      <video
        autoPlay loop muted playsInline
        className="absolute inset-0 w-full h-full object-cover scale-105"
        style={{ filter: 'blur(12px)' }}
      >
        <source src="/bg-video.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/40" />
    </>
  )
}

function GlassFooter() {
  return (
    <p className="text-center text-[11px] text-white/30 font-medium mt-4">
      © {new Date().getFullYear()} StationSync. All rights reserved.
    </p>
  )
}

interface RowGroup {
  key: string
  name: string
  entries: AttendantEntry[]
  indices: number[]
}

function groupRows(rows: AttendantEntry[]): RowGroup[] {
  return rows.reduce<RowGroup[]>((acc, row, i) => {
    if (row.name) {
      const existing = acc.find((g) => g.name === row.name)
      if (existing) {
        existing.entries.push(row)
        existing.indices.push(i)
        return acc
      }
      acc.push({ key: row.name, name: row.name, entries: [row], indices: [i] })
    } else {
      acc.push({ key: `_${i}`, name: '', entries: [row], indices: [i] })
    }
    return acc
  }, [])
}

export function ShiftLoginFlow({ onComplete }: Props) {
  const shiftData = getShiftData()
  const hasOpenShift = shiftData?.status === 'open'

  const [step, setStep] = useState<Step>(hasOpenShift ? 'takeover' : 'attendants')
  const [rows, setRows] = useState<AttendantEntry[]>([])
  const [prices, setPrices] = useState<Record<string, number>>(
    shiftData?.fuelPrices ?? defaultFuelPrices
  )

  const userName = shiftData?.userName ?? 'there'
  const canContinue = rows.length > 0 && rows.some((r) => r.name !== '')

  function addRow() {
    setRows((prev) => [...prev, { name: '', pump: String(prev.length + 1), clockIn: currentTime() }])
  }

  function updateRow(i: number, field: keyof AttendantEntry, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  }

  function updateGroup(indices: number[], patch: Partial<AttendantEntry>) {
    setRows((prev) => prev.map((r, i) => (indices.includes(i) ? { ...r, ...patch } : r)))
  }

  function removeGroup(indices: number[]) {
    setRows((prev) => prev.filter((_, i) => !indices.includes(i)))
  }

  function handleStartShift() {
    saveShiftData({ status: 'open', attendants: rows, fuelPrices: prices })
    onComplete()
  }

  function handleTakeover() {
    saveShiftData({ attendants: rows })
    onComplete()
  }

  // ─── Takeover panel ────────────────────────────────────────────────────────
  if (step === 'takeover') {
    return (
      <div className="relative min-h-screen font-[Manrope] flex items-center justify-center p-4 overflow-hidden">
        <GlassBackground />
        <div className="relative z-10 w-full max-w-[680px]">
          <div className="bg-white/20 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-10">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 border border-white/30 rounded-2xl mb-4">
                <StationSyncLogo size={26} color="white" />
              </div>
              <h1 className="text-[24px] font-bold text-white leading-none mb-2">Active shift</h1>
              <p className="text-[13px] text-white/60 font-medium">
                A shift is already in progress. How would you like to proceed?
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleTakeover}
                className="flex-1 aspect-square flex flex-col items-center justify-center rounded-2xl bg-black/50 backdrop-blur-sm border border-white/15 text-white hover:bg-black/65 transition-colors text-center px-5"
              >
                <span className="text-[14px] font-bold mb-2 leading-snug">Takeover current shift</span>
                <span className="text-[11px] font-medium text-white/50 leading-snug">Assume responsibility and continue where the previous operator left off.</span>
              </button>
              <button
                onClick={onComplete}
                className="flex-1 aspect-square flex flex-col items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/15 transition-colors text-center px-5"
              >
                <span className="text-[14px] font-bold mb-2 leading-snug">Continue to weekly schedule</span>
                <span className="text-[11px] font-medium text-white/50 leading-snug">View the weekly schedule without taking over the active shift.</span>
              </button>
            </div>
          </div>
          <GlassFooter />
        </div>
      </div>
    )
  }

  // ─── Attendants panel ──────────────────────────────────────────────────────
  if (step === 'attendants') {
    const groups = groupRows(rows)

    return (
      <div className="min-h-screen bg-[#f4f4f4] font-[Manrope] flex flex-col">
        <div className="bg-white border-b border-[#e8e8e8] px-8 py-4 flex items-center gap-2.5 flex-shrink-0">
          <div className="w-7 h-7 bg-[#111] rounded-xl flex items-center justify-center">
            <StationSyncLogo size={16} color="white" />
          </div>
          <span className="text-[14px] font-bold text-[#111]">StationSync</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-[760px]">
            <div className="mb-6">
              <h1 className="text-[32px] font-bold text-[#111] leading-none mb-1.5">
                {greeting()}, {userName}
              </h1>
              <p className="text-[14px] text-[#888] font-medium">
                Set up the attendants on duty for this shift.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden mb-4">
              {/* Column headers */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-[#f0f0f0]">
                <span className="w-[190px] flex-shrink-0 text-[11px] font-bold tracking-widest text-[#aaa] uppercase">
                  Attendant
                </span>
                <span className="flex-1 text-[11px] font-bold tracking-widest text-[#aaa] uppercase">
                  Pump
                </span>
                <span className="w-[120px] flex-shrink-0 text-[11px] font-bold tracking-widest text-[#aaa] uppercase text-center">
                  Clock In
                </span>
                <span className="w-[36px]" />
              </div>

              {/* Grouped rows */}
              {groups.map((group) => (
                <div
                  key={group.key}
                  className="flex items-center gap-3 px-5 py-3 border-b border-[#f9f9f9] last:border-b-0"
                >
                  {/* Attendant dropdown */}
                  <div className="w-[190px] flex-shrink-0">
                    <select
                      value={group.name}
                      onChange={(e) => updateGroup(group.indices, { name: e.target.value })}
                      className="w-full text-[13px] font-semibold text-[#333] bg-[#f4f4f4] rounded-lg px-3 py-2 outline-none cursor-pointer border-0 appearance-none"
                    >
                      <option value="">Select attendant...</option>
                      {ATTENDANTS.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>

                  {/* Pump column — expands with & between each dropdown */}
                  <div className="flex-1 flex items-center gap-2 flex-wrap min-w-0">
                    {group.entries.map((entry, j) => (
                      <Fragment key={j}>
                        {j > 0 && (
                          <span className="text-[11px] font-bold text-[#bbb] select-none px-0.5">
                            &
                          </span>
                        )}
                        <select
                          value={entry.pump}
                          onChange={(e) => {
                            if (e.target.value === '__delete__') {
                              setRows((prev) => prev.filter((_, i) => i !== group.indices[j]))
                            } else {
                              updateRow(group.indices[j], 'pump', e.target.value)
                            }
                          }}
                          className="text-[13px] font-semibold text-[#333] bg-[#f4f4f4] rounded-lg px-3 py-2 outline-none cursor-pointer border-0 appearance-none"
                        >
                          {PUMPS.map((p) => (
                            <option key={p} value={p}>Pump {p}</option>
                          ))}
                          <option disabled>──────────</option>
                          <option value="__delete__">Delete</option>
                        </select>
                      </Fragment>
                    ))}
                  </div>

                  {/* Clock In — shared for the whole group */}
                  <div className="w-[120px] flex-shrink-0">
                    <input
                      type="time"
                      value={group.entries[0].clockIn}
                      onChange={(e) => updateGroup(group.indices, { clockIn: e.target.value })}
                      className="w-full text-[13px] font-semibold text-[#333] bg-[#f4f4f4] rounded-lg px-3 py-2 outline-none border-0 text-center"
                    />
                  </div>

                  {/* Remove entire group */}
                  <button
                    onClick={() => removeGroup(group.indices)}
                    className="w-[36px] flex-shrink-0 flex items-center justify-center h-9 rounded-lg text-[#ccc] hover:text-[#888] hover:bg-[#f4f4f4] transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}

              <button
                onClick={addRow}
                className="flex items-center gap-2 px-5 py-3.5 text-[13px] font-semibold text-[#888] hover:text-[#333] hover:bg-[#fafafa] transition-colors w-full text-left"
              >
                <Plus size={14} />
                Add attendant
              </button>
            </div>

            <button
              onClick={() => setStep('prices')}
              disabled={!canContinue}
              className="w-full py-3.5 rounded-2xl bg-[#111] text-white text-[13px] font-bold hover:bg-[#333] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Continue
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Fuel prices panel ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f4f4f4] font-[Manrope] flex flex-col">
      <div className="bg-white border-b border-[#e8e8e8] px-8 py-4 flex items-center gap-2.5 flex-shrink-0">
        <div className="w-7 h-7 bg-[#111] rounded-xl flex items-center justify-center">
          <StationSyncLogo size={16} color="white" />
        </div>
        <span className="text-[14px] font-bold text-[#111]">StationSync</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-[480px]">
          <div className="mb-6">
            <h1 className="text-[32px] font-bold text-[#111] leading-none mb-1.5">Fuel prices</h1>
            <p className="text-[14px] text-[#888] font-medium">
              {shiftData?.status === 'closed'
                ? 'Prices from the last shift. Adjust if needed.'
                : 'Set the fuel prices for this shift.'}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden mb-4">
            {Object.keys(prices).map((grade) => (
              <div key={grade} className="flex items-center justify-between px-5 py-4 border-b border-[#f9f9f9] last:border-b-0">
                <div>
                  <p className="text-[13px] font-semibold text-[#222]">{gradeLabels[grade] ?? grade}</p>
                  <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mt-0.5">{grade}</p>
                </div>
                <div className="flex items-center gap-1 bg-[#f4f4f4] rounded-xl px-3 py-2">
                  <span className="text-[12px] font-semibold text-[#aaa]">J$</span>
                  <input
                    type="number"
                    value={prices[grade]}
                    onChange={(e) =>
                      setPrices((prev) => ({ ...prev, [grade]: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-20 bg-transparent text-[13px] font-bold text-[#333] text-right outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('attendants')}
              className="flex-1 py-3.5 rounded-2xl border border-[#ddd] bg-white text-[#333] text-[13px] font-semibold hover:bg-[#f4f4f4] transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleStartShift}
              className="flex-1 py-3.5 rounded-2xl bg-[#111] text-white text-[13px] font-bold hover:bg-[#333] transition-colors"
            >
              Start shift
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
