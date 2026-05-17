import { useState } from 'react'
import { X } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { upsertFuelPrice } from '../../lib/api'
import { fmtInput, parseInput } from '../../lib/fmt'
import type { Fuel, ShiftFuelPrice } from '../../lib/api'

interface Props {
  fuels: Fuel[]
  initialPrices: ShiftFuelPrice[]
  shiftId?: string
  onClose: () => void
  onSaved: () => void
}

export function EditFuelPricesModal({ fuels, initialPrices, shiftId, onClose, onSaved }: Props) {
  useEscapeKey(onClose)

  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fuels.map((f) => {
        const existing = initialPrices.find((p) => p.fuel_id === f.id)
        return [f.id, existing ? String(existing.price) : '']
      })
    )
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updatePrice(fuelId: string, value: string) {
    setPrices((prev) => ({ ...prev, [fuelId]: parseInput(value) }))
  }

  async function handleSave() {
    if (!shiftId) return
    setSaving(true)
    setError(null)
    try {
      const toSave = fuels.filter((f) => prices[f.id] !== '' && parseFloat(prices[f.id]) > 0)
      await Promise.all(toSave.map((f) => upsertFuelPrice(shiftId, f.id, parseFloat(prices[f.id]))))
      onSaved()
      onClose()
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const axiosMsg = (err as any)?.response?.data?.error
      const msg = axiosMsg ?? (err instanceof Error ? err.message : String(err))
      setError(`Failed to save: ${msg}`)
    } finally {
      setSaving(false)
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
        <div className="flex items-center justify-end mb-8">
          <button
            onClick={onClose}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            <X size={13} />
            Cancel
          </button>
        </div>

        <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">Edit fuel prices</h2>
        <p className="text-[14px] text-[#888] font-medium mb-6">Please use accurate info</p>

        <div className="flex flex-col gap-3 mb-8">
          {fuels.map((fuel, i) => (
            <div key={fuel.id} className="flex items-end gap-3">
              <div className="w-16 flex-shrink-0">
                {i === 0 && (
                  <label className="text-[13px] font-semibold text-[#888] block mb-2">fuel</label>
                )}
                <div className="px-4 py-2.5 text-[13px] font-semibold text-[#333]">
                  {fuel.name}
                </div>
              </div>
              <div className="flex-1">
                {i === 0 && (
                  <label className="text-[13px] font-semibold text-[#888] block mb-2">price per litre</label>
                )}
                <div className="flex items-center border border-[#e0e0e0] rounded-xl px-4 py-2.5 gap-2">
                  <span className="text-[13px] font-bold text-[#aaa]">J$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={fmtInput(prices[fuel.id])}
                    onChange={(e) => updatePrice(fuel.id, e.target.value)}
                    placeholder="0.00"
                    className="flex-1 text-[13px] font-semibold text-[#333] focus:outline-none bg-transparent min-w-0"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-[12px] font-semibold text-red-500 mb-3">{error}</p>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !shiftId}
          className="w-full py-4 rounded-2xl border border-[#e0e0e0] text-[15px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Update'}
        </button>
      </div>
    </div>
  )
}
