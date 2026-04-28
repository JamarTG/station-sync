import clsx from 'clsx'

export type PumpGrade = '87' | '90' | 'ADO' | 'ULSD'

const grades: PumpGrade[] = ['87', '90', 'ADO', 'ULSD']

interface Props {
  selected: PumpGrade | null
  onSelect: (grade: PumpGrade | null) => void
}

export function PumpsPanel({ selected, onSelect }: Props) {
  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] font-semibold text-[#888]">Pumps</p>
        <p className="text-[11px] text-[#bbb] font-medium">
          TOTAL LITRES SOLD&nbsp;&nbsp;<span className="text-[#555] font-bold">2.5051</span>
        </p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {grades.map((g) => {
          const isActive = selected === g
          return (
            <button
              key={g}
              onClick={() => onSelect(isActive ? null : g)}
              className={clsx(
                'rounded-xl py-3 text-[13px] font-bold transition-colors',
                isActive
                  ? 'bg-[#222] text-white border border-[#222]'
                  : 'bg-white border border-[#ebebeb] text-[#333] hover:border-[#ccc] hover:bg-[#fafafa]'
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
