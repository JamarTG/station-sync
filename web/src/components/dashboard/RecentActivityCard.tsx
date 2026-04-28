import { ChevronDown, ChevronUp, Plus, MoreHorizontal } from 'lucide-react'
import type { AccountType } from './AccountsPanel'

interface BaseRow { id: number; amount: number }
interface AttendantRow extends BaseRow { type: 'attendant'; name: string; time: string }
interface ExpenditureRow extends BaseRow { type: 'expenditure'; requestedBy: string; description: string }
interface ChargesRow extends BaseRow { type: 'charges'; name: string; fuelType: string; litres: number }

type ActivityRow = AttendantRow | ExpenditureRow | ChargesRow

const activityByAccount: Record<AccountType, ActivityRow[]> = {
  Cash: [
    { type: 'attendant', id: 1, name: 'S. Lawes', time: '9:00 PM', amount: 150000.0 },
    { type: 'attendant', id: 2, name: 'S. Smith', time: '7:43 PM', amount: 150000.0 },
    { type: 'attendant', id: 3, name: 'T. Brisco', time: '4:32 PM', amount: 150000.0 },
    { type: 'attendant', id: 4, name: 'T. Brisco', time: '4:32 PM', amount: 150000.0 },
    { type: 'attendant', id: 5, name: 'T. Brisco', time: '4:32 PM', amount: 150000.0 },
  ],
  Charges: [
    { type: 'charges', id: 1, name: 'T. Brisco', fuelType: '87', litres: 45.2, amount: 8608.08 },
    { type: 'charges', id: 2, name: 'A. Lewis', fuelType: 'ADO', litres: 30.0, amount: 5727.0 },
  ],
  Expenditures: [
    { type: 'expenditure', id: 1, requestedBy: 'A. Lewis', description: 'Office supplies', amount: 5000.0 },
    { type: 'expenditure', id: 2, requestedBy: 'T. Brisco', description: 'Equipment repair', amount: 12000.0 },
  ],
  Advance: [],
  FX: [],
  Card: [
    { type: 'attendant', id: 1, name: 'S. Smith', time: '7:00 PM', amount: 23000.0 },
    { type: 'attendant', id: 2, name: 'T. Brisco', time: '5:30 PM', amount: 15000.0 },
  ],
}

interface Props {
  account: AccountType
}

function TableHeaders({ account }: { account: AccountType }) {
  const th = 'text-left px-3 py-3 text-[11px] font-semibold text-[#bbb]'
  if (account === 'Expenditures') return (
    <>
      <th className={th}>Requested by</th>
      <th className={th}>Description</th>
    </>
  )
  if (account === 'Charges') return (
    <>
      <th className={th}>Attendant</th>
      <th className={th}>Fuel Type</th>
      <th className="text-right px-3 py-3 text-[11px] font-semibold text-[#bbb]">Litres</th>
    </>
  )
  return <th className={th}>Attendant</th>
}

function TableCells({ row }: { row: ActivityRow }) {
  if (row.type === 'expenditure') return (
    <>
      <td className="px-3 py-3.5">
        <p className="text-[13px] font-semibold text-[#222]">{row.requestedBy}</p>
      </td>
      <td className="px-3 py-3.5">
        <p className="text-[13px] text-[#555]">{row.description}</p>
      </td>
    </>
  )
  if (row.type === 'charges') return (
    <>
      <td className="px-3 py-3.5">
        <p className="text-[13px] font-semibold text-[#222]">{row.name}</p>
      </td>
      <td className="px-3 py-3.5">
        <p className="text-[13px] text-[#555]">{row.fuelType}</p>
      </td>
      <td className="px-3 py-3.5 text-right">
        <p className="text-[13px] text-[#555]">{row.litres.toFixed(2)}</p>
      </td>
    </>
  )
  return (
    <td className="px-3 py-3.5">
      <p className="text-[13px] font-semibold text-[#222]">{row.name}</p>
      <p className="text-[11px] text-[#bbb]">{row.time}</p>
    </td>
  )
}

export function RecentActivityCard({ account }: Props) {
  const activities = activityByAccount[account]

  return (
    <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-[#111]">{account}</span>
          <span className="text-[#ccc]">|</span>
          <span className="text-[13px] font-medium text-[#888]">Recent Activity</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="flex items-center border border-[#ddd] rounded-lg overflow-hidden">
            <span className="px-2 py-1.5 hover:bg-[#f4f4f4] border-r border-[#ddd] transition-colors">
              <ChevronDown size={12} className="text-[#666]" />
            </span>
            <span className="px-2 py-1.5 hover:bg-[#f4f4f4] transition-colors">
              <ChevronUp size={12} className="text-[#666]" />
            </span>
          </button>
          <button className="w-7 h-7 border border-[#ddd] rounded-lg flex items-center justify-center hover:bg-[#f4f4f4] transition-colors text-[#666]">
            <Plus size={13} />
          </button>
          <button className="w-7 h-7 border border-[#ddd] rounded-lg flex items-center justify-center hover:bg-[#f4f4f4] transition-colors text-[#666]">
            <MoreHorizontal size={13} />
          </button>
        </div>
      </div>

      {/* Table — fixed height, scrollable */}
      <div className="overflow-y-auto h-[240px] flex-shrink-0">
        {activities.length > 0 ? (
          <table className="w-full">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-[#f4f4f4]">
                <th className="text-left pl-5 pr-3 py-3 text-[11px] font-semibold text-[#bbb] w-10">#</th>
                <TableHeaders account={account} />
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-[#bbb]">Amount</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((row) => (
                <tr key={row.id} className="border-b border-[#f9f9f9] hover:bg-[#fafafa] transition-colors group">
                  <td className="pl-5 pr-3 py-3.5 text-[13px] text-[#bbb] font-medium">{row.id}</td>
                  <TableCells row={row} />
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-[13px] font-semibold text-[#333]">
                        J$ {row.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity text-[#bbb] hover:text-[#888]">
                        <MoreHorizontal size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex items-center justify-center py-10">
            <p className="text-[13px] text-[#ccc] font-medium">No activity recorded</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-[#f0f0f0] flex-shrink-0">
        <button className="text-[12px] font-semibold text-[#888] hover:text-[#333] transition-colors">
          view all
        </button>
        <div className="flex items-center gap-4">
          <span className="text-[12px] text-[#bbb] font-medium">{activities.length}</span>
          <span className="text-[13px] font-bold text-[#333]">J$ 0.00</span>
        </div>
      </div>
    </div>
  )
}
