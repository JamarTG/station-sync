import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { apiFetch, type Fuel } from '../../lib/api'

export type { Fuel }

interface Props {
  selected: Fuel | null
  onSelect: (fuel: Fuel | null) => void
}

export function PumpsPanel({ selected, onSelect }: Props) {
  const [fuels, setFuels] = useState<Fuel[]>([])

  useEffect(() => {
    apiFetch<Fuel[]>('/fuels').then(setFuels).catch(() => {})
  }, [])

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] font-semibold text-[#888]">Pumps</p>
      </div>
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
