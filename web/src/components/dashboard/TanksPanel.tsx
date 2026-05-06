import clsx from 'clsx'

export type TankGrade = '87' | '90' | 'ADO' | 'ULSD'

const grades: TankGrade[] = ['87', '90', 'ADO', 'ULSD']

const prices: Record<TankGrade, number> = {
  '87': 190.90,
  '90': 190.90,
  'ADO': 190.90,
  'ULSD': 190.90,
}

interface Props {
  selected: TankGrade
  onSelect: (grade: TankGrade) => void
}

export function TanksPanel({ selected, onSelect }: Props) {
  return (
    <div className="flex flex-col border-b border-[#e8e8e8] bg-white flex-shrink-0">
      <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase px-5 pt-4 pb-[39px]">Tanks</p>
      <div className="flex">
        {grades.map((g) => {
          const isActive = selected === g
          return (
            <button
              key={g}
              onClick={() => onSelect(g)}
              className={clsx(
                'px-5 py-3 text-[13px] font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap',
                isActive
                  ? 'border-[#111] text-[#111]'
                  : 'border-transparent text-[#999] hover:text-[#555]'
              )}
            >
              <p className={clsx('text-[13px] font-bold mb-1 leading-none', isActive ? 'text-[#111]' : 'text-[#aaa]')}>
                {g}
              </p>
              <p className={clsx('text-[11px] leading-none', isActive ? 'text-[#555]' : 'text-[#ccc]')}>
                <span className="text-[10px]">J$</span>{prices[g].toFixed(2)}
              </p>
            </button>
          )
        })}
      </div>
      <div className="flex-1 flex items-center px-5">
        <p className="text-[11px] font-medium text-[#bbb] uppercase tracking-wide">
          Available&nbsp;
          <span className="text-[#555] font-bold normal-case tracking-normal text-[12px]">2.5051</span>
        </p>
      </div>
    </div>
  )
}
