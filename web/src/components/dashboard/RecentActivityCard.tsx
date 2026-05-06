import { useState, useRef, useEffect } from 'react'
import { ChevronDown, ChevronUp, Plus, MoreHorizontal } from 'lucide-react'
import clsx from 'clsx'
import type { AccountType } from './AccountsPanel'
import { ExpenditureModal } from './ExpenditureModal'
import { CashDepositModal } from './CashDropModal'
import { CardModal } from './CardModal'
import { AdvanceModal } from './AdvanceModal'
import { ChargeModal } from './ChargeModal'
import { FXModal } from './FXModal'
import { CashBreakdownModal } from './CashBreakdownModal'
import { ExpenditureBreakdownModal } from './ExpenditureBreakdownModal'
import { CardBreakdownModal } from './CardBreakdownModal'
import { ChargesBreakdownModal } from './ChargesBreakdownModal'
import { AdvanceBreakdownModal } from './AdvanceBreakdownModal'
import { FXBreakdownModal } from './FXBreakdownModal'
import { AttendantModal } from './AttendantModal'
import { ManageAttendantsModal } from './ManageAttendantsModal'
import { DepositModal } from './DepositModal'

interface BaseRow { id: number; amount: number }
interface AttendantsRow extends BaseRow { type: 'attendants'; name: string; pump: string; balance: number; clockIn: string }
interface AttendantRow extends BaseRow { type: 'attendant'; name: string; time: string }
interface ExpenditureRow extends BaseRow { type: 'expenditure'; requestedBy: string; description: string }
interface ChargesRow extends BaseRow { type: 'charges'; name: string; fuelType: string; litres: number }
interface CardRow extends BaseRow { type: 'card'; name: string; bank: string; litres: number }
interface AdvanceRow extends BaseRow { type: 'advance'; name: string; fuelType: string; litres: number }
interface FXRow extends BaseRow { type: 'fx'; name: string; fxAmount: number; currency: string }
interface DepositRow extends BaseRow { type: 'deposit'; name: string; description: string; depositType: string }

type ActivityRow = AttendantsRow | AttendantRow | ExpenditureRow | ChargesRow | CardRow | AdvanceRow | FXRow | DepositRow

const activityByAccount: Record<AccountType, ActivityRow[]> = {
  Attendants: [
    { type: 'attendants', id: 1, name: 'S. Lawes', pump: 'Pump 1', balance: 150000.0, clockIn: '7:00 AM', amount: 0 },
    { type: 'attendants', id: 2, name: 'S. Smith', pump: 'Pump 2', balance: 92000.0, clockIn: '7:00 AM', amount: 0 },
    { type: 'attendants', id: 3, name: 'T. Brisco', pump: 'Pump 3', balance: 210000.0, clockIn: '3:00 PM', amount: 0 },
  ],
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
  Advance: [
    { type: 'advance', id: 1, name: 'T. Brisco', fuelType: '87', litres: 45.2, amount: 8608.08 },
    { type: 'advance', id: 2, name: 'S. Smith', fuelType: '90', litres: 30.0, amount: 6150.0 },
  ],
  FX: [
    { type: 'fx', id: 1, name: 'S. Smith', fxAmount: 500, currency: 'USD', amount: 75000 },
    { type: 'fx', id: 2, name: 'T. Brisco', fxAmount: 200, currency: 'EUR', amount: 32000 },
  ],
  Card: [
    { type: 'card', id: 1, name: 'S. Smith', bank: 'NCB', litres: 120.5, amount: 23000.0 },
    { type: 'card', id: 2, name: 'T. Brisco', bank: 'Scotiabank', litres: 78.3, amount: 15000.0 },
  ],
  Deposits: [
    { type: 'deposit', id: 1, name: 'S. Lawes', description: 'Shift end deposit', depositType: 'Cash', amount: 150000.0 },
    { type: 'deposit', id: 2, name: 'S. Smith', description: 'Card settlement', depositType: 'Card', amount: 45000.0 },
    { type: 'deposit', id: 3, name: 'T. Brisco', description: 'FX deposit', depositType: 'FX', amount: 32000.0 },
  ],
}

interface Props {
  account: AccountType
}

function TableHeaders({ account }: { account: AccountType }) {
  const th = 'text-left px-3 py-3 text-[11px] font-semibold text-[#bbb]'
  if (account === 'Deposits') return (
    <>
      <th className={th}>Name</th>
      <th className={th}>Description</th>
      <th className={th}>Type</th>
    </>
  )
  if (account === 'Attendants') return (
    <>
      <th className={th}>Attendant</th>
      <th className={th}>Pump</th>
      <th className="text-right px-3 py-3 text-[11px] font-semibold text-[#bbb]">Balance</th>
    </>
  )
  if (account === 'Expenditures') return (
    <>
      <th className={th}>Requested by</th>
      <th className={th}>Description</th>
    </>
  )
  if (account === 'Charges') return (
    <>
      <th className={th}>Attendant</th>
      <th className={th}>Fuel</th>
      <th className="text-right px-3 py-3 text-[11px] font-semibold text-[#bbb]">Litres</th>
    </>
  )
  if (account === 'Card') return (
    <>
      <th className={th}>Attendant</th>
      <th className={th}>Bank</th>
      <th className="text-right px-3 py-3 text-[11px] font-semibold text-[#bbb]">Litres</th>
    </>
  )
  if (account === 'Advance') return (
    <>
      <th className={th}>Attendant</th>
      <th className={th}>Fuel</th>
      <th className="text-right px-3 py-3 text-[11px] font-semibold text-[#bbb]">Litres</th>
    </>
  )
  if (account === 'FX') return (
    <>
      <th className={th}>Attendant</th>
      <th className="text-right px-3 py-3 text-[11px] font-semibold text-[#bbb]">Amount</th>
      <th className={th}>Currency</th>
    </>
  )
  return <th className={th}>Attendant</th>
}

function TableCells({ row }: { row: ActivityRow }) {
  if (row.type === 'deposit') return (
    <>
      <td className="px-3 py-3.5">
        <p className="text-[13px] font-semibold text-[#222] whitespace-nowrap">{row.name}</p>
      </td>
      <td className="px-3 py-3.5">
        <p className="text-[13px] text-[#555] whitespace-nowrap">{row.description}</p>
      </td>
      <td className="px-3 py-3.5">
        <p className="text-[13px] text-[#555] whitespace-nowrap">{row.depositType}</p>
      </td>
    </>
  )
  if (row.type === 'attendants') return (
    <>
      <td className="px-3 py-3.5">
        <p className="text-[13px] font-semibold text-[#222] whitespace-nowrap">{row.name}</p>
        <p className="text-[11px] text-[#bbb] whitespace-nowrap">{row.clockIn}</p>
      </td>
      <td className="px-3 py-3.5">
        <p className="text-[13px] text-[#555] whitespace-nowrap">{row.pump}</p>
      </td>
      <td className="px-3 py-3.5 text-right">
        <p className="text-[13px] font-semibold text-[#333] whitespace-nowrap">J$ {row.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
      </td>
    </>
  )
  if (row.type === 'expenditure') return (
    <>
      <td className="px-3 py-3.5">
        <p className="text-[13px] font-semibold text-[#222] whitespace-nowrap">{row.requestedBy}</p>
      </td>
      <td className="px-3 py-3.5">
        <p className="text-[13px] text-[#555] whitespace-nowrap">{row.description}</p>
      </td>
    </>
  )
  if (row.type === 'charges') return (
    <>
      <td className="px-3 py-3.5">
        <p className="text-[13px] font-semibold text-[#222] whitespace-nowrap">{row.name}</p>
      </td>
      <td className="px-3 py-3.5">
        <p className="text-[13px] text-[#555] whitespace-nowrap">{row.fuelType}</p>
      </td>
      <td className="px-3 py-3.5 text-right">
        <p className="text-[13px] text-[#555] whitespace-nowrap">{row.litres.toFixed(2)}</p>
      </td>
    </>
  )
  if (row.type === 'advance') return (
    <>
      <td className="px-3 py-3.5">
        <p className="text-[13px] font-semibold text-[#222] whitespace-nowrap">{row.name}</p>
      </td>
      <td className="px-3 py-3.5">
        <p className="text-[13px] text-[#555] whitespace-nowrap">{row.fuelType}</p>
      </td>
      <td className="px-3 py-3.5 text-right">
        <p className="text-[13px] text-[#555] whitespace-nowrap">{row.litres.toFixed(2)}</p>
      </td>
    </>
  )
  if (row.type === 'card') return (
    <>
      <td className="px-3 py-3.5">
        <p className="text-[13px] font-semibold text-[#222] whitespace-nowrap">{row.name}</p>
      </td>
      <td className="px-3 py-3.5">
        <p className="text-[13px] text-[#555] whitespace-nowrap">{row.bank}</p>
      </td>
      <td className="px-3 py-3.5 text-right">
        <p className="text-[13px] text-[#555] whitespace-nowrap">{row.litres.toFixed(2)}</p>
      </td>
    </>
  )
  if (row.type === 'fx') return (
    <>
      <td className="px-3 py-3.5">
        <p className="text-[13px] font-semibold text-[#222] whitespace-nowrap">{row.name}</p>
      </td>
      <td className="px-3 py-3.5 text-right">
        <p className="text-[13px] text-[#555] whitespace-nowrap">{row.fxAmount.toFixed(2)}</p>
      </td>
      <td className="px-3 py-3.5">
        <p className="text-[13px] text-[#555] whitespace-nowrap">{row.currency}</p>
      </td>
    </>
  )
  if (row.type === 'attendant') return (
    <td className="px-3 py-3.5">
      <p className="text-[13px] font-semibold text-[#222] whitespace-nowrap">{row.name}</p>
      <p className="text-[11px] text-[#bbb] whitespace-nowrap">{row.time}</p>
    </td>
  )
  return null
}

export function RecentActivityCard({ account }: Props) {
  const activities = activityByAccount[account]
  const [showExpenditure, setShowExpenditure] = useState(false)
  const [showCashDeposit, setShowCashDeposit] = useState(false)
  const [showCard, setShowCard] = useState(false)
  const [showAdvance, setShowAdvance] = useState(false)
  const [showCharge, setShowCharge] = useState(false)
  const [showFX, setShowFX] = useState(false)
  const [showCashBreakdown, setShowCashBreakdown] = useState(false)
  const [showExpenditureBreakdown, setShowExpenditureBreakdown] = useState(false)
  const [showCardBreakdown, setShowCardBreakdown] = useState(false)
  const [showChargesBreakdown, setShowChargesBreakdown] = useState(false)
  const [showAdvanceBreakdown, setShowAdvanceBreakdown] = useState(false)
  const [showFXBreakdown, setShowFXBreakdown] = useState(false)
  const [selectedAttendant, setSelectedAttendant] = useState<string | null>(null)
  const [showManageAttendants, setShowManageAttendants] = useState(false)
  const [showDeposit, setShowDeposit] = useState(false)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const displayedActivities = account === 'Attendants'
    ? [...activities].sort((a, b) => {
        const balA = a.type === 'attendants' ? a.balance : 0
        const balB = b.type === 'attendants' ? b.balance : 0
        return sortDir === 'asc' ? balA - balB : balB - balA
      })
    : activities

  return (
    <>
    <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-[#111]">
            {account === 'Attendants' ? 'Manage attendants' : account}
          </span>
          {account !== 'Attendants' && (
            <>
              <span className="text-[#ccc]">|</span>
              <span className="text-[13px] font-medium text-[#888]">Recent Activity</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button className="flex items-center border border-[#ddd] rounded-lg overflow-hidden">
            <span onClick={() => account === 'Attendants' && setSortDir('desc')} className="px-2 py-1.5 hover:bg-[#f4f4f4] border-r border-[#ddd] transition-colors cursor-pointer">
              <ChevronDown size={12} className="text-[#666]" />
            </span>
            <span onClick={() => account === 'Attendants' && setSortDir('asc')} className="px-2 py-1.5 hover:bg-[#f4f4f4] transition-colors cursor-pointer">
              <ChevronUp size={12} className="text-[#666]" />
            </span>
          </button>
          <button
            onClick={() => {
              if (account === 'Attendants') setShowManageAttendants(true)
              if (account === 'Expenditures') setShowExpenditure(true)
              if (account === 'Cash') setShowCashDeposit(true)
              if (account === 'Card') setShowCard(true)
              if (account === 'Advance') setShowAdvance(true)
              if (account === 'Charges') setShowCharge(true)
              if (account === 'FX') setShowFX(true)
              if (account === 'Deposits') setShowDeposit(true)
            }}
            className="w-7 h-7 border border-[#ddd] rounded-lg flex items-center justify-center hover:bg-[#f4f4f4] transition-colors text-[#666]"
          >
            <Plus size={13} />
          </button>
          <button className="w-7 h-7 border border-[#ddd] rounded-lg flex items-center justify-center hover:bg-[#f4f4f4] transition-colors text-[#666]">
            <MoreHorizontal size={13} />
          </button>
        </div>
      </div>

      {/* Table — fixed height, scrollable */}
      <div className="overflow-y-auto flex-1 min-h-0 flex-shrink-0">
        {activities.length > 0 ? (
          <table className="w-full">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-[#f4f4f4]">
                <th className="text-left pl-5 pr-3 py-3 text-[11px] font-semibold text-[#bbb] w-10">#</th>
                <TableHeaders account={account} />
                {account !== 'Attendants' && <th className="text-right px-5 py-3 text-[11px] font-semibold text-[#bbb]">Amount</th>}
              </tr>
            </thead>
            <tbody>
              {displayedActivities.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-[#f9f9f9] hover:bg-[#fafafa] transition-colors group${account === 'Attendants' ? ' cursor-pointer' : ''}`}
                  onClick={account === 'Attendants' && row.type === 'attendants' ? () => setSelectedAttendant(row.name) : undefined}
                >
                  <td className="pl-5 pr-3 py-3.5 text-[13px] text-[#bbb] font-medium">{row.id}</td>
                  <TableCells row={row} />
                  {account !== 'Attendants' && (
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2 flex-nowrap">
                        <span className="text-[13px] font-semibold text-[#333] whitespace-nowrap">
                          J$ {row.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity text-[#bbb] hover:text-[#888] flex-shrink-0">
                          <MoreHorizontal size={14} />
                        </button>
                      </div>
                    </td>
                  )}
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

        <div className="flex items-center justify-between px-5 py-3 border-t border-[#f0f0f0] flex-shrink-0">
          <button className="text-[12px] font-semibold text-[#888] hover:text-[#333] transition-colors">
            view all
          </button>
          <div className="flex items-center gap-4">
            <span className="text-[12px] text-[#bbb] font-medium">{activities.length}</span>
            <button
              onClick={handleTotal}
              className="text-[13px] font-bold text-[#333] hover:text-[#111] transition-colors"
            >
              J$ 0.00
            </button>
          </div>
        </div>
      </div>

      {showExpenditure && (
        <ExpenditureModal onBack={() => setShowExpenditure(false)} onClose={() => setShowExpenditure(false)} />
      )}
      {showCashDeposit && (
        <CashDepositModal initialAttendant="" onBack={() => setShowCashDeposit(false)} onClose={() => setShowCashDeposit(false)} />
      )}
      {showCard && (
        <CardModal onBack={() => setShowCard(false)} onClose={() => setShowCard(false)} />
      )}
      {showAdvance && (
        <AdvanceModal onBack={() => setShowAdvance(false)} onClose={() => setShowAdvance(false)} />
      )}
      {showCharge && (
        <ChargeModal onBack={() => setShowCharge(false)} onClose={() => setShowCharge(false)} />
      )}
      {showFX && (
        <FXModal onBack={() => setShowFX(false)} onClose={() => setShowFX(false)} />
      )}
      {showCashBreakdown && (
        <CashBreakdownModal onBack={() => setShowCashBreakdown(false)} onClose={() => setShowCashBreakdown(false)} />
      )}
      {showExpenditureBreakdown && (
        <ExpenditureBreakdownModal onBack={() => setShowExpenditureBreakdown(false)} onClose={() => setShowExpenditureBreakdown(false)} />
      )}
      {showCardBreakdown && (
        <CardBreakdownModal onBack={() => setShowCardBreakdown(false)} onClose={() => setShowCardBreakdown(false)} />
      )}
      {showChargesBreakdown && (
        <ChargesBreakdownModal onBack={() => setShowChargesBreakdown(false)} onClose={() => setShowChargesBreakdown(false)} />
      )}
      {showAdvanceBreakdown && (
        <AdvanceBreakdownModal onBack={() => setShowAdvanceBreakdown(false)} onClose={() => setShowAdvanceBreakdown(false)} />
      )}
      {showFXBreakdown && (
        <FXBreakdownModal
          onBack={() => setShowFXBreakdown(false)}
          onClose={() => setShowFXBreakdown(false)}
        />
      )}
      {selectedAttendant && (
        <AttendantModal
          name={selectedAttendant}
          onClose={() => setSelectedAttendant(null)}
        />
      )}
      {showManageAttendants && (
        <ManageAttendantsModal
          onClose={() => setShowManageAttendants(false)}
        />
      )}
      {showDeposit && (
        <DepositModal
          onBack={() => setShowDeposit(false)}
          onClose={() => setShowDeposit(false)}
        />
      )}
    </>
  )
}
