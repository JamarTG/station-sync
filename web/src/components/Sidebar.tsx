import { Link, useRouterState } from '@tanstack/react-router'
import clsx from 'clsx'

const navItems = [{ label: 'Dashboard', to: '/' }]

const convenienceItems = [
  { label: 'Sales', to: '/convenience/sales' },
  { label: 'Accounts', to: '/convenience/accounts' },
  { label: 'Reports', to: '/convenience/reports' },
]

const stationItems = [
  { label: 'Accounts', to: '/station/accounts' },
  { label: 'Reports', to: '/station/reports' },
  { label: 'Staff', to: '/station/staff' },
  { label: 'Schedule', to: '/station/schedule' },
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
        isActive ? 'text-[#111] font-semibold' : 'text-[#888] hover:text-[#111]'
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
      <div className="p-5 pb-4">
        <div className="w-8 h-8 grid grid-cols-2 gap-[3px]">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-[#111] rounded-[2px]" />
          ))}
        </div>
      </div>

      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
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

        <div className="pt-4 pb-1 px-4">
          <p className="text-[10px] font-semibold tracking-widest text-[#aaa] uppercase">
            Service Station
          </p>
        </div>
        {stationItems.map((item) => (
          <NavLink key={item.to} {...item} onClick={onClose} />
        ))}
      </nav>

      <div className="p-3 border-t border-[#ebebeb]">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#f4f4f4] cursor-pointer transition-colors">
          <div className="w-8 h-8 rounded-full bg-[#e8e8e8] flex items-center justify-center text-xs font-bold text-[#555] flex-shrink-0">
            AL
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-[#111] truncate">A. Lewis</p>
            <p className="text-[11px] text-[#999] truncate">Supervisor</p>
          </div>
          <button className="ml-auto text-[#bbb] hover:text-[#888] text-xs">···</button>
        </div>
      </div>
    </aside>
  )
}
