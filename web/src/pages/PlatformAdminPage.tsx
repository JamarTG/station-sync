import { useEffect, useState } from 'react'
import { LogoLoader } from '../components/StationSyncLogo'
import { Building2, Users, GitBranch, LogOut } from 'lucide-react'
import { getPlatformAccounts, clearToken } from '../lib/api'
import type { AccountSummary } from '../lib/api'

interface Props {
  userName: string
  onLogout: () => void
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function PlatformAdminPage({ userName, onLogout }: Props) {
  const [accounts, setAccounts] = useState<AccountSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getPlatformAccounts()
      .then(setAccounts)
      .finally(() => setLoading(false))
  }, [])

  function handleLogout() {
    clearToken()
    onLogout()
  }

  const filtered = accounts.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#f4f4f4] font-[Manrope]">
      {/* Header */}
      <div className="bg-white border-b border-[#ebebeb] px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">StationSync</p>
          <p className="text-[15px] font-bold text-[#111]">Platform Admin</p>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-[13px] font-semibold text-[#555]">{userName}</p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-[13px] font-semibold text-[#888] hover:text-[#111] transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-[#ebebeb] p-5">
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Total Accounts</p>
            <p className="text-[32px] font-bold text-[#111] leading-none">{accounts.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#ebebeb] p-5">
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Total Users</p>
            <p className="text-[32px] font-bold text-[#111] leading-none">
              {accounts.reduce((s, a) => s + a.user_count, 0)}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-[#ebebeb] p-5">
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Total Branches</p>
            <p className="text-[32px] font-bold text-[#111] leading-none">
              {accounts.reduce((s, a) => s + a.branch_count, 0)}
            </p>
          </div>
        </div>

        {/* Accounts table */}
        <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#f4f4f4] flex items-center justify-between gap-4">
            <p className="text-[13px] font-bold text-[#111]">Active Accounts</p>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search accounts…"
              className="border border-[#e0e0e0] rounded-xl px-3 py-2 text-[13px] font-medium text-[#333] focus:outline-none w-56"
            />
          </div>

          {loading ? (
            <div className="py-16 flex items-center justify-center">
              <LogoLoader />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 flex items-center justify-center">
              <p className="text-[13px] font-medium text-[#bbb]">No accounts found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f4f4f4]">
                  <th className="px-5 py-3 text-left text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Account</th>
                  <th className="px-5 py-3 text-center text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Users</th>
                  <th className="px-5 py-3 text-center text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Branches</th>
                  <th className="px-5 py-3 text-right text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f4f4]">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-[#fafafa] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#f4f4f4] rounded-xl flex items-center justify-center flex-shrink-0">
                          <Building2 size={14} className="text-[#888]" />
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-[#111]">{a.name}</p>
                          <p className="text-[11px] font-medium text-[#bbb]">{a.id.slice(0, 8)}…</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Users size={12} className="text-[#aaa]" />
                        <span className="text-[13px] font-semibold text-[#333]">{a.user_count}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <GitBranch size={12} className="text-[#aaa]" />
                        <span className="text-[13px] font-semibold text-[#333]">{a.branch_count}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-[12px] font-medium text-[#888]">{fmt(a.created_at)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="px-5 py-3 border-t border-[#f4f4f4]">
            <p className="text-[11px] font-semibold text-[#bbb]">{filtered.length} account{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
