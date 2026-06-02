import { useState } from 'react'
import { LogoLoader } from '../components/StationSyncLogo'
import { useRouterState } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal, X, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../lib/authContext'
import { usePumps, useNozzles, useFuels, useUsers, useTanks } from '../hooks/useApi'
import { createUser, updateUser } from '../lib/api'
import type { AuthUser } from '../lib/api'
import { PayrollPage } from './PayrollPage'
import { HolidaysPage } from './HolidaysPage'
import { RewardsSettingsPanel } from './RewardsPage'

type Category = 'profile' | 'rewards' | 'security' | 'notifications' | 'team' | 'payroll' | 'holidays' | 'forecourt' | 'business'

const categoryLabels: Record<Category, string> = {
  profile:       'Profile',
  rewards:       'Rewards',
  security:      'Security',
  notifications: 'Notifications',
  team:          'Team',
  payroll:       'Payroll',
  holidays:      'Holidays',
  forecourt:     'Forecourt',
  business:      'Business',
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return (parts[0][0] ?? '').toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-[#ebebeb] dark:border-[#222] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#f0f0f0] dark:border-[#1e1e1e]">
        <p className="text-[13px] font-bold tracking-widest text-[#111] dark:text-[#e0e0e0] uppercase">{title}</p>
      </div>
      <div className="px-6 py-5 space-y-5">{children}</div>
    </div>
  )
}

function Field({ label, value, type = 'text' }: { label: string; value: string; type?: string }) {
  const [val, setVal] = useState(value)
  return (
    <div>
      <label className="block text-[11px] font-semibold tracking-widest text-[#aaa] dark:text-[#555] uppercase mb-1.5">{label}</label>
      <input
        type={type}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-full bg-[#f9f9f9] dark:bg-[#1a1a1a] border border-[#ebebeb] dark:border-[#222] rounded-xl px-4 py-2.5 text-[13px] font-medium text-[#111] dark:text-[#e0e0e0] outline-none focus:border-[#ccc] dark:focus:border-[#444] transition-colors"
      />
    </div>
  )
}

function ToggleRow({ label, description, defaultOn = false }: { label: string; description: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0]">{label}</p>
        <p className="text-[12px] text-[#aaa] dark:text-[#555] mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => setOn((v) => !v)}
        className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 relative ${on ? 'bg-[#111] dark:bg-[#e0e0e0]' : 'bg-[#ddd] dark:bg-[#444]'}`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-5' : 'left-1'}`} />
      </button>
    </div>
  )
}

function SaveButton({ label = 'Save changes' }: { label?: string }) {
  return (
    <div className="pt-1">
      <button className="px-5 py-2.5 bg-white dark:bg-[#1a1a1a] border border-[#ddd] dark:border-[#333] text-[#333] dark:text-[#ccc] text-[13px] font-semibold rounded-xl hover:bg-[#f9f9f9] dark:hover:bg-[#1a1a1a] transition-colors">
        {label}
      </button>
    </div>
  )
}

function PlanSection() {
  return (
    <Section title="Plan">
      <div className="flex items-center justify-between py-1">
        <div>
          <p className="text-[14px] font-bold text-[#111] dark:text-[#e0e0e0]">Starter</p>
          <p className="text-[12px] text-[#aaa] dark:text-[#555] mt-0.5">Your current plan</p>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#f0f0f0] dark:bg-[#222] text-[#555] dark:text-[#999] tracking-widest uppercase">Active</span>
      </div>
      <div className="border-t border-[#f4f4f4] dark:border-[#1e1e1e] pt-4 space-y-2">
        {[
          '1 branch',
          'Up to 10 staff members',
          'Shift management & payroll',
          'Reports & analytics',
        ].map((feature) => (
          <div key={feature} className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#bbb] dark:bg-[#444] shrink-0" />
            <p className="text-[13px] text-[#666] dark:text-[#888]">{feature}</p>
          </div>
        ))}
      </div>
      <div className="pt-1">
        <button className="px-5 py-2 border border-[#e0e0e0] dark:border-[#2a2a2a] text-[13px] font-semibold text-[#555] dark:text-[#999] rounded-xl hover:bg-[#f9f9f9] dark:hover:bg-[#1a1a1a] transition-colors">
          Manage plan
        </button>
      </div>
    </Section>
  )
}

function ProfilePanel() {
  const { user } = useAuth()
  const nameParts = (user?.name ?? '').trim().split(/\s+/)
  const firstName = nameParts[0] ?? ''
  const lastName = nameParts.slice(1).join(' ')
  return (
    <div className="space-y-4">
      <Section title="Profile">
        <div className="flex items-center gap-4 pb-2">
          <div className="w-14 h-14 rounded-full bg-[#111] dark:bg-[#e0e0e0] flex items-center justify-center text-white dark:text-[#111] text-[16px] font-bold flex-shrink-0">
            {user ? initials(user.name) : '?'}
          </div>
          <div>
            <p className="text-[14px] font-bold text-[#111] dark:text-[#e0e0e0]">{user?.name ?? '—'}</p>
            <p className="text-[12px] text-[#aaa] dark:text-[#555] font-medium">{user?.role ?? '—'}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="First Name" value={firstName} />
          <Field label="Last Name" value={lastName} />
        </div>
        <Field label="Email" value={user?.email ?? ''} type="email" />
        <Field label="Phone" value="" />
        <SaveButton />
      </Section>
      <FXRatesPanel />
      <ShiftsPanel />
      <PlanSection />
    </div>
  )
}

function SecurityPanel() {
  return (
    <div className="space-y-4">
      <Section title="Password">
        <Field label="Current Password" value="" type="password" />
        <Field label="New Password" value="" type="password" />
        <Field label="Confirm New Password" value="" type="password" />
        <SaveButton label="Update password" />
      </Section>
      <Section title="Sessions">
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0]">Current session</p>
            <p className="text-[12px] text-[#aaa] dark:text-[#555] mt-0.5">Active now</p>
          </div>
          <span className="text-[11px] font-bold tracking-widest text-green-500 uppercase">Active</span>
        </div>
        <div className="pt-1">
          <button className="px-5 py-2 border border-[#e0e0e0] dark:border-[#2a2a2a] text-[13px] font-semibold text-[#555] dark:text-[#999] rounded-xl hover:bg-[#f9f9f9] dark:hover:bg-[#1a1a1a] transition-colors">
            Sign out all other sessions
          </button>
        </div>
      </Section>
    </div>
  )
}

function NotificationsPanel() {
  return (
    <div className="space-y-4">
      <Section title="Shift">
        <ToggleRow label="Shift reminders" description="Get notified before your shift starts" defaultOn />
        <ToggleRow label="End of shift summary" description="Receive a summary when your shift closes" defaultOn />
      </Section>
      <Section title="Inventory">
        <ToggleRow label="Low fuel alerts" description="Receive alerts when tank levels are low" defaultOn />
        <ToggleRow label="Low stock alerts" description="Alerts when convenience store items run low" />
      </Section>
      <Section title="Reports">
        <ToggleRow label="End of day summary" description="Daily report sent to your email" />
        <ToggleRow label="Weekly performance digest" description="Weekly summary delivered every Monday" />
      </Section>
    </div>
  )
}

const allRoles = ['Super Admin', 'Admin', 'Manager', 'Supervisor', 'Cashier', 'Attendant']

function memberInitials(name: string) {
  const p = name.trim().split(/\s+/)
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

function MemberModal({
  member,
  onClose,
  onSave,
}: {
  member: AuthUser | null
  onClose: () => void
  onSave: () => void
}) {
  const isEdit = !!member
  const [name, setName]         = useState(member?.name ?? '')
  const [email, setEmail]       = useState(member?.email ?? '')
  const [role, setRole]         = useState(member?.role ?? 'Attendant')
  const [phone, setPhone]       = useState(member?.phone ?? '')
  const [sickDays, setSickDays] = useState(member?.sick_days?.toString() ?? '')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [saving, setSaving]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    if (!isEdit && !password) { setError('Password is required'); return }
    setSaving(true)
    setError('')
    const sick = sickDays !== '' ? parseInt(sickDays, 10) : undefined
    try {
      if (isEdit) {
        await updateUser(member.id, { name: name.trim(), email: email.trim(), role, phone: phone || undefined, sick_days: sick ?? null })
      } else {
        await createUser({ name: name.trim(), email: email.trim(), role, password, phone: phone || undefined })
      }
      onSave()
      onClose()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string }
      setError(e?.response?.data?.error ?? e?.message ?? 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#2a2a2a] rounded-xl px-4 py-2.5 text-[13px] font-medium text-[#111] dark:text-[#e0e0e0] placeholder:text-[#ccc] dark:placeholder:text-[#444] placeholder:font-normal focus:outline-none focus:border-[#aaa] dark:focus:border-[#555] transition-colors'
  const labelCls = 'block text-[11px] font-semibold tracking-widest text-[#aaa] uppercase mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl shadow-xl border border-[#ebebeb] dark:border-[#222] w-full max-w-[460px] p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[18px] font-bold text-[#111] dark:text-[#e0e0e0]">{isEdit ? 'Edit member' : 'Add member'}</h2>
          <button onClick={onClose} className="text-[#bbb] dark:text-[#444] hover:text-[#111] dark:hover:text-[#e0e0e0] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Full name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
                {allRoles.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Phone <span className="normal-case tracking-normal font-normal text-[#ccc]">(optional)</span></label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="876-555-0001" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Sick Days <span className="normal-case tracking-normal font-normal text-[#ccc]">(optional)</span></label>
            <input type="number" min="0" value={sickDays} onChange={(e) => setSickDays(e.target.value)} placeholder="0" className={inputCls} />
          </div>
          {!isEdit && (
            <div>
              <label className={labelCls}>Temporary password</label>
              <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="They'll change it on first login" required className={inputCls} />
            </div>
          )}
          {error && <p className="text-[11px] font-semibold text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full mt-1 py-2.5 rounded-xl bg-white dark:bg-[#1a1a1a] border border-[#ddd] dark:border-[#333] text-[#333] dark:text-[#ccc] text-[13px] font-bold uppercase tracking-widest hover:bg-[#f9f9f9] dark:hover:bg-[#1a1a1a] transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add member'}
          </button>
        </form>
      </div>
    </div>
  )
}

function TeamPanel() {
  const { user: me } = useAuth()
  const qc = useQueryClient()
  const { data: users = [], isLoading } = useUsers()
  const [modalMember, setModalMember] = useState<AuthUser | 'new' | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const members = users

  async function toggleActive(u: AuthUser) {
    setTogglingId(u.id)
    try {
      await updateUser(u.id, { active: !u.active })
      qc.invalidateQueries({ queryKey: ['users'] })
    } finally {
      setTogglingId(null)
    }
  }

  function refresh() { qc.invalidateQueries({ queryKey: ['users'] }) }

  return (
    <div className="space-y-4">
      <Section title="Members">
        {isLoading ? (
          <div className="py-6 flex items-center justify-center">
            <LogoLoader />
          </div>
        ) : members.length === 0 ? (
          <div className="py-6 flex flex-col items-center justify-center gap-1">
            <p className="text-[13px] font-semibold text-[#bbb]">No team members yet</p>
            <p className="text-[12px] text-[#ccc] font-medium">Add staff to get started</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 -mx-1">
            {members.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-1 py-2 rounded-xl hover:bg-[#fafafa] dark:hover:bg-[#161616] transition-colors group">
                <div className="w-8 h-8 rounded-full bg-[#111] dark:bg-[#e0e0e0] flex items-center justify-center text-white dark:text-[#111] text-[11px] font-bold flex-shrink-0">
                  {memberInitials(u.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-semibold ${u.active ? 'text-[#111] dark:text-[#e0e0e0]' : 'text-[#aaa] dark:text-[#555]'}`}>{u.name}</p>
                  <p className="text-[11px] font-medium text-[#aaa] dark:text-[#555]">
                    {u.role} · {u.email}
                    {u.sick_days != null && ` · ${u.sick_days}d sick`}
                  </p>
                </div>
                {u.id === me?.id
                  ? <span className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase">You</span>
                  : !u.active && <span className="text-[10px] font-bold tracking-widest text-[#ccc] dark:text-[#444] uppercase">Inactive</span>
                }
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => setMenuOpen(menuOpen === u.id ? null : u.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[#ccc] dark:text-[#444] hover:text-[#555] dark:hover:text-[#999] hover:bg-[#f0f0f0] dark:hover:bg-[#222] transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {menuOpen === u.id && (
                    <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#2a2a2a] rounded-xl shadow-lg py-1 min-w-[140px] z-20">
                      <button
                        onClick={() => { setModalMember(u); setMenuOpen(null) }}
                        className="w-full text-left px-4 py-2 text-[13px] font-semibold text-[#333] dark:text-[#ccc] hover:bg-[#f9f9f9] dark:hover:bg-[#1a1a1a]"
                      >
                        Edit
                      </button>
                      {u.id !== me?.id && (
                        <button
                          disabled={togglingId === u.id}
                          onClick={() => { toggleActive(u); setMenuOpen(null) }}
                          className="w-full text-left px-4 py-2 text-[13px] font-semibold hover:bg-[#f9f9f9] dark:hover:bg-[#1a1a1a] disabled:opacity-40 transition-colors text-red-500"
                        >
                          {u.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="pt-2">
          <button
            onClick={() => setModalMember('new')}
            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-[#1a1a1a] border border-[#ddd] dark:border-[#333] text-[#333] dark:text-[#ccc] text-[13px] font-semibold rounded-xl hover:bg-[#f9f9f9] dark:hover:bg-[#1a1a1a] transition-colors"
          >
            <Plus size={13} />
            Add member
          </button>
        </div>
      </Section>

      {modalMember !== null && (
        <MemberModal
          member={modalMember === 'new' ? null : modalMember}
          onClose={() => { setModalMember(null); setMenuOpen(null) }}
          onSave={refresh}
        />
      )}
    </div>
  )
}

function ForecourtPanel() {
  const { data: pumps = [], isLoading: loadingPumps } = usePumps()
  const { data: nozzles = [], isLoading: loadingNozzles } = useNozzles()
  const { data: fuels = [] } = useFuels()
  const { data: tanks = [], isLoading: loadingTanks } = useTanks()

  const fuelName = (fuelId: string) => fuels.find((f) => f.id === fuelId)?.name ?? fuelId
  const pumpNozzles = (pumpId: string) => nozzles.filter((n) => n.pump_id === pumpId)

  const loading = loadingPumps || loadingNozzles

  return (
    <div className="space-y-4">
      <Section title="Pumps">
        {loading ? (
          <div className="py-6 flex items-center justify-center">
            <LogoLoader />
          </div>
        ) : pumps.length === 0 ? (
          <div className="py-6 flex items-center justify-center">
            <p className="text-[13px] font-medium text-[#bbb]">No pumps configured</p>
          </div>
        ) : (
          pumps.map((pump) => {
            const grades = pumpNozzles(pump.id)
            return (
              <div key={pump.id} className="flex items-center justify-between gap-4 py-1">
                <div>
                  <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0]">{pump.name}</p>
                  {grades.length > 0 ? (
                    <p className="text-[12px] font-medium text-[#aaa] dark:text-[#555] mt-0.5">
                      {grades.map((n) => fuelName(n.fuel_id)).join(' · ')}
                    </p>
                  ) : (
                    <p className="text-[12px] font-medium text-[#ccc] dark:text-[#444] mt-0.5">No nozzles</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {grades.map((n) => (
                    <span key={n.id} className="px-2.5 py-1 bg-[#f4f4f4] dark:bg-[#222] rounded-lg text-[11px] font-bold text-[#555] dark:text-[#999]">
                      {fuelName(n.fuel_id)}
                    </span>
                  ))}
                </div>
              </div>
            )
          })
        )}
        <SaveButton label="Add pump" />
      </Section>
      <Section title="Fuel Grades">
        {fuels.length === 0 ? (
          <div className="py-4 flex items-center justify-center">
            <p className="text-[13px] font-medium text-[#bbb]">No fuel grades configured</p>
          </div>
        ) : (
          fuels.map((f) => (
            <div key={f.id} className="flex items-center justify-between py-0.5">
              <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0]">{f.name}</p>
              <span className="px-2.5 py-1 bg-[#f4f4f4] dark:bg-[#222] rounded-lg text-[11px] font-bold text-[#555] dark:text-[#999]">{f.name}</span>
            </div>
          ))
        )}
        <SaveButton label="Add fuel grade" />
      </Section>
      <Section title="Tanks">
        {loadingTanks ? (
          <div className="py-6 flex items-center justify-center">
            <LogoLoader />
          </div>
        ) : tanks.length === 0 ? (
          <div className="py-6 flex items-center justify-center">
            <p className="text-[13px] font-medium text-[#bbb]">No tanks configured</p>
          </div>
        ) : (
          tanks.map((tank) => (
            <div key={tank.id} className="flex items-center justify-between gap-4 py-1">
              <div>
                <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0]">{tank.name}</p>
                <p className="text-[12px] font-medium text-[#aaa] dark:text-[#555] mt-0.5">
                  {tank.fuel_name} · {tank.capacity_litres.toLocaleString()} L capacity
                </p>
              </div>
              <span className="px-2.5 py-1 bg-[#f4f4f4] dark:bg-[#222] rounded-lg text-[11px] font-bold text-[#555] dark:text-[#999]">
                {tank.fuel_name}
              </span>
            </div>
          ))
        )}
        <SaveButton label="Add tank" />
      </Section>
    </div>
  )
}

const commonCurrencies = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'EUR', name: 'Euro' },
]

function FXRatesPanel() {
  const [rates, setRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(commonCurrencies.map(({ code }) => [code, '']))
  )
  const [saved, setSaved] = useState(false)

  function handleSave() {
    localStorage.setItem('fx_configured', '1')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-4">
      <Section title="Exchange Rates">
        <p className="text-[12px] font-medium text-[#aaa] dark:text-[#555] -mt-2">
          Set the exchange rate to Jamaican dollars (J$) for each currency you accept.
        </p>
        {commonCurrencies.map(({ code, name }) => (
          <div key={code}>
            <label className="block text-[11px] font-semibold tracking-widest text-[#aaa] uppercase mb-1.5">
              {name} ({code})
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[#aaa] dark:text-[#555] flex-shrink-0">1 {code} =</span>
              <div className="flex items-center flex-1 bg-[#f9f9f9] dark:bg-[#1a1a1a] border border-[#ebebeb] dark:border-[#222] rounded-xl px-4 py-2.5 gap-1.5 focus-within:border-[#ccc] dark:focus-within:border-[#444] transition-colors">
                <span className="text-[13px] font-semibold text-[#aaa] dark:text-[#555]">J$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rates[code]}
                  onChange={(e) => setRates((prev) => ({ ...prev, [code]: e.target.value }))}
                  placeholder="0.00"
                  className="flex-1 bg-transparent text-[13px] font-medium text-[#111] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
          </div>
        ))}
        <div className="pt-1">
          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-white border border-[#ddd] text-[#333] text-[13px] font-semibold rounded-xl hover:bg-[#f9f9f9] transition-colors"
          >
            {saved ? 'Saved' : 'Save rates'}
          </button>
        </div>
      </Section>
      <Section title="Rounding">
        <ToggleRow label="Round to nearest dollar" description="Round FX amounts to the nearest J$ when recording transactions" />
        <ToggleRow label="Show FX rate on receipts" description="Display the exchange rate used on printed receipts" defaultOn />
      </Section>
    </div>
  )
}

type ShiftConfig = { id: string; name: string; start: string; end: string }

function calcDuration(start: string, end: string): string {
  if (!start || !end) return ''
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) mins += 24 * 60
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function ShiftRows({
  shifts,
  onChange,
  onAdd,
  onRemove,
}: {
  shifts: ShiftConfig[]
  onChange: (id: string, field: keyof ShiftConfig, value: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
}) {
  const inputCls = 'bg-[#f9f9f9] dark:bg-[#1a1a1a] border border-[#ebebeb] dark:border-[#222] rounded-xl px-3 py-2 text-[13px] font-medium text-[#111] dark:text-[#e0e0e0] outline-none focus:border-[#ccc] dark:focus:border-[#444] transition-colors w-full'
  return (
    <div className="space-y-3">
      {shifts.length === 0 && (
        <p className="text-[13px] font-medium text-[#bbb] py-2">No shifts configured</p>
      )}
      {shifts.map((s) => {
        const dur = calcDuration(s.start, s.end)
        return (
          <div key={s.id} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={s.name}
                onChange={(e) => onChange(s.id, 'name', e.target.value)}
                placeholder="Shift name"
                className={inputCls}
              />
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <input
                type="time"
                value={s.start}
                onChange={(e) => onChange(s.id, 'start', e.target.value)}
                className="bg-[#f9f9f9] border border-[#ebebeb] rounded-xl px-3 py-2 text-[13px] font-medium text-[#111] outline-none focus:border-[#ccc] transition-colors"
              />
              <span className="text-[12px] font-medium text-[#bbb] dark:text-[#444]">to</span>
              <input
                type="time"
                value={s.end}
                onChange={(e) => onChange(s.id, 'end', e.target.value)}
                className="bg-[#f9f9f9] border border-[#ebebeb] rounded-xl px-3 py-2 text-[13px] font-medium text-[#111] outline-none focus:border-[#ccc] transition-colors"
              />
            </div>
            {dur && (
              <span className="text-[11px] font-semibold text-[#aaa] dark:text-[#555] flex-shrink-0 w-10 text-right">{dur}</span>
            )}
            <button
              onClick={() => onRemove(s.id)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#ccc] hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )
      })}
      <div className="pt-1">
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-[#555] dark:text-[#999] hover:text-[#111] dark:hover:text-[#e0e0e0] transition-colors"
        >
          <Plus size={13} />
          Add shift
        </button>
      </div>
    </div>
  )
}

const DEFAULT_STATION_SHIFTS: ShiftConfig[] = [
  { id: '1', name: 'Morning', start: '06:00', end: '14:00' },
  { id: '2', name: 'Evening', start: '14:00', end: '22:00' },
  { id: '3', name: 'Night',   start: '22:00', end: '06:00' },
]
const DEFAULT_CONV_SHIFTS: ShiftConfig[] = [
  { id: '1', name: 'Day',   start: '08:00', end: '16:00' },
  { id: '2', name: 'Night', start: '16:00', end: '00:00' },
]

function loadShifts(key: string, fallback: ShiftConfig[]): ShiftConfig[] {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { return fallback }
}

function ShiftsPanel() {
  const [stationShifts, setStationShifts] = useState<ShiftConfig[]>(() => loadShifts('ss_station_shifts', DEFAULT_STATION_SHIFTS))
  const [convShifts, setConvShifts] = useState<ShiftConfig[]>(() => loadShifts('ss_conv_shifts', DEFAULT_CONV_SHIFTS))
  const [saved, setSaved] = useState(false)

  function update(
    setList: React.Dispatch<React.SetStateAction<ShiftConfig[]>>,
    id: string, field: keyof ShiftConfig, value: string
  ) {
    setList((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s))
  }

  function add(setList: React.Dispatch<React.SetStateAction<ShiftConfig[]>>) {
    setList((prev) => [...prev, { id: Date.now().toString(), name: '', start: '', end: '' }])
  }

  function remove(setList: React.Dispatch<React.SetStateAction<ShiftConfig[]>>, id: string) {
    setList((prev) => prev.filter((s) => s.id !== id))
  }

  function handleSave() {
    localStorage.setItem('ss_station_shifts', JSON.stringify(stationShifts))
    localStorage.setItem('ss_conv_shifts', JSON.stringify(convShifts))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-4">
      <Section title="Service Station Shifts">
        <ShiftRows
          shifts={stationShifts}
          onChange={(id, f, v) => update(setStationShifts, id, f, v)}
          onAdd={() => add(setStationShifts)}
          onRemove={(id) => remove(setStationShifts, id)}
        />
      </Section>
      <Section title="Convenience Store Shifts">
        <ShiftRows
          shifts={convShifts}
          onChange={(id, f, v) => update(setConvShifts, id, f, v)}
          onAdd={() => add(setConvShifts)}
          onRemove={(id) => remove(setConvShifts, id)}
        />
      </Section>
      <div className="pt-1">
        <button
          onClick={handleSave}
          className="px-5 py-2.5 bg-white border border-[#ddd] text-[#333] text-[13px] font-semibold rounded-xl hover:bg-[#f9f9f9] transition-colors"
        >
          {saved ? 'Saved' : 'Save shifts'}
        </button>
      </div>
    </div>
  )
}

function BusinessPanel() {
  const { user } = useAuth()
  return (
    <div className="space-y-4">
      <Section title="Business Details">
        <Field label="Business Name" value={user?.business_name ?? ''} />
        <Field label="Address Line 1" value={user?.business_address_line1 ?? ''} />
        <Field label="Address Line 2" value={user?.business_address_line2 ?? ''} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="City" value={user?.business_city ?? ''} />
          <Field label="Parish" value={user?.business_parish ?? ''} />
        </div>
        <SaveButton />
      </Section>
      <Section title="Branches">
        <div className="py-4 flex items-center justify-center">
          <p className="text-[13px] font-medium text-[#bbb]">Branch management coming soon</p>
        </div>
      </Section>
    </div>
  )
}

export function AccountSettingsPage() {
  const { location } = useRouterState()
  const active = (new URLSearchParams(location.search).get('tab') as Category) ?? 'profile'

  // Payroll renders the full payroll workspace (runs, compensation, tax config,
  // settings, analytics, audit) — it manages its own header and wide layout.
  if (active === 'payroll') {
    return (
      <div className="h-full overflow-y-auto">
        <PayrollPage />
      </div>
    )
  }

  // Holidays renders the full Holiday Management workspace (calendar, pay rules,
  // forecast, sign-ups, analytics) — it manages its own header and wide layout.
  if (active === 'holidays') {
    return (
      <div className="h-full overflow-y-auto">
        <HolidaysPage />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-[640px] space-y-4">
        <div className="mb-6">
          <h1 className="text-[22px] font-bold text-[#111] dark:text-[#e0e0e0]">{categoryLabels[active]}</h1>
        </div>
        {active === 'profile'       && <ProfilePanel />}
        {active === 'rewards'       && <RewardsSettingsPanel />}
        {active === 'security'      && <SecurityPanel />}
        {active === 'notifications' && <NotificationsPanel />}
        {active === 'team'          && <TeamPanel />}
        {active === 'forecourt'     && <ForecourtPanel />}
        {active === 'business'      && <BusinessPanel />}
      </div>
    </div>
  )
}
