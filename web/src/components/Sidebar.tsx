import { useState, useRef, useEffect } from 'react'
import { Link, useRouterState, useNavigate } from '@tanstack/react-router'
import { AlertCircle, Tv2, ArrowLeft, User, Shield, Bell, Users, Banknote, Fuel, Building2, Search, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import { StationSyncLogo } from './StationSyncLogo'
import { useAuth } from '../lib/authContext'

const managerRoles = new Set(['Super Admin', 'Admin', 'Manager'])

const managerItems = [
  { label: 'Dashboard', to: '/' },
  { label: 'Sales',     to: '/station/sales' },
  { label: 'Reports',   to: '/station/reports' },
  { label: 'Expenses',  to: '/expenses' },
  { label: 'Staff',     to: '/station/staff' },
  { label: 'Schedule',  to: '/station/schedule' },
  { label: 'Charges',   to: '/station/charges' },
]

const stationItems = [
  { label: 'Sales',     to: '/station/sales' },
  { label: 'Reports',   to: '/station/reports' },
  { label: 'Staff',     to: '/station/staff' },
  { label: 'Schedule',  to: '/station/schedule' },
  { label: 'Charges',   to: '/station/charges' },
]

const convenienceItems = [
  { label: 'Sales',     to: '/convenience/sales' },
  { label: 'Staff',     to: '/convenience/staff' },
  { label: 'Schedule',  to: '/convenience/schedule' },
]

const settingsCategories = [
  { id: 'profile',       label: 'Profile',        icon: User },
  { id: 'security',      label: 'Security',        icon: Shield },
  { id: 'notifications', label: 'Notifications',   icon: Bell },
  { id: 'team',          label: 'Team',            icon: Users },
  { id: 'payroll',       label: 'Payroll',         icon: Banknote },
  { id: 'pumps',         label: 'Pumps',           icon: Fuel },
  { id: 'business',      label: 'Business',        icon: Building2 },
]

type SettingsItem = { tab: string; label: string; description: string }

const allSettingsItems: SettingsItem[] = [
  { tab: 'profile',       label: 'Profile',              description: 'Name, email, and contact info' },
  { tab: 'profile',       label: 'First & Last Name',    description: 'Update your display name' },
  { tab: 'profile',       label: 'Email address',        description: 'Change your login email' },
  { tab: 'profile',       label: 'Phone number',         description: 'Update your contact number' },
  { tab: 'security',      label: 'Password',             description: 'Change your account password' },
  { tab: 'security',      label: 'Sessions',             description: 'View and revoke active sessions' },
  { tab: 'notifications', label: 'Shift reminders',      description: 'Notifications before your shift starts' },
  { tab: 'notifications', label: 'Low fuel alerts',      description: 'Alerts when tank levels drop' },
  { tab: 'notifications', label: 'Low stock alerts',     description: 'Alerts for convenience store stock' },
  { tab: 'notifications', label: 'End of day summary',   description: 'Daily report to your email' },
  { tab: 'team',          label: 'Team members',         description: 'Invite and manage staff' },
  { tab: 'team',          label: 'Roles & permissions',  description: 'Configure access levels per role' },
  { tab: 'payroll',       label: 'Pay period',           description: 'Set pay frequency and pay day' },
  { tab: 'payroll',       label: 'Pay rates',            description: 'Default rates per role' },
  { tab: 'payroll',       label: 'NIS deductions',       description: 'National Insurance contributions' },
  { tab: 'payroll',       label: 'Income tax',           description: 'Statutory income tax deductions' },
  { tab: 'payroll',       label: 'NHT contributions',    description: 'National Housing Trust deductions' },
  { tab: 'payroll',       label: 'Configure payroll',    description: 'Pay periods, rates and deductions' },
  { tab: 'profile',       label: 'FX rates',             description: 'Exchange rates for foreign currency' },
  { tab: 'profile',       label: 'USD rate',             description: 'US Dollar to Jamaican Dollar rate' },
  { tab: 'profile',       label: 'GBP rate',             description: 'British Pound to Jamaican Dollar rate' },
  { tab: 'profile',       label: 'FX rounding',          description: 'Round FX amounts on transactions' },
  { tab: 'pumps',         label: 'Pumps',                description: 'Manage pump names and nozzles' },
  { tab: 'pumps',         label: 'Fuel grades',          description: 'Configure available fuel grades' },
  { tab: 'business',      label: 'Business details',     description: 'Name, address, and location info' },
  { tab: 'business',      label: 'Branches',             description: 'Manage branch locations' },
]

const tabLabel: Record<string, string> = Object.fromEntries(
  settingsCategories.map(({ id, label }) => [id, label])
)

function SettingsSearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const q = query.trim().toLowerCase()
  const results = q
    ? allSettingsItems.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          tabLabel[item.tab]?.toLowerCase().includes(q)
      )
    : []

  function go(tab: string) {
    navigate({ to: '/settings', search: { tab } })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-[15vh] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-[#e0e0e0] w-full max-w-[480px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#f0f0f0]">
          <Search size={15} className="text-[#bbb] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search settings…"
            className="flex-1 text-[13px] font-medium text-[#111] placeholder:text-[#bbb] focus:outline-none bg-transparent"
          />
          <kbd className="text-[10px] font-bold text-[#bbb] border border-[#e0e0e0] rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        {q === '' ? (
          <div className="px-4 py-3 pb-2">
            <p className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase mb-2">Categories</p>
            <div className="flex flex-col gap-0.5">
              {settingsCategories.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => go(id)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#f4f4f4] transition-colors text-left group"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#f4f4f4] group-hover:bg-white flex items-center justify-center flex-shrink-0 transition-colors">
                    <Icon size={13} className="text-[#555]" />
                  </div>
                  <p className="text-[13px] font-semibold text-[#111] flex-1">{label}</p>
                  <ChevronRight size={13} className="text-[#ccc] flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="px-4 py-8 flex items-center justify-center">
            <p className="text-[13px] font-medium text-[#bbb]">No settings matching "{query}"</p>
          </div>
        ) : (
          <div className="px-4 py-3 pb-2 max-h-[320px] overflow-y-auto">
            <p className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase mb-2">{results.length} result{results.length !== 1 ? 's' : ''}</p>
            <div className="flex flex-col gap-0.5">
              {results.map((item, i) => (
                <button
                  key={i}
                  onClick={() => go(item.tab)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#f4f4f4] transition-colors text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#111]">{item.label}</p>
                    <p className="text-[11px] font-medium text-[#aaa] mt-0.5">{item.description}</p>
                  </div>
                  <span className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase flex-shrink-0">
                    {tabLabel[item.tab]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-4 py-2 border-t border-[#f4f4f4]" />
      </div>
    </div>
  )
}

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
  posMode?: boolean
  onTogglePosMode?: () => void
}

export function Sidebar({ isOpen, onClose, posMode, onTogglePosMode }: Props) {
  const { user } = useAuth()
  const { location } = useRouterState()
  const isSettings = location.pathname === '/settings'
  const activeTab = new URLSearchParams(location.search).get('tab') ?? 'profile'
  const isManager = managerRoles.has(user?.role ?? '')
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <>
      <aside
        className={clsx(
          'w-[190px] bg-white border-r border-[#ebebeb] flex flex-col h-full flex-shrink-0',
          'fixed inset-y-0 left-0 z-40 transition-transform duration-300',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'min-[668px]:relative min-[668px]:translate-x-0 min-[668px]:z-auto',
        )}
      >
        <div className="px-5 pt-5 pb-4 flex items-center justify-between">
          <StationSyncLogo size={32} />
          {isSettings ? (
            <button
              onClick={() => setSearchOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#aaa] hover:text-[#111] hover:bg-[#f4f4f4] transition-colors flex-shrink-0"
              title="Search settings"
            >
              <Search size={15} />
            </button>
          ) : !isManager ? (
            <button
              title={posMode ? 'Exit POS Mode' : 'POS Mode'}
              onClick={onTogglePosMode}
              className={clsx(
                'w-8 h-8 flex items-center justify-center rounded-lg transition-colors flex-shrink-0',
                posMode ? 'text-[#111] bg-[#f0f0f0]' : 'text-[#aaa] hover:text-[#111] hover:bg-[#f4f4f4]'
              )}
            >
              <Tv2 size={16} />
            </button>
          ) : null}
        </div>

        {isSettings ? (
          <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
            <Link
              to="/"
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 mb-1 text-[13px] font-medium text-[#888] hover:text-[#111] hover:bg-black/[0.03] rounded-md transition-colors"
            >
              <ArrowLeft size={13} className="flex-shrink-0" />
              Dashboard
            </Link>

            <div className="pt-3 pb-1 px-4">
              <p className="text-[10px] font-semibold tracking-widest text-[#aaa] uppercase">Settings</p>
            </div>

            {settingsCategories.map(({ id, label, icon: Icon }) => (
              <Link
                key={id}
                to="/settings"
                search={{ tab: id }}
                onClick={onClose}
                className={clsx(
                  'flex items-center gap-2.5 px-4 py-2 text-[13px] font-medium rounded-md transition-colors',
                  activeTab === id
                    ? 'text-[#111] font-semibold bg-black/[0.06] ring-1 ring-[#ddd]'
                    : 'text-[#888] hover:text-[#111] hover:bg-black/[0.03]'
                )}
              >
                <Icon size={13} className="flex-shrink-0" />
                {label}
              </Link>
            ))}
          </nav>
        ) : isManager ? (
          <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
            {managerItems.map((item) => (
              <NavLink key={item.to} {...item} onClick={onClose} />
            ))}
          </nav>
        ) : (
          <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
            <NavLink label="Dashboard" to="/" onClick={onClose} />

            <div className="pt-4 pb-1 px-4">
              <p className="text-[10px] font-semibold tracking-widest text-[#aaa] uppercase">Service Station</p>
            </div>
            {stationItems.map((item) => (
              <NavLink key={item.to} {...item} onClick={onClose} />
            ))}

            <div className="pt-4 pb-1 px-4">
              <p className="text-[10px] font-semibold tracking-widest text-[#aaa] uppercase">Convenience Store</p>
            </div>
            {convenienceItems.map((item) => (
              <NavLink key={item.to} {...item} onClick={onClose} />
            ))}
          </nav>
        )}

        <div className="p-3 border-t border-[#ebebeb]">
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-[#888] hover:text-[#111] hover:bg-[#f4f4f4] transition-colors text-left">
            <AlertCircle size={14} className="flex-shrink-0" />
            Report a bug
          </button>
        </div>
      </aside>

      {searchOpen && <SettingsSearchModal onClose={() => setSearchOpen(false)} />}
    </>
  )
}
