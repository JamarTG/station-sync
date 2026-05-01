import clsx from 'clsx'

export type AccountType = 'Expenditures' | 'Charges' | 'Advance' | 'FX' | 'Card' | 'Cash'

const accounts: AccountType[] = ['Expenditures', 'Charges', 'Advance', 'FX', 'Card', 'Cash']

interface Props {
  selected: AccountType
  onSelect: (account: AccountType) => void
  className?: string
}

export function AccountsPanel({ selected, onSelect, className }: Props) {
  return (
    <div className={clsx('p-5 flex flex-col', className)}>
      <p className="text-[13px] font-semibold text-[#888] mb-3">Accounts</p>
      <div className="grid grid-cols-1 gap-2 flex-1 content-start overflow-y-auto">
        {accounts.map((a) => {
          const isActive = selected === a
          return (
            <button
              key={a}
              onClick={() => onSelect(a)}
              className={clsx(
                'flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors',
                isActive
                  ? 'bg-[#2e2e2e] border border-[#2e2e2e]'
                  : 'bg-white border border-[#ebebeb] hover:bg-[#fafafa]'
              )}
            >
              <span className={clsx('text-[12px] font-semibold truncate', isActive ? 'text-white' : 'text-[#333]')}>
                {a}
              </span>
              <span className={clsx('text-[12px] font-semibold ml-1 flex-shrink-0', isActive ? 'text-white' : 'text-[#333]')}>
                <span className={clsx('text-[10px] mr-0.5', isActive ? 'text-white/60' : 'text-[#888]')}>J$</span>
                0.00
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
