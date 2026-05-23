import { useState, useMemo } from 'react'
import { ChevronRight, Search, X, MoreHorizontal } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { LogoLoader } from '../components/StationSyncLogo'
import { useAuth } from '../lib/authContext'
import { useOpenCStoreShift, useShiftOrders, useShiftsInRange, useProducts } from '../hooks/useApi'
import { refundOrderItem, updateOrderStatus, deleteOrder } from '../lib/api'
import { printOrderReceipt } from '../lib/printReceipt'
import { InvoiceView, type CartItem } from '../components/dashboard/InvoiceView'
import { SettleCreditModal } from '../components/dashboard/SettleCreditModal'
import type { Order, Shift } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

type TransactionStatus = 'Paid' | 'Pending' | 'Void' | 'Held' | 'Credit'

interface Transaction {
  id: string
  invoice_no: string
  cashier: string
  time: string
  amount: number
  status: TransactionStatus
  method: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return '$' + n.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-JM', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtTime(s: string) {
  const d = new Date(s)
  const h = d.getHours(), m = d.getMinutes()
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

const STATUS_COLOR: Record<TransactionStatus, string> = {
  Paid:    'text-green-600 bg-green-50',
  Pending: 'text-amber-600 bg-amber-50',
  Void:    'text-red-500 bg-red-50',
  Held:    'text-amber-600 bg-amber-50',
  Credit:  'text-blue-600 bg-blue-50',
}

const METHOD_COLOR: Record<string, string> = {
  Cash:    'bg-[#f0f0f0] text-[#555]',
  Card:    'bg-[#cfe2ff] text-[#0a3d91]',
  Credit:  'bg-[#fff3cd] text-[#856404]',
  Pending: 'bg-[#fff3cd] text-[#856404]',
}

// ── Products Section (shared) ─────────────────────────────────────────────────

type ItemRow = {
  id: string
  name: string
  quantity: number
  unit_price: number
  total: number
  orderId: string
  orderStatus: string
  refunded: boolean
}

function ProductsSection({
  items,
  shiftId,
  emptyLabel,
}: {
  items: ItemRow[]
  shiftId: string | undefined
  emptyLabel: string
}) {
  const qc = useQueryClient()
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  async function refundItem(orderId: string, itemId: string) {
    if (!shiftId) return
    try {
      await refundOrderItem(shiftId, orderId, itemId)
      qc.invalidateQueries({ queryKey: ['shifts', shiftId, 'orders'] })
    } catch {}
    setOpenMenuId(null)
  }

  return (
    <div className="p-5 border-t border-[#f0f0f0] flex-1 flex flex-col min-h-0">
      <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mb-3">Products</p>

      {items.length === 0 ? (
        <p className="text-[13px] font-medium text-[#bbb]">{emptyLabel}</p>
      ) : (
        <>
          <div className="space-y-0.5">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 py-1.5">
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-semibold truncate ${
                    item.refunded ? 'text-[#bbb] line-through' : 'text-[#111]'
                  }`}>{item.name}</p>
                  <p className="text-[11px] text-[#bbb]">
                    {item.quantity} × {fmt(item.unit_price)}{item.refunded ? ' · Refunded' : ''}
                  </p>
                </div>
                <p className={`text-[13px] font-semibold shrink-0 ${
                  item.refunded ? 'text-[#bbb] line-through' : 'text-[#333]'
                }`}>{fmt(item.total)}</p>

                {/* ··· menu */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                    className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#f4f4f4] text-[#ccc] hover:text-[#555] transition-colors"
                  >
                    <MoreHorizontal size={13} />
                  </button>

                  {openMenuId === item.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                      <div className="absolute right-0 top-full mt-1.5 bg-white border border-[#e8e8e8] rounded-2xl shadow-lg z-20 w-40 overflow-hidden">
                        <button
                          onClick={() => refundItem(item.orderId, item.id)}
                          disabled={item.refunded}
                          className="w-full px-4 py-2.5 text-left text-[12px] font-semibold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {item.refunded ? 'Refunded' : 'Refund'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#f0f0f0] mt-auto">
            <p className="text-[11px] font-medium text-[#bbb]">
              {items.length} item{items.length !== 1 ? 's' : ''}
            </p>
            <p className="text-[13px] font-bold text-[#111]">
              {fmt(items.reduce((s, i) => s + i.total, 0))}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// ── Cashier: Shift Sales Breakdown ────────────────────────────────────────────

function ShiftBreakdown({ shift, orders }: { shift: Shift | null; orders: Order[] }) {
  const sales = orders.filter((o) => o.status === 'paid' || o.status === 'credit')
  const total = sales.reduce((s, o) => s + o.total, 0)

  const byPayment: Record<string, number> = {}
  for (const o of sales) {
    const m = o.payment_method ?? 'Unknown'
    byPayment[m] = (byPayment[m] ?? 0) + o.total
  }
  const paymentEntries = Object.entries(byPayment).sort(([, a], [, b]) => b - a)

  const counts = [
    { label: 'Completed', value: sales.length },
    { label: 'Held',      value: orders.filter((o) => o.status === 'held').length },
    { label: 'Voided',    value: orders.filter((o) => o.status === 'voided').length },
  ]

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-5 border-b border-[#f0f0f0] shrink-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-bold text-[#111]">Sales</p>
          {shift && (
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
              shift.end_time ? 'bg-[#f0f0f0] text-[#555]' : 'bg-[#d1e7dd] text-[#0a5435]'
            }`}>
              {shift.end_time ? 'Closed' : 'Open'}
            </span>
          )}
        </div>
        <p className="text-[28px] font-bold text-[#111] leading-none mt-3">{fmt(total)}</p>
      </div>

      {/* Payment methods */}
      <div className="p-5 border-b border-[#f0f0f0] shrink-0">
        <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mb-3">Payment Methods</p>
        {paymentEntries.length === 0 ? (
          <p className="text-[13px] font-medium text-[#bbb]">No sales yet</p>
        ) : (
          <div className="space-y-2.5">
            {paymentEntries.map(([methodName, amount]) => (
              <div key={methodName} className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-medium text-[#555] shrink-0">{methodName}</p>
                <div className="flex items-center gap-3 flex-1 justify-end">
                  <div className="w-20 h-1.5 rounded-full bg-[#f0f0f0] overflow-hidden">
                    <div
                      className="h-full bg-[#111] rounded-full"
                      style={{ width: total > 0 ? `${(amount / total) * 100}%` : '0%' }}
                    />
                  </div>
                  <p className="text-[13px] font-semibold text-[#111] w-24 text-right">{fmt(amount)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transactions */}
      <div className="p-5 shrink-0">
        <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mb-3">Transactions</p>
        <div className="space-y-2">
          {counts.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-[#555]">{label}</p>
              <p className="text-[13px] font-semibold text-[#111]">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto p-5 border-t border-[#f0f0f0]">
        <p className="text-[12px] font-medium text-[#bbb]">Select a transaction to see its products</p>
      </div>
    </div>
  )
}

// ── Cashier: Products Panel ───────────────────────────────────────────────────

function CashierProductsPanel({
  shift,
  selectedOrder,
  orders,
  onUnhold,
}: {
  shift: Shift | null
  selectedOrder: Order | null
  orders: Order[]
  onUnhold: (order: Order) => void
}) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showSettle, setShowSettle] = useState(false)

  const items: ItemRow[] = (selectedOrder?.items ?? []).map((i) => ({
    id:          i.id,
    name:        i.name,
    quantity:    i.quantity,
    unit_price:  i.unit_price,
    total:       i.total,
    orderId:     selectedOrder!.id,
    orderStatus: selectedOrder!.status,
    refunded:    i.refunded,
  }))

  async function voidOrder() {
    if (!shift?.id || !selectedOrder) return
    try {
      await updateOrderStatus(shift.id, selectedOrder.id, 'voided')
      qc.invalidateQueries({ queryKey: ['shifts', shift.id, 'orders'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['customers'] })
    } catch {}
    setMenuOpen(false)
  }

  function printReceipt() {
    if (!selectedOrder) return
    printOrderReceipt(selectedOrder, user?.business_name)
    setMenuOpen(false)
  }

  // No transaction selected → show a sales breakdown of the whole shift.
  if (!selectedOrder) {
    return <ShiftBreakdown shift={shift} orders={orders} />
  }

  const method = selectedOrder.payment_method
    ?? (selectedOrder.status === 'held' ? 'Pending' : 'Unknown')

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-5 border-b border-[#f0f0f0] shrink-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[22px] font-bold text-[#111] leading-tight">
            {selectedOrder.invoice_no ?? `#${String(selectedOrder.order_no).padStart(4, '0')}`}
          </p>

          {/* ··· menu */}
          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#f4f4f4] text-[#ccc] hover:text-[#555] transition-colors"
            >
              <MoreHorizontal size={16} />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1.5 bg-white border border-[#e8e8e8] rounded-2xl shadow-lg z-20 w-40 overflow-hidden">
                  {selectedOrder.status === 'held' && (
                    <button
                      onClick={() => { setMenuOpen(false); onUnhold(selectedOrder) }}
                      className="w-full px-4 py-2.5 text-left text-[12px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors"
                    >
                      Unhold
                    </button>
                  )}
                  {selectedOrder.status === 'credit' && (
                    <button
                      onClick={() => { setMenuOpen(false); setShowSettle(true) }}
                      className="w-full px-4 py-2.5 text-left text-[12px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors"
                    >
                      Mark as paid
                    </button>
                  )}
                  <button
                    onClick={printReceipt}
                    className="w-full px-4 py-2.5 text-left text-[12px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors"
                  >
                    Print
                  </button>
                  <button
                    onClick={voidOrder}
                    disabled={selectedOrder.status === 'voided'}
                    className="w-full px-4 py-2.5 text-left text-[12px] font-semibold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {selectedOrder.status === 'voided' ? 'Voided' : 'Void'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            METHOD_COLOR[method] ?? 'bg-[#f0f0f0] text-[#555]'
          }`}>
            {method}
          </span>
          <span className="text-[12px] text-[#999]">{fmtTime(selectedOrder.created_at)}</span>
        </div>
      </div>

      <ProductsSection
        items={items}
        shiftId={shift?.id}
        emptyLabel="No items recorded"
      />

      {showSettle && shift && (
        <SettleCreditModal order={selectedOrder} shiftId={shift.id} onClose={() => setShowSettle(false)} />
      )}
    </div>
  )
}

// ── Cashier: Transactions Table ───────────────────────────────────────────────

function TransactionRow({
  t,
  selected,
  onSelect,
}: {
  t: Transaction
  selected: Transaction | null
  onSelect: (t: Transaction) => void
}) {
  return (
    <button
      onClick={() => onSelect(t)}
      className={`w-full grid grid-cols-[100px_1fr_1fr_1fr_120px_auto_32px] gap-4 items-center px-5 py-3.5 border-b border-[#f8f8f8] last:border-0 transition-colors text-left ${
        selected?.id === t.id ? 'bg-[#f4f4f4]' : 'hover:bg-[#fafafa]'
      }`}
    >
      <p className="text-[12px] font-bold text-[#ccc]">{t.invoice_no}</p>
      <p className="text-[11px] font-bold text-[#666]">{fmtTime(t.time)}</p>
      <p className="text-[13px] font-semibold text-[#111] truncate">{t.cashier}</p>
      <p className="text-[13px] font-semibold text-[#111]">{fmt(t.amount)}</p>
      <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 capitalize w-fit ${STATUS_COLOR[t.status]}`}>
        {t.status}
      </span>
      <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 capitalize w-fit ${METHOD_COLOR[t.method] ?? 'text-[#555] bg-[#f0f0f0]'}`}>
        {t.method}
      </span>
      <ChevronRight size={14} className="text-[#ccc]" />
    </button>
  )
}

function TransactionsTable({
  transactions,
  selected,
  onSelect,
  isLoading,
}: {
  transactions: Transaction[]
  selected: Transaction | null
  onSelect: (t: Transaction) => void
  isLoading: boolean
}) {
  const [query, setQuery] = useState('')
  // Open the accordion automatically when arriving from the dashboard's "view all" button.
  const [heldOpen, setHeldOpen] = useState(() => {
    try {
      if (sessionStorage.getItem('ss_expand_held') === '1') {
        sessionStorage.removeItem('ss_expand_held')
        return true
      }
    } catch {}
    return false
  })

  const filtered = query.trim()
    ? transactions.filter((t) =>
        t.invoice_no.toLowerCase().includes(query.toLowerCase()) ||
        t.cashier.toLowerCase().includes(query.toLowerCase()) ||
        t.method.toLowerCase().includes(query.toLowerCase()) ||
        t.status.toLowerCase().includes(query.toLowerCase())
      )
    : transactions

  const heldTxns = filtered.filter((t) => t.status === 'Held')
  const mainTxns = filtered.filter((t) => t.status !== 'Held')

  return (
    <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4 min-w-0">
      {/* Search bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border border-[#ebebeb] rounded-xl shrink-0">
        <Search size={14} className="text-[#bbb] shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by invoice, method, or status…"
          className="flex-1 text-[13px] text-[#111] placeholder-[#ccc] outline-none bg-transparent"
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-[#bbb] hover:text-[#555] transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Main table */}
      <div className="flex-1 bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col">
        <div className="grid grid-cols-[100px_1fr_1fr_1fr_120px_auto_32px] gap-4 px-5 py-2.5 border-b border-[#f0f0f0] bg-[#fafafa] shrink-0">
          {['#', 'Time', 'Cashier', 'Amount', 'Status', 'Method', ''].map((h) => (
            <p key={h} className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
          ))}
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center"><LogoLoader /></div>
        ) : mainTxns.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <p className="text-[13px] font-semibold text-[#bbb]">
              {transactions.length === 0
                ? 'No transactions yet'
                : query.trim()
                ? 'No results found'
                : 'No completed sales'}
            </p>
            {transactions.length === 0 && (
              <p className="text-[12px] font-medium text-[#ccc]">Sales will appear here once recorded</p>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {mainTxns.map((t) => (
              <TransactionRow key={t.id} t={t} selected={selected} onSelect={onSelect} />
            ))}
          </div>
        )}

        {mainTxns.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#f0f0f0] shrink-0">
            <p className="text-[20px] font-bold text-[#111]">{mainTxns.length}</p>
            <p className="text-[13px] font-bold text-[#111]">{fmt(mainTxns.reduce((s, t) => s + t.amount, 0))}</p>
          </div>
        )}
      </div>

      {/* Held receipts accordion */}
      {heldTxns.length > 0 && (
        <div className="shrink-0 bg-white rounded-2xl border border-[#ebebeb] overflow-hidden">
          <button
            onClick={() => setHeldOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#fafafa] transition-colors"
          >
            <div className="flex items-center gap-2">
              <ChevronRight size={14} className={`text-[#888] transition-transform ${heldOpen ? 'rotate-90' : ''}`} />
              <span className="text-[13px] font-bold text-[#888]">Held Receipts</span>
              <span className="text-[11px] font-bold text-[#bbb] bg-[#f4f4f4] px-2 py-0.5 rounded-full">{heldTxns.length}</span>
            </div>
            <span className="text-[13px] font-bold text-[#888]">{fmt(heldTxns.reduce((s, t) => s + t.amount, 0))}</span>
          </button>
          {heldOpen && (
            <div className="border-t border-[#f0f0f0] max-h-[280px] overflow-y-auto">
              <div className="grid grid-cols-[100px_1fr_1fr_1fr_120px_auto_32px] gap-4 px-5 py-2.5 border-b border-[#f0f0f0] bg-[#fafafa]">
                {['#', 'Time', 'Cashier', 'Amount', 'Status', 'Method', ''].map((h) => (
                  <p key={h} className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
                ))}
              </div>
              {heldTxns.map((t) => (
                <TransactionRow key={t.id} t={t} selected={selected} onSelect={onSelect} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Cashier View ──────────────────────────────────────────────────────────────

function CStoreCashierView() {
  const qc = useQueryClient()
  const { data: shift } = useOpenCStoreShift()
  const { data: orders = [], isLoading } = useShiftOrders(shift?.id)
  const { data: products = [] } = useProducts()
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [unhold, setUnhold] = useState<{ cart: CartItem[]; invoiceNo?: string } | null>(null)

  const transactions: Transaction[] = [...orders].reverse().map((o) => ({
    id:         o.id,
    invoice_no: o.invoice_no ?? `#${String(o.order_no).padStart(4, '0')}`,
    cashier:    o.cashier_name.trim().split(/\s+/)[0],
    time:       o.created_at,
    amount:     o.total,
    status:     o.status === 'paid' ? 'Paid' : o.status === 'voided' ? 'Void' : o.status === 'held' ? 'Held' : o.status === 'credit' ? 'Credit' : 'Pending',
    method:     o.payment_method ?? (o.status === 'held' ? 'Pending' : 'Unknown'),
  }))

  const selectedOrder = selected ? (orders.find((o) => o.id === selected.id) ?? null) : null

  // Resume a held sale: rebuild the cart from its items, drop the held record, open checkout.
  async function handleUnhold(order: Order) {
    const cart: CartItem[] = []
    for (const it of order.items ?? []) {
      const product = products.find((p) => p.id === it.product_id)
      if (product) cart.push({ product, quantity: it.quantity, unitPrice: it.unit_price })
    }
    if (shift?.id) {
      try {
        await deleteOrder(shift.id, order.id)
        qc.invalidateQueries({ queryKey: ['shifts', shift.id, 'orders'] })
      } catch {}
    }
    setSelected(null)
    setUnhold({ cart, invoiceNo: order.invoice_no ?? undefined })
  }

  if (unhold) {
    return (
      <InvoiceView
        cart={unhold.cart}
        initialInvoiceNo={unhold.invoiceNo}
        onUpdateCart={(c) => setUnhold((u) => (u ? { ...u, cart: c } : u))}
        onReturn={() => setUnhold(null)}
        onCancel={() => setUnhold(null)}
      />
    )
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <TransactionsTable
        transactions={transactions}
        selected={selected}
        onSelect={(t) => setSelected((cur) => (cur?.id === t.id ? null : t))}
        isLoading={isLoading}
      />
      <div className="w-[450px] shrink-0 border-l border-[#e8e8e8] h-full overflow-y-auto">
        <CashierProductsPanel shift={shift ?? null} selectedOrder={selectedOrder} orders={orders} onUnhold={handleUnhold} />
      </div>
    </div>
  )
}

// ── Manager: Shift Detail Panel ───────────────────────────────────────────────

function CStoreShiftDetailPanel({ shift }: { shift: Shift | null }) {
  const { data: orders = [], isLoading } = useShiftOrders(shift?.id)

  const total = orders.reduce((s, o) => s + o.total, 0)
  const byPayment: Record<string, number> = {}
  for (const o of orders) {
    const m = o.payment_method ?? 'Unknown'
    byPayment[m] = (byPayment[m] ?? 0) + o.total
  }
  const paymentEntries = Object.entries(byPayment).sort(([, a], [, b]) => b - a)

  // Flatten all items across all orders, carrying the parent order context
  const allItems: ItemRow[] = orders.flatMap((o) =>
    (o.items ?? []).map((i) => ({
      id:          i.id,
      name:        i.name,
      quantity:    i.quantity,
      unit_price:  i.unit_price,
      total:       i.total,
      orderId:     o.id,
      orderStatus: o.status,
      refunded:    i.refunded,
    }))
  )

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-5 border-b border-[#f0f0f0] shrink-0">
        <p className="text-[13px] font-bold text-[#111]">Sales</p>
        {shift && (
          <p className="text-[28px] font-bold text-[#111] leading-none mt-3">{fmt(total)}</p>
        )}
      </div>

      {!shift ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] font-medium text-[#bbb]">Select a shift to see breakdown</p>
        </div>
      ) : isLoading ? (
        <div className="flex-1 flex items-center justify-center"><LogoLoader /></div>
      ) : (
        <>
          {/* Payment methods */}
          {paymentEntries.length > 0 && (
            <div className="p-5 border-b border-[#f0f0f0] shrink-0">
              <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mb-3">Payment Methods</p>
              <div className="space-y-2">
                {paymentEntries.map(([method, amount]) => (
                  <div key={method} className="flex items-center justify-between">
                    <p className="text-[13px] font-medium text-[#555]">{method}</p>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-1.5 rounded-full bg-[#f0f0f0] overflow-hidden">
                        <div
                          className="h-full bg-[#111] rounded-full"
                          style={{ width: total > 0 ? `${(amount / total) * 100}%` : '0%' }}
                        />
                      </div>
                      <p className="text-[13px] font-semibold text-[#111] w-24 text-right">{fmt(amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Products */}
          <ProductsSection
            items={allItems}
            shiftId={shift.id}
            emptyLabel="No products sold this shift"
          />
        </>
      )}
    </div>
  )
}

// ── Manager View ──────────────────────────────────────────────────────────────

function CStoreManagerView() {
  const [selected, setSelected] = useState<Shift | null>(null)
  const [query, setQuery] = useState('')

  const { end, start } = useMemo(() => {
    const now = new Date()
    const end = now.toISOString().slice(0, 10)
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    return { start, end }
  }, [])

  const { data: allShifts = [], isLoading } = useShiftsInRange(start, end)
  const shifts = allShifts
    .filter((s) => s.shift_type === 'convenience_store')
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))

  const filtered = query.trim()
    ? shifts.filter((s) =>
        s.supervisor_name.toLowerCase().includes(query.toLowerCase()) ||
        fmtDate(s.date).toLowerCase().includes(query.toLowerCase())
      )
    : shifts

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4 min-w-0">
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-white border border-[#ebebeb] rounded-xl shrink-0">
          <Search size={14} className="text-[#bbb] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by cashier or date…"
            className="flex-1 text-[13px] text-[#111] placeholder-[#ccc] outline-none bg-transparent"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[#bbb] hover:text-[#555] transition-colors">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex-1 bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col">
          <div className="grid grid-cols-[1fr_2fr_1fr_1fr_32px] gap-4 px-5 py-2.5 border-b border-[#f0f0f0] bg-[#fafafa] shrink-0">
            {['Date', 'Cashier', 'Time', 'Status', ''].map((h) => (
              <p key={h} className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
            ))}
          </div>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center"><LogoLoader /></div>
          ) : filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-1">
              <p className="text-[13px] font-semibold text-[#bbb]">
                {shifts.length === 0 ? 'No shifts in the last 30 days' : 'No results found'}
              </p>
              {shifts.length === 0 && (
                <p className="text-[12px] font-medium text-[#ccc]">Shifts will appear here once recorded</p>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {filtered.map((s) => {
                const open = !s.end_time
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className={`w-full grid grid-cols-[1fr_2fr_1fr_1fr_32px] gap-4 items-center px-5 py-3.5 border-b border-[#f8f8f8] last:border-0 transition-colors text-left ${
                      selected?.id === s.id ? 'bg-[#f4f4f4]' : 'hover:bg-[#fafafa]'
                    }`}
                  >
                    <p className="text-[13px] text-[#666]">{fmtDate(s.date)}</p>
                    <p className="text-[13px] font-semibold text-[#111] truncate">{s.supervisor_name}</p>
                    <p className="text-[13px] text-[#666]">
                      {s.start_time}{s.end_time ? `–${s.end_time}` : ''}
                    </p>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit ${
                      open ? 'bg-[#d1e7dd] text-[#0a5435]' : 'bg-[#f0f0f0] text-[#555]'
                    }`}>{open ? 'Open' : 'Closed'}</span>
                    <ChevronRight size={14} className="text-[#ccc]" />
                  </button>
                )
              })}
            </div>
          )}

          {shifts.length > 0 && (
            <div className="px-5 py-3 border-t border-[#f0f0f0] shrink-0">
              <p className="text-[11px] font-medium text-[#bbb]">{filtered.length} shift{filtered.length !== 1 ? 's' : ''}</p>
            </div>
          )}
        </div>
      </div>

      <div className="w-[450px] shrink-0 border-l border-[#e8e8e8] h-full overflow-y-auto">
        <CStoreShiftDetailPanel shift={selected} />
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const CASHIER_ROLES = new Set(['Cashier'])

export function ConvenienceSalesPage() {
  const { user } = useAuth()
  const showCashierView = CASHIER_ROLES.has(user?.role ?? '')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebebeb] flex-shrink-0">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-0.5">Convenience Store</p>
          <h1 className="text-[22px] font-bold text-[#111] leading-tight">Sales</h1>
        </div>
      </div>

      {showCashierView ? <CStoreCashierView /> : <CStoreManagerView />}
    </div>
  )
}
