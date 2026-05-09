import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { CardBankDetailModal } from './CardBankDetailModal'
import { activityByAccount, type CardRow } from './RecentActivityCard'

const cardData: Record<string, { transNo: string; attendant: string; amount: number }[]> = {
  NCB: [
    { transNo: 'TXN-001', attendant: 'S. Smith', amount: 23000.0 },
    { transNo: 'TXN-002', attendant: 'A. Lewis', amount: 11500.0 },
  ],
  Scotiabank: [
    { transNo: 'TXN-003', attendant: 'T. Brisco', amount: 15000.0 },
  ],
}

const fmt = (n: number) => `J$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

interface Props {
  onBack: () => void
  onClose: () => void
}

export function CardBreakdownModal({ onBack, onClose }: Props) {
  useEscapeKey(onClose)
  const [selectedBank, setSelectedBank] = useState<string | null>(null)
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 537)
  const bankMap = activityByAccount.Card.filter((r): r is CardRow => r.type === 'card')
    .reduce<Record<string, number>>((acc, r) => { acc[r.bank] = (acc[r.bank] ?? 0) + r.amount; return acc }, {})
  const banks = Object.keys(bankMap)
  const bankTotal = (bank: string) => bankMap[bank] ?? 0
  const total = activityByAccount.Card.reduce((s, r) => s + r.amount, 0)

  useEffect(() => {
    function onResize() { setIsNarrow(window.innerWidth < 537) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (selectedBank) {
    return (
      <CardBankDetailModal
        bank={selectedBank}
        transactions={cardData[selectedBank]}
        onBack={() => setSelectedBank(null)}
        onClose={onClose}
      />
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[640px] p-8 shadow-xl h-[820px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onBack}
          className="self-start flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors mb-8"
        >
          <ArrowLeft size={13} />
          Go back
        </button>

        {isNarrow ? (
          <div className="mb-6">
            <h2 className="text-[36px] font-bold text-[#111] leading-none mb-3">Card</h2>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Total</p>
              <p className="text-[11px] font-bold text-[#111]">{fmt(total)}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[36px] font-bold text-[#111] leading-none">Card</h2>
            <p className="text-[36px] font-bold text-[#111] leading-none">{fmt(total)}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-2">Breakdown</p>

          {banks.map((bank) => (
            <div key={bank} className="flex items-center justify-between py-2">
              <button
                onClick={() => setSelectedBank(bank)}
                className="text-[13px] font-semibold text-[#111] hover:text-[#555] transition-colors"
              >
                {bank}
              </button>
              <p className="text-[13px] font-semibold text-[#333]">{fmt(bankTotal(bank))}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-[#f0f0f0] mt-4" />

        <div className="flex items-center justify-between pt-4">
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Count</p>
          <p className="text-[13px] font-semibold text-[#333]">{banks.length} Banks</p>
        </div>
      </div>
    </div>
  )
}
