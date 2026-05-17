import clsx from 'clsx'
import type { Tank } from '../../lib/api'

interface Props {
  tanks: Tank[]
  selected: Tank | null
  onSelect: (tank: Tank) => void
}

export function TanksPanel({ tanks, selected, onSelect }: Props) {
  return (
    <div className="flex flex-col border-b border-[#e8e8e8] bg-white flex-shrink-0">
      <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase px-5 pt-4 pb-[39px]">Tanks</p>
      <div className="flex">
        {tanks.length === 0 ? (
          <p className="px-5 py-3 text-[13px] text-[#bbb]">No tanks configured</p>
        ) : (
          tanks.map((tank) => {
            const isActive = selected?.id === tank.id
            return (
              <button
                key={tank.id}
                onClick={() => onSelect(tank)}
                className={clsx(
                  'px-5 py-3 text-[13px] font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-[#111] text-[#111]'
                    : 'border-transparent text-[#999] hover:text-[#555]'
                )}
              >
                {tank.name}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
