import clsx from 'clsx'
import { useFuels } from '../../hooks/useApi'
import type { Fuel } from '../../lib/api'

export type { Fuel }

const prices: Record<string, number> = {
  '87': 190.90,
  '90': 190.90,
  'ADO': 190.90,
  'ULSD': 190.90,
}

interface Props {
  selected: Fuel | null
  onSelect: (fuel: Fuel | null) => void
}

export function PumpsPanel({ selected, onSelect }: Props) {
  const { data: fuels = [] } = useFuels()

  return (
    <div className="bg-white rounded-2xl border border-[#ebebeb] h-[160px] flex flex-col overflow-hidden">
      {fuels.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] text-[#ccc] font-medium">No fuels configured</p>
        </div>
      ) : (
        <>
          <div className="flex">
            {fuels.map((fuel) => {
              const isActive = selected?.id === fuel.id
              return (
                <button
                  key={fuel.id}
                  onClick={() => onSelect(isActive ? null : fuel)}
                  className={clsx(
                    'flex-1 pt-4 pb-3 text-center border-b-2 transition-colors',
                    isActive
                      ? 'border-[#111]'
                      : 'border-[#f0f0f0] hover:border-[#d0d0d0]'
                  )}
                >
                  <p className={clsx('text-[13px] font-bold mb-1 leading-none', isActive ? 'text-[#111]' : 'text-[#aaa]')}>
                    {fuel.name}
                  </p>
                  <p className={clsx('text-[11px] leading-none', isActive ? 'text-[#555]' : 'text-[#ccc]')}>
                    <span className="text-[10px]">J$</span>{(prices[fuel.name] ?? 0).toFixed(2)}
                  </p>
                </button>
              )
            })}
          </div>
          <div className="flex-1 flex items-center px-5">
            {selected ? (
              <p className="text-[12px] text-[#888] font-medium">{selected.name} pump selected</p>
            ) : (
              <p className="text-[12px] text-[#ccc] font-medium">Select a fuel type</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
