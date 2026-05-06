import { useState, useEffect } from 'react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { ArrowLeft } from 'lucide-react'

const accounts = ['CASH', 'CARD', 'FX', 'PHONE CREDIT']

interface Props {
  onClose: () => void
}

export function ConvenienceStoreBreakdownModal({ onClose }: Props) {
  useEscapeKey(onClose)
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 537)

  useEffect(() => {
    function onResize() { setIsNarrow(window.innerWidth < 537) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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
          onClick={onClose}
          className="self-start flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors mb-8"
        >
          <ArrowLeft size={13} />
          Go back
        </button>

        <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-2">Convenience Store</p>
        {isNarrow ? (
          <div className="mb-6">
            <h2 className="text-[36px] font-bold text-[#111] leading-none mb-3">Sales</h2>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Total</p>
              <p className="text-[11px] font-bold text-[#111]">J$0.00</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[36px] font-bold text-[#111] leading-none">Sales</h2>
            <p className="text-[36px] font-bold text-[#111] leading-none">J$0.00</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1 mt-6">Accounts</p>
          {accounts.map((a) => (
            <div key={a} className="flex items-center justify-between py-2">
              <p className="text-[13px] font-semibold text-[#111]">{a}</p>
              <p className="text-[13px] font-semibold text-[#bbb]">--</p>
            </div>
          ))}
        </div>

        <div className="border-t border-[#f0f0f0] mt-4" />

        <div className="flex items-center justify-between pt-4">
          <p className="text-[14px] font-semibold text-[#333]">Balance</p>
          <p className="text-[14px] font-bold text-[#111]">J$0.00</p>
        </div>
      </div>
    </div>
  )
}
