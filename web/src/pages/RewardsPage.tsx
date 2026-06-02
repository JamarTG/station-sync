import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Gift, Search, Plus, X, Users, Tag, Megaphone, BarChart2,
  Check, Loader2, Edit2, Trash2, Sparkles,
  TrendingUp, Fuel, ShoppingBag, Droplets, Crown, ChevronRight, AlertTriangle,
} from 'lucide-react'
import clsx from 'clsx'
import { useCustomers } from '../hooks/useApi'
import { useAuth } from '../lib/authContext'
import { createCustomer, type Customer } from '../lib/api'
import {
  getLoyaltyRewards, createLoyaltyReward, updateLoyaltyReward, deleteLoyaltyReward,
  getLoyaltyTiers, upsertLoyaltyTier, getLoyaltyConfig, upsertLoyaltyConfig,
  getLoyaltyWallet, redeemReward, adjustPoints, earnPoints,
  getLoyaltyCampaigns, createLoyaltyCampaign, toggleLoyaltyCampaign,
  getLoyaltyRedemptions, reviewRedemption, getLoyaltyAnalytics,
  type LoyaltyReward, type RewardType, type RewardInput, type LoyaltyConfig,
  type LoyaltyTier, type LoyaltyCampaign, type LoyaltyWallet,
} from '../lib/api'
import { LogoLoader } from '../components/StationSyncLogo'
import { matchesSearch } from '../lib/search'

const managerRoles = new Set(['Super Admin', 'Admin', 'Manager', 'Super Duper Admin'])

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString('en-JM') }
function money(n: number) { return '$' + n.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function initials(name: string) { return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() }
function uuid() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random())
}

const REWARD_TYPE_META: Record<RewardType, { label: string; icon: React.ElementType; color: string }> = {
  fuel_discount:  { label: 'Fuel Discount',  icon: Fuel,        color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
  store_discount: { label: 'Store Discount', icon: ShoppingBag, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/30' },
  free_product:   { label: 'Free Product',   icon: Gift,        color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
  car_wash:       { label: 'Car Wash',       icon: Droplets,    color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30' },
  membership:     { label: 'Membership',     icon: Crown,       color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('bg-white dark:bg-[#1a1a1a] border border-[#ebebeb] dark:border-[#222] rounded-2xl', className)}>{children}</div>
}
function Loading() { return <div className="flex items-center justify-center py-16"><LogoLoader /></div> }
function Empty({ msg }: { msg: string }) { return <div className="py-14 text-center text-[13px] font-semibold text-[#bbb] dark:text-[#555]">{msg}</div> }

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Members (with wallet + redeem)
// ═══════════════════════════════════════════════════════════════════════════════

function MembersTab({ isManager, tabsSlot, showAdd, setShowAdd }: {
  isManager: boolean; tabsSlot: React.ReactNode; showAdd: boolean; setShowAdd: (b: boolean) => void
}) {
  const qc = useQueryClient()
  const { data: customers = [], isLoading } = useCustomers()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Customer | null>(null)

  const matches = customers.filter((c) =>
    matchesSearch(query, { text: [c.name, c.phone, c.email, (c as any).tier], date: c.created_at }))

  const COLS = 'grid-cols-[2fr_1fr_1fr_1.5fr_32px]'

  return (
    <>
      <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4 min-w-0">
        {/* Search + add + category tabs */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-1 px-4 py-2.5 bg-white dark:bg-[#1a1a1a] border border-[#ebebeb] dark:border-[#222] rounded-xl">
            <Search size={14} className="text-[#bbb] dark:text-[#444] shrink-0" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members…"
              className="flex-1 text-[13px] text-[#111] dark:text-[#e0e0e0] placeholder-[#ccc] dark:placeholder-[#444] outline-none bg-transparent" />
            {query && <button onClick={() => setQuery('')} className="text-[#bbb] dark:text-[#444] hover:text-[#555] dark:hover:text-[#999] transition-colors"><X size={14} /></button>}
          </div>
          {tabsSlot}
        </div>

        {/* Members table card */}
        <div className="flex-1 min-h-0 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-[#ebebeb] dark:border-[#222] overflow-hidden flex flex-col">
          <div className={clsx('grid gap-4 px-5 py-2.5 border-b border-[#f0f0f0] dark:border-[#1e1e1e] bg-[#fafafa] dark:bg-[#161616] shrink-0', COLS)}>
            {['Member', 'Tier', 'Points', 'Phone', ''].map((h, i) => (
              <p key={i} className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase">{h}</p>
            ))}
          </div>
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center"><Loading /></div>
          ) : matches.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[13px] text-[#aaa] dark:text-[#555]">{customers.length === 0 ? 'No members enrolled yet' : 'No results found'}</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {matches.map((c) => (
                <button key={c.id} onClick={() => setSelected(c)}
                  className={clsx('w-full grid gap-4 items-center px-5 py-3.5 border-b border-[#f8f8f8] dark:border-[#1a1a1a] last:border-0 text-left transition-colors', COLS,
                    selected?.id === c.id ? 'bg-[#f4f4f4] dark:bg-[#222]' : 'hover:bg-[#fafafa] dark:hover:bg-[#161616]')}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-[#111] dark:bg-[#e0e0e0] flex items-center justify-center text-[9px] font-bold text-white dark:text-[#111] shrink-0">{initials(c.name)}</div>
                    <span className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] truncate">{c.name}</span>
                  </div>
                  <TierChip tier={(c as any).tier ?? 'Bronze'} />
                  <span className="text-[13px] font-bold tabular-nums text-[#111] dark:text-[#e0e0e0]">{fmt((c as any).loyalty_points ?? 0)}</span>
                  <span className="text-[12px] text-[#888] truncate">{c.phone || '—'}</span>
                  <ChevronRight size={14} className="text-[#ccc] dark:text-[#444]" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: wallet detail (parallels catalog side panel) */}
      <div className="w-[420px] shrink-0 border-l border-[#e8e8e8] dark:border-[#222] overflow-y-auto h-full">
        {selected
          ? <div className="p-5"><WalletPanel customer={selected} isManager={isManager} onClose={() => setSelected(null)}
              onChange={() => qc.invalidateQueries({ queryKey: ['customers'] })} /></div>
          : <div className="h-full flex items-center justify-center px-8 text-center">
              <p className="text-[13px] font-medium text-[#bbb] dark:text-[#444]">Select a member to view their rewards wallet</p>
            </div>}
      </div>

      {showAdd && <AddMemberModal onClose={() => setShowAdd(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ['customers'] }); setShowAdd(false) }} />}
    </>
  )
}

function TierChip({ tier }: { tier: string }) {
  const cls: Record<string, string> = {
    Bronze:   'text-[#9a3412] bg-[#ffede6] dark:bg-[#3a1e12] dark:text-[#e8a583]',
    Silver:   'text-[#4b5563] bg-[#f0f0f0] dark:bg-[#222] dark:text-[#bbb]',
    Gold:     'text-[#92400e] bg-[#fef3c7] dark:bg-[#3a2e0e] dark:text-[#e8c372]',
    Platinum: 'text-[#6b4fa8] bg-[#eeebf8] dark:bg-[#2a2244] dark:text-[#b9a6e8]',
  }
  return <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', cls[tier] ?? cls.Bronze)}>{tier}</span>
}

function WalletPanel({ customer, isManager, onClose, onChange }: {
  customer: Customer; isManager: boolean; onClose: () => void; onChange: () => void
}) {
  const qc = useQueryClient()
  const { data: wallet, isLoading } = useQuery({ queryKey: ['wallet', customer.id], queryFn: () => getLoyaltyWallet(customer.id) })
  const [adjustOpen, setAdjustOpen] = useState(false)

  const redeemMut = useMutation({
    mutationFn: (rewardId: string) => redeemReward(customer.id, rewardId, uuid()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wallet', customer.id] }); onChange() },
  })

  if (isLoading || !wallet) return <Card className="p-5"><Loading /></Card>

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#111] dark:bg-[#e0e0e0] flex items-center justify-center text-[12px] font-bold text-white dark:text-[#111]">{initials(wallet.customer_name)}</div>
            <div>
              <p className="text-[14px] font-bold text-[#111] dark:text-[#e0e0e0]">{wallet.customer_name}</p>
              <p className="text-[11px] text-[#aaa]">{customer.phone || customer.email || 'No contact'}</p>
            </div>
          </div>
          <button onClick={onClose}><X size={15} className="text-[#bbb]" /></button>
        </div>

        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-[34px] font-black text-[#111] dark:text-[#e0e0e0] leading-none">{fmt(wallet.current_points)}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#bbb] mt-1">Points · {wallet.tier_multiplier}× earn</p>
          </div>
          <TierChip tier={wallet.tier} />
        </div>

        {wallet.next_tier && (
          <p className="text-[11px] font-semibold text-[#aaa]">{fmt(wallet.points_to_next_tier)} pts to {wallet.next_tier}</p>
        )}

        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-[#f0f0f0] dark:border-[#222] text-center">
          <div><p className="text-[13px] font-black text-[#111] dark:text-[#e0e0e0]">{fmt(wallet.lifetime_points_earned)}</p><p className="text-[10px] text-[#aaa] uppercase tracking-wider">Earned</p></div>
          <div><p className="text-[13px] font-black text-[#111] dark:text-[#e0e0e0]">{fmt(wallet.lifetime_points_redeemed)}</p><p className="text-[10px] text-[#aaa] uppercase tracking-wider">Redeemed</p></div>
        </div>

        {isManager && (
          <button onClick={() => setAdjustOpen(true)}
            className="w-full mt-3 py-2 rounded-xl border border-[#e0e0e0] dark:border-[#333] text-[12px] font-bold text-[#555] dark:text-[#aaa] hover:bg-[#f4f4f4] dark:hover:bg-[#222] transition-colors">
            Manual Adjustment
          </button>
        )}
      </Card>

      {/* Available rewards */}
      <Card className="p-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#bbb] mb-3">Available Rewards</p>
        <div className="space-y-2">
          {wallet.available_rewards.length === 0 && <p className="text-[12px] text-[#bbb]">No active rewards</p>}
          {wallet.available_rewards.map((r) => {
            const affordable = wallet.current_points >= r.points_required
            const M = REWARD_TYPE_META[r.reward_type]
            return (
              <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-[#f0f0f0] dark:border-[#222]">
                <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', M.color)}>
                  <M.icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-[#111] dark:text-[#e0e0e0] truncate">{r.name}</p>
                  <p className="text-[11px] text-[#aaa]">{fmt(r.points_required)} pts</p>
                </div>
                <button
                  disabled={!affordable || redeemMut.isPending}
                  onClick={() => redeemMut.mutate(r.id)}
                  className={clsx('px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors',
                    affordable ? 'bg-[#111] dark:bg-white text-white dark:text-[#111] hover:opacity-90' : 'bg-[#f0f0f0] dark:bg-[#222] text-[#bbb] cursor-not-allowed')}>
                  Redeem
                </button>
              </div>
            )
          })}
        </div>
      </Card>

      {/* History */}
      <Card className="p-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#bbb] mb-3">Points History</p>
        {wallet.points_history.length === 0 ? <p className="text-[12px] text-[#bbb]">No activity yet</p> : (
          <div className="space-y-1.5">
            {wallet.points_history.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-[12px]">
                <span className="text-[#555] dark:text-[#aaa] capitalize">{t.tx_type}{t.source ? ` · ${t.source}` : ''}</span>
                <span className={clsx('font-bold tabular-nums', t.points_delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
                  {t.points_delta >= 0 ? '+' : ''}{fmt(t.points_delta)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {adjustOpen && <AdjustModal customerId={customer.id} onClose={() => setAdjustOpen(false)}
        onSaved={() => { qc.invalidateQueries({ queryKey: ['wallet', customer.id] }); onChange(); setAdjustOpen(false) }} />}
    </div>
  )
}

function AdjustModal({ customerId, onClose, onSaved }: { customerId: string; onClose: () => void; onSaved: () => void }) {
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('')
  const mut = useMutation({ mutationFn: () => adjustPoints(customerId, parseInt(delta) || 0, reason), onSuccess: onSaved })
  return (
    <ModalShell title="Manual Points Adjustment" onClose={onClose}>
      <Labeled label="Points (+ or −)">
        <input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="e.g. 500 or -200" className={inputCls} />
      </Labeled>
      <Labeled label="Reason (audited)">
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Goodwill / correction" className={inputCls} />
      </Labeled>
      <SaveBtn onClick={() => mut.mutate()} pending={mut.isPending} disabled={!delta} label="Apply Adjustment" />
    </ModalShell>
  )
}

function AddMemberModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const mut = useMutation({ mutationFn: () => createCustomer(form), onSuccess: onSaved })
  return (
    <ModalShell title="Add Member" onClose={onClose}>
      <Labeled label="Full Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} /></Labeled>
      <Labeled label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} /></Labeled>
      <Labeled label="Email"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} /></Labeled>
      <SaveBtn onClick={() => mut.mutate()} pending={mut.isPending} disabled={!form.name.trim()} label="Enroll Member" />
    </ModalShell>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Rewards catalog
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Reward Catalog row ───────────────────────────────────────────────────────

function RewardRow({
  reward: r, isManager, onSelect, onToggle, onDelete, dimmed = false,
}: {
  reward: LoyaltyReward
  isManager: boolean
  onSelect: (r: LoyaltyReward) => void
  onToggle: (r: LoyaltyReward) => void
  onDelete: (id: string) => void
  dimmed?: boolean
}) {
  const M = REWARD_TYPE_META[r.reward_type]
  return (
    <div
      className={clsx(
        'w-full grid grid-cols-[28px_2fr_1fr_1fr_1fr_1fr_auto] gap-4 items-center px-5 py-3.5 border-b border-[#f8f8f8] dark:border-[#1a1a1a] last:border-0 hover:bg-[#fafafa] dark:hover:bg-[#161616] transition-colors',
        dimmed && 'opacity-50',
      )}
    >
      <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', M.color)}>
        <M.icon size={13} />
      </div>
      <button onClick={() => onSelect(r)} className="text-left min-w-0">
        <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] truncate">{r.name}</p>
        <p className="text-[11px] text-[#aaa] dark:text-[#555] truncate">{r.description || M.label}</p>
      </button>
      <p className="text-[12px] text-[#666] dark:text-[#888]">{M.label}</p>
      <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] tabular-nums">
        {fmt(r.points_required)} <span className="text-[10px] font-bold text-[#aaa]">pts</span>
      </p>
      <p className="text-[12px] text-[#666] dark:text-[#888] tabular-nums">{r.redemption_count}</p>
      <span className={clsx('text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit',
        r.is_active ? 'bg-green-100 text-green-700' : 'bg-[#f0f0f0] dark:bg-[#222] text-[#999] dark:text-[#555]')}>
        {r.is_active ? 'Active' : 'Inactive'}
      </span>
      {isManager ? (
        <div className="flex items-center gap-1">
          <button onClick={() => onToggle(r)}
            title={r.is_active ? 'Deactivate' : 'Activate'}
            className="p-1.5 rounded-lg hover:bg-[#f0f0f0] dark:hover:bg-[#222]">
            <Check size={12} className="text-[#888]" />
          </button>
          <button onClick={() => onSelect(r)} className="p-1.5 rounded-lg hover:bg-[#f0f0f0] dark:hover:bg-[#222]">
            <Edit2 size={12} className="text-[#888]" />
          </button>
          <button onClick={() => { if (confirm(`Delete "${r.name}"?`)) onDelete(r.id) }}
            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30">
            <Trash2 size={12} className="text-red-400" />
          </button>
        </div>
      ) : <ChevronRight size={14} className="text-[#ccc] dark:text-[#444]" />}
    </div>
  )
}

// ─── Top Performing side panel (mirrors OutstandingBalancesPanel) ─────────────

function TopPerformingPanel({
  rewards, onSelect,
}: {
  rewards: LoyaltyReward[]
  onSelect: (r: LoyaltyReward) => void
}) {
  const ranked = [...rewards].filter((r) => r.redemption_count > 0).sort((a, b) => b.redemption_count - a.redemption_count)
  const totalRedemptions = ranked.reduce((s, r) => s + r.redemption_count, 0)

  return (
    <div className="h-full flex flex-col">
      <div className="p-5 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4">
          <p>
            <span className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">Rewards</span>
            <span className="text-[13px] font-medium text-[#aaa] dark:text-[#555]"> | Top Performing</span>
          </p>
        </div>

        <div className="grid grid-cols-[24px_1fr_auto] gap-3 mb-2">
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">#</p>
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">Name</p>
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase text-right">Redeemed</p>
        </div>

        {ranked.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[13px] font-medium text-[#bbb] dark:text-[#444]">No redemptions yet</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {ranked.slice(0, 25).map((r, i) => {
              const M = REWARD_TYPE_META[r.reward_type]
              return (
                <button
                  key={r.id}
                  onClick={() => onSelect(r)}
                  className="grid grid-cols-[24px_1fr_auto] gap-3 items-center py-2.5 border-b border-[#f8f8f8] dark:border-[#1a1a1a] last:border-0 hover:bg-[#fafafa] dark:hover:bg-[#161616] -mx-1 px-1 rounded-lg transition-colors text-left"
                >
                  <p className="text-[11px] font-bold text-[#ccc] dark:text-[#444]">{i + 1}</p>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] truncate">{r.name}</p>
                    <p className="text-[10px] text-[#aaa] dark:text-[#555] truncate">{M.label}</p>
                  </div>
                  <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] tabular-nums">{r.redemption_count}</p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[#f0f0f0] dark:border-[#1e1e1e] px-5 py-3">
        <p className="text-[12px] font-semibold text-[#888] dark:text-[#666]">Total redemptions</p>
        <p className={clsx('text-[13px] font-bold', totalRedemptions > 0 ? 'text-[#111] dark:text-[#e0e0e0]' : 'text-[#bbb] dark:text-[#444]')}>
          {fmt(totalRedemptions)}
        </p>
      </div>
    </div>
  )
}

// ─── Rewards Tab (customers-page style: search + table + side panel) ──────────

function RewardsTab({
  isManager, editing, setEditing, creating, setCreating, tabsSlot,
}: {
  isManager: boolean
  editing: LoyaltyReward | null
  setEditing: (r: LoyaltyReward | null) => void
  creating: boolean
  setCreating: (b: boolean) => void
  tabsSlot: React.ReactNode
}) {
  const qc = useQueryClient()
  const { data: rewards = [], isLoading } = useQuery({ queryKey: ['loyalty-rewards'], queryFn: getLoyaltyRewards })
  const [query, setQuery] = useState('')
  const [inactiveOpen, setInactiveOpen] = useState(false)

  const delMut = useMutation({ mutationFn: deleteLoyaltyReward, onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty-rewards'] }) })
  const toggleMut = useMutation({
    mutationFn: (r: LoyaltyReward) => updateLoyaltyReward(r.id, { ...rewardToInput(r), is_active: !r.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty-rewards'] }),
  })

  const match = (r: LoyaltyReward) =>
    matchesSearch(query, {
      text: [r.name, r.description, REWARD_TYPE_META[r.reward_type]?.label, r.is_active ? 'active' : 'inactive'],
      date: [r.start_date, r.end_date],
    })
  const active   = rewards.filter((r) => r.is_active  && match(r))
  const inactive = rewards.filter((r) => !r.is_active && match(r))

  return (
    <>
      <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4 min-w-0">
        {/* Search + category tabs (deposits-page layout) */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-1 px-4 py-2.5 bg-white dark:bg-[#1a1a1a] border border-[#ebebeb] dark:border-[#222] rounded-xl">
            <Search size={14} className="text-[#bbb] dark:text-[#444] shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search rewards by name or description…"
              className="flex-1 text-[13px] text-[#111] dark:text-[#e0e0e0] placeholder-[#ccc] dark:placeholder-[#444] outline-none bg-transparent"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-[#bbb] dark:text-[#444] hover:text-[#555] dark:hover:text-[#999] transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
          {tabsSlot}
        </div>

        {/* Active rewards table */}
        <div className="flex-1 min-h-0 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-[#ebebeb] dark:border-[#222] overflow-hidden flex flex-col">
          <div className="grid grid-cols-[28px_2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-2.5 border-b border-[#f0f0f0] dark:border-[#1e1e1e] bg-[#fafafa] dark:bg-[#161616] shrink-0">
            {['', 'Name', 'Type', 'Points', 'Redeemed', 'Status', isManager ? '' : ''].map((h, i) => (
              <p key={i} className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase">{h}</p>
            ))}
          </div>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center"><Loading /></div>
          ) : active.length === 0 && inactive.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[13px] text-[#aaa] dark:text-[#555]">
                {rewards.length === 0 ? 'No rewards configured yet' : 'No results found'}
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {active.map((r) => (
                <RewardRow
                  key={r.id} reward={r} isManager={isManager}
                  onSelect={setEditing}
                  onToggle={(rr) => toggleMut.mutate(rr)}
                  onDelete={(id) => delMut.mutate(id)}
                />
              ))}
              {active.length === 0 && (
                <div className="py-8 flex items-center justify-center">
                  <p className="text-[13px] text-[#aaa] dark:text-[#555]">No active rewards</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Inactive accordion */}
        {inactive.length > 0 && (
          <div className="shrink-0 border border-[#ebebeb] dark:border-[#222] rounded-2xl bg-white dark:bg-[#1a1a1a] overflow-hidden">
            <button
              onClick={() => setInactiveOpen((o) => !o)}
              className="w-full flex items-center gap-2 px-5 py-3.5 hover:bg-[#fafafa] dark:hover:bg-[#161616] transition-colors"
            >
              <ChevronRight size={14} className={clsx('text-[#888] dark:text-[#666] transition-transform', inactiveOpen && 'rotate-90')} />
              <span className="text-[13px] font-bold text-[#888] dark:text-[#666]">Inactive</span>
              <span className="text-[11px] font-bold text-[#bbb] dark:text-[#444] bg-[#f4f4f4] dark:bg-[#222] px-2 py-0.5 rounded-full">{inactive.length}</span>
            </button>
            {inactiveOpen && (
              <div className="border-t border-[#f0f0f0] dark:border-[#1e1e1e] max-h-[280px] overflow-y-auto">
                <div className="grid grid-cols-[28px_2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-2.5 border-b border-[#f4f4f4] dark:border-[#1e1e1e] bg-[#fafafa] dark:bg-[#161616]">
                  {['', 'Name', 'Type', 'Points', 'Redeemed', 'Status', ''].map((h, i) => (
                    <p key={i} className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase">{h}</p>
                  ))}
                </div>
                {inactive.map((r) => (
                  <RewardRow
                    key={r.id} reward={r} isManager={isManager}
                    onSelect={setEditing}
                    onToggle={(rr) => toggleMut.mutate(rr)}
                    onDelete={(id) => delMut.mutate(id)}
                    dimmed
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: top performing side panel (parallels OutstandingBalancesPanel) */}
      <div className="w-[420px] shrink-0 border-l border-[#e8e8e8] dark:border-[#222] overflow-y-auto h-full">
        <TopPerformingPanel rewards={rewards} onSelect={setEditing} />
      </div>

      {(creating || editing) && (
        <RewardModal reward={editing} onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['loyalty-rewards'] }); setCreating(false); setEditing(null) }} />
      )}
    </>
  )
}

function rewardToInput(r: LoyaltyReward): RewardInput {
  return {
    name: r.name, description: r.description, reward_type: r.reward_type, points_required: r.points_required,
    discount_type: r.discount_type, discount_value: r.discount_value, is_active: r.is_active, visible: r.visible,
    start_date: r.start_date, end_date: r.end_date, max_redemptions: r.max_redemptions,
    per_customer_limit: r.per_customer_limit, applicable_fuel_grades: r.applicable_fuel_grades,
    applicable_products: r.applicable_products, cost_estimate: r.cost_estimate, scope: r.scope,
  }
}

function RewardModal({ reward, onClose, onSaved }: { reward: LoyaltyReward | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<RewardInput>(reward ? rewardToInput(reward) : {
    name: '', description: '', reward_type: 'fuel_discount', points_required: 500,
    discount_type: 'fixed_amount', discount_value: 500, is_active: true, visible: true, cost_estimate: 0,
  })
  const mut = useMutation({
    mutationFn: () => reward ? updateLoyaltyReward(reward.id, f) : createLoyaltyReward(f),
    onSuccess: onSaved,
  })
  const showDiscount = f.reward_type === 'fuel_discount' || f.reward_type === 'store_discount'

  return (
    <ModalShell title={reward ? 'Edit Reward' : 'New Reward'} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} /></Labeled>
        <Labeled label="Points Required"><input type="number" value={f.points_required} onChange={(e) => setF({ ...f, points_required: parseInt(e.target.value) || 0 })} className={inputCls} /></Labeled>
      </div>
      <Labeled label="Description"><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={inputCls} /></Labeled>
      <Labeled label="Reward Type">
        <select value={f.reward_type} onChange={(e) => setF({ ...f, reward_type: e.target.value as RewardType })} className={inputCls}>
          {(Object.keys(REWARD_TYPE_META) as RewardType[]).map((t) => <option key={t} value={t}>{REWARD_TYPE_META[t].label}</option>)}
        </select>
      </Labeled>
      {showDiscount && (
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Discount Type">
            <select value={f.discount_type ?? 'fixed_amount'} onChange={(e) => setF({ ...f, discount_type: e.target.value as any })} className={inputCls}>
              <option value="fixed_amount">Fixed Amount ($)</option>
              <option value="percentage">Percentage (%)</option>
              {f.reward_type === 'fuel_discount' && <option value="free_fuel">Free Fuel (litres)</option>}
            </select>
          </Labeled>
          <Labeled label="Discount Value"><input type="number" value={f.discount_value ?? 0} onChange={(e) => setF({ ...f, discount_value: parseFloat(e.target.value) || 0 })} className={inputCls} /></Labeled>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="Per-Customer Limit (optional)"><input type="number" value={f.per_customer_limit ?? ''} onChange={(e) => setF({ ...f, per_customer_limit: e.target.value ? parseInt(e.target.value) : null })} className={inputCls} /></Labeled>
        <Labeled label="Est. Cost ($, for analytics)"><input type="number" value={f.cost_estimate ?? 0} onChange={(e) => setF({ ...f, cost_estimate: parseFloat(e.target.value) || 0 })} className={inputCls} /></Labeled>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="Available From"><input type="date" value={f.start_date ?? ''} onChange={(e) => setF({ ...f, start_date: e.target.value || null })} className={inputCls} /></Labeled>
        <Labeled label="Available Until"><input type="date" value={f.end_date ?? ''} onChange={(e) => setF({ ...f, end_date: e.target.value || null })} className={inputCls} /></Labeled>
      </div>
      <SaveBtn onClick={() => mut.mutate()} pending={mut.isPending} disabled={!f.name.trim()} label={reward ? 'Save Reward' : 'Create Reward'} />
    </ModalShell>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Campaigns
// ═══════════════════════════════════════════════════════════════════════════════

function CampaignsTab({ isManager, tabsSlot, creating, setCreating }: {
  isManager: boolean; tabsSlot: React.ReactNode; creating: boolean; setCreating: (b: boolean) => void
}) {
  const qc = useQueryClient()
  const { data: campaigns = [], isLoading } = useQuery({ queryKey: ['loyalty-campaigns'], queryFn: getLoyaltyCampaigns })
  const [query, setQuery] = useState('')
  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => toggleLoyaltyCampaign(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty-campaigns'] }),
  })

  const matches = campaigns.filter((cp) =>
    matchesSearch(query, {
      text: [cp.name, cp.description, cp.campaign_type, cp.applies_to, cp.is_active ? 'active' : 'paused'],
      date: [cp.start_date, cp.end_date],
    }))
  const activeCampaigns = campaigns.filter((cp) => cp.is_active)

  const COLS = 'grid-cols-[2fr_1.5fr_1.4fr_auto]'
  const campaignReward = (cp: typeof campaigns[number]) =>
    cp.campaign_type === 'bonus_threshold'
      ? `+${fmt(cp.bonus_points)} pts over ${money(cp.threshold_amount)}`
      : `${cp.multiplier}× points`

  return (
    <>
      <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4 min-w-0">
        {/* Search + new + category tabs */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-1 px-4 py-2.5 bg-white dark:bg-[#1a1a1a] border border-[#ebebeb] dark:border-[#222] rounded-xl">
            <Search size={14} className="text-[#bbb] dark:text-[#444] shrink-0" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search campaigns…"
              className="flex-1 text-[13px] text-[#111] dark:text-[#e0e0e0] placeholder-[#ccc] dark:placeholder-[#444] outline-none bg-transparent" />
            {query && <button onClick={() => setQuery('')} className="text-[#bbb] dark:text-[#444] hover:text-[#555] dark:hover:text-[#999] transition-colors"><X size={14} /></button>}
          </div>
          {tabsSlot}
        </div>

        {/* Campaigns table card */}
        <div className="flex-1 min-h-0 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-[#ebebeb] dark:border-[#222] overflow-hidden flex flex-col">
          <div className={clsx('grid gap-4 px-5 py-2.5 border-b border-[#f0f0f0] dark:border-[#1e1e1e] bg-[#fafafa] dark:bg-[#161616] shrink-0', COLS)}>
            {['Campaign', 'Reward', 'Window', 'Status'].map((h, i) => (
              <p key={i} className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase">{h}</p>
            ))}
          </div>
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center"><Loading /></div>
          ) : matches.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[13px] text-[#aaa] dark:text-[#555]">{campaigns.length === 0 ? 'No campaigns yet' : 'No results found'}</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {matches.map((cp) => (
                <div key={cp.id} className={clsx('grid gap-4 items-center px-5 py-3.5 border-b border-[#f8f8f8] dark:border-[#1a1a1a] last:border-0', COLS)}>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] truncate">{cp.name}</p>
                    <p className="text-[11px] text-[#aaa] dark:text-[#555] truncate">{cp.description || `${cp.campaign_type} · ${cp.applies_to}`}</p>
                  </div>
                  <p className="text-[12px] font-semibold text-[#111] dark:text-[#e0e0e0]">{campaignReward(cp)}</p>
                  <p className="text-[11px] text-[#888] tabular-nums">{cp.start_date} → {cp.end_date}</p>
                  {isManager ? (
                    <button onClick={() => toggleMut.mutate({ id: cp.id, active: !cp.is_active })}
                      className={clsx('text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit transition-colors',
                        cp.is_active ? 'bg-green-100 text-green-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-[#f0f0f0] dark:bg-[#222] text-[#999] dark:text-[#555]')}>
                      {cp.is_active ? 'Active' : 'Paused'}
                    </button>
                  ) : (
                    <span className={clsx('text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit',
                      cp.is_active ? 'bg-green-100 text-green-700' : 'bg-[#f0f0f0] dark:bg-[#222] text-[#999]')}>
                      {cp.is_active ? 'Active' : 'Paused'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: active-campaign summary side panel */}
      <div className="w-[420px] shrink-0 border-l border-[#e8e8e8] dark:border-[#222] overflow-y-auto h-full">
        <div className="h-full flex flex-col">
          <div className="p-5 flex-1 flex flex-col min-h-0">
            <p className="mb-4">
              <span className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">Campaigns</span>
              <span className="text-[13px] font-medium text-[#aaa] dark:text-[#555]"> | Currently Active</span>
            </p>
            {activeCampaigns.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[13px] font-medium text-[#bbb] dark:text-[#444]">No active campaigns</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto flex flex-col gap-2">
                {activeCampaigns.map((cp) => (
                  <div key={cp.id} className="rounded-xl border border-[#f0f0f0] dark:border-[#222] px-3.5 py-3">
                    <p className="text-[12px] font-bold text-[#111] dark:text-[#e0e0e0] truncate">{cp.name}</p>
                    <p className="text-[11px] font-semibold text-[#555] dark:text-[#999] mt-0.5">{campaignReward(cp)}</p>
                    <p className="text-[10px] text-[#bbb] dark:text-[#444] mt-1">{cp.applies_to} · ends {cp.end_date}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-[#f0f0f0] dark:border-[#1e1e1e] px-5 py-3">
            <p className="text-[12px] font-semibold text-[#888] dark:text-[#666]">Active / total</p>
            <p className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">{activeCampaigns.length} / {campaigns.length}</p>
          </div>
        </div>
      </div>

      {creating && <CampaignModal onClose={() => setCreating(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ['loyalty-campaigns'] }); setCreating(false) }} />}
    </>
  )
}

function CampaignModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [f, setF] = useState({ name: '', description: '', campaign_type: 'multiplier', multiplier: 2, bonus_points: 0, threshold_amount: 0, applies_to: 'all', start_date: today, end_date: today })
  const mut = useMutation({ mutationFn: () => createLoyaltyCampaign(f), onSuccess: onSaved })
  return (
    <ModalShell title="New Campaign" onClose={onClose} wide>
      <Labeled label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} placeholder="e.g. Double Points Friday" /></Labeled>
      <Labeled label="Description"><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={inputCls} /></Labeled>
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="Type">
          <select value={f.campaign_type} onChange={(e) => setF({ ...f, campaign_type: e.target.value })} className={inputCls}>
            <option value="multiplier">Multiplier</option>
            <option value="double_points">Double Points</option>
            <option value="bonus_threshold">Bonus on Threshold</option>
          </select>
        </Labeled>
        <Labeled label="Applies To">
          <select value={f.applies_to} onChange={(e) => setF({ ...f, applies_to: e.target.value })} className={inputCls}>
            <option value="all">All purchases</option>
            <option value="fuel">Fuel</option>
            <option value="store">Store</option>
            <option value="premium_fuel">Premium fuel</option>
          </select>
        </Labeled>
      </div>
      {f.campaign_type === 'bonus_threshold' ? (
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Bonus Points"><input type="number" value={f.bonus_points} onChange={(e) => setF({ ...f, bonus_points: parseInt(e.target.value) || 0 })} className={inputCls} /></Labeled>
          <Labeled label="Spend Threshold ($)"><input type="number" value={f.threshold_amount} onChange={(e) => setF({ ...f, threshold_amount: parseFloat(e.target.value) || 0 })} className={inputCls} /></Labeled>
        </div>
      ) : (
        <Labeled label="Multiplier"><input type="number" step="0.5" value={f.multiplier} onChange={(e) => setF({ ...f, multiplier: parseFloat(e.target.value) || 1 })} className={inputCls} /></Labeled>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="Start"><input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} className={inputCls} /></Labeled>
        <Labeled label="End"><input type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} className={inputCls} /></Labeled>
      </div>
      <SaveBtn onClick={() => mut.mutate()} pending={mut.isPending} disabled={!f.name.trim()} label="Create Campaign" />
    </ModalShell>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Approvals
// ═══════════════════════════════════════════════════════════════════════════════

function ApprovalsTab({ tabsSlot }: { tabsSlot: React.ReactNode }) {
  const qc = useQueryClient()
  const { data: pending = [], isLoading } = useQuery({ queryKey: ['loyalty-pending'], queryFn: () => getLoyaltyRedemptions('pending') })
  const [query, setQuery] = useState('')
  const mut = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) => reviewRedemption(id, decision),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loyalty-pending'] }); qc.invalidateQueries({ queryKey: ['customers'] }) },
  })

  const matches = pending.filter((r) =>
    matchesSearch(query, { text: [r.customer_name, r.reward_name, r.approval_level], date: r.created_at }))
  const pointsPending = pending.reduce((s, r) => s + r.points_spent, 0)
  const byLevel = pending.reduce<Record<string, number>>((m, r) => { m[r.approval_level] = (m[r.approval_level] ?? 0) + 1; return m }, {})

  const COLS = 'grid-cols-[2fr_2fr_1fr_1fr_auto]'

  return (
    <>
      <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4 min-w-0">
        {/* Search + category tabs */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-1 px-4 py-2.5 bg-white dark:bg-[#1a1a1a] border border-[#ebebeb] dark:border-[#222] rounded-xl">
            <Search size={14} className="text-[#bbb] dark:text-[#444] shrink-0" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pending approvals…"
              className="flex-1 text-[13px] text-[#111] dark:text-[#e0e0e0] placeholder-[#ccc] dark:placeholder-[#444] outline-none bg-transparent" />
            {query && <button onClick={() => setQuery('')} className="text-[#bbb] dark:text-[#444] hover:text-[#555] dark:hover:text-[#999] transition-colors"><X size={14} /></button>}
          </div>
          {tabsSlot}
        </div>

        {/* Approvals table card */}
        <div className="flex-1 min-h-0 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-[#ebebeb] dark:border-[#222] overflow-hidden flex flex-col">
          <div className={clsx('grid gap-4 px-5 py-2.5 border-b border-[#f0f0f0] dark:border-[#1e1e1e] bg-[#fafafa] dark:bg-[#161616] shrink-0', COLS)}>
            {['Member', 'Reward', 'Points', 'Level', ''].map((h, i) => (
              <p key={i} className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase">{h}</p>
            ))}
          </div>
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center"><Loading /></div>
          ) : matches.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[13px] text-[#aaa] dark:text-[#555]">{pending.length === 0 ? 'No pending approvals — all clear.' : 'No results found'}</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {matches.map((r) => (
                <div key={r.id} className={clsx('grid gap-4 items-center px-5 py-3.5 border-b border-[#f8f8f8] dark:border-[#1a1a1a] last:border-0', COLS)}>
                  <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] truncate">{r.customer_name}</p>
                  <p className="text-[12px] text-[#555] dark:text-[#aaa] truncate">{r.reward_name}</p>
                  <p className="text-[13px] font-bold tabular-nums text-[#111] dark:text-[#e0e0e0]">{fmt(r.points_spent)}</p>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full w-fit bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">{r.approval_level}</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => mut.mutate({ id: r.id, decision: 'approve' })} className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700">Approve</button>
                    <button onClick={() => mut.mutate({ id: r.id, decision: 'reject' })} className="px-2.5 py-1 rounded-lg bg-[#f0f0f0] dark:bg-[#222] text-[#888] text-[11px] font-bold">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: pending summary side panel */}
      <div className="w-[420px] shrink-0 border-l border-[#e8e8e8] dark:border-[#222] overflow-y-auto h-full">
        <div className="h-full flex flex-col">
          <div className="p-5 flex-1 flex flex-col min-h-0">
            <p className="mb-4">
              <span className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">Approvals</span>
              <span className="text-[13px] font-medium text-[#aaa] dark:text-[#555]"> | Pending Queue</span>
            </p>
            <div className="rounded-2xl border border-[#f0f0f0] dark:border-[#222] p-4 mb-3">
              <p className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase mb-1">Points awaiting</p>
              <p className="text-[28px] font-bold text-[#111] dark:text-[#e0e0e0] leading-none">{fmt(pointsPending)}</p>
            </div>
            {Object.keys(byLevel).length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase">By approval level</p>
                {Object.entries(byLevel).map(([level, n]) => (
                  <div key={level} className="flex items-center justify-between text-[12px]">
                    <span className="capitalize text-[#555] dark:text-[#999]">{level}</span>
                    <span className="font-bold tabular-nums text-[#111] dark:text-[#e0e0e0]">{n}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-[#f0f0f0] dark:border-[#1e1e1e] px-5 py-3">
            <p className="text-[12px] font-semibold text-[#888] dark:text-[#666]">Pending requests</p>
            <p className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">{pending.length}</p>
          </div>
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Analytics
// ═══════════════════════════════════════════════════════════════════════════════

function AnalyticsTab({ tabsSlot }: { tabsSlot: React.ReactNode }) {
  const { data: a, isLoading } = useQuery({ queryKey: ['loyalty-analytics'], queryFn: getLoyaltyAnalytics })
  const tierOrder = ['Platinum', 'Gold', 'Silver', 'Bronze']
  const COLS = 'grid-cols-[2fr_1fr_1fr]'

  return (
    <>
      <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4 min-w-0">
        {/* Title + category tabs (no search — dashboard view) */}
        <div className="flex items-center gap-3 shrink-0">
          <p className="flex-1">
            <span className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">Loyalty</span>
            <span className="text-[13px] font-medium text-[#aaa] dark:text-[#555]"> | Program Analytics</span>
          </p>
          {tabsSlot}
        </div>

        {isLoading || !a ? (
          <div className="flex-1 flex items-center justify-center"><Loading /></div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 shrink-0">
              {[
                { label: 'Members', v: fmt(a.total_members), icon: Users },
                { label: 'Points Issued', v: fmt(a.total_points_issued), icon: TrendingUp },
                { label: 'Points Redeemed', v: fmt(a.total_points_redeemed), icon: Gift },
                { label: 'Outstanding', v: fmt(a.outstanding_points), icon: Sparkles },
              ].map(({ label, v, icon: Icon }) => (
                <Card key={label} className="p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#f4f4f4] dark:bg-[#222] flex items-center justify-center"><Icon size={14} className="text-[#555] dark:text-[#aaa]" /></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-wider text-[#aaa]">{label}</p><p className="text-[17px] font-black text-[#111] dark:text-[#e0e0e0] tabular-nums">{v}</p></div>
                </Card>
              ))}
            </div>

            {/* Reward performance table card */}
            <div className="flex-1 min-h-0 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-[#ebebeb] dark:border-[#222] overflow-hidden flex flex-col">
              <div className={clsx('grid gap-4 px-5 py-2.5 border-b border-[#f0f0f0] dark:border-[#1e1e1e] bg-[#fafafa] dark:bg-[#161616] shrink-0', COLS)}>
                {['Reward', 'Redemptions', 'Est. Cost'].map((h, i) => (
                  <p key={i} className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase">{h}</p>
                ))}
              </div>
              {a.reward_performance.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-[13px] text-[#aaa] dark:text-[#555]">No reward redemptions yet</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  {a.reward_performance.map((rp) => (
                    <div key={rp.reward_id} className={clsx('grid gap-4 items-center px-5 py-3.5 border-b border-[#f8f8f8] dark:border-[#1a1a1a] last:border-0', COLS)}>
                      <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0] truncate">{rp.name}</p>
                      <p className="text-[13px] tabular-nums text-[#111] dark:text-[#e0e0e0]">{rp.redemption_count}</p>
                      <p className="text-[12px] tabular-nums text-[#888]">{money(rp.estimated_cost)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right: tier distribution + top members side panel */}
      <div className="w-[420px] shrink-0 border-l border-[#e8e8e8] dark:border-[#222] overflow-y-auto h-full">
        {isLoading || !a ? null : (
          <div className="flex flex-col">
            <div className="p-5 border-b border-[#f0f0f0] dark:border-[#1e1e1e]">
              <p className="text-[11px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase mb-3">Tier Distribution</p>
              <div className="space-y-2">
                {tierOrder.map((t) => {
                  const n = a.tier_distribution[t] ?? 0
                  const pct = a.total_members > 0 ? n / a.total_members * 100 : 0
                  return (
                    <div key={t} className="flex items-center gap-3">
                      <span className="w-16 text-right"><TierChip tier={t} /></span>
                      <div className="flex-1 h-2 rounded-full bg-[#f0f0f0] dark:bg-[#222] overflow-hidden"><div className="h-full rounded-full bg-[#111] dark:bg-white" style={{ width: `${pct}%` }} /></div>
                      <span className="w-8 text-right text-[12px] font-bold tabular-nums">{n}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="p-5">
              <p className="text-[11px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase mb-3">Top Members</p>
              <div className="space-y-2.5">
                {a.top_customers.slice(0, 8).map((c, i) => (
                  <div key={c.customer_id} className="flex items-center gap-3 text-[12px]">
                    <span className="w-5 text-[#bbb] font-bold">{i + 1}</span>
                    <span className="flex-1 font-semibold text-[#111] dark:text-[#e0e0e0] truncate">{c.name}</span>
                    <TierChip tier={c.tier} />
                    <span className="font-bold tabular-nums w-16 text-right text-[#111] dark:text-[#e0e0e0]">{fmt(c.current_points)}</span>
                  </div>
                ))}
                {a.top_customers.length === 0 && <p className="text-[12px] text-[#bbb]">No members yet</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Settings (config + tiers)
// ═══════════════════════════════════════════════════════════════════════════════

// Exported so the Settings page can render it under its own "Rewards" category.
export function RewardsSettingsPanel() {
  const qc = useQueryClient()
  const { data: cfg } = useQuery({ queryKey: ['loyalty-config'], queryFn: getLoyaltyConfig })
  const { data: tiers = [] } = useQuery({ queryKey: ['loyalty-tiers'], queryFn: getLoyaltyTiers })
  const [draft, setDraft] = useState<LoyaltyConfig | null>(null)
  const [saved, setSaved] = useState(false)
  useEffect(() => { if (cfg) setDraft(cfg) }, [cfg])

  const cfgMut = useMutation({
    mutationFn: () => upsertLoyaltyConfig(draft!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loyalty-config'] }); setSaved(true); setTimeout(() => setSaved(false), 2000) },
  })

  if (!draft) return <Loading />
  const num = (k: keyof LoyaltyConfig) => (
    <input type="number" value={draft[k] as number} onChange={(e) => setDraft({ ...draft, [k]: parseFloat(e.target.value) || 0 })} className={inputCls} />
  )

  return (
    <div className="max-w-2xl space-y-5">
      <Card className="p-6 space-y-4">
        <p className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">Earning Rules</p>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Fuel: points per $100">{num('fuel_points_per_100')}</Labeled>
          <Labeled label="Store: points per $100">{num('store_points_per_100')}</Labeled>
        </div>
        <p className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0] pt-2">Approval Thresholds</p>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Auto-approve under (pts)">{num('auto_approve_max')}</Labeled>
          <Labeled label="Supervisor approve under (pts)">{num('supervisor_approve_max')}</Labeled>
        </div>
        <p className="text-[10px] text-[#aaa]">Redemptions ≥ supervisor threshold require manager approval.</p>
        <p className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0] pt-2">Fraud Limits</p>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Daily redemptions / customer">{num('daily_redeem_limit')}</Labeled>
          <Labeled label="Monthly redemptions / customer">{num('monthly_redeem_limit')}</Labeled>
        </div>
        <button onClick={() => cfgMut.mutate()} disabled={cfgMut.isPending}
          className={clsx('w-full py-2.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all',
            saved ? 'bg-emerald-600 text-white' : 'bg-[#111] dark:bg-white text-white dark:text-[#111] hover:opacity-90')}>
          {cfgMut.isPending ? <Loader2 size={13} className="animate-spin" /> : saved ? <><Check size={13} /> Saved!</> : 'Save Earning Rules'}
        </button>
      </Card>

      <Card className="p-6">
        <p className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0] mb-4">Membership Tiers</p>
        <div className="space-y-2">
          {tiers.map((t) => <TierRow key={t.id} tier={t} onSaved={() => qc.invalidateQueries({ queryKey: ['loyalty-tiers'] })} />)}
        </div>
        <p className="text-[10px] text-[#aaa] mt-3">Multiplier boosts earning rate for members in that tier (e.g. Gold 1.5× earns 50% more points).</p>
      </Card>
    </div>
  )
}

function TierRow({ tier, onSaved }: { tier: LoyaltyTier; onSaved: () => void }) {
  const [min, setMin] = useState(String(tier.min_points))
  const [mult, setMult] = useState(String(tier.multiplier))
  const mut = useMutation({
    mutationFn: () => upsertLoyaltyTier({ name: tier.name, min_points: parseInt(min) || 0, multiplier: parseFloat(mult) || 1, benefits: tier.benefits ?? undefined, sort_order: tier.sort_order }),
    onSuccess: onSaved,
  })
  return (
    <div className="flex items-center gap-3">
      <span className="w-20"><TierChip tier={tier.name} /></span>
      <div className="flex items-center gap-1 text-[11px] text-[#888]">
        <span>min</span>
        <input type="number" value={min} onChange={(e) => setMin(e.target.value)} onBlur={() => mut.mutate()}
          className="w-20 px-2 py-1 text-[12px] bg-white dark:bg-[#222] border border-[#e0e0e0] dark:border-[#333] rounded-lg text-[#111] dark:text-[#e0e0e0]" />
        <span>pts</span>
      </div>
      <div className="flex items-center gap-1 text-[11px] text-[#888]">
        <input type="number" step="0.1" value={mult} onChange={(e) => setMult(e.target.value)} onBlur={() => mut.mutate()}
          className="w-16 px-2 py-1 text-[12px] bg-white dark:bg-[#222] border border-[#e0e0e0] dark:border-[#333] rounded-lg text-[#111] dark:text-[#e0e0e0]" />
        <span>× earn</span>
      </div>
      {mut.isPending && <Loader2 size={12} className="animate-spin text-[#bbb]" />}
    </div>
  )
}

// ─── shared UI bits ───────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 text-[13px] bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333] rounded-xl text-[#111] dark:text-[#e0e0e0] focus:outline-none focus:ring-2 focus:ring-[#111] dark:focus:ring-white'

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-bold text-[#555] dark:text-[#aaa] mb-1.5">{label}</label>{children}</div>
}
function SaveBtn({ onClick, pending, disabled, label }: { onClick: () => void; pending: boolean; disabled?: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={disabled || pending}
      className="w-full py-2.5 bg-[#111] dark:bg-white text-white dark:text-[#111] rounded-xl text-[13px] font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity">
      {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {label}
    </button>
  )
}
function ModalShell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className={clsx('bg-white dark:bg-[#1a1a1a] rounded-2xl border border-[#ebebeb] dark:border-[#222] w-full p-6 space-y-4 my-4', wide ? 'max-w-lg' : 'max-w-sm')} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><p className="text-[15px] font-bold text-[#111] dark:text-[#e0e0e0]">{title}</p><button onClick={onClose}><X size={18} className="text-[#bbb]" /></button></div>
        {children}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════════════

type Tab = 'rewards' | 'members' | 'campaigns' | 'approvals' | 'analytics'

interface TabDef { id: Tab; label: string; icon: React.ElementType }

// Category tabs — matches the Deposits page filter-tab style.
function CategoryTabs({ tabs, tab, setTab }: { tabs: TabDef[]; tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div className="flex gap-0.5 shrink-0">
      {tabs.map(({ id, label }) => (
        <button key={id} onClick={() => setTab(id)}
          className={clsx(
            'px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors',
            tab === id
              ? 'bg-[#f0f0f0] dark:bg-[#222] text-[#111] dark:text-[#e0e0e0]'
              : 'text-[#bbb] dark:text-[#444] hover:text-[#555] dark:hover:text-[#999]',
          )}>
          {label}
        </button>
      ))}
    </div>
  )
}

export function RewardsPage() {
  const { user } = useAuth()
  const isManager = managerRoles.has(user?.role ?? '')
  // Reward catalog is the landing view (mirrors CustomersPage style).
  const [tab, setTab] = useState<Tab>('rewards')

  // Lifted so the create buttons live in the page-level top bar (same spot for
  // every tab), regardless of which tab owns the actual modal.
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<LoyaltyReward | null>(null)
  const [showAddMember, setShowAddMember] = useState(false)
  const [creatingCampaign, setCreatingCampaign] = useState(false)

  const allTabs: (TabDef & { managerOnly?: boolean })[] = [
    { id: 'rewards',   label: 'Rewards',   icon: Tag },
    { id: 'members',   label: 'Members',   icon: Users },
    { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
    { id: 'approvals', label: 'Approvals', icon: AlertTriangle, managerOnly: true },
    { id: 'analytics', label: 'Analytics', icon: BarChart2,     managerOnly: true },
  ]
  const tabs: TabDef[] = allTabs.filter((t) => !t.managerOnly || isManager)
  const categoryTabs = <CategoryTabs tabs={tabs} tab={tab} setTab={setTab} />

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar — store identifier + title (mirrors CustomersPage / Deposits) */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebebeb] dark:border-[#222] flex-shrink-0">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] dark:text-[#555] uppercase mb-0.5">Convenience Store</p>
          <h1 className="text-[22px] font-bold text-[#111] dark:text-[#e0e0e0] leading-tight">Rewards</h1>
        </div>
        {isManager && (tab === 'rewards' || tab === 'members' || tab === 'campaigns') && (
          <button
            onClick={() => {
              if (tab === 'rewards') setCreating(true)
              else if (tab === 'members') setShowAddMember(true)
              else setCreatingCampaign(true)
            }}
            className="px-4 py-2 border border-[#ddd] dark:border-[#333] rounded-xl text-[12px] font-semibold text-[#333] dark:text-[#ccc] bg-white dark:bg-[#1a1a1a] hover:bg-[#f9f9f9] dark:hover:bg-[#161616] transition-colors"
          >
            {tab === 'rewards' ? 'Add a reward' : tab === 'members' ? 'Add a member' : 'New campaign'}
          </button>
        )}
      </div>

      {/* Body — every tab uses the same catalog two-column shell, with the
          category pills beside the search/controls row (Deposits-page layout). */}
      <div className="flex flex-1 overflow-hidden">
        {tab === 'rewards' && (
          <RewardsTab
            isManager={isManager}
            editing={editing} setEditing={setEditing}
            creating={creating} setCreating={setCreating}
            tabsSlot={categoryTabs}
          />
        )}
        {tab === 'members'   && <MembersTab   isManager={isManager} tabsSlot={categoryTabs} showAdd={showAddMember} setShowAdd={setShowAddMember} />}
        {tab === 'campaigns' && <CampaignsTab isManager={isManager} tabsSlot={categoryTabs} creating={creatingCampaign} setCreating={setCreatingCampaign} />}
        {tab === 'approvals' && <ApprovalsTab tabsSlot={categoryTabs} />}
        {tab === 'analytics' && <AnalyticsTab tabsSlot={categoryTabs} />}
      </div>
    </div>
  )
}
