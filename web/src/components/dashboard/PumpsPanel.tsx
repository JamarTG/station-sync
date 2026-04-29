import clsx from 'clsx'
import { useFuels } from '../../hooks/useApi'
import type { Fuel } from '../../lib/api'

export type { Fuel }

interface Props {
  selected: Fuel | null
  onSelect: (fuel: Fuel | null) => void
}

export function PumpsPanel({ selected, onSelect }: Props) {
  const { data: fuels = [], isLoading } = useFuels()

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] font-semibold text-[#888]">Pumps</p>
      </div>
      <pre className="text-[11px] bg-[#f5f5f5] rounded-lg p-3 mb-3 overflow-x-auto text-[#333]">
        {JSON.stringify({ isLoading, fuels }, null, 2)}
      </pre>
      <div className="grid grid-cols-4 gap-2">
        {fuels.map((fuel) => {
          const isActive = selected?.id === fuel.id
          return (
            <button
              key={fuel.id}
              onClick={() => onSelect(isActive ? null : fuel)}
              className={clsx(
                'rounded-xl py-3 text-[13px] font-bold transition-colors',
                isActive
                  ? 'bg-[#222] text-white border border-[#222]'
                  : 'bg-white border border-[#ebebeb] text-[#333] hover:border-[#ccc] hover:bg-[#fafafa]'
              )}
            >
              {fuel.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
