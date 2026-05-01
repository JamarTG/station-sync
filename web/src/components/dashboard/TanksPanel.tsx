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
  selected: TankGrade | null
  onSelect: (grade: TankGrade | null) => void
}

export function TanksPanel({ selected, onSelect }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-[#ebebeb] h-[160px] flex flex-col overflow-hidden">
      <div className="flex">
        {grades.map((g) => {
          const isActive = selected === g
          return (
            <button
              key={g}
              onClick={() => onSelect(isActive ? null : g)}
              className={clsx(
                'flex-1 pt-4 pb-3 text-center border-b-2 transition-colors',
                isActive
                  ? 'border-[#111]'
                  : 'border-[#f0f0f0] hover:border-[#d0d0d0]'
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
