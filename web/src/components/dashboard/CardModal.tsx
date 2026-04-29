import { useState } from 'react'
import { ArrowLeft, X, Plus } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'

const banks = ['NCB', 'Scotiabank', 'JMMB', 'Sagicor', 'FirstGlobal']
const fuelGrades = ['87', '90', 'ADO', 'ULSD']
const attendants = ['T. Brisco', 'S. Smith', 'S. Lawes', 'A. Lewis']

const pricePerLitre: Record<string, number> = {
  '87': 190.5,
  '90': 205.0,
  'ADO': 190.86,
  'ULSD': 210.0,
}

interface CardRecord {
  id: number
  amount: string
  bank: string
  fuel: string
  transNo: string
}

interface Props {
  onBack: () => void
  onClose: () => void
}

let nextId = 1

export function CardModal({ onBack, onClose }: Props) {
  useEscapeKey(onClose)
  const [records, setRecords] = useState<CardRecord[]>([
    { id: nextId++, amount: '', bank: 'NCB', fuel: '90', transNo: '' },
  ])
  const [attendant, setAttendant] = useState('')

  function updateRecord(id: number, field: keyof CardRecord, value: string) {
    setRecords((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r))
  }

  function addRecord() {
    setRecords((prev) => [...prev, { id: nextId++, amount: '', bank: 'NCB', fuel: '90', transNo: '' }])
  }

  function isDuplicateTransNo(record: CardRecord) {
    if (!record.transNo.trim()) return false
    return records.some(
      (r) => r.id !== record.id && r.bank === record.bank && r.transNo.trim() === record.transNo.trim()
    )
  }

  const hasDuplicates = records.some(isDuplicateTransNo)
  const total = records.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
  const litres = records.reduce((sum, r) => {
    const amt = parseFloat(r.amount) || 0
    const price = pricePerLitre[r.fuel]
    return sum + (price ? amt / price : 0)
  }, 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[740px] p-8 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            <ArrowLeft size={13} />
            Go back
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            <X size={13} />
            Cancel
          </button>
        </div>

        <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">Record card</h2>
        <p className="text-[14px] text-[#888] font-medium mb-6">Please use accurate info</p>

        <div className="flex flex-col gap-3 mb-2">
          {records.map((r) => (
            <div key={r.id} className="flex items-end gap-3">
              <div className="flex-1">
                {r.id === records[0].id && (
                  <label className="text-[13px] font-semibold text-[#888] block mb-2">amount</label>
                )}
                <div className="flex items-center border border-[#e0e0e0] rounded-xl px-4 py-2.5 gap-2">
                  <span className="text-[13px] font-bold text-[#aaa]">J$</span>
                  <input
                    type="number"
                    min={0}
                    value={r.amount}
                    onChange={(e) => updateRecord(r.id, 'amount', e.target.value)}
                    placeholder="0.00"
                    className="flex-1 text-[13px] font-semibold text-[#333] focus:outline-none bg-transparent min-w-0"
                  />
                  {r.fuel && pricePerLitre[r.fuel] && (parseFloat(r.amount) || 0) > 0 && (
                    <span className="text-[12px] text-[#bbb] font-medium flex-shrink-0">
                      {((parseFloat(r.amount) || 0) / pricePerLitre[r.fuel]).toFixed(2)}L
                    </span>
                  )}
                </div>
              </div>
              <div>
                {r.id === records[0].id && (
                  <label className="text-[13px] font-semibold text-[#888] block mb-2">bank</label>
                )}
                <select
                  value={r.bank}
                  onChange={(e) => updateRecord(r.id, 'bank', e.target.value)}
                  className="border border-[#e0e0e0] rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[#333] bg-white focus:outline-none cursor-pointer min-w-[120px]"
                >
                  {banks.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                {r.id === records[0].id && (
                  <label className="text-[13px] font-semibold text-[#888] block mb-2">fuel</label>
                )}
                <select
                  value={r.fuel}
                  onChange={(e) => updateRecord(r.id, 'fuel', e.target.value)}
                  className="border border-[#e0e0e0] rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[#333] bg-white focus:outline-none cursor-pointer min-w-[90px]"
                >
                  {fuelGrades.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                {r.id === records[0].id && (
                  <label className="text-[13px] font-semibold text-[#888] block mb-2">trans #</label>
                )}
                <input
                  type="text"
                  value={r.transNo}
                  onChange={(e) => updateRecord(r.id, 'transNo', e.target.value)}
                  placeholder="—"
                  className={`border rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[#333] focus:outline-none w-[100px] ${isDuplicateTransNo(r) ? 'border-red-400 bg-red-50' : 'border-[#e0e0e0]'}`}
                />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addRecord}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-[#555] hover:text-[#111] transition-colors mb-6 ml-auto"
        >
          <Plus size={13} />
          Add another record
        </button>

        <div className="border-t border-[#ebebeb] mb-6" />

        <div className="flex items-end gap-10 mb-6">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Total</p>
            <p className="text-[32px] font-bold text-[#111] leading-none tracking-tight">
              <span className="text-[18px] font-bold text-[#aaa] mr-1">J$</span>{total.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Litres</p>
            <p className="text-[32px] font-bold text-[#111] leading-none tracking-tight">
              {litres.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="mb-8">
          <label className="text-[13px] font-semibold text-[#888] block mb-2">Attendant</label>
          <select
            value={attendant}
            onChange={(e) => setAttendant(e.target.value)}
            className="border border-[#ddd] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] bg-white focus:outline-none cursor-pointer min-w-[200px]"
          >
            <option value="">Select...</option>
            {attendants.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        <button
          disabled={hasDuplicates}
          className="w-full py-4 rounded-2xl border border-[#e0e0e0] text-[15px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit
        </button>
      </div>
    </div>
  )
}
