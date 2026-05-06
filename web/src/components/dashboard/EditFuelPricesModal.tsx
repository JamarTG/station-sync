import { useState } from 'react'
import { X } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'

const fuelGrades = ['87', '90', 'ADO', 'ULSD']

const defaultPrices: Record<string, string> = {
  '87': '190.90',
  '90': '190.90',
  'ADO': '190.90',
  'ULSD': '190.90',
}

interface Props {
  onClose: () => void
}

export function EditFuelPricesModal({ onClose }: Props) {
  useEscapeKey(onClose)
  const [prices, setPrices] = useState<Record<string, string>>(defaultPrices)

  function updatePrice(fuel: string, value: string) {
    setPrices((prev) => ({ ...prev, [fuel]: value }))
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
          {fuelGrades.map((fuel, i) => (
            <div key={fuel} className="flex items-end gap-3">
              <div className="w-16 flex-shrink-0">
                {i === 0 && (
                  <label className="text-[13px] font-semibold text-[#888] block mb-2">fuel</label>
                )}
                <div className="px-4 py-2.5 text-[13px] font-semibold text-[#333]">
                  {fuel}
                </div>
              </div>
              <div className="flex-1">
                {i === 0 && (
                  <label className="text-[13px] font-semibold text-[#888] block mb-2">price per litre</label>
                )}
                <div className="flex items-center border border-[#e0e0e0] rounded-xl px-4 py-2.5 gap-2">
                  <span className="text-[13px] font-bold text-[#aaa]">J$</span>
                  <input
                    type="number"
                    min={0}
                    value={prices[fuel]}
                    onChange={(e) => updatePrice(fuel, e.target.value)}
                    placeholder="0.00"
                    className="flex-1 text-[13px] font-semibold text-[#333] focus:outline-none bg-transparent min-w-0"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-4 rounded-2xl border border-[#e0e0e0] text-[15px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
        >
          Update
        </button>
      </div>
    </div>
  )
}
