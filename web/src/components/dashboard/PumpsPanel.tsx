import { useEffect } from 'react'
import clsx from 'clsx'
import { useFuels } from '../../hooks/useApi'
import type { Fuel } from '../../lib/api'
import { fmtNum } from '../../lib/fmt'

export type { Fuel }

interface Props {
  selected: Fuel | null
  onSelect: (fuel: Fuel) => void
  onEditPrice?: () => void
  price?: number | null
}

export function PumpsPanel({ selected, onSelect, onEditPrice, price = null }: Props) {
  const { data: fuels = [] } = useFuels()

  useEffect(() => {
    if (fuels.length > 0 && !selected) {
      onSelect(fuels[0])
    }
  }, [fuels])

  return (
    <div className="flex flex-col border-b border-[#e8e8e8] bg-white flex-shrink-0">
      <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase px-5 pt-4 pb-1">Pumps</p>
      <div className="flex items-center justify-between px-5 pb-2">
        <p className="text-[15px] font-bold text-[#111]">
          {price != null ? (
            <>
              <span className="text-[11px] font-semibold text-[#888] mr-1">J$</span>
              {fmtNum(price)}
              <span className="text-[11px] font-semibold text-[#888] ml-1">/L</span>
            </>
          ) : '—'}
        </p>
        <button
          onClick={onEditPrice}
          className="text-[12px] font-semibold text-[#333] border border-[#ddd] rounded-lg px-3 py-1 hover:bg-[#f4f4f4] transition-colors"
        >
          Edit
        </button>
      </div>
      <div className="flex">
        {fuels.map((fuel) => {
          const isActive = selected?.id === fuel.id
          return (
            <button
              key={fuel.id}
              onClick={() => onSelect(fuel)}
              className={clsx(
                'px-5 py-3 text-[13px] font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap',
                isActive
                  ? 'border-[#111] text-[#111]'
                  : 'border-transparent text-[#999] hover:text-[#555]'
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
