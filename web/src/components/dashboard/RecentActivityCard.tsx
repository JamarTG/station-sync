import { useState, useRef, useEffect } from 'react'
import { totalRecordedForAttendant } from '../../lib/attendantBalances'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronUp, Plus, MoreHorizontal, Eye, Pencil, Trash2, Printer, FileText, Search, X } from 'lucide-react'
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
import { DepositsBreakdownModal } from './DepositsBreakdownModal'
import { CashDepositEntryModal } from './CashDepositEntryModal'
import { CardDepositModal } from './CardDepositModal'
import { FXDepositModal } from './FXDepositModal'
import { ChequeDepositModal } from './ChequeDepositModal'
import { ViewDetailsModal } from './ViewDetailsModal'
import { ReceiptModal } from './ReceiptModal'
import { ExpenditureReceiptModal } from './ExpenditureReceiptModal'


export interface BaseRow { id: number; amount: number }
export interface AttendantsRow extends BaseRow { type: 'attendants'; name: string; pump: string; balance: number; clockIn: string }
export interface AttendantRow extends BaseRow { type: 'attendant'; name: string; time: string; supervisor?: string; denominations?: Record<number, number> }
export interface ExpenditureRow extends BaseRow { type: 'expenditure'; requestedBy: string; description: string; denominations?: Record<number, number> }
export interface ChargesRow extends BaseRow { type: 'charges'; name: string; fuelType: string; litres: number }
export interface CardRow extends BaseRow { type: 'card'; name: string; bank: string; transNo: string }
export interface AdvanceRow extends BaseRow { type: 'advance'; name: string; fuelType: string; litres: number }
export interface FXRow extends BaseRow { type: 'fx'; name: string; fxAmount: number; currency: string }
export interface DepositRow extends BaseRow { type: 'deposit'; name: string; description: string; depositType: string; supervisor?: string; fxAmount?: number; currency?: string; denominations?: Record<number, number> }

export type ActivityRow = AttendantsRow | AttendantRow | ExpenditureRow | ChargesRow | CardRow | AdvanceRow | FXRow | DepositRow

export const activityByAccount: Record<AccountType, ActivityRow[]> = {
  Attendants: [
    { type: 'attendants', id: 1, name: 'S. Lawes', pump: 'Pump 1', balance: 150000.0, clockIn: '7:00 AM', amount: 0 },
    { type: 'attendants', id: 2, name: 'S. Smith', pump: 'Pump 2', balance: 92000.0, clockIn: '7:00 AM', amount: 0 },
    { type: 'attendants', id: 3, name: 'T. Brisco', pump: 'Pump 3', balance: 210000.0, clockIn: '3:00 PM', amount: 0 },
  ],
  Cash: [
    { type: 'attendant', id: 1, name: 'S. Lawes', time: '9:00 PM', supervisor: 'A. Lewis', amount: 150000.0, denominations: { 5000: 25, 2000: 10, 1000: 5 } },
    { type: 'attendant', id: 2, name: 'S. Smith', time: '7:43 PM', supervisor: 'A. Lewis', amount: 150000.0, denominations: { 5000: 20, 2000: 15, 1000: 10 } },
    { type: 'attendant', id: 3, name: 'T. Brisco', time: '4:32 PM', supervisor: 'A. Lewis', amount: 150000.0, denominations: { 5000: 28, 1000: 8, 500: 4 } },
    { type: 'attendant', id: 4, name: 'T. Brisco', time: '4:32 PM', supervisor: 'A. Lewis', amount: 150000.0, denominations: { 5000: 30 } },
    { type: 'attendant', id: 5, name: 'T. Brisco', time: '4:32 PM', supervisor: 'A. Lewis', amount: 150000.0, denominations: { 5000: 26, 2000: 5, 1000: 10 } },
  ],
  Charges: [
    { type: 'charges', id: 1, name: 'T. Brisco', fuelType: '87', litres: 45.2, amount: 8608.08 },
    { type: 'charges', id: 2, name: 'A. Lewis', fuelType: 'ADO', litres: 30.0, amount: 5727.0 },
  ],
  Expenditures: [
    { type: 'expenditure', id: 1, requestedBy: 'A. Lewis', description: 'Office supplies', amount: 5000.0, denominations: { 5000: 1 } },
    { type: 'expenditure', id: 2, requestedBy: 'T. Brisco', description: 'Equipment repair', amount: 12000.0, denominations: { 5000: 2, 2000: 1 } },
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
    { type: 'card', id: 1, name: 'S. Smith', bank: 'NCB', transNo: 'TXN-00123', amount: 23000.0 },
    { type: 'card', id: 2, name: 'T. Brisco', bank: 'Scotiabank', transNo: 'TXN-00124', amount: 15000.0 },
  ],
  Deposits: [
    { type: 'deposit', id: 1, name: 'S. Lawes', description: 'Shift end deposit', depositType: 'Cash', supervisor: 'A. Lewis', amount: 150000.0, denominations: { 5000: 30 } },
    { type: 'deposit', id: 2, name: 'S. Smith', description: 'Card settlement', depositType: 'Card', supervisor: 'A. Lewis', amount: 45000.0 },
    { type: 'deposit', id: 3, name: 'T. Brisco', description: 'FX deposit', depositType: 'FX', supervisor: 'A. Lewis', amount: 32000.0, fxAmount: 200, currency: 'EUR' },
  ],
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
      <th className="text-right px-3 py-3 text-[11px] font-semibold text-[#bbb]">Amount Sold</th>
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
      <th className="text-right px-3 py-3 text-[11px] font-semibold text-[#bbb]">Trans #</th>
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

function TableCells({ row, attendantSales }: { row: ActivityRow; attendantSales?: Record<string, number> }) {
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
  if (row.type === 'attendants') {
    const sales = attendantSales?.[row.name] ?? 0
    const balance = totalRecordedForAttendant(row.name) - sales
    const balanceFmt = `J$ ${Math.abs(balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    return (
      <>
        <td className="px-3 py-3.5">
          <p className="text-[13px] font-semibold text-[#222] whitespace-nowrap">{row.name}</p>
          <p className="text-[11px] text-[#bbb] whitespace-nowrap">{row.clockIn}</p>
        </td>
        <td className="px-3 py-3.5">
          <p className="text-[13px] text-[#555] whitespace-nowrap">{row.pump}</p>
        </td>
        <td className="px-3 py-3.5 text-right">
          <p className={`text-[13px] font-semibold whitespace-nowrap ${sales > 0 ? 'text-[#333]' : 'text-[#bbb]'}`}>
            {sales > 0 ? `J$ ${sales.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
          </p>
        </td>
        <td className="px-3 py-3.5 text-right">
          <p className={`text-[13px] font-semibold whitespace-nowrap ${sales === 0 || balance === 0 ? 'text-[#bbb]' : balance < 0 ? 'text-red-500' : 'text-green-600'}`}>
            {sales === 0 || balance === 0 ? '—' : `${balance < 0 ? '-' : '+'}${balanceFmt}`}
          </p>
        </td>
      </>
    )
  }
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
        <p className="text-[13px] text-[#555] whitespace-nowrap">{row.transNo}</p>
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


interface Props {
  account: AccountType
  readOnly?: boolean
  attendantSales?: Record<string, number>
  attendantGradeSales?: Record<string, Record<string, number>>
}

function rowMenuOptions(account: AccountType) {
  const base = [
    { label: 'View details', icon: Eye },
    { label: 'Edit', icon: Pencil },
    { label: 'Delete', icon: Trash2, danger: true },
  ]
  if (account === 'Cash') return [{ label: 'Print receipt', icon: Printer }, ...base]
  if (account === 'Card') return base
  if (account === 'Deposits') return [{ label: 'Print receipt', icon: Printer }, ...base]
  if (account === 'Expenditures') return [{ label: 'View receipt', icon: FileText }, ...base]
  return base
}

interface RowDropdownProps {
  account: AccountType
  onClose: () => void
  onAction: (action: string) => void
  anchor: DOMRect
}

function RowDropdown({ account, onClose, onAction, anchor }: RowDropdownProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const options = rowMenuOptions(account)

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top: anchor.bottom + 4, right: window.innerWidth - anchor.right, zIndex: 9999 }}
      className="bg-white border border-[#e0e0e0] rounded-xl shadow-lg py-1 min-w-[160px]"
    >
      {options.map(({ label, icon: Icon, danger }) => (
        <button
          key={label}
          onClick={(e) => { e.stopPropagation(); onAction(label); onClose() }}
          className={clsx(
            'w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold transition-colors text-left',
            danger ? 'text-red-500 hover:bg-red-50' : 'text-[#333] hover:bg-[#f9f9f9]'
          )}
        >
          <Icon size={13} className="flex-shrink-0" />
          {label}
        </button>
      ))}
    </div>,
    document.body
  )
}

export function RecentActivityCard({ account, readOnly, attendantSales, attendantGradeSales }: Props) {
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null)
  const [dropdownAnchor, setDropdownAnchor] = useState<DOMRect | null>(null)
  const [editingRow, setEditingRow] = useState<ActivityRow | null>(null)
  const [viewingRow, setViewingRow] = useState<ActivityRow | null>(null)
  const [receiptRow, setReceiptRow] = useState<ActivityRow | null>(null)

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
  const [showDepositsBreakdown, setShowDepositsBreakdown] = useState(false)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => { setIsSearching(false); setSearchQuery('') }, [account])

  function rowMatchesSearch(r: ActivityRow, q: string): boolean {
    const s = q.toLowerCase()
    const amt = r.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })
    const base = amt.includes(s)
    if (r.type === 'attendant') return base || r.name.toLowerCase().includes(s) || r.time.toLowerCase().includes(s) || (r.supervisor ?? '').toLowerCase().includes(s)
    if (r.type === 'expenditure') return base || r.requestedBy.toLowerCase().includes(s) || r.description.toLowerCase().includes(s)
    if (r.type === 'charges') return base || r.name.toLowerCase().includes(s) || r.fuelType.toLowerCase().includes(s)
    if (r.type === 'card') return base || r.name.toLowerCase().includes(s) || r.bank.toLowerCase().includes(s) || r.transNo.toLowerCase().includes(s)
    if (r.type === 'advance') return base || r.name.toLowerCase().includes(s) || r.fuelType.toLowerCase().includes(s)
    if (r.type === 'fx') return base || r.name.toLowerCase().includes(s) || r.currency.toLowerCase().includes(s)
    if (r.type === 'deposit') return base || r.name.toLowerCase().includes(s) || r.description.toLowerCase().includes(s) || r.depositType.toLowerCase().includes(s)
    return base
  }

  const allActivities = activityByAccount[account]
  const displayedActivities = [...allActivities].sort((a, b) => {
    const valA = a.type === 'attendants' ? a.balance : a.amount
    const valB = b.type === 'attendants' ? b.balance : b.amount
    return sortDir === 'asc' ? valA - valB : valB - valA
  }).filter((r) => !searchQuery || rowMatchesSearch(r, searchQuery)).slice(0, isSearching ? undefined : 4)

  const accountTotal = allActivities.reduce((sum, r) => {
    if (r.type === 'attendants') {
      const sales = attendantSales?.[r.name] ?? 0
      if (sales === 0) return sum
      const balance = totalRecordedForAttendant(r.name) - sales
      return balance === 0 ? sum : sum + balance
    }
    return sum + r.amount
  }, 0)

  function handleTotal() {
    if (account === 'Cash') setShowCashBreakdown(true)
    if (account === 'Expenditures') setShowExpenditureBreakdown(true)
    if (account === 'Card') setShowCardBreakdown(true)
    if (account === 'Charges') setShowChargesBreakdown(true)
    if (account === 'Advance') setShowAdvanceBreakdown(true)
    if (account === 'FX') setShowFXBreakdown(true)
    if (account === 'Deposits') setShowDepositsBreakdown(true)
  }

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
        {isSearching ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="h-7 px-2.5 border border-[#ddd] rounded-lg text-[13px] text-[#333] placeholder-[#bbb] outline-none focus:border-[#aaa] w-36"
            />
            <button
              onClick={() => { setIsSearching(false); setSearchQuery('') }}
              className="w-7 h-7 border border-[#ddd] rounded-lg flex items-center justify-center hover:bg-[#f4f4f4] transition-colors text-[#888]"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button className="flex items-center border border-[#ddd] rounded-lg overflow-hidden">
              <span onClick={() => setSortDir('desc')} className={clsx('px-2 py-1.5 hover:bg-[#f4f4f4] border-r border-[#ddd] transition-colors cursor-pointer', sortDir === 'desc' && 'bg-[#f4f4f4]')}>
                <ChevronDown size={12} className="text-[#666]" />
              </span>
              <span onClick={() => setSortDir('asc')} className={clsx('px-2 py-1.5 hover:bg-[#f4f4f4] transition-colors cursor-pointer', sortDir === 'asc' && 'bg-[#f4f4f4]')}>
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
            {account !== 'Attendants' && (
              <button
                onClick={() => setIsSearching(true)}
                className="w-7 h-7 border border-[#ddd] rounded-lg flex items-center justify-center hover:bg-[#f4f4f4] transition-colors text-[#666]"
              >
                <Search size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
          {displayedActivities.length > 0 ? (
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
                    className={`border-b border-[#f9f9f9] hover:bg-[#fafafa] transition-colors group cursor-pointer`}
                    onClick={
                      account === 'Attendants' && row.type === 'attendants' ? () => setSelectedAttendant(row.name)
                      : row.type !== 'attendants' ? () => setViewingRow(row)
                      : undefined
                    }
                  >
                    <td className="pl-5 pr-3 py-3.5 text-[13px] text-[#bbb] font-medium">{row.id}</td>
                    <TableCells row={row} attendantSales={attendantSales} />
                    {account !== 'Attendants' && (
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2 flex-nowrap">
                          <span className="text-[13px] font-semibold text-[#333] whitespace-nowrap">
                            J$ {row.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                          {!readOnly && (
                            <div className="flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (openDropdownId === row.id) {
                                    setOpenDropdownId(null)
                                    setDropdownAnchor(null)
                                  } else {
                                    setOpenDropdownId(row.id)
                                    setDropdownAnchor(e.currentTarget.getBoundingClientRect())
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-[#bbb] hover:text-[#888]"
                              >
                                <MoreHorizontal size={14} />
                              </button>
                              {openDropdownId === row.id && dropdownAnchor && (
                                <RowDropdown
                                  account={account}
                                  anchor={dropdownAnchor}
                                  onClose={() => { setOpenDropdownId(null); setDropdownAnchor(null) }}
                                  onAction={(action) => {
                                    if (action === 'Edit') setEditingRow(row)
                                    if (action === 'View details') setViewingRow(row)
                                    if (action === 'Print receipt') setReceiptRow(row)
                                    if (action === 'View receipt') setReceiptRow(row)
                                  }}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    )}
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

      <div className="grid grid-cols-3 items-center px-5 py-3 border-t border-[#f0f0f0] flex-shrink-0">
          <button
            onClick={handleTotal}
            className="text-[13px] font-bold text-[#333] hover:text-[#111] transition-colors text-left"
          >
            J$ {accountTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </button>
          <span className="text-[12px] text-[#bbb] font-medium text-center">{displayedActivities.length}</span>
          <button className="text-[12px] font-semibold text-[#888] hover:text-[#333] transition-colors text-right">
            view all
          </button>
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
      {selectedAttendant && (
        <AttendantModal
          name={selectedAttendant}
          onClose={() => setSelectedAttendant(null)}
          sales={attendantSales?.[selectedAttendant]}
          gradeSales={attendantGradeSales?.[selectedAttendant]}
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
      {showDepositsBreakdown && (
        <DepositsBreakdownModal onBack={() => setShowDepositsBreakdown(false)} onClose={() => setShowDepositsBreakdown(false)} />
      )}
      {editingRow?.type === 'attendant' && (
        <CashDepositModal
          initialAttendant={editingRow.name}
          isEditing
          onBack={() => setEditingRow(null)}
          onClose={() => setEditingRow(null)}
        />
      )}
      {editingRow?.type === 'expenditure' && (
        <ExpenditureModal
          initialData={{ requestedBy: editingRow.requestedBy, description: editingRow.description }}
          isEditing
          onBack={() => setEditingRow(null)}
          onClose={() => setEditingRow(null)}
        />
      )}
      {editingRow?.type === 'charges' && (
        <ChargeModal
          initialData={{ name: editingRow.name, fuelType: editingRow.fuelType, amount: editingRow.amount }}
          isEditing
          onBack={() => setEditingRow(null)}
          onClose={() => setEditingRow(null)}
        />
      )}
      {editingRow?.type === 'card' && (
        <CardModal
          initialData={{ name: editingRow.name, bank: editingRow.bank, amount: editingRow.amount }}
          isEditing
          onBack={() => setEditingRow(null)}
          onClose={() => setEditingRow(null)}
        />
      )}
      {editingRow?.type === 'advance' && (
        <AdvanceModal
          initialData={{ name: editingRow.name, fuelType: editingRow.fuelType, amount: editingRow.amount }}
          isEditing
          onBack={() => setEditingRow(null)}
          onClose={() => setEditingRow(null)}
        />
      )}
      {editingRow?.type === 'fx' && (
        <FXModal
          initialData={{ name: editingRow.name, currency: editingRow.currency, fxAmount: editingRow.fxAmount }}
          isEditing
          onBack={() => setEditingRow(null)}
          onClose={() => setEditingRow(null)}
        />
      )}

      {editingRow?.type === 'deposit' && editingRow.depositType === 'Cash' && (
        <CashDepositEntryModal
          isEditing
          initialData={{ depositedBy: editingRow.name, description: editingRow.description }}
          onBack={() => setEditingRow(null)}
          onClose={() => setEditingRow(null)}
        />
      )}
      {editingRow?.type === 'deposit' && editingRow.depositType === 'Card' && (
        <CardDepositModal
          isEditing
          initialData={{ depositedBy: editingRow.name, description: editingRow.description, amount: editingRow.amount }}
          onBack={() => setEditingRow(null)}
          onClose={() => setEditingRow(null)}
        />
      )}
      {editingRow?.type === 'deposit' && editingRow.depositType === 'FX' && (
        <FXDepositModal
          isEditing
          initialData={{ depositedBy: editingRow.name, description: editingRow.description, fxAmount: editingRow.fxAmount ?? 0, currency: editingRow.currency ?? 'USD' }}
          onBack={() => setEditingRow(null)}
          onClose={() => setEditingRow(null)}
        />
      )}
      {editingRow?.type === 'deposit' && editingRow.depositType === 'Cheque' && (
        <ChequeDepositModal
          isEditing
          initialData={{ depositedBy: editingRow.name, description: editingRow.description, amount: editingRow.amount }}
          onBack={() => setEditingRow(null)}
          onClose={() => setEditingRow(null)}
        />
      )}
      {viewingRow && viewingRow.type !== 'attendants' && (
        <ViewDetailsModal
          row={viewingRow}
          onClose={() => setViewingRow(null)}
          onEdit={() => { setEditingRow(viewingRow); setViewingRow(null) }}
        />
      )}
      {receiptRow?.type === 'attendant' && (
        <ReceiptModal row={receiptRow} onClose={() => setReceiptRow(null)} />
      )}
      {receiptRow?.type === 'deposit' && (
        <ReceiptModal row={receiptRow} onClose={() => setReceiptRow(null)} />
      )}
      {receiptRow?.type === 'expenditure' && (
        <ExpenditureReceiptModal row={receiptRow} onClose={() => setReceiptRow(null)} />
      )}
    </div>
    </>
  )
}
