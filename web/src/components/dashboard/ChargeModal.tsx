import { useState } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'

const fuelGrades = ['87', '90', 'ADO', 'ULSD']
const attendants = ['T. Brisco', 'S. Smith', 'S. Lawes', 'A. Lewis']

const pricePerLitre: Record<string, number> = {
  '87': 190.5,
  '90': 205.0,
  'ADO': 190.86,
  'ULSD': 210.0,
}

interface Props {
  onBack: () => void
  onClose: () => void
}

export function ChargeModal({ onBack, onClose }: Props) {
  useEscapeKey(onClose)
  const [fuelGrade, setFuelGrade] = useState('')
  const [amount, setAmount] = useState('')
  const [collectedBy, setCollectedBy] = useState('')
  const [attendant, setAttendant] = useState('')

  const numAmount = parseFloat(amount) || 0
  const litres = fuelGrade && pricePerLitre[fuelGrade]
    ? numAmount / pricePerLitre[fuelGrade]
    : 0

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

        <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">Record charge</h2>
        <p className="text-[14px] text-[#888] font-medium mb-6">Please use accurate info</p>

        <div className="mb-6">
          <label className="text-[13px] font-semibold text-[#888] block mb-2">fuel</label>
          <select
            value={fuelGrade}
            onChange={(e) => setFuelGrade(e.target.value)}
            className="border border-[#ddd] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] bg-white focus:outline-none cursor-pointer min-w-[200px]"
          >
            <option value="">Select...</option>
            {fuelGrades.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <label className="text-[13px] font-semibold text-[#888] block mb-2">amount</label>
          <div className="flex items-center border border-[#e0e0e0] rounded-xl px-4 py-3 gap-2">
            <span className="text-[15px] font-bold text-[#aaa]">J$</span>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="flex-1 text-[15px] font-semibold text-[#333] focus:outline-none bg-transparent"
            />
          </div>
        </div>

        <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Litres</p>
        <p className="text-[36px] font-bold text-[#111] leading-none tracking-tight mb-6">
          {litres.toFixed(2)}
        </p>

        <div className="mb-6">
          <label className="text-[13px] font-semibold text-[#888] block mb-2">collected by</label>
          <select
            value={collectedBy}
            onChange={(e) => setCollectedBy(e.target.value)}
            className="border border-[#ddd] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] bg-white focus:outline-none cursor-pointer min-w-[200px]"
          >
            <option value="">Select...</option>
            {attendants.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
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

        <button className="w-full py-4 rounded-2xl border border-[#e0e0e0] text-[15px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors">
          Submit
        </button>
      </div>
    </div>
  )
}
