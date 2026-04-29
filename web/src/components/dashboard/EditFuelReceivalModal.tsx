import { useState } from 'react'
import { ArrowLeft, X, Plus, Minus } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'

const fuelGrades = ['87', '90', 'ADO', 'ULSD']

interface Props {
  onClose: () => void
  onSubmit?: () => void
}

export function EditFuelReceivalModal({ onClose, onSubmit }: Props) {
  useEscapeKey(onClose)
  const [amountOrdered, setAmountOrdered] = useState('')
  const [opening, setOpening] = useState('')
  const [closing, setClosing] = useState('')
  const [fuel, setFuel] = useState('90')
  const [showRate, setShowRate] = useState(false)
  const [showHaulage, setShowHaulage] = useState(false)
  const [showGct, setShowGct] = useState(false)
  const [rate, setRate] = useState('')
  const [haulage, setHaulage] = useState('')
  const [gct, setGct] = useState('')

  const ordered = parseFloat(amountOrdered) || 0
  const openingVal = parseFloat(opening) || 0
  const closingVal = parseFloat(closing) || 0
  const variance = (closingVal - openingVal) - ordered

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
            onClick={onClose}
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

        <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">Edit fuel receival</h2>
        <p className="text-[14px] text-[#888] font-medium mb-6">Please use accurate info</p>

        <div className="mb-6">
          <label className="text-[13px] font-semibold text-[#888] block mb-2">amount ordered</label>
          <div className="flex items-center gap-4">
            <input
              type="number"
              min={0}
              value={amountOrdered}
              onChange={(e) => setAmountOrdered(e.target.value)}
              placeholder="0.00"
              className="border border-[#e0e0e0] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] focus:outline-none w-[200px]"
            />
            <button
              onClick={() => { setShowRate((v) => !v); if (showRate) setRate('') }}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-[#555] hover:text-[#111] transition-colors"
            >
              {showRate ? <Minus size={13} /> : <Plus size={13} />}
              {showRate ? 'Remove rate' : 'Add rate'}
            </button>
            <button
              onClick={() => { setShowHaulage((v) => !v); if (showHaulage) setHaulage('') }}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-[#555] hover:text-[#111] transition-colors"
            >
              {showHaulage ? <Minus size={13} /> : <Plus size={13} />}
              {showHaulage ? 'Remove haulage' : 'Add haulage'}
            </button>
            <button
              onClick={() => { setShowGct((v) => !v); if (showGct) setGct('') }}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-[#555] hover:text-[#111] transition-colors"
            >
              {showGct ? <Minus size={13} /> : <Plus size={13} />}
              {showGct ? 'Remove GCT' : 'Add GCT'}
            </button>
          </div>
        </div>

        {(showRate || showHaulage || showGct) && (
          <div className="flex gap-4 mb-6">
            {showRate && (
              <div className="flex-1">
                <label className="text-[13px] font-semibold text-[#888] block mb-2">rate</label>
                <input
                  type="number"
                  min={0}
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-[#e0e0e0] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] focus:outline-none"
                />
              </div>
            )}
            {showHaulage && (
              <div className="flex-1">
                <label className="text-[13px] font-semibold text-[#888] block mb-2">haulage</label>
                <input
                  type="number"
                  min={0}
                  value={haulage}
                  onChange={(e) => setHaulage(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-[#e0e0e0] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] focus:outline-none"
                />
              </div>
            )}
            {showGct && (
              <div className="flex-1">
                <label className="text-[13px] font-semibold text-[#888] block mb-2">GCT</label>
                <input
                  type="number"
                  min={0}
                  value={gct}
                  onChange={(e) => setGct(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-[#e0e0e0] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] focus:outline-none"
                />
              </div>
            )}
          </div>
        )}

        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <label className="text-[13px] font-semibold text-[#888] block mb-2">opening</label>
            <input
              type="number"
              min={0}
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              placeholder="0.00"
              className="w-full border border-[#e0e0e0] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="text-[13px] font-semibold text-[#888] block mb-2">closing</label>
            <input
              type="number"
              min={0}
              value={closing}
              onChange={(e) => setClosing(e.target.value)}
              placeholder="0.00"
              className="w-full border border-[#e0e0e0] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[13px] font-semibold text-[#888] block mb-2">fuel</label>
            <select
              value={fuel}
              onChange={(e) => setFuel(e.target.value)}
              className="border border-[#e0e0e0] rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[#333] bg-white focus:outline-none cursor-pointer min-w-[100px]"
            >
              {fuelGrades.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-t border-[#ebebeb] mb-6" />

        <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Variance</p>
        <p className="text-[36px] font-bold text-[#111] leading-none tracking-tight mb-6">
          {variance.toFixed(2)}
        </p>

        <div className="mb-8">
          <label className="text-[13px] font-semibold text-[#888] block mb-2">receival slip</label>
          <label className="flex items-center justify-center w-full border border-[#e0e0e0] rounded-xl py-3 text-[13px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors cursor-pointer">
            <input type="file" multiple className="hidden" />
            upload file(s)
          </label>
        </div>

        <button
          onClick={() => { onSubmit?.(); onClose() }}
          className="w-full py-4 rounded-2xl border border-[#e0e0e0] text-[15px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
        >
          Submit
        </button>
      </div>
    </div>
  )
}
