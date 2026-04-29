import { Menu } from 'lucide-react'

interface Props {
  onMenuClick: () => void
}

export function TopBar({ onMenuClick }: Props) {
  const now = new Date()
  const ampm = now.getHours() < 12 ? 'AM' : 'PM'
  const dateStr = now.toLocaleDateString('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  }).toUpperCase().replace(',', '')

  return (
    <header className="h-[56px] bg-white border-b border-[#ebebeb] flex items-center justify-between px-4 min-[668px]:px-6 flex-shrink-0">
      {/* Mobile: hamburger | Desktop: station name */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="min-[668px]:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f4f4f4] transition-colors text-[#555]"
        >
          <Menu size={18} />
        </button>
        <h1 className="hidden min-[668px]:block text-[14px] font-bold tracking-widest text-[#111] uppercase">
          Pechon Street
        </h1>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 text-[12px] text-[#888]">
        {/* Desktop only */}
        <span className="hidden min-[668px]:inline font-semibold text-[#333]">YAAD MAN ENERGY JA LTD.</span>
        <span className="hidden min-[668px]:inline text-[#ddd]">|</span>

        {/* Always visible */}
        <span className="font-bold text-[#111]">{ampm}</span>
        <span className="font-semibold text-[#555] tracking-wide">{dateStr}</span>
      </div>
    </header>
  )
}
