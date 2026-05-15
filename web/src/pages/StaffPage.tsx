import { useUsers } from '../hooks/useApi'
import type { User } from '../lib/api'

function roleBadgeColor(role: string) {
  switch (role) {
    case 'Supervisor': return 'bg-[#f0f0f0] text-[#555]'
    case 'Manager':    return 'bg-[#fff3cd] text-[#856404]'
    case 'Admin':      return 'bg-[#cfe2ff] text-[#0a3d91]'
    case 'Attendant':  return 'bg-[#d1e7dd] text-[#0a5435]'
    default:           return 'bg-[#f0f0f0] text-[#555]'
  }
}

function StaffRow({ user }: { user: User }) {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-[#f0f0f0] hover:bg-[#fafafa] transition-colors">
      <div className="w-9 h-9 rounded-full bg-[#111] text-white flex items-center justify-center text-[13px] font-bold shrink-0">
        {user.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-[#111] truncate">{user.name}</p>
        <p className="text-[12px] text-[#999] truncate">{user.email}</p>
      </div>
      <span className={`text-[11px] font-semibold px-2 py-1 rounded-full shrink-0 ${roleBadgeColor(user.role)}`}>
        {user.role}
      </span>
      <div className="text-right shrink-0 w-28">
        {user.pay_rate != null && user.pay_type != null ? (
          <>
            <p className="text-[14px] font-semibold text-[#111]">
              ${user.pay_rate.toLocaleString('en-JM', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-[#999]">{user.pay_type === 'Hourly' ? 'per hour' : 'per month'}</p>
          </>
        ) : (
          <p className="text-[12px] text-[#bbb]">No pay set</p>
        )}
      </div>
      <div className="shrink-0">
        <span className={`w-2 h-2 rounded-full inline-block ${user.active ? 'bg-green-400' : 'bg-[#ddd]'}`} />
      </div>
    </div>
  )
}

export function StaffPage() {
  const { data: users = [], isLoading } = useUsers()

  const active   = users.filter((u) => u.active)
  const inactive = users.filter((u) => !u.active)

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[20px] font-bold text-[#111]">Staff</h2>
          <p className="text-[13px] text-[#888] mt-0.5">{users.length} employee{users.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-[13px] text-[#aaa]">Loading...</p>
      ) : (
        <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden">
          {active.length === 0 && inactive.length === 0 && (
            <p className="text-[13px] text-[#aaa] p-6">No staff found.</p>
          )}

          {active.map((u) => <StaffRow key={u.id} user={u} />)}

          {inactive.length > 0 && (
            <>
              <div className="px-6 py-2 bg-[#fafafa] border-t border-b border-[#f0f0f0]">
                <p className="text-[11px] font-semibold text-[#bbb] uppercase tracking-widest">Inactive</p>
              </div>
              {inactive.map((u) => (
                <div key={u.id} className="opacity-50">
                  <StaffRow user={u} />
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
