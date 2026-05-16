import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useShiftAttendance, useShiftDeposits } from '../../hooks/useApi'
import { deleteDeposit } from '../../lib/api'
import type { Deposit } from '../../lib/api'
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
export interface AttendantRow extends BaseRow { type: 'attendant'; depositId: string; name: string; time: string; supervisor?: string; denominations?: Record<number, number> }
export interface ExpenditureRow extends BaseRow { type: 'expenditure'; depositId: string; requestedBy: string; description: string; denominations?: Record<number, number> }
export interface ChargesRow extends BaseRow { type: 'charges'; depositId: string; name: string; fuelType: string; litres: number }
export interface CardRow extends BaseRow { type: 'card'; depositId: string; name: string; bank: string; transNo: string }
export interface AdvanceRow extends BaseRow { type: 'advance'; depositId: string; name: string; fuelType: string; litres: number }
export interface FXRow extends BaseRow { type: 'fx'; depositId: string; name: string; fxAmount: number; currency: string }
export interface DepositRow extends BaseRow { type: 'deposit'; depositId: string; name: string; description: string; depositType: string; supervisor?: string; fxAmount?: number; currency?: string; denominations?: Record<number, number>; bank?: string; transNo?: string; chequeNo?: string }

export type ActivityRow = AttendantsRow | AttendantRow | ExpenditureRow | ChargesRow | CardRow | AdvanceRow | FXRow | DepositRow

export const activityByAccount: Record<AccountType, ActivityRow[]> = {
  Attendants: [], Cash: [], Charges: [], Expenditures: [],
  Advance: [], FX: [], Card: [], Deposits: [],
}

function fmtShortName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return name
  return `${parts[0][0]}. ${parts[parts.length - 1]}`
}

function formatClockIn(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function mapDepositToRow(d: Deposit, id: number): ActivityRow {
  const meta: Record<string, unknown> = d.metadata ? JSON.parse(d.metadata) : {}
  switch (d.type) {
    case 'Cash':
      return { type: 'attendant', id, depositId: d.id, name: d.attendant_name, time: '', supervisor: String(meta.supervisor ?? ''), amount: d.amount, denominations: meta.denominations as Record<number, number> | undefined }
    case 'Card':
      return { type: 'card', id, depositId: d.id, name: d.attendant_name, bank: String(meta.bank ?? ''), transNo: String(meta.trans_no ?? ''), amount: d.amount }
    case 'Charge':
      return { type: 'charges', id, depositId: d.id, name: d.attendant_name, fuelType: String(meta.fuel_type ?? ''), litres: Number(meta.litres ?? 0), amount: d.amount }
    case 'Advance':
      return { type: 'advance', id, depositId: d.id, name: d.attendant_name, fuelType: String(meta.fuel_type ?? ''), litres: Number(meta.litres ?? 0), amount: d.amount }
    case 'FX':
      return { type: 'fx', id, depositId: d.id, name: d.attendant_name, fxAmount: Number(meta.fx_amount ?? 0), currency: String(meta.currency ?? ''), amount: d.amount }
    case 'Expenditure':
      return { type: 'expenditure', id, depositId: d.id, requestedBy: d.attendant_name, description: String(meta.description ?? ''), amount: d.amount, denominations: meta.denominations as Record<number, number> | undefined }
    default:
      return { type: 'deposit', id, depositId: d.id, name: String(meta.deposited_by ?? d.attendant_name), description: String(meta.description ?? ''), depositType: d.type, supervisor: String(meta.supervisor ?? ''), amount: d.amount, fxAmount: meta.fx_amount != null ? Number(meta.fx_amount) : undefined, currency: meta.currency != null ? String(meta.currency) : undefined, denominations: meta.denominations as Record<number, number> | undefined, bank: meta.bank != null ? String(meta.bank) : undefined, transNo: meta.trans_no != null ? String(meta.trans_no) : undefined, chequeNo: meta.cheque_no != null ? String(meta.cheque_no) : undefined }
  }
}

function TableHeaders({ account }: { account: AccountType }) {
  const th = 'text-left px-3 py-3 text-[11px] font-semibold text-[#bbb]'
  if (account === 'Deposits') return (
    <>
      <th className={th}>Name</th>
      <th className={th}>Description</th>
    </>
  )
  if (account === 'Attendants') return (
    <>
      <th className={th}>Attendant</th>
      <th className="text-right px-3 py-3 text-[11px] font-semibold text-[#bbb]">Amount Sold</th>
      <th className="text-right px-3 py-3 text-[11px] font-semibold text-[#bbb]">Deposited</th>
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

function TableCells({ row, attendantSales, totalRecordedByAttendant }: { row: ActivityRow; attendantSales?: Record<string, number>; totalRecordedByAttendant?: Record<string, number> }) {
  if (row.type === 'deposit') return (
    <>
      <td className="px-3 py-3.5">
        <p className="text-[13px] font-semibold text-[#222] whitespace-nowrap">{row.name}</p>
      </td>
      <td className="px-3 py-3.5">
        <p className="text-[13px] text-[#555] whitespace-nowrap">{row.description}</p>
      </td>
    </>
  )
  if (row.type === 'attendants') {
    const sales = attendantSales?.[row.name] ?? 0
    const deposited = totalRecordedByAttendant?.[row.name] ?? 0
    const balance = deposited - sales
    const balanceFmt = `J$ ${Math.abs(balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    return (
      <>
        <td className="px-3 py-3.5">
          <p className="text-[13px] font-semibold text-[#222] whitespace-nowrap">{fmtShortName(row.name)}</p>
          <p className="text-[11px] text-[#bbb] whitespace-nowrap">{row.clockIn}</p>
        </td>
        <td className="px-3 py-3.5 text-right">
          <p className={`text-[13px] font-semibold whitespace-nowrap ${sales > 0 ? 'text-[#333]' : 'text-[#bbb]'}`}>
            {sales > 0 ? `J$ ${sales.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
          </p>
        </td>
        <td className="px-3 py-3.5 text-right">
          <p className={`text-[13px] font-semibold whitespace-nowrap ${deposited > 0 ? 'text-[#333]' : 'text-[#bbb]'}`}>
            {deposited > 0 ? `J$ ${deposited.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
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
        <p className="text-[13px] font-semibold text-[#222] whitespace-nowrap">{fmtShortName(row.name)}</p>
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
        <p className="text-[13px] font-semibold text-[#222] whitespace-nowrap">{fmtShortName(row.name)}</p>
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
        <p className="text-[13px] font-semibold text-[#222] whitespace-nowrap">{fmtShortName(row.name)}</p>
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
        <p className="text-[13px] font-semibold text-[#222] whitespace-nowrap">{fmtShortName(row.name)}</p>
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
      <p className="text-[13px] font-semibold text-[#222] whitespace-nowrap">{fmtShortName(row.name)}</p>
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
  shiftId?: string
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

export function RecentActivityCard({ account, readOnly, attendantSales, attendantGradeSales, shiftId }: Props) {
  const queryClient = useQueryClient()
  const { data: attendance = [] } = useShiftAttendance(shiftId)
  const { data: deposits = [] } = useShiftDeposits(shiftId)
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

  const totalRecordedByAttendant: Record<string, number> = {}
  for (const d of deposits) {
    if (['Cash', 'Card', 'Charge', 'Advance', 'FX'].includes(d.type)) {
      totalRecordedByAttendant[d.attendant_name] = (totalRecordedByAttendant[d.attendant_name] ?? 0) + d.amount
    }
  }

  const depositTypeMap: Partial<Record<AccountType, string[]>> = {
    Cash: ['Cash'], Card: ['Card'], Charges: ['Charge'],
    Advance: ['Advance'], FX: ['FX'], Expenditures: ['Expenditure'],
    Deposits: ['CashDeposit', 'CardDeposit', 'FXDeposit', 'Cheque'],
  }

  // Keep activityByAccount fresh for all accounts so breakdown modals always have current data
  const seenCache = new Set<string>()
  activityByAccount.Attendants = attendance
    .filter((a) => { if (seenCache.has(a.user_name)) return false; seenCache.add(a.user_name); return true })
    .map((a, i) => ({
      type: 'attendants' as const, id: i + 1, name: a.user_name, pump: '—',
      balance: totalRecordedByAttendant[a.user_name] ?? 0,
      clockIn: formatClockIn(a.clock_in), amount: 0,
    }))
  for (const [acct, types] of Object.entries(depositTypeMap)) {
    activityByAccount[acct as AccountType] = deposits
      .filter((d) => types!.includes(d.type))
      .map((d, i) => mapDepositToRow(d, i + 1))
  }

  const allActivities: ActivityRow[] = (() => {
    if (account === 'Attendants') return activityByAccount.Attendants
    return activityByAccount[account] ?? []
  })()

  const displayedActivities = [...allActivities].sort((a, b) => {
    const valA = a.type === 'attendants' ? a.balance : a.amount
    const valB = b.type === 'attendants' ? b.balance : b.amount
    return sortDir === 'asc' ? valA - valB : valB - valA
  }).filter((r) => !searchQuery || rowMatchesSearch(r, searchQuery)).slice(0, (isSearching || account === 'Attendants') ? undefined : 4)

  const accountTotal = allActivities.reduce((sum, r) => {
    if (r.type === 'attendants') {
      const sales = attendantSales?.[r.name] ?? 0
      if (sales === 0) return sum
      const balance = (totalRecordedByAttendant[r.name] ?? 0) - sales
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
              {account === 'Attendants' ? <Pencil size={13} /> : <Plus size={13} />}
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
                    className="border-b border-[#f9f9f9] hover:bg-[#fafafa] transition-colors group cursor-pointer"
                    onClick={row.type === 'attendants' ? () => setSelectedAttendant(row.name) : () => setViewingRow(row)}
                  >
                    <td className="pl-5 pr-3 py-3.5 text-[13px] text-[#bbb] font-medium">{row.id}</td>
                    <TableCells row={row} attendantSales={attendantSales} totalRecordedByAttendant={totalRecordedByAttendant} />
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
                                    if (action === 'Delete' && shiftId && row.type !== 'attendants') {
                                      deleteDeposit(shiftId, row.depositId).then(() =>
                                        queryClient.invalidateQueries({ queryKey: ['shifts', shiftId, 'deposits'] })
                                      )
                                    }
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
              <p className="text-[13px] text-[#ccc] font-medium">
                {account === 'Attendants' ? 'No attendants were assigned' : 'No activity recorded'}
              </p>
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
        <ExpenditureModal onBack={() => setShowExpenditure(false)} onClose={() => setShowExpenditure(false)} shiftId={shiftId} />
      )}
      {showCashDeposit && (
        <CashDepositModal initialAttendant="" onBack={() => setShowCashDeposit(false)} onClose={() => setShowCashDeposit(false)} shiftId={shiftId} />
      )}
      {showCard && (
        <CardModal onBack={() => setShowCard(false)} onClose={() => setShowCard(false)} shiftId={shiftId} />
      )}
      {showAdvance && (
        <AdvanceModal onBack={() => setShowAdvance(false)} onClose={() => setShowAdvance(false)} shiftId={shiftId} />
      )}
      {showCharge && (
        <ChargeModal onBack={() => setShowCharge(false)} onClose={() => setShowCharge(false)} shiftId={shiftId} />
      )}
      {showFX && (
        <FXModal onBack={() => setShowFX(false)} onClose={() => setShowFX(false)} shiftId={shiftId} />
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
          shiftId={shiftId}
        />
      )}
      {showManageAttendants && (
        <ManageAttendantsModal
          onClose={() => setShowManageAttendants(false)}
          shiftId={shiftId}
        />
      )}
      {showDeposit && (
        <DepositModal
          onBack={() => setShowDeposit(false)}
          onClose={() => setShowDeposit(false)}
          shiftId={shiftId}
        />
      )}
      {showDepositsBreakdown && (
        <DepositsBreakdownModal onBack={() => setShowDepositsBreakdown(false)} onClose={() => setShowDepositsBreakdown(false)} />
      )}
      {editingRow?.type === 'attendant' && (
        <CashDepositModal
          initialAttendant={editingRow.name}
          initialDenominations={editingRow.denominations}
          depositId={editingRow.depositId}
          isEditing
          onBack={() => setEditingRow(null)}
          onClose={() => setEditingRow(null)}
          shiftId={shiftId}
        />
      )}
      {editingRow?.type === 'expenditure' && (
        <ExpenditureModal
          initialData={{ requestedBy: editingRow.requestedBy, description: editingRow.description, denominations: editingRow.denominations }}
          depositId={editingRow.depositId}
          isEditing
          onBack={() => setEditingRow(null)}
          onClose={() => setEditingRow(null)}
          shiftId={shiftId}
        />
      )}
      {editingRow?.type === 'charges' && (
        <ChargeModal
          initialData={{ name: editingRow.name, fuelType: editingRow.fuelType, amount: editingRow.amount }}
          depositId={editingRow.depositId}
          isEditing
          onBack={() => setEditingRow(null)}
          onClose={() => setEditingRow(null)}
          shiftId={shiftId}
        />
      )}
      {editingRow?.type === 'card' && (
        <CardModal
          initialData={{ name: editingRow.name, bank: editingRow.bank, transNo: editingRow.transNo, amount: editingRow.amount }}
          depositId={editingRow.depositId}
          isEditing
          onBack={() => setEditingRow(null)}
          onClose={() => setEditingRow(null)}
          shiftId={shiftId}
        />
      )}
      {editingRow?.type === 'advance' && (
        <AdvanceModal
          initialData={{ name: editingRow.name, fuelType: editingRow.fuelType, amount: editingRow.amount }}
          depositId={editingRow.depositId}
          isEditing
          onBack={() => setEditingRow(null)}
          onClose={() => setEditingRow(null)}
          shiftId={shiftId}
        />
      )}
      {editingRow?.type === 'fx' && (
        <FXModal
          initialData={{ name: editingRow.name, currency: editingRow.currency, fxAmount: editingRow.fxAmount }}
          depositId={editingRow.depositId}
          isEditing
          onBack={() => setEditingRow(null)}
          onClose={() => setEditingRow(null)}
          shiftId={shiftId}
        />
      )}

      {editingRow?.type === 'deposit' && editingRow.depositType === 'CashDeposit' && (
        <CashDepositEntryModal
          isEditing
          depositId={editingRow.depositId}
          initialData={{ depositedBy: editingRow.name, description: editingRow.description, denominations: editingRow.denominations }}
          onBack={() => setEditingRow(null)}
          onClose={() => setEditingRow(null)}
          shiftId={shiftId}
        />
      )}
      {editingRow?.type === 'deposit' && editingRow.depositType === 'CardDeposit' && (
        <CardDepositModal
          isEditing
          depositId={editingRow.depositId}
          initialData={{ depositedBy: editingRow.name, description: editingRow.description, amount: editingRow.amount, bank: editingRow.bank, transNo: editingRow.transNo }}
          onBack={() => setEditingRow(null)}
          onClose={() => setEditingRow(null)}
          shiftId={shiftId}
        />
      )}
      {editingRow?.type === 'deposit' && editingRow.depositType === 'FXDeposit' && (
        <FXDepositModal
          isEditing
          depositId={editingRow.depositId}
          initialData={{ depositedBy: editingRow.name, description: editingRow.description, fxAmount: editingRow.fxAmount ?? 0, currency: editingRow.currency ?? 'USD' }}
          onBack={() => setEditingRow(null)}
          onClose={() => setEditingRow(null)}
          shiftId={shiftId}
        />
      )}
      {editingRow?.type === 'deposit' && editingRow.depositType === 'Cheque' && (
        <ChequeDepositModal
          isEditing
          depositId={editingRow.depositId}
          initialData={{ depositedBy: editingRow.name, description: editingRow.description, amount: editingRow.amount, bank: editingRow.bank, chequeNo: editingRow.chequeNo }}
          onBack={() => setEditingRow(null)}
          onClose={() => setEditingRow(null)}
          shiftId={shiftId}
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
