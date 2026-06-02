import { useState, useRef, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Menu, Settings, LogOut, Bell, Moon, Sun } from 'lucide-react'
import { useAuth } from '../lib/authContext'
import { SyncStatusIndicator } from './SyncStatusIndicator'

interface Props {
  onMenuClick: () => void
  onLogout: () => void
  dark: boolean
  onToggleDark: () => void
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return (parts[0][0] ?? '').toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function TopBar({ onMenuClick, onLogout, dark, onToggleDark }: Props) {
  const { user } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const now = new Date()
  const ampm = now.getHours() < 12 ? 'AM' : 'PM'
  const dateStr = now.toLocaleDateString('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  }).toUpperCase().replace(',', '')

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <header className="relative h-[56px] bg-white dark:bg-[#111] border-b border-[#ebebeb] dark:border-[#222] flex items-center justify-between px-4 min-[668px]:px-6 flex-shrink-0">
      {/* Mobile: hamburger */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="min-[668px]:hidden w-8 h-8 flex items-center justify-center rounded-lg text-[#555] dark:text-[#888] hover:bg-[#f4f4f4] dark:hover:bg-[#222] transition-colors"
        >
          <Menu size={18} />
        </button>
      </div>

      {user?.business_address_line1 && (
        <h1 className="hidden min-[668px]:block max-[1087px]:!hidden absolute left-1/2 -translate-x-1/2 text-[14px] font-bold tracking-widest text-[#111] dark:text-[#d0d0d0] uppercase">
          {user.business_address_line1}
        </h1>
      )}

      {/* Right side */}
      <div className="flex items-center gap-3 text-[12px]">
        {/* Offline / sync status */}
        <SyncStatusIndicator />

        {/* Dark mode toggle */}
        <button
          onClick={onToggleDark}
          className="hidden min-[668px]:flex w-8 h-8 items-center justify-center rounded-lg text-[#888] dark:text-[#666] hover:text-[#111] dark:hover:text-[#ccc] hover:bg-[#f4f4f4] dark:hover:bg-[#222] transition-colors"
          title={dark ? 'Light mode' : 'Night mode'}
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Business name */}
        <span className="hidden min-[668px]:inline font-semibold text-[#333] dark:text-[#ccc]">{user?.business_name?.toUpperCase() ?? ''}</span>
        <span className="hidden min-[668px]:inline text-[#ddd] dark:text-[#333]">|</span>

        {/* AM/PM + date */}
        <span className="font-bold text-[#111] dark:text-[#d0d0d0]">{ampm}</span>
        <span className="font-semibold text-[#555] dark:text-[#888] tracking-wide">{dateStr}</span>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => { setNotifOpen((o) => !o); setDropdownOpen(false) }}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#888] dark:text-[#666] hover:text-[#111] dark:hover:text-[#ccc] hover:bg-[#f4f4f4] dark:hover:bg-[#222] transition-colors"
          >
            <Bell size={16} />
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#2a2a2a] rounded-xl shadow-lg z-50 w-[280px]">
              <div className="px-4 py-3 border-b border-[#f4f4f4] dark:border-[#222]">
                <p className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">Notifications</p>
              </div>
              <div className="py-8 flex items-center justify-center">
                <p className="text-[12px] font-medium text-[#bbb] dark:text-[#555]">No new notifications</p>
              </div>
            </div>
          )}
        </div>

        {/* Avatar + dropdown */}
        <div ref={dropdownRef} className="relative ml-1">
          <button
            onClick={() => { setDropdownOpen((o) => !o); setNotifOpen(false) }}
            className="w-8 h-8 rounded-full bg-[#111] dark:bg-[#333] flex items-center justify-center text-white text-[11px] font-bold hover:bg-[#333] dark:hover:bg-[#444] transition-colors"
          >
            {user ? initials(user.name) : '?'}
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#2a2a2a] rounded-xl shadow-lg py-1 min-w-[160px] z-50">
              <div className="px-4 py-2.5 border-b border-[#f4f4f4] dark:border-[#222]">
                <p className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">{user?.name ?? '—'}</p>
                <p className="text-[11px] text-[#aaa] dark:text-[#555] font-medium">{user?.role ?? '—'}</p>
              </div>
              <button
                onClick={() => { setDropdownOpen(false); navigate({ to: '/settings' }) }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-[#333] dark:text-[#ccc] hover:bg-[#f9f9f9] dark:hover:bg-[#222] transition-colors text-left"
              >
                <Settings size={13} className="text-[#888] dark:text-[#666]" />
                Settings
              </button>
              <button
                onClick={() => { setDropdownOpen(false); onLogout() }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left"
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
