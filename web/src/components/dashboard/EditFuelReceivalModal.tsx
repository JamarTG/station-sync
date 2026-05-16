import { useState, useEffect } from 'react'
import { ArrowLeft, X, Plus, Minus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useOpenShift, useTanks } from '../../hooks/useApi'
import { createFuelReceival, type FuelReceival } from '../../lib/api'
import { fmtInput, parseInput, fmtNum } from '../../lib/fmt'

interface Props {
  onClose: () => void
  onSubmit?: () => void
  initialTankId?: string
  initialReceival?: FuelReceival | null
}

export function EditFuelReceivalModal({ onClose, initialTankId, initialReceival }: Props) {
  useEscapeKey(onClose)
  const queryClient = useQueryClient()
  const { data: shift } = useOpenShift()
  const shiftId = shift?.id
  const { data: tanks = [] } = useTanks()

  const defaultTank = tanks.find((t) => t.id === (initialReceival?.tank_id ?? initialTankId)) ?? tanks[0]
  const [tankId, setTankId] = useState(initialReceival?.tank_id ?? initialTankId ?? '')
  const [amountOrdered, setAmountOrdered] = useState(initialReceival ? String(initialReceival.litres_ordered) : '')
  const [opening, setOpening] = useState(initialReceival?.opening_level != null ? String(initialReceival.opening_level) : '')
  const [closing, setClosing] = useState(initialReceival?.closing_level != null ? String(initialReceival.closing_level) : '')
  const [showRate, setShowRate] = useState(initialReceival?.rate != null)
  const [showHaulage, setShowHaulage] = useState(initialReceival?.haulage != null)
  const [showGct, setShowGct] = useState(initialReceival?.gct != null)
  const [rate, setRate] = useState(initialReceival?.rate != null ? String(initialReceival.rate) : '')
  const [haulage, setHaulage] = useState(initialReceival?.haulage != null ? String(initialReceival.haulage) : '')
  const [gct, setGct] = useState(initialReceival?.gct != null ? String(initialReceival.gct) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!tankId && defaultTank) setTankId(defaultTank.id)
  }, [defaultTank])

  const ordered = parseFloat(amountOrdered) || 0
  const openingVal = parseFloat(opening) || 0
  const closingVal = parseFloat(closing) || 0
  const variance = (closingVal - openingVal) - ordered
  const selectedTank = tanks.find((t) => t.id === tankId)

  async function handleSubmit() {
    if (!shiftId || ordered === 0 || !tankId) return
    setLoading(true)
    setError('')
    try {
      await createFuelReceival(shiftId, {
        tank_id: tankId || null,
        fuel_name: selectedTank?.fuel_name ?? tankId,
        litres_ordered: ordered,
        opening_level: opening ? openingVal : null,
        closing_level: closing ? closingVal : null,
        rate: rate ? parseFloat(rate) : null,
        haulage: haulage ? parseFloat(haulage) : null,
        gct: gct ? parseFloat(gct) : null,
      })
      queryClient.invalidateQueries({ queryKey: ['shifts', shiftId, 'fuel-receivals'] })
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
              type="text"
              value={fmtInput(amountOrdered)}
              onChange={(e) => setAmountOrdered(parseInput(e.target.value))}
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
                  type="text"
                  value={fmtInput(rate)}
                  onChange={(e) => setRate(parseInput(e.target.value))}
                  placeholder="0.00"
                  className="w-full border border-[#e0e0e0] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] focus:outline-none"
                />
              </div>
            )}
            {showHaulage && (
              <div className="flex-1">
                <label className="text-[13px] font-semibold text-[#888] block mb-2">haulage</label>
                <input
                  type="text"
                  value={fmtInput(haulage)}
                  onChange={(e) => setHaulage(parseInput(e.target.value))}
                  placeholder="0.00"
                  className="w-full border border-[#e0e0e0] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] focus:outline-none"
                />
              </div>
            )}
            {showGct && (
              <div className="flex-1">
                <label className="text-[13px] font-semibold text-[#888] block mb-2">GCT</label>
                <input
                  type="text"
                  value={fmtInput(gct)}
                  onChange={(e) => setGct(parseInput(e.target.value))}
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
              type="text"
              value={fmtInput(opening)}
              onChange={(e) => setOpening(parseInput(e.target.value))}
              placeholder="0.00"
              className="w-full border border-[#e0e0e0] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="text-[13px] font-semibold text-[#888] block mb-2">closing</label>
            <input
              type="text"
              value={fmtInput(closing)}
              onChange={(e) => setClosing(parseInput(e.target.value))}
              placeholder="0.00"
              className="w-full border border-[#e0e0e0] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[13px] font-semibold text-[#888] block mb-2">fuel</label>
            <select
              value={tankId}
              onChange={(e) => setTankId(e.target.value)}
              className="border border-[#e0e0e0] rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[#333] bg-white focus:outline-none cursor-pointer min-w-[100px]"
            >
              {tanks.length === 0 && <option value="">—</option>}
              {tanks.map((t) => (
                <option key={t.id} value={t.id}>{t.fuel_name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-t border-[#ebebeb] mb-6" />

        <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Variance</p>
        <p className="text-[36px] font-bold text-[#111] leading-none tracking-tight mb-6">
          {fmtNum(variance)}
        </p>

        <div className="mb-8">
          <label className="text-[13px] font-semibold text-[#888] block mb-2">receival slip</label>
          <label className="flex items-center justify-center w-full border border-[#e0e0e0] rounded-xl py-3 text-[13px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors cursor-pointer">
            <input type="file" multiple className="hidden" />
            upload file(s)
          </label>
        </div>

        {error && <p className="text-[11px] font-semibold text-red-500 mb-3">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || ordered === 0 || !tankId || !shiftId}
          className="w-full py-4 rounded-2xl border border-[#e0e0e0] text-[15px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Submit'}
        </button>
      </div>
    </div>
  )
}
