import clsx from 'clsx'

const attendants = [
  { name: 'T. Brisco', amount: 0.0, sign: '+' },
  { name: 'S. Smith', amount: -0.0, sign: '-' },
  { name: 'S. Lawes', amount: -0.0, sign: '-' },
  { name: 'A. Lewis', amount: 0.0, sign: '+' },
]

function formatAmount(sign: string, amount: number) {
  return `J$ ${sign}${Math.abs(amount).toFixed(2)}`
}

export function AttendantsCard() {
  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] font-semibold text-[#888]">Attendants</p>
        <button className="text-[12px] font-semibold text-[#333] border border-[#ddd] rounded-lg px-3 py-1 hover:bg-[#f4f4f4] transition-colors">
          Manage
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {attendants.map((a) => (
          <div
            key={a.name}
            className="flex items-center justify-between bg-white border border-[#ebebeb] rounded-xl px-4 py-3"
          >
            <span className="text-[13px] font-semibold text-[#333]">{a.name}</span>
            <span
              className={clsx(
                'text-[12px] font-semibold',
                a.sign === '+' ? 'text-[#333]' : 'text-[#333]'
              )}
            >
              {formatAmount(a.sign, a.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
