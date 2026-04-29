import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'

const attendantNames = ['T. Brisco', 'S. Smith', 'S. Lawes', 'A. Lewis']
const pumps = ['Pump 1', 'Pump 2', 'Pump 3', 'Pump 4']

interface AttendantEntry {
  id: number
  name: string
  pump: string
  clockIn: string
  period: 'AM' | 'PM'
}

interface Props {
  onClose: () => void
}

let nextId = 1

export function ManageAttendantsModal({ onClose }: Props) {
  useEscapeKey(onClose)
  const [entries, setEntries] = useState<AttendantEntry[]>([
    { id: nextId++, name: attendantNames[0], pump: pumps[0], clockIn: '6:30', period: 'AM' },
  ])

  function addEntry() {
    setEntries((prev) => [...prev, { id: nextId++, name: attendantNames[0], pump: pumps[0], clockIn: '', period: 'AM' }])
  }

  function removeEntry(id: number) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function updateEntry(id: number, field: keyof AttendantEntry, value: string) {
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, [field]: value } : e))
  }

  function isDuplicatePump(entry: AttendantEntry) {
    return entries.some((e) => e.id !== entry.id && e.pump === entry.pump)
  }

  function isDuplicateNamePump(entry: AttendantEntry) {
    return entries.some((e) => e.id !== entry.id && e.name === entry.name && e.pump === entry.pump)
  }

  function isInvalid(entry: AttendantEntry) {
    return isDuplicatePump(entry) || isDuplicateNamePump(entry)
  }

  const hasErrors = entries.some(isInvalid)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[740px] p-8 shadow-xl max-h-[90vh] overflow-y-auto"
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
        <p className="text-[14px] text-[#888] font-medium mb-8">Please to use accurate info</p>

        <div className="flex flex-col gap-4 mb-4">
          {entries.map((entry) => {
            const dupPump = isDuplicatePump(entry)
            const dupNamePump = isDuplicateNamePump(entry)
            return (
            <div key={entry.id} className="flex items-end gap-4">
              <div className="flex-1">
                {entries.indexOf(entry) === 0 && (
                  <label className="text-[13px] font-semibold text-[#888] block mb-2">Attendant</label>
                )}
                <select
                  value={entry.name}
                  onChange={(e) => updateEntry(entry.id, 'name', e.target.value)}
                  className={`w-full border rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] bg-white focus:outline-none cursor-pointer ${dupNamePump ? 'border-red-400' : 'border-[#e0e0e0]'}`}
                >
                  {attendantNames.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                {entries.indexOf(entry) === 0 && (
                  <label className="text-[13px] font-semibold text-[#888] block mb-2">Pump</label>
                )}
                <select
                  value={entry.pump}
                  onChange={(e) => updateEntry(entry.id, 'pump', e.target.value)}
                  className={`border rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] bg-white focus:outline-none cursor-pointer min-w-[120px] ${dupPump ? 'border-red-400' : 'border-[#e0e0e0]'}`}
                >
                  {pumps.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                {entries.indexOf(entry) === 0 && (
                  <label className="text-[13px] font-semibold text-[#888] block mb-2">Clock in</label>
                )}
                <div className="flex items-center border border-[#e0e0e0] rounded-xl px-4 py-2.5 gap-2">
                  <input
                    type="text"
                    value={entry.clockIn}
                    onChange={(e) => updateEntry(entry.id, 'clockIn', e.target.value)}
                    placeholder="0:00"
                    className="flex-1 text-[13px] font-semibold text-[#333] focus:outline-none bg-transparent min-w-0"
                  />
                  <button
                    onClick={() => updateEntry(entry.id, 'period', entry.period === 'AM' ? 'PM' : 'AM')}
                    className="text-[13px] font-semibold text-[#888] hover:text-[#333] transition-colors flex-shrink-0"
                  >
                    {entry.period}
                  </button>
                </div>
              </div>
              <button
                onClick={() => removeEntry(entry.id)}
                className="pb-2.5 text-[13px] font-semibold text-[#888] hover:text-[#333] transition-colors flex-shrink-0"
              >
                Remove
              </button>
            </div>
            )
          })}
        </div>

        <div className="flex justify-end mb-6">
          <button
            onClick={addEntry}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-[#555] hover:text-[#111] transition-colors"
          >
            <Plus size={13} />
            Add attendant
          </button>
        </div>

        <div className="border-t border-[#ebebeb] mb-6" />

        <button
          onClick={onClose}
          disabled={hasErrors}
          className="w-full py-4 rounded-2xl border border-[#e0e0e0] text-[15px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          Update
        </button>
      </div>
    </div>
  )
}
