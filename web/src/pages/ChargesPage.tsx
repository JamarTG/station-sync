import { useState, useEffect } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { useAuth } from '../lib/authContext'
import { LogoLoader } from '../components/StationSyncLogo'

// ── Add Organization Modal ────────────────────────────────────────────────────

function AddOrgModal({ onClose }: { onClose: () => void }) {
  const [name, setName]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // TODO: wire to backend
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-[400px] p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[16px] font-bold text-[#111]">Add Account</h3>
          <button onClick={onClose} className="text-[#bbb] hover:text-[#555] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#888] mb-1 uppercase tracking-widest">Account Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border border-[#ebebeb] rounded-xl px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111]"
            />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-white border border-[#ddd] text-[#333] rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#f9f9f9] transition-colors disabled:opacity-40">
            {loading ? 'Adding...' : 'Add Account'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Organizations Panel ───────────────────────────────────────────────────────

function OrganizationsPanel() {
  const [showModal, setShowModal] = useState(false)

  // TODO: replace with real data from backend
  const organizations: { id: string; name: string; balance: number }[] = []

  return (
    <div className="h-full flex flex-col">
      <div className="p-5 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4">
          <p>
            <span className="text-[13px] font-bold text-[#111]">Accounts</span>
            <span className="text-[13px] font-medium text-[#aaa]"> | Outstanding Balances</span>
          </p>
        </div>

        <div className="grid grid-cols-[20px_1fr_auto] gap-3 mb-2">
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">#</p>
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">Name</p>
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase text-right">Balance</p>
        </div>

        {organizations.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[13px] font-medium text-[#bbb]">No accounts yet</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {organizations.map((org, i) => (
              <div
                key={org.id}
                className="grid grid-cols-[20px_1fr_auto] gap-3 items-center py-2.5 border-b border-[#f8f8f8] last:border-0"
              >
                <p className="text-[11px] font-bold text-[#ccc]">{i + 1}</p>
                <p className="text-[13px] font-semibold text-[#111]">{org.name}</p>
                <p className="text-[13px] font-semibold text-[#111]">
                  ${org.balance.toLocaleString('en-JM', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[#f0f0f0] px-5 py-3">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1 text-[12px] font-semibold text-[#888] hover:text-[#111] transition-colors"
        >
          <Plus size={12} /> New
        </button>
        <p className="text-[13px] font-bold text-[#bbb]">
          {organizations.length} account{organizations.length !== 1 ? 's' : ''}
        </p>
      </div>

      {showModal && <AddOrgModal onClose={() => setShowModal(false)} />}
    </div>
  )
}

// ── Search Bar ────────────────────────────────────────────────────────────────

function ChargesSearch() {
  const [query, setQuery] = useState('')

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-white border border-[#ebebeb] rounded-xl shrink-0">
      <Search size={14} className="text-[#bbb] shrink-0" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by customer, date, or status…"
        className="flex-1 text-[13px] text-[#111] placeholder-[#ccc] outline-none bg-transparent"
      />
      {query && (
        <button onClick={() => setQuery('')} className="text-[#bbb] hover:text-[#555] transition-colors">
          <X size={14} />
        </button>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ChargesPage() {
  const { user: authUser } = useAuth()
  const isManagerOrAdmin = authUser?.role === 'Manager' || authUser?.role === 'Admin'
  const [isLoading, setIsLoading] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 800)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebebeb] flex-shrink-0">
        <div>
          {!isManagerOrAdmin && (
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-0.5">Service Station</p>
          )}
          <h1 className="text-[22px] font-bold text-[#111] leading-tight">Charges</h1>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: charges table */}
        <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4 min-w-0">
          <ChargesSearch />
          <div className="flex-1 bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-5 py-2.5 border-b border-[#f0f0f0] bg-[#fafafa] shrink-0">
              {['Customer', 'Date', 'Amount', 'Status'].map((h) => (
                <p key={h} className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
              ))}
            </div>
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center"><LogoLoader /></div>
            ) : (
              <div className="flex-1 overflow-y-auto flex items-center justify-center">
                <div className="flex flex-col items-center gap-1">
                  <p className="text-[13px] font-semibold text-[#bbb]">No charges yet</p>
                  <p className="text-[12px] font-medium text-[#ccc]">Charge records will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: organizations panel */}
        <div className="w-[600px] shrink-0 border-l border-[#e8e8e8] h-full">
          <OrganizationsPanel />
        </div>
      </div>
    </div>
  )
}
