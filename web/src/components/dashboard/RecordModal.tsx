import { useRef, useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'

const recordTypes = [
  { id: 'drop', label: 'Drop', description: 'A deposit from a pump, attendant' },
  { id: 'fuel-receival', label: 'Fuel Receival', description: 'The credit card machine receipt records' },
  { id: 'expenditure', label: 'Expenditure', description: 'Cash payments taken from sales' },
  { id: 'deposit', label: 'Deposit', description: 'A bank deposit of collected cash' },
]

interface Props {
  onClose: () => void
  onSelectDrop: () => void
  onSelectExpenditure: () => void
  onSelectFuelReceival: () => void
  onSelectDeposit: () => void
}

export function RecordModal({ onClose, onSelectDrop, onSelectExpenditure, onSelectFuelReceival, onSelectDeposit }: Props) {
  useEscapeKey(onClose)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 655)

  function updateScroll() {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }

  useEffect(() => {
    updateScroll()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateScroll)
    const ro = new ResizeObserver(updateScroll)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScroll)
      ro.disconnect()
    }
  }, [])

  useEffect(() => {
    function onResize() { setIsNarrow(window.innerWidth < 655) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function getHandler(id: string) {
    if (id === 'drop') return onSelectDrop
    if (id === 'expenditure') return onSelectExpenditure
    if (id === 'fuel-receival') return onSelectFuelReceival
    if (id === 'deposit') return onSelectDeposit
    return undefined
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[740px] p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end mb-8">
          <button
            onClick={onClose}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            <X size={13} />
            Cancel
          </button>
        </div>

        <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">Record a...</h2>
        <p className="text-[14px] text-[#888] font-medium mb-8">Choose a type</p>

        {isNarrow ? (
          <div className="flex flex-col gap-3">
            {recordTypes.map((type) => (
              <button
                key={type.id}
                onClick={getHandler(type.id)}
                className="flex flex-col border border-[#e0e0e0] rounded-2xl p-4 text-left hover:border-[#bbb] hover:bg-[#fafafa] transition-colors"
              >
                <p className="text-[16px] font-bold text-[#111] mb-1">{type.label}</p>
                <p className="text-[12px] text-[#888] leading-snug">{type.description}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {canScrollLeft && (
              <button
                onClick={() => scrollRef.current?.scrollBy({ left: -210, behavior: 'smooth' })}
                className="flex-shrink-0 w-8 h-8 rounded-full bg-[#f0f0f0] hover:bg-[#e4e4e4] flex items-center justify-center text-[18px] text-[#888] hover:text-[#333] transition-colors"
              >
                ‹
              </button>
            )}
            <div ref={scrollRef} className="flex gap-4 overflow-hidden flex-1">
              {recordTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={getHandler(type.id)}
                  className="flex flex-col flex-shrink-0 w-[210px] border border-[#e0e0e0] rounded-2xl p-5 text-left hover:border-[#bbb] hover:bg-[#fafafa] transition-colors"
                >
                  <div className="w-16 h-16 border border-[#e0e0e0] rounded-2xl mb-8 self-center" />
                  <p className="text-[12px] text-[#888] text-center leading-snug mb-4 px-1">{type.description}</p>
                  <p className="text-[22px] font-bold text-[#111] mt-auto">{type.label}</p>
                </button>
              ))}
            </div>
            {canScrollRight && (
              <button
                onClick={() => scrollRef.current?.scrollBy({ left: 210, behavior: 'smooth' })}
                className="flex-shrink-0 w-8 h-8 rounded-full bg-[#f0f0f0] hover:bg-[#e4e4e4] flex items-center justify-center text-[18px] text-[#888] hover:text-[#333] transition-colors"
              >
                ›
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
