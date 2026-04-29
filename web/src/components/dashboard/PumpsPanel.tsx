import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { apiFetch, type Pump } from '../../lib/api'

export type { Pump }

interface Props {
  selected: Pump | null
  onSelect: (pump: Pump | null) => void
}

export function PumpsPanel({ selected, onSelect }: Props) {
  const [pumps, setPumps] = useState<Pump[]>([])

  useEffect(() => {
    apiFetch<Pump[]>('/pumps').then(setPumps).catch(() => {})
  }, [])

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] font-semibold text-[#888]">Pumps</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {pumps.map((pump) => {
          const isActive = selected?.id === pump.id
          return (
            <button
              key={pump.id}
              onClick={() => onSelect(isActive ? null : pump)}
              className={clsx(
                'rounded-xl py-3 text-[13px] font-bold transition-colors',
                isActive
                  ? 'bg-[#222] text-white border border-[#222]'
                  : 'bg-white border border-[#ebebeb] text-[#333] hover:border-[#ccc] hover:bg-[#fafafa]'
              )}
            >
              {pump.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
