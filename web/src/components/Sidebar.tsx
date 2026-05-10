import { Link, useRouterState } from '@tanstack/react-router'
import { AlertCircle, Tv2 } from 'lucide-react'
import clsx from 'clsx'
import { StationSyncLogo } from './StationSyncLogo'

const navItems = [{ label: 'Dashboard', to: '/' }]

const convenienceItems = [
  { label: 'Sales', to: '/convenience/sales' },
  { label: 'Staff', to: '/convenience/staff' },
  { label: 'Schedule', to: '/convenience/schedule' },
]

const stationItems = [
  { label: 'Sales', to: '/station/sales' },
  { label: 'Reports', to: '/station/reports' },
  { label: 'Staff', to: '/station/staff' },
  { label: 'Schedule', to: '/station/schedule' },
  { label: 'Charges', to: '/station/charges' },
]

function NavLink({ to, label, onClick }: { to: string; label: string; onClick?: () => void }) {
  const { location } = useRouterState()
  const isActive = location.pathname === to

  return (
    <Link
      to={to}
      onClick={onClick}
      className={clsx(
        'block px-4 py-2 text-[13px] font-medium rounded-md transition-colors',
        isActive ? 'text-[#111] font-semibold bg-black/[0.06] ring-1 ring-[#ddd]' : 'text-[#888] hover:text-[#111] hover:bg-black/[0.03]'
      )}
    >
      {label}
    </Link>
  )
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: Props) {

  return (
    <aside
      className={clsx(
        // base styles
        'w-[190px] bg-white border-r border-[#ebebeb] flex flex-col h-full flex-shrink-0',
        // mobile: fixed overlay, slides in/out
        'fixed inset-y-0 left-0 z-40 transition-transform duration-300',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        // desktop: back in normal flow, always visible
        'min-[668px]:relative min-[668px]:translate-x-0 min-[668px]:z-auto',
      )}
    >
      <div className="px-5 pt-5 pb-4 flex items-center justify-between">
        <StationSyncLogo size={32} />
        <button
          title="POS Mode"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#aaa] hover:text-[#111] hover:bg-[#f4f4f4] transition-colors flex-shrink-0"
        >
          <Tv2 size={16} />
        </button>
      </div>

      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink key={item.to} {...item} onClick={onClose} />
        ))}

        <div className="pt-4 pb-1 px-4">
          <p className="text-[10px] font-semibold tracking-widest text-[#aaa] uppercase">
            Service Station
          </p>
        </div>
        {stationItems.map((item) => (
          <NavLink key={item.to} {...item} onClick={onClose} />
        ))}

        <div className="pt-4 pb-1 px-4">
          <p className="text-[10px] font-semibold tracking-widest text-[#aaa] uppercase">
            Convenience Store
          </p>
        </div>
        {convenienceItems.map((item) => (
          <NavLink key={item.to} {...item} onClick={onClose} />
        ))}
      </nav>

      <div className="p-3 border-t border-[#ebebeb]">
        <button
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-[#888] hover:text-[#111] hover:bg-[#f4f4f4] transition-colors text-left"
        >
          <AlertCircle size={14} className="flex-shrink-0" />
          Report a bug
        </button>
      </div>

    </aside>
  )
}
