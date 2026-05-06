import clsx from 'clsx'

export type TankGrade = '87' | '90' | 'ADO' | 'ULSD'

const grades: TankGrade[] = ['87', '90', 'ADO', 'ULSD']


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
              {g}
            </button>
          )
        })}
      </div>
    </div>
  )
}
