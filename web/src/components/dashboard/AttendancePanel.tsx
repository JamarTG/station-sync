import { useState } from 'react'
import { Pencil, X, Check } from 'lucide-react'
import { useShiftAttendance } from '../../hooks/useApi'
import { api } from '../../lib/api'
import { useQueryClient } from '@tanstack/react-query'

function fmtTime(ts: string | null | undefined) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-JM', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function toInputValue(ts: string | null | undefined) {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface RowProps {
  attendance: {
    id: string
    shift_id: string
    user_name: string
    clock_in: string
    clock_out: string | null
  }
}

function AttendanceRow({ attendance }: RowProps) {
  const qc = useQueryClient()
  const [editing, setEditing]   = useState(false)
  const [clockIn, setClockIn]   = useState('')
  const [clockOut, setClockOut] = useState('')
  const [saving, setSaving]     = useState(false)

  function startEdit() {
    setClockIn(toInputValue(attendance.clock_in))
    setClockOut(toInputValue(attendance.clock_out))
    setEditing(true)
  }

  async function save() {
    setSaving(true)
    try {
      await api.patch(`/shifts/${attendance.shift_id}/attendance/${attendance.id}`, {
        clock_in:  clockIn  || attendance.clock_in,
        clock_out: clockOut || null,
      })
      await qc.invalidateQueries({ queryKey: ['attendance', attendance.shift_id] })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const isOpen = !attendance.clock_out

  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-[#f4f4f4] last:border-0">
      <div className="w-8 h-8 rounded-full bg-[#111] text-white flex items-center justify-center text-[12px] font-bold shrink-0">
        {attendance.user_name.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[#111] truncate">{attendance.user_name}</p>
        {editing ? (
          <div className="flex items-center gap-2 mt-1">
            <div>
              <p className="text-[10px] text-[#bbb] mb-0.5">Clock in</p>
              <input
                type="datetime-local"
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
                className="border border-[#ebebeb] rounded-lg px-2 py-1 text-[11px] text-[#111] focus:outline-none focus:border-[#111]"
              />
            </div>
            <div>
              <p className="text-[10px] text-[#bbb] mb-0.5">Clock out</p>
              <input
                type="datetime-local"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
                className="border border-[#ebebeb] rounded-lg px-2 py-1 text-[11px] text-[#111] focus:outline-none focus:border-[#111]"
              />
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-[#999]">
            {fmtTime(attendance.clock_in)} → {attendance.clock_out ? fmtTime(attendance.clock_out) : <span className="text-green-500 font-semibold">Active</span>}
          </p>
        )}
      </div>

      {!isOpen && !editing && (
        <p className="text-[12px] text-[#bbb] shrink-0">
          {(() => {
            const mins = (new Date(attendance.clock_out!).getTime() - new Date(attendance.clock_in).getTime()) / 60000
            const h = Math.floor(mins / 60)
            const m = Math.round(mins % 60)
            return `${h}h ${m}m`
          })()}
        </p>
      )}

      <div className="flex items-center gap-1 shrink-0">
        {editing ? (
          <>
            <button onClick={save} disabled={saving}
              className="w-7 h-7 rounded-full bg-[#111] text-white flex items-center justify-center hover:bg-[#333] transition-colors disabled:opacity-40">
              <Check size={12} />
            </button>
            <button onClick={() => setEditing(false)}
              className="w-7 h-7 rounded-full border border-[#ebebeb] flex items-center justify-center hover:bg-[#fafafa] transition-colors">
              <X size={12} className="text-[#888]" />
            </button>
          </>
        ) : (
          <button onClick={startEdit}
            className="w-7 h-7 rounded-full border border-[#ebebeb] flex items-center justify-center hover:bg-[#fafafa] transition-colors">
            <Pencil size={12} className="text-[#888]" />
          </button>
        )}
      </div>
    </div>
  )
}

interface Props {
  shiftId: string | undefined
}

export function AttendancePanel({ shiftId }: Props) {
  const { data: records = [], isLoading } = useShiftAttendance(shiftId)

  const active = records.filter((r) => !r.clock_out).length
  const done   = records.filter((r) =>  r.clock_out).length

  return (
    <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#f4f4f4] flex items-center justify-between">
        <div>
          <p className="text-[14px] font-bold text-[#111]">Attendance</p>
          {records.length > 0 && (
            <p className="text-[12px] text-[#999] mt-0.5">
              {active > 0 ? `${active} active` : ''}{active > 0 && done > 0 ? ' · ' : ''}{done > 0 ? `${done} clocked out` : ''}
            </p>
          )}
        </div>
      </div>

      {!shiftId ? (
        <p className="text-[13px] text-[#bbb] p-5">No shift for today.</p>
      ) : isLoading ? (
        <p className="text-[13px] text-[#aaa] p-5">Loading...</p>
      ) : records.length === 0 ? (
        <p className="text-[13px] text-[#bbb] p-5">No attendance records. Start a shift to auto-clock in attendants.</p>
      ) : (
        records.map((r) => <AttendanceRow key={r.id} attendance={r} />)
      )}
    </div>
  )
}
