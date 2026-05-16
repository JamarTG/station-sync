import { Fragment, useState, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useShiftAttendance, usePumps, useUsers } from '../../hooks/useApi'
import { clockIn, updateAttendance, deleteAttendance } from '../../lib/api'

interface AttendantEntry {
  id: number
  attendanceId?: string
  originalClockIn?: string
  name: string
  pump: string
  clockIn: string
  period: 'AM' | 'PM'
}

interface RowGroup {
  key: string
  name: string
  entries: AttendantEntry[]
}

interface Props {
  onClose: () => void
  shiftId?: string
}

let nextId = 1

function parseClockIn(iso: string): { time: string; period: 'AM' | 'PM' } {
  const d = new Date(iso)
  let hours = d.getHours()
  const minutes = d.getMinutes()
  const period: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM'
  if (hours > 12) hours -= 12
  if (hours === 0) hours = 12
  return { time: `${hours}:${minutes.toString().padStart(2, '0')}`, period }
}

function buildClockInISO(timeStr: string, period: 'AM' | 'PM', baseDate: string): string {
  const [hStr = '0', mStr = '0'] = timeStr.split(':')
  let h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  if (isNaN(h)) h = 0
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return `${baseDate}T${String(h).padStart(2, '0')}:${String(isNaN(m) ? 0 : m).padStart(2, '0')}:00`
}

function groupEntries(entries: AttendantEntry[]): RowGroup[] {
  return entries.reduce<RowGroup[]>((acc, entry) => {
    if (entry.name) {
      const existing = acc.find((g) => g.name === entry.name)
      if (existing) {
        existing.entries.push(entry)
        return acc
      }
      acc.push({ key: String(entry.id), name: entry.name, entries: [entry] })
    } else {
      acc.push({ key: String(entry.id), name: '', entries: [entry] })
    }
    return acc
  }, [])
}

export function ManageAttendantsModal({ onClose, shiftId }: Props) {
  useEscapeKey(onClose)
  const queryClient = useQueryClient()
  const { data: attendance = [], isFetched: attendanceFetched } = useShiftAttendance(shiftId)
  const { data: pumps = [] } = usePumps()
  const { data: users = [] } = useUsers()

  const pumpOptions = pumps.map((p) => p.name)
  const attendantNames = users.filter((u) => u.role === 'Attendant').map((u) => u.name)

  const [entries, setEntries] = useState<AttendantEntry[]>([])
  const [initialized, setInitialized] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initialized) return
    if (!pumps.length) return
    if (shiftId && !attendanceFetched) return

    if (attendance.length > 0) {
      const mapped = attendance.map((a, idx) => {
        const pump = pumps.find((p) => p.id === a.pump_id)
        const { time, period } = parseClockIn(a.clock_in)
        return {
          id: idx + 1,
          attendanceId: a.id,
          originalClockIn: a.clock_in,
          name: a.user_name,
          pump: pump?.name ?? '',
          clockIn: time,
          period,
        }
      })
      nextId = mapped.length + 1
      setEntries(mapped)
    } else {
      setEntries([{ id: nextId++, name: '', pump: pumpOptions[0] ?? '', clockIn: '', period: 'AM' }])
    }
    setInitialized(true)
  }, [attendance, attendanceFetched, pumps, shiftId, initialized, pumpOptions])

  function addEntry() {
    setEntries((prev) => [...prev, { id: nextId++, name: '', pump: pumpOptions[0] ?? '', clockIn: '', period: 'AM' }])
  }

  function updateEntry(id: number, field: keyof AttendantEntry, value: string) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)))
  }

  function updateGroup(ids: number[], patch: Partial<AttendantEntry>) {
    setEntries((prev) => prev.map((e) => (ids.includes(e.id) ? { ...e, ...patch } : e)))
  }

  function removeGroup(ids: number[]) {
    setEntries((prev) => prev.filter((e) => !ids.includes(e.id)))
  }

  function removeSingle(id: number) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function isDuplicatePump(entry: AttendantEntry) {
    return entries.some((e) => e.id !== entry.id && e.pump === entry.pump)
  }

  const hasErrors = entries.some(isDuplicatePump)
  const groups = groupEntries(entries)
  const assignedPumps = new Set(entries.map((e) => e.pump))
  const allPumpsAssigned = pumpOptions.length > 0 && pumpOptions.every((p) => assignedPumps.has(p))

  async function handleSave() {
    if (!shiftId || hasErrors) return
    setLoading(true)
    setError('')
    try {
      const today = new Date().toISOString().split('T')[0]

      // Delete records that were removed
      const currentAttendanceIds = new Set(
        entries.filter((e) => e.attendanceId).map((e) => e.attendanceId!)
      )
      for (const a of attendance) {
        if (!currentAttendanceIds.has(a.id)) {
          await deleteAttendance(shiftId, a.id)
        }
      }

      // Create or update remaining entries
      for (const entry of entries) {
        if (!entry.name) continue
        const pumpObj = pumps.find((p) => p.name === entry.pump)
        const pumpId = pumpObj?.id ?? null
        const baseDate = entry.originalClockIn
          ? entry.originalClockIn.split(/[T ]/)[0]
          : today
        const clockInISO = entry.clockIn
          ? buildClockInISO(entry.clockIn, entry.period, baseDate)
          : undefined

        const user = users.find((u) => u.name === entry.name)
        if (!user) continue

        if (entry.attendanceId) {
          await updateAttendance(shiftId, entry.attendanceId, {
            user_id: user.id,
            pump_id: pumpId,
            clock_in: clockInISO,
          })
        } else {
          await clockIn(shiftId, user.id, pumpId ?? undefined, clockInISO)
        }
      }

      queryClient.invalidateQueries({ queryKey: ['shifts', shiftId, 'attendance'] })
      onClose()
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[960px] p-8 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end mb-8">
          <button
            onClick={onClose}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            <X size={13} />
            Cancel
          </button>
        </div>

        <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">Manage attendants</h2>
        <p className="text-[14px] text-[#888] font-medium mb-8">Please use accurate info</p>

        {/* Column headers */}
        <div className="flex items-center gap-4 mb-2 px-0.5">
          <span className="flex-1 text-[13px] font-semibold text-[#888]">Attendant</span>
          <span className="flex-1 text-[13px] font-semibold text-[#888]">Pump(s)</span>
          <span className="flex-1 text-[13px] font-semibold text-[#888]">Clock in</span>
          <span className="w-[60px]" />
        </div>

        <div className="flex flex-col gap-3 mb-4">
          {groups.map((group) => {
            const groupIds = group.entries.map((e) => e.id)
            const hasPumpError = group.entries.some(isDuplicatePump)

            return (
              <div key={group.key} className="flex items-center gap-4">
                {/* Attendant */}
                <div className="flex-1">
                  <select
                    value={group.name}
                    onChange={(e) => updateGroup(groupIds, { name: e.target.value })}
                    className="w-full border border-[#e0e0e0] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] bg-white focus:outline-none cursor-pointer appearance-none"
                  >
                    <option value="">Select...</option>
                    {attendantNames.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                {/* Pump(s) */}
                <div className="flex-1 flex items-center gap-2 flex-wrap min-w-0">
                  {group.entries.map((entry, j) => (
                    <Fragment key={entry.id}>
                      {j > 0 && (
                        <span className="text-[11px] font-bold text-[#bbb] select-none">&</span>
                      )}
                      <select
                        value={entry.pump}
                        onChange={(e) => {
                          if (e.target.value === '__delete__') {
                            group.entries.length === 1 ? removeGroup(groupIds) : removeSingle(entry.id)
                          } else {
                            updateEntry(entry.id, 'pump', e.target.value)
                          }
                        }}
                        className={`border rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[#333] bg-white focus:outline-none cursor-pointer appearance-none w-[100px] ${hasPumpError ? 'border-red-400' : 'border-[#e0e0e0]'}`}
                      >
                        {pumpOptions.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                        <option disabled>──────────</option>
                        <option value="__delete__">Delete</option>
                      </select>
                    </Fragment>
                  ))}
                </div>

                {/* Clock in */}
                <div className="flex-1">
                  <div className="flex items-center border border-[#e0e0e0] rounded-xl px-4 py-2.5 gap-2">
                    <input
                      type="text"
                      value={group.entries[0].clockIn}
                      onChange={(e) => updateGroup(groupIds, { clockIn: e.target.value })}
                      placeholder="0:00"
                      className="flex-1 text-[13px] font-semibold text-[#333] focus:outline-none bg-transparent min-w-0"
                    />
                    <button
                      onClick={() => updateGroup(groupIds, { period: group.entries[0].period === 'AM' ? 'PM' : 'AM' })}
                      className="text-[13px] font-semibold text-[#888] hover:text-[#333] transition-colors flex-shrink-0"
                    >
                      {group.entries[0].period}
                    </button>
                  </div>
                </div>

                {/* Remove */}
                <button
                  onClick={() => removeGroup(groupIds)}
                  className="w-[60px] text-[13px] font-semibold text-[#888] hover:text-[#333] transition-colors text-right flex-shrink-0"
                >
                  Remove
                </button>
              </div>
            )
          })}
        </div>

        {!allPumpsAssigned && (
          <div className="flex justify-end mb-6">
            <button
              onClick={addEntry}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-[#555] hover:text-[#111] transition-colors"
            >
              <Plus size={13} />
              Add attendant
            </button>
          </div>
        )}

        <div className="border-t border-[#ebebeb] mb-6" />

        {error && <p className="text-[11px] font-semibold text-red-500 mb-3">{error}</p>}

        <button
          onClick={handleSave}
          disabled={loading || hasErrors}
          className="w-full py-4 rounded-2xl border border-[#e0e0e0] text-[15px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          {loading ? 'Saving...' : 'Update'}
        </button>
      </div>
    </div>
  )
}
