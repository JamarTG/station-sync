import { useState, useRef, useEffect } from 'react'
import { Menu, Settings, LogOut } from 'lucide-react'

interface Props {
  onMenuClick: () => void
  onLogout: () => void
}

export function TopBar({ onMenuClick, onLogout }: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const now = new Date()
  const ampm = now.getHours() < 12 ? 'AM' : 'PM'
  const dateStr = now.toLocaleDateString('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  }).toUpperCase().replace(',', '')

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <header className="relative h-[56px] bg-white border-b border-[#ebebeb] flex items-center justify-between px-4 min-[668px]:px-6 flex-shrink-0">
      {/* Mobile: hamburger | Desktop: station name */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="min-[668px]:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f4f4f4] transition-colors text-[#555]"
        >
          <Menu size={18} />
        </button>
      </div>

      <h1 className="hidden min-[668px]:block absolute left-1/2 -translate-x-1/2 text-[14px] font-bold tracking-widest text-[#111] uppercase">
        Pechon Street
      </h1>

      {/* Right side */}
      <div className="flex items-center gap-3 text-[12px] text-[#888]">
        {/* Desktop only */}
        <span className="hidden min-[668px]:inline font-semibold text-[#333]">YAAD MAN ENERGY JA LTD.</span>
        <span className="hidden min-[668px]:inline text-[#ddd]">|</span>

        {/* Always visible */}
        <span className="font-bold text-[#111]">{ampm}</span>
        <span className="font-semibold text-[#555] tracking-wide">{dateStr}</span>

        {/* Avatar + dropdown */}
        <div ref={dropdownRef} className="relative ml-1">
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="w-8 h-8 rounded-full bg-[#111] flex items-center justify-center text-white text-[11px] font-bold hover:bg-[#333] transition-colors"
          >
            AL
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 bg-white border border-[#e0e0e0] rounded-xl shadow-lg py-1 min-w-[160px] z-50">
              <div className="px-4 py-2.5 border-b border-[#f4f4f4]">
                <p className="text-[13px] font-bold text-[#111]">A. Lewis</p>
                <p className="text-[11px] text-[#aaa] font-medium">Supervisor</p>
              </div>
              <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors text-left">
                <Settings size={13} className="text-[#888]" />
                Settings
              </button>
              <button
                onClick={() => { setDropdownOpen(false); onLogout() }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-red-500 hover:bg-red-50 transition-colors text-left"
              >
                <LogOut size={13} />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
