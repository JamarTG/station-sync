import { useRef, useState, useEffect } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'

const dropTypes = [
  { id: 'cash', label: 'Cash', description: "The easiest thing to steal. Sometimes called 'Food'" },
  { id: 'card', label: 'Card', description: 'The credit card machine receipt records' },
  { id: 'charges', label: 'Charges', description: 'Authorized customers who we lend gas to on a daily basis' },
  { id: 'fx', label: 'FX', description: 'Foreign exchange cash deposits' },
  { id: 'advance', label: 'Advance', description: 'Pre-paid accounts drawn down per sale' },
]

interface Props {
  onBack: () => void
  onClose: () => void
  onSelectCash: (attendant: string) => void
  onSelectCharges: () => void
  onSelectCard: () => void
  onSelectAdvance: () => void
  onSelectFX: () => void
}

export function DropModal({ onBack, onClose, onSelectCash, onSelectCharges, onSelectCard, onSelectAdvance, onSelectFX }: Props) {
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
    if (id === 'cash') return () => onSelectCash('')
    if (id === 'charges') return onSelectCharges
    if (id === 'card') return onSelectCard
    if (id === 'advance') return onSelectAdvance
    if (id === 'fx') return onSelectFX
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
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            <ArrowLeft size={13} />
            Go back
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            <X size={13} />
            Cancel
          </button>
        </div>

        <div className="mb-8">
          <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">Record a drop</h2>
          <p className="text-[14px] text-[#888] font-medium">Choose a type</p>
        </div>

        {isNarrow ? (
          <div className="flex flex-col gap-3">
            {dropTypes.map((type) => (
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
                onClick={() => scrollRef.current?.scrollBy({ left: -180, behavior: 'smooth' })}
                className="flex-shrink-0 w-8 h-8 rounded-full bg-[#f0f0f0] hover:bg-[#e4e4e4] flex items-center justify-center text-[18px] text-[#888] hover:text-[#333] transition-colors"
              >
                ‹
              </button>
            )}
            <div ref={scrollRef} className="flex gap-4 overflow-hidden flex-1">
              {dropTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={getHandler(type.id)}
                  className="flex flex-col flex-shrink-0 w-[180px] border border-[#e0e0e0] rounded-2xl p-5 text-left hover:border-[#bbb] hover:bg-[#fafafa] transition-colors"
                >
                  <div className="w-16 h-16 border border-[#e0e0e0] rounded-2xl mb-8 self-center" />
                  <p className="text-[12px] text-[#888] text-center leading-snug mb-4 px-1">{type.description}</p>
                  <p className="text-[22px] font-bold text-[#111] mt-auto">{type.label}</p>
                </button>
              ))}
            </div>
            {canScrollRight && (
              <button
                onClick={() => scrollRef.current?.scrollBy({ left: 180, behavior: 'smooth' })}
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
