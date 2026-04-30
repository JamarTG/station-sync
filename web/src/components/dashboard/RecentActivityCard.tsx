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

const accounts: AccountType[] = ['Cash', 'Expenditures', 'Charges', 'Advance', 'FX', 'Card']

interface BaseRow { id: number; amount: number }
interface AttendantRow extends BaseRow { type: 'attendant'; name: string; time: string }
interface ExpenditureRow extends BaseRow { type: 'expenditure'; requestedBy: string; description: string }
interface ChargesRow extends BaseRow { type: 'charges'; name: string; fuelType: string; litres: number }
interface CardRow extends BaseRow { type: 'card'; name: string; bank: string; litres: number }
interface AdvanceRow extends BaseRow { type: 'advance'; name: string; fuelType: string; litres: number }
interface FXRow extends BaseRow { type: 'fx'; name: string; fxAmount: number; currency: string }

type ActivityRow = AttendantRow | ExpenditureRow | ChargesRow | CardRow | AdvanceRow | FXRow

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
  if (row.type === 'advance') return (
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
  if (row.type === 'card') return (
    <>
      <td className="px-3 py-3.5">
        <p className="text-[13px] font-semibold text-[#222]">{row.name}</p>
      </td>
      <td className="px-3 py-3.5">
        <p className="text-[13px] text-[#555]">{row.bank}</p>
      </td>
      <td className="px-3 py-3.5 text-right">
        <p className="text-[13px] text-[#555]">{row.litres.toFixed(2)}</p>
      </td>
    </>
  )
  if (row.type === 'fx') return (
    <>
      <td className="px-3 py-3.5">
        <p className="text-[13px] font-semibold text-[#222]">{row.name}</p>
      </td>
      <td className="px-3 py-3.5 text-right">
        <p className="text-[13px] text-[#555]">{row.fxAmount.toFixed(2)}</p>
      </td>
      <td className="px-3 py-3.5">
        <p className="text-[13px] text-[#555]">{row.currency}</p>
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

function AccountDropdown({ account, onChange }: { account: AccountType; onChange: (a: AccountType) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative flex-1 py-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 border border-[#ddd] rounded-lg px-3 py-1.5"
      >
        <span className="text-[13px] font-semibold text-[#111]">{account}</span>
        <ChevronDown size={12} className={clsx('text-[#888] transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-[#e0e0e0] rounded-xl shadow-md py-1 min-w-[140px]">
          {accounts.map((a) => (
            <button
              key={a}
              onClick={() => { onChange(a); setOpen(false) }}
              className={clsx(
                'w-full text-left px-4 py-2.5 text-[13px] font-semibold transition-colors',
                a === account ? 'text-[#111] bg-[#f5f5f5]' : 'text-[#555] hover:bg-[#f9f9f9]'
              )}
            >
              {a}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function RecentActivityCard() {
  const [account, setAccount] = useState<AccountType>('Cash')
  const activities = activityByAccount[account].slice(0, 4)

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

  function handleAdd() {
    if (account === 'Expenditures') setShowExpenditure(true)
    if (account === 'Cash') setShowCashDeposit(true)
    if (account === 'Card') setShowCard(true)
    if (account === 'Advance') setShowAdvance(true)
    if (account === 'Charges') setShowCharge(true)
    if (account === 'FX') setShowFX(true)
  }

  function handleTotal() {
    if (account === 'Cash') setShowCashBreakdown(true)
    if (account === 'Expenditures') setShowExpenditureBreakdown(true)
    if (account === 'Card') setShowCardBreakdown(true)
    if (account === 'Charges') setShowChargesBreakdown(true)
    if (account === 'Advance') setShowAdvanceBreakdown(true)
    if (account === 'FX') setShowFXBreakdown(true)
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col h-full">
        <div className="sm:hidden flex items-center px-5 border-b-2 border-[#f0f0f0]">
          <AccountDropdown account={account} onChange={setAccount} />

          <div className="flex items-center gap-1 flex-shrink-0">
            <button className="flex items-center border border-[#ddd] rounded-lg overflow-hidden">
              <span className="px-2 py-1.5 hover:bg-[#f4f4f4] border-r border-[#ddd] transition-colors">
                <ChevronDown size={12} className="text-[#666]" />
              </span>
              <span className="px-2 py-1.5 hover:bg-[#f4f4f4] transition-colors">
                <ChevronUp size={12} className="text-[#666]" />
              </span>
            </button>
            <button
              onClick={handleAdd}
              className="w-7 h-7 border border-[#ddd] rounded-lg flex items-center justify-center hover:bg-[#f4f4f4] transition-colors text-[#666]"
            >
              <Plus size={13} />
            </button>
            <button className="w-7 h-7 border border-[#ddd] rounded-lg flex items-center justify-center hover:bg-[#f4f4f4] transition-colors text-[#666]">
              <MoreHorizontal size={13} />
            </button>
          </div>
        </div>

        <div className="hidden sm:flex items-center px-5 flex-shrink-0">
          <div className="flex flex-1 min-w-0">
            {accounts.map((a) => {
              const isActive = account === a
              return (
                <button
                  key={a}
                  onClick={() => setAccount(a)}
                  className={clsx(
                    'flex-shrink-0 py-4 mr-5 text-[13px] font-semibold transition-colors whitespace-nowrap border-b-2',
                    isActive ? 'border-[#111] text-[#111]' : 'border-[#f0f0f0] text-[#aaa] hover:text-[#555]'
                  )}
                >
                  {a}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 pl-2 py-3 border-b-2 border-[#f0f0f0]">
            <button className="flex items-center border border-[#ddd] rounded-lg overflow-hidden">
              <span className="px-2 py-1.5 hover:bg-[#f4f4f4] border-r border-[#ddd] transition-colors">
                <ChevronDown size={12} className="text-[#666]" />
              </span>
              <span className="px-2 py-1.5 hover:bg-[#f4f4f4] transition-colors">
                <ChevronUp size={12} className="text-[#666]" />
              </span>
            </button>
            <button
              onClick={handleAdd}
              className="w-7 h-7 border border-[#ddd] rounded-lg flex items-center justify-center hover:bg-[#f4f4f4] transition-colors text-[#666]"
            >
              <Plus size={13} />
            </button>
            <button className="w-7 h-7 border border-[#ddd] rounded-lg flex items-center justify-center hover:bg-[#f4f4f4] transition-colors text-[#666]">
              <MoreHorizontal size={13} />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0">
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
            <div className="flex items-center justify-center h-full">
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
        <FXBreakdownModal onBack={() => setShowFXBreakdown(false)} onClose={() => setShowFXBreakdown(false)} />
      )}
    </>
  )
}
