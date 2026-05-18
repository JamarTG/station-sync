import { useState, useEffect, Fragment } from 'react'
import { Plus, X, ChevronRight } from 'lucide-react'
import { StationSyncLogo } from '../components/StationSyncLogo'
import { useOpenShift, usePumps, useFuels, useUsers } from '../hooks/useApi'
import { createShift, clockIn, upsertFuelPrice, type AuthUser } from '../lib/api'
import { useQueryClient } from '@tanstack/react-query'

interface Props {
  user: AuthUser
  onComplete: () => void
}

type Step = 'loading' | 'takeover' | 'attendants' | 'prices' | 'invite'

const gradeLabels: Record<string, string> = {
  '87': 'Unleaded 87',
  '90': 'Unleaded 90',
  'ADO': 'Auto Diesel',
  'ULSD': 'Ultra Low Sulphur',
}

function toInitialLastName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
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

function FlowTopBar() {
  return (
    <div className="bg-white border-b border-[#e8e8e8] px-8 py-4 flex items-center gap-2.5 flex-shrink-0">
      <div className="w-7 h-7 bg-[#111] rounded-xl flex items-center justify-center">
        <StationSyncLogo size={16} color="white" />
      </div>
      <span className="text-[14px] font-bold text-[#111]">StationSync</span>
    </div>
  )
}

interface AttendantEntry {
  name: string
  pumpName: string
  clockIn: string
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

export function ShiftLoginFlow({ user, onComplete }: Props) {
  const queryClient = useQueryClient()
  const { data: openShift, isLoading: loadingShift } = useOpenShift()
  const { data: allUsers = [], isLoading: loadingUsers } = useUsers()
  const { data: allPumps = [] } = usePumps()
  const { data: allFuels = [] } = useFuels()

  const attendants = allUsers.filter((u) => u.role === 'Attendant')

  const [step, setStep] = useState<Step>('loading')
  const [rows, setRows] = useState<AttendantEntry[]>([])
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isSupervisor = ['Super Admin', 'Branch Admin', 'Supervisor'].includes(user.role)

  useEffect(() => {
    if (!loadingShift && !loadingUsers && step === 'loading') {
      if (openShift) {
        setStep('takeover')
      } else if (!isSupervisor) {
        setStep('invite')
      } else if (attendants.length === 0) {
        onComplete()
      } else {
        setStep('attendants')
      }
    }
  }, [loadingShift, loadingUsers, openShift, step, isSupervisor, attendants.length, onComplete])

  useEffect(() => {
    if (allFuels.length > 0 && Object.keys(prices).length === 0) {
      setPrices(Object.fromEntries(allFuels.map((f) => [f.name, 190.90])))
    }
  }, [allFuels, prices])

  const assignedPumps = new Set(rows.map((r) => r.pumpName))
  const allPumpsAssigned = allPumps.length > 0 && allPumps.every((p) => assignedPumps.has(p.name))
  const canContinue = rows.length > 0 && rows.some((r) => r.name !== '')

  function addRow() {
    const nextPump = allPumps.find((p) => !assignedPumps.has(p.name))
    setRows((prev) => [...prev, { name: '', pumpName: nextPump?.name ?? '', clockIn: currentTime() }])
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

  async function handleStartShift() {
    setIsSubmitting(true)
    try {
      const now = new Date()
      const shift = await createShift({
        supervisor_id: user.id,
        date: now.toISOString().slice(0, 10),
        start_time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`,
      })

      for (const row of rows) {
        if (!row.name) continue
        const u = attendants.find((a) => a.name === row.name)
        if (!u) continue
        const pump = allPumps.find((p) => p.name === row.pumpName)
        const clockInTime = row.clockIn
          ? `${now.toISOString().slice(0, 10)}T${row.clockIn}:00`
          : undefined
        await clockIn(shift.id, u.id, pump?.id, clockInTime)
      }

      for (const fuel of allFuels) {
        const price = prices[fuel.name] ?? 0
        await upsertFuelPrice(shift.id, fuel.id, price)
      }

      queryClient.invalidateQueries({ queryKey: ['shifts', 'open'] })
      onComplete()
    } catch (err) {
      console.error('Failed to start shift:', err)
      setIsSubmitting(false)
    }
  }

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-[#f4f4f4] font-[Manrope] flex flex-col">
        <FlowTopBar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] font-semibold text-[#bbb]">Loading…</p>
        </div>
      </div>
    )
  }

  // ─── Takeover panel ────────────────────────────────────────────────────────
  if (step === 'takeover') {
    return (
      <div className="min-h-screen bg-[#f4f4f4] font-[Manrope] flex flex-col">
        <FlowTopBar />
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-[600px] flex flex-col items-center">
            <div className="mb-8 text-center">
              <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-3">Notice</p>
              <h1 className="text-[32px] font-bold text-[#111] leading-none mb-1.5">Shift in progress</h1>
              <p className="text-[14px] text-[#888] font-medium">How would you like to proceed?</p>
            </div>
            <div className="flex gap-3 w-full justify-center">
              <button
                onClick={onComplete}
                className="w-[260px] flex flex-col items-center justify-center rounded-2xl bg-white border border-[#ebebeb] text-[#111] hover:border-[#ccc] hover:bg-[#fafafa] transition-colors text-center px-6 py-10"
              >
                <span className="text-[14px] font-bold mb-2 leading-snug">Continue to current shift</span>
                <span className="text-[11px] font-medium text-[#aaa] leading-snug">Assume responsibility and continue where the previous operator left off.</span>
              </button>
              <button
                onClick={onComplete}
                className="w-[260px] flex flex-col items-center justify-center rounded-2xl bg-white border border-[#ebebeb] text-[#111] hover:border-[#ccc] hover:bg-[#fafafa] transition-colors text-center px-6 py-10"
              >
                <span className="text-[14px] font-bold mb-2 leading-snug">Continue to schedule</span>
                <span className="text-[11px] font-medium text-[#aaa] leading-snug">View the weekly schedule without taking over the active shift.</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Attendants panel ──────────────────────────────────────────────────────
  if (step === 'attendants') {
    const groups = groupRows(rows)

    return (
      <div className="min-h-screen bg-[#f4f4f4] font-[Manrope] flex flex-col">
        <FlowTopBar />

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-[760px]">
            <div className="mb-6">
              <h1 className="text-[32px] font-bold text-[#111] leading-none mb-1.5">
                {greeting()}, {toInitialLastName(user.name)}
              </h1>
              <p className="text-[14px] text-[#888] font-medium">
                Set up the attendants on duty for this shift.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden mb-4">
              {groups.length === 0 ? (
                <div className="py-14 flex flex-col items-center justify-center text-center px-6">
                  <p className="text-[13px] font-semibold text-[#bbb]">No attendants added yet</p>
                  <p className="text-[12px] text-[#ccc] mt-1">Press "Add attendant" below to get started</p>
                </div>
              ) : (
                groups.map((group) => (
                  <div key={group.key} className="px-5 py-4 border-b border-[#f0f0f0] last:border-b-0">
                    <div className="flex items-end gap-4">
                      {/* Attendant */}
                      <div className="w-[200px] flex-shrink-0">
                        <label className="block text-[10px] font-bold tracking-widest text-[#bbb] uppercase mb-1.5">
                          Attendant
                        </label>
                        <select
                          value={group.name}
                          onChange={(e) => updateGroup(group.indices, { name: e.target.value })}
                          className="w-full text-[13px] font-semibold text-[#333] bg-[#f4f4f4] rounded-xl px-3 py-2.5 outline-none cursor-pointer border-0 appearance-none"
                        >
                          <option value="">Select...</option>
                          {attendants.map((a) => (
                            <option key={a.id} value={a.name}>{a.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Pump(s) */}
                      <div className="flex-1 min-w-0">
                        <label className="block text-[10px] font-bold tracking-widest text-[#bbb] uppercase mb-1.5">
                          Pump(s)
                        </label>
                        <div className="flex items-center gap-2 flex-wrap">
                          {group.entries.map((entry, j) => (
                            <Fragment key={j}>
                              {j > 0 && (
                                <span className="text-[11px] font-bold text-[#bbb] select-none">&</span>
                              )}
                              <select
                                value={entry.pumpName}
                                onChange={(e) => {
                                  if (e.target.value === '__delete__') {
                                    setRows((prev) => prev.filter((_, i) => i !== group.indices[j]))
                                  } else {
                                    updateRow(group.indices[j], 'pumpName', e.target.value)
                                  }
                                }}
                                className="text-[13px] font-semibold text-[#333] bg-[#f4f4f4] rounded-xl px-3 py-2.5 outline-none cursor-pointer border-0 appearance-none"
                              >
                                {allPumps.map((p) => (
                                  <option key={p.id} value={p.name}>{p.name}</option>
                                ))}
                                <option disabled>──────────</option>
                                <option value="__delete__">Delete</option>
                              </select>
                            </Fragment>
                          ))}
                        </div>
                      </div>

                      {/* Clock In */}
                      <div className="w-[120px] flex-shrink-0">
                        <label className="block text-[10px] font-bold tracking-widest text-[#bbb] uppercase mb-1.5">
                          Clock in
                        </label>
                        <input
                          type="time"
                          value={group.entries[0].clockIn}
                          onChange={(e) => updateGroup(group.indices, { clockIn: e.target.value })}
                          className="w-full text-[13px] font-semibold text-[#333] bg-[#f4f4f4] rounded-xl px-3 py-2.5 outline-none border-0 text-center"
                        />
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => removeGroup(group.indices)}
                        className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-[#ccc] hover:text-[#888] hover:bg-[#f4f4f4] transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}

              {!allPumpsAssigned && (
                <button
                  onClick={addRow}
                  className="flex items-center gap-2 px-5 py-3.5 text-[13px] font-semibold text-[#888] hover:text-[#333] hover:bg-[#fafafa] transition-colors w-full text-left border-t border-[#f0f0f0]"
                >
                  <Plus size={14} />
                  Add attendant
                </button>
              )}
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

  // ─── Invite / no-shift panel (non-supervisors) ────────────────────────────
  if (step === 'invite') {
    return (
      <div className="min-h-screen bg-[#f4f4f4] font-[Manrope] flex flex-col">
        <FlowTopBar />
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-[600px]">
            <div className="mb-8 text-center">
              <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-3">Welcome</p>
              <h1 className="text-[32px] font-bold text-[#111] leading-none mb-1.5">
                {greeting()}, {toInitialLastName(user.name)}
              </h1>
              <p className="text-[14px] text-[#888] font-medium">
                No shift has been started yet. Your supervisor will kick things off shortly.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-[#ebebeb] px-6 py-10 flex flex-col items-center text-center mb-4">
              <div className="w-10 h-10 rounded-full bg-[#f4f4f4] flex items-center justify-center mb-4">
                <div className="w-3 h-3 rounded-full bg-[#ddd]" />
              </div>
              <p className="text-[13px] font-semibold text-[#888]">Waiting for shift to begin</p>
              <p className="text-[12px] text-[#bbb] mt-1">You'll be clocked in once your supervisor starts the shift.</p>
            </div>
            <button
              onClick={onComplete}
              className="w-full py-3.5 rounded-2xl bg-[#111] text-white text-[13px] font-bold hover:bg-[#333] transition-colors"
            >
              Continue to dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Fuel prices panel ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f4f4f4] font-[Manrope] flex flex-col">
      <FlowTopBar />

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-[480px]">
          <div className="mb-6">
            <h1 className="text-[32px] font-bold text-[#111] leading-none mb-1.5">Fuel prices</h1>
            <p className="text-[14px] text-[#888] font-medium">Set the fuel prices for this shift.</p>
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
              disabled={isSubmitting}
              className="flex-1 py-3.5 rounded-2xl bg-[#111] text-white text-[13px] font-bold hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Starting…' : 'Start shift'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
