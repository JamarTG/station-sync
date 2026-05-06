import { useRef, useState, useEffect } from 'react'
import clsx from 'clsx'

export type AccountType = 'Attendants' | 'Expenditures' | 'Charges' | 'Advance' | 'FX' | 'Card' | 'Cash' | 'Deposits'

const accounts: AccountType[] = ['Attendants', 'Cash', 'Expenditures', 'Charges', 'Advance', 'FX', 'Card', 'Deposits']

interface Props {
  selected: AccountType
  onSelect: (account: AccountType) => void
  className?: string
}

export function AccountsPanel({ selected, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

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

export function AccountsPanel({ selected, onSelect, className }: Props) {
  return (
    <div className="flex items-center border-b border-[#e8e8e8] bg-white">
      {canScrollLeft && (
        <button
          onClick={() => scrollRef.current?.scrollBy({ left: -160, behavior: 'smooth' })}
          className="flex-shrink-0 px-2 py-3 text-[13px] text-[#bbb] hover:text-[#555] transition-colors border-r border-[#f0f0f0]"
        >
          ‹
        </button>
      )}
      <div ref={scrollRef} className="flex overflow-x-auto flex-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        {accounts.map((a) => (
          <button
            key={a}
            onClick={() => onSelect(a)}
            className={clsx(
              'px-5 py-3 text-[13px] font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap',
              selected === a
                ? 'border-[#111] text-[#111]'
                : 'border-transparent text-[#999] hover:text-[#555]'
            )}
          >
            {a}
          </button>
        ))}
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
      {canScrollRight && (
        <button
          onClick={() => scrollRef.current?.scrollBy({ left: 160, behavior: 'smooth' })}
          className="flex-shrink-0 px-2 py-3 text-[13px] text-[#bbb] hover:text-[#555] transition-colors border-l border-[#f0f0f0]"
        >
          ›
        </button>
      )}
    </div>
  )
}
