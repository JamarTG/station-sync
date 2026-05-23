import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal, Search, GlassWater, Candy, Utensils, Home, Wrench, Snowflake, Flame, ChevronLeft, ChevronRight, Cigarette, Smartphone, Plus, ShoppingBag, Eye, Pencil, Trash2, FileText, Printer, Ban, Play, Check } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/authContext'
import { useOpenShift, useOpenCStoreShift, useShiftDeposits, useShiftOrders, useProducts, useCustomers } from '../../hooks/useApi'
import { useNavigate } from '@tanstack/react-router'
import type { Product, Order } from '../../lib/api'
import { createCStoreShift, deleteDeposit, updateOrderStatus, deleteOrder } from '../../lib/api'
import { printOrderReceipt } from '../../lib/printReceipt'
import { CashDepositModal } from './CashDropModal'
import { DepositModal } from './DepositModal'
import { ReportIssueModal } from './ReportIssueModal'
import { AddModal } from './AddModal'
import { ExpenditureModal } from './ExpenditureModal'
import { ExpenditureReceiptModal } from './ExpenditureReceiptModal'
import { ViewDetailsModal } from './ViewDetailsModal'
import type { ExpenditureRow } from './RecentActivityCard'
import { InvoiceView, type CartItem } from './InvoiceView'
import { SettleCreditModal } from './SettleCreditModal'

type View = 'add' | 'cash-deposit' | 'deposit' | 'expenditure' | null

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const categories = [
  { label: 'Liquors &\nBeverages', name: 'Beverages',   icon: GlassWater },
  { label: 'Snacks &\nCandies',    name: 'Snacks',       icon: Candy      },
  { label: 'Quick Meals',          name: 'Meals',        icon: Utensils   },
  { label: 'Smoking\nProducts',    name: 'Tobacco',      icon: Cigarette  },
  { label: 'Household\nItems',     name: 'Household',    icon: Home       },
  { label: 'Lubes &\nCar Care',    name: 'Automotive',   icon: Wrench     },
  { label: 'Frozen\nFoods',        name: 'Frozen',       icon: Snowflake  },
  { label: 'LPG',                  name: 'LPG',          icon: Flame      },
  { label: 'Credit &\nElectronics',name: 'Electronics',  icon: Smartphone },
]

const fmt = (n: number) => `J$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

function CategoriesRow({ selected, onSelect }: { selected: string | null; onSelect: (name: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  function updateScroll() {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }

  useEffect(() => {
    updateScroll()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateScroll)
    const ro = new ResizeObserver(updateScroll)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', updateScroll); ro.disconnect() }
  }, [])

  return (
    <div className="relative flex items-center">
      {canScrollLeft && (
        <button
          onClick={() => scrollRef.current?.scrollBy({ left: -160, behavior: 'smooth' })}
          className="absolute left-0 z-10 w-7 h-7 rounded-full bg-white border border-[#e0e0e0] shadow-sm flex items-center justify-center text-[#888] hover:text-[#111] transition-colors flex-shrink-0"
        >
          <ChevronLeft size={14} />
        </button>
      )}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide w-full justify-center"
        style={{ scrollbarWidth: 'none' }}
      >
        {categories.map(({ label, name, icon: Icon }) => {
          const active = selected === name
          return (
            <button
              key={name}
              onClick={() => onSelect(name)}
              className="flex flex-col items-center gap-2 transition-opacity flex-shrink-0 hover:opacity-80"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${active ? 'bg-[#111]' : 'bg-[#f4f4f4]'}`}>
                <Icon size={16} className={active ? 'text-white' : 'text-[#888]'} />
              </div>
              <p className={`text-[11px] font-medium text-center leading-tight whitespace-pre-line w-14 transition-colors ${active ? 'text-[#111] font-bold' : 'text-[#888]'}`}>{label}</p>
            </button>
          )
        })}
      </div>
      {canScrollRight && (
        <button
          onClick={() => scrollRef.current?.scrollBy({ left: 160, behavior: 'smooth' })}
          className="absolute right-0 z-10 w-7 h-7 rounded-full bg-white border border-[#e0e0e0] shadow-sm flex items-center justify-center text-[#888] hover:text-[#111] transition-colors flex-shrink-0"
        >
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  )
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: (p: Product) => void }) {
  const outOfStock = product.stock_qty === 0
  return (
    <button
      onClick={() => !outOfStock && onAdd(product)}
      disabled={outOfStock}
      className={`text-left bg-white rounded-2xl border p-4 flex flex-col gap-2 transition-colors ${outOfStock ? 'border-[#ebebeb] opacity-50 cursor-not-allowed' : 'border-[#ebebeb] hover:border-[#ccc]'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-bold text-[#111] leading-snug line-clamp-2">{product.name}</p>
        <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 flex-shrink-0 ${
          outOfStock
            ? 'text-red-500 bg-red-50'
            : product.stock_qty < 10
            ? 'text-[#856404] bg-[#fff3cd]'
            : 'text-[#555] bg-[#f4f4f4]'
        }`}>
          {outOfStock ? 'Out' : `${product.stock_qty} ${product.unit}`}
        </span>
      </div>
      {product.sku && <p className="text-[11px] text-[#bbb]">{product.sku}</p>}
      <div className="flex items-center justify-between mt-auto pt-1">
        <p className="text-[14px] font-bold text-[#111]">{fmt(product.price)}</p>
        {!outOfStock && <Plus size={18} className="text-[#111]" />}
      </div>
    </button>
  )
}

const idleBtnClass = 'px-4 py-2 border border-[#ddd] rounded-xl text-[12px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors'

function CashierIdleView({ cstoreShiftOpen, onStart }: { cstoreShiftOpen: boolean; onStart: () => Promise<void> }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [showReportIssue, setShowReportIssue] = useState(false)
  const [starting, setStarting] = useState(false)

  const firstName = user?.name?.trim().split(/\s+/)[0] ?? ''
  const h = new Date().getHours()
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long' })

  const statusPill = (active: boolean) => (
    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-widest uppercase flex-shrink-0 ${
      active ? 'bg-amber-50 text-amber-600' : 'bg-[#f4f4f4] text-[#bbb]'
    }`}>
      {active ? 'In progress' : 'Inactive'}
    </span>
  )

  return (
    <div className="flex-1 overflow-y-auto flex flex-col" style={{ scrollbarWidth: 'none' }}>

      <div className="px-6 pt-8 pb-6 border-b border-[#f0f0f0] flex-shrink-0 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mb-1">{dateStr}</p>
          <h1 className="text-[28px] font-bold text-[#111] tracking-tight leading-none">
            {greeting}{firstName ? `, ${firstName}` : ''}
          </h1>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => setShowReportIssue(true)} className={idleBtnClass}>Report an issue</button>
          <button onClick={() => navigate({ to: '/schedule' })} className={idleBtnClass}>Request day off</button>
        </div>
      </div>

      <div className="flex-1 p-6">
        <div className="bg-white border border-[#ebebeb] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#f0f0f0] flex items-center justify-between gap-4">
            <div>
              <p className="text-[13px] font-bold text-[#111] uppercase tracking-wide">Convenience Store</p>
              <p className="text-[11px] font-medium text-[#bbb] mt-0.5">
                {cstoreShiftOpen ? 'A shift is currently running' : 'No shift in progress'}
              </p>
            </div>
            {statusPill(cstoreShiftOpen)}
          </div>
          <div className="px-5 py-4 flex gap-2 flex-wrap">
            <button
              onClick={async () => { setStarting(true); await onStart().finally(() => setStarting(false)) }}
              disabled={starting}
              className={`${idleBtnClass} disabled:opacity-50`}
            >
              {starting ? 'Starting…' : cstoreShiftOpen ? 'Takeover shift' : 'Start a shift'}
            </button>
          </div>
        </div>
      </div>

      <div className="py-3 text-center border-t border-[#f4f4f4] flex-shrink-0">
        <span className="text-[10px] font-medium text-[#ccc] tracking-widest">&copy; 2025 STATIONSYNC</span>
      </div>

      {showReportIssue && <ReportIssueModal onClose={() => setShowReportIssue(false)} />}
    </div>
  )
}

export function CashierDashboard() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: shift } = useOpenShift()
  const { data: cstoreShift, isLoading: cstoreLoading } = useOpenCStoreShift()
  const { data: deposits = [] } = useShiftDeposits(cstoreShift?.id)
  const { data: orders = [] } = useShiftOrders(cstoreShift?.id)
  const { data: products = [] } = useProducts()
  const { data: customers = [] } = useCustomers()
  const [shiftStarted, setShiftStarted] = useState(false)
  const [expMenuPos, setExpMenuPos] = useState<{ depositId: string; anchor: DOMRect } | null>(null)
  const [orderMenuPos, setOrderMenuPos] = useState<{ orderId: string; anchor: DOMRect } | null>(null)
  const [settleOrder, setSettleOrder] = useState<Order | null>(null)
  const [editingExp, setEditingExp] = useState<ExpenditureRow | null>(null)
  const [viewingExp, setViewingExp] = useState<ExpenditureRow | null>(null)
  const [receiptExp, setReceiptExp] = useState<ExpenditureRow | null>(null)
  const [view, setView] = useState<View>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [showInvoice, setShowInvoice] = useState(() => {
    try { return localStorage.getItem('ss_show_invoice') === 'true' } catch { return false }
  })
  const [unheldInvoiceNo, setUnheldInvoiceNo] = useState<string | null>(null)
  const [showReportIssue, setShowReportIssue] = useState(false)
  const [searchActive, setSearchActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('ss_cart')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const moreRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const firstName = user?.name?.trim().split(/\s+/)[0] ?? ''
  const greeting = getGreeting()

  const showProducts = searchActive || selectedCategory !== null

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.trim().toLowerCase()
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.sku?.toLowerCase().includes(q) ?? false)
    const matchesCategory = !selectedCategory || p.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  function handleCategorySelect(name: string) {
    setSelectedCategory((prev) => prev === name ? null : name)
    setSearchActive(false)
    setSearchQuery('')
  }

  function handleSearchFocus() {
    setSearchActive(true)
    setSelectedCategory(null)
  }

  function handleCancel() {
    setSearchActive(false)
    setSearchQuery('')
    setSelectedCategory(null)
  }

  function handleAddProduct(p: Product) {
    // Starting from an empty cart means a brand-new sale — drop any carried-over held invoice no.
    if (cart.length === 0) setUnheldInvoiceNo(null)
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === p.id)
      if (existing) return prev.map((i) => i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { product: p, quantity: 1, unitPrice: p.price }]
    })
    setShowInvoice(true)
  }

  // Resume a held sale: rebuild the cart from its items, drop the held record, open checkout.
  async function handleUnhold(order: Order) {
    const heldCart: CartItem[] = []
    for (const it of order.items ?? []) {
      const product = products.find((p) => p.id === it.product_id)
      if (product) heldCart.push({ product, quantity: it.quantity, unitPrice: it.unit_price })
    }
    if (cstoreShift?.id) {
      try {
        await deleteOrder(cstoreShift.id, order.id)
        qc.invalidateQueries({ queryKey: ['shifts', cstoreShift.id, 'orders'] })
      } catch {}
    }
    setUnheldInvoiceNo(order.invoice_no ?? null)
    setCart(heldCart)
    setShowInvoice(true)
  }

  useEffect(() => {
    try { localStorage.setItem('ss_cart', JSON.stringify(cart)) } catch {}
  }, [cart])

  useEffect(() => {
    try { localStorage.setItem('ss_show_invoice', String(showInvoice)) } catch {}
  }, [showInvoice])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleStartShift = useCallback(async () => {
    if (!user?.id) return
    // If a shift already exists, just enter it — never create a duplicate
    if (cstoreShift) {
      setShiftStarted(true)
      return
    }
    const now = new Date()
    const date = now.toISOString().slice(0, 10)
    const startTime = now.toTimeString().slice(0, 5)
    await createCStoreShift({ supervisor_id: user.id, date, start_time: startTime })
    await qc.invalidateQueries({ queryKey: ['shifts', 'open', 'convenience'] })
    setShiftStarted(true)
  }, [user?.id, qc, cstoreShift])

  // While we're still checking for an open shift, show nothing (avoids "Inactive" flash)
  if (cstoreLoading) return null

  // If an open shift exists, go straight to the dashboard — no idle screen needed
  if (!cstoreShift && !shiftStarted) {
    return <CashierIdleView cstoreShiftOpen={false} onStart={handleStartShift} />
  }

  const btnClass = 'px-5 py-2.5 border border-[#ddd] rounded-xl text-[13px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors'

  if (showInvoice) {
    return (
      <div className="flex h-full overflow-hidden">
        <InvoiceView
          cart={cart}
          initialInvoiceNo={unheldInvoiceNo ?? undefined}
          onUpdateCart={setCart}
          onReturn={() => { setShowInvoice(false); setUnheldInvoiceNo(null) }}
          onCancel={() => { setCart([]); setShowInvoice(false); setUnheldInvoiceNo(null) }}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Main column ── */}
      <div className="flex-[3] min-w-0 flex flex-col overflow-hidden">
        <div className="p-6 flex flex-col gap-5 flex-shrink-0">

          {/* Greeting + actions */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h1 className="text-[22px] font-bold text-[#111]">{greeting}{firstName ? `, ${firstName}` : ''}</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => cart.length > 0 && setShowInvoice(true)}
                className={`${btnClass} flex items-center gap-2 ${cart.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <ShoppingBag size={15} />
                <span>{cart.reduce((s, i) => s + i.quantity, 0)}</span>
              </button>
              <button onClick={() => setView('add')} className={btnClass}>Add a ...</button>
              <button className={`${btnClass} hidden min-[416px]:block`}>End shift</button>
              <div ref={moreRef} className="relative">
                <button onClick={() => setMoreOpen((o) => !o)} className={btnClass}>
                  <MoreHorizontal size={15} />
                </button>
                {moreOpen && (
                  <div className="absolute right-0 top-full mt-1.5 bg-white border border-[#e8e8e8] rounded-2xl shadow-lg overflow-hidden min-w-[160px] z-50">
                    <button
                      onClick={() => { setMoreOpen(false); setShowReportIssue(true) }}
                      className="w-full text-left px-4 py-2.5 text-[12px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors"
                    >
                      Report an issue
                    </button>
                    <button
                      className="w-full text-left px-4 py-2.5 text-[12px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors min-[416px]:hidden"
                    >
                      End shift
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* POS search + categories */}
          <div className="bg-white rounded-2xl border border-[#ebebeb] p-6">
            <div className={`flex items-center gap-3 border rounded-xl px-4 py-3 mb-6 transition-colors ${searchActive ? 'border-[#aaa]' : 'border-[#e0e0e0]'}`}>
              <Search size={15} className="text-[#bbb] flex-shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={handleSearchFocus}
                placeholder="Search products or scan an item"
                className="flex-1 text-[13px] font-medium text-[#333] placeholder:text-[#bbb] placeholder:font-normal focus:outline-none bg-transparent"
              />
              {showProducts && (
                <button
                  onMouseDown={(e) => { e.preventDefault(); handleCancel() }}
                  className="text-[12px] font-semibold text-[#888] hover:text-[#111] transition-colors flex-shrink-0"
                >
                  Cancel
                </button>
              )}
            </div>
            <CategoriesRow selected={selectedCategory} onSelect={handleCategorySelect} />
          </div>
        </div>

        {/* Products panel — shown when search active or category selected */}
        {showProducts && (
          <div className="flex-1 overflow-y-auto scrollbar-hide px-6 pb-6" style={{ scrollbarWidth: 'none' }}>
            <div className="bg-white rounded-2xl border border-[#ebebeb] h-full flex flex-col">
              <div className="px-5 py-4 border-b border-[#f0f0f0] flex items-center justify-between flex-shrink-0">
                <div>
                  <span className="text-[13px] font-bold text-[#111]">Products</span>
                  {selectedCategory && <span className="text-[13px] font-medium text-[#aaa]"> | {categories.find(c => c.name === selectedCategory)?.label.replace('\n', ' ')}</span>}
                  {searchQuery && <span className="text-[13px] font-medium text-[#aaa]"> | "{searchQuery}"</span>}
                </div>
                <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">{filteredProducts.length} {filteredProducts.length === 1 ? 'result' : 'results'}</p>
              </div>
              {filteredProducts.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-[13px] font-medium text-[#bbb]">
                    {searchQuery ? `No products matching "${searchQuery}"` : 'No products in this category'}
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 min-[500px]:grid-cols-3 gap-3 content-start" style={{ scrollbarWidth: 'none' }}>
                  {filteredProducts.map((p) => (
                    <ProductCard key={p.id} product={p} onAdd={handleAddProduct} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sales | Recent Activity — hidden when products panel is shown */}
        {!showProducts && (
          <div className="flex-1 overflow-y-auto scrollbar-hide px-6 pb-6" style={{ scrollbarWidth: 'none' }}>
            <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden h-full flex flex-col">
              <div className="px-5 py-4 border-b border-[#f0f0f0]">
                <span className="text-[13px] font-bold text-[#111]">Sales</span>
                <span className="text-[13px] font-medium text-[#aaa]"> | Recent Activity</span>
              </div>

              <div className="grid grid-cols-[1fr_1.4fr_1.1fr_1fr_1fr_32px] gap-3 px-5 py-2 border-b border-[#f4f4f4]">
                {['#', 'Time', 'Amount', 'Status', 'Method', ''].map((h, i) => (
                  <p key={i} className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
                ))}
              </div>

              {orders.length === 0 ? (
                <div className="flex-1 px-5 py-8 flex items-center justify-center">
                  <p className="text-[13px] font-medium text-[#bbb]">No sales recorded yet</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                  {[...orders].reverse().map((o) => {
                    const time = new Date(o.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                    const statusStyle =
                      o.status === 'paid'   ? 'text-green-600 bg-green-50' :
                      o.status === 'voided' ? 'text-red-500 bg-red-50'    :
                      o.status === 'credit' ? 'text-blue-600 bg-blue-50'  :
                                              'text-amber-600 bg-amber-50'
                    return (
                      <div key={o.id} className="grid grid-cols-[1fr_1.4fr_1.1fr_1fr_1fr_32px] gap-3 items-center px-5 py-2.5 border-b border-[#f4f4f4] last:border-b-0 group">
                        <p className="text-[11px] font-bold text-[#888] truncate">{o.invoice_no ?? `#${String(o.order_no).padStart(4, '0')}`}</p>
                        <p className="text-[12px] font-semibold text-[#888]">{time}</p>
                        <p className="text-[12px] font-semibold text-[#111]">{fmt(o.total)}</p>
                        <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 capitalize w-fit ${statusStyle}`}>
                          {o.status}
                        </span>
                        <p className="text-[12px] font-semibold text-[#888] truncate">{o.payment_method ?? '--'}</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setOrderMenuPos({ orderId: o.id, anchor: e.currentTarget.getBoundingClientRect() })
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[#f4f4f4] text-[#bbb] hover:text-[#555]"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {(() => {
                const total = orders.reduce((s, o) => s + o.total, 0)
                return (
                  <div className="px-5 py-3 border-t border-[#f0f0f0] flex items-center justify-between">
                    <button
                      onClick={() => navigate({ to: '/convenience/sales' })}
                      className="text-[12px] font-semibold text-[#888] hover:text-[#111] transition-colors"
                    >
                      view all
                    </button>
                    <div className="flex items-center gap-6">
                      <p className={`text-[13px] font-bold ${orders.length > 0 ? 'text-[#333]' : 'text-[#bbb]'}`}>{orders.length}</p>
                      <p className={`text-[13px] font-bold ${total > 0 ? 'text-[#111]' : 'text-[#bbb]'}`}>{fmt(total)}</p>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

      </div>

      {/* ── Right column ── */}
      <div className="hidden min-[900px]:flex flex-col flex-[2] min-w-0 border-l border-[#e8e8e8] overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>

        {/* Customers | Outstanding Balances */}
        {(() => {
          const outstanding = customers
            .filter((c) => c.credit_balance > 0)
            .sort((a, b) => b.credit_balance - a.credit_balance)
          const totalOutstanding = outstanding.reduce((s, c) => s + c.credit_balance, 0)
          return (
            <div className="flex-[3] flex flex-col border-b border-[#e8e8e8]">
              <div className="flex-1 p-5">
                <p className="mb-4">
                  <span className="text-[13px] font-bold text-[#111]">Customers</span>
                  <span className="text-[13px] font-medium text-[#aaa]"> | Outstanding Balances</span>
                </p>
                <div className="grid grid-cols-[28px_1fr_auto] gap-3 mb-2">
                  <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">#</p>
                  <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">Name</p>
                  <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase text-right">Amount</p>
                </div>
                {outstanding.length === 0 ? (
                  <div className="py-6 flex items-center justify-center">
                    <p className="text-[13px] font-medium text-[#bbb]">No outstanding balances</p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {outstanding.slice(0, 5).map((c, i) => (
                      <div key={c.id} className="grid grid-cols-[28px_1fr_auto] gap-3 items-center py-1.5 border-b border-[#f4f4f4] last:border-b-0">
                        <p className="text-[12px] font-bold text-[#ccc]">{i + 1}</p>
                        <p className="text-[13px] font-semibold text-[#111] truncate">{c.name}</p>
                        <p className="text-[13px] font-semibold text-[#c0392b] text-right">{fmt(c.credit_balance)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-[#f0f0f0] px-5 py-3">
                <button
                  onClick={() => navigate({ to: '/convenience/accounts' })}
                  className="text-[12px] font-semibold text-[#888] hover:text-[#111] transition-colors"
                >
                  view all
                </button>
                <p className={`text-[13px] font-bold ${totalOutstanding > 0 ? 'text-[#c0392b]' : 'text-[#bbb]'}`}>
                  {fmt(totalOutstanding)}
                </p>
              </div>
            </div>
          )
        })()}

        {/* Expenditures */}
        <div className="flex-[2] flex flex-col border-b border-[#e8e8e8]">
          <div className="p-5 flex-1">
            <p className="mb-3">
              <span className="text-[13px] font-bold text-[#111]">Expenditures</span>
              <span className="text-[13px] font-medium text-[#aaa]"> | Cash</span>
            </p>
            {/* Column headers */}
            <div className="grid grid-cols-[24px_1fr_auto_28px] gap-2 mb-1">
              <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">#</p>
              <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">Description</p>
              <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase text-right">Amount</p>
              <span />
            </div>
            {(() => {
              const expenditures = deposits.filter((d) => d.type === 'Expenditure')
              if (expenditures.length === 0) {
                return (
                  <div className="py-4 flex items-center justify-center">
                    <p className="text-[13px] font-medium text-[#bbb]">No expenditures</p>
                  </div>
                )
              }
              return (
                <div className="flex flex-col">
                  {expenditures.slice(0, 3).map((d, i) => {
                    let meta: Record<string, unknown> = {}
                    try { meta = JSON.parse(d.metadata ?? '{}') } catch {}
                    const desc = String(meta.description ?? '')
                    return (
                      <div key={d.id} className="grid grid-cols-[24px_1fr_auto_28px] gap-2 items-center py-1.5 border-b border-[#f4f4f4] last:border-b-0 group">
                        <p className="text-[12px] font-bold text-[#ccc]">{i + 1}</p>
                        <p className="text-[13px] font-semibold text-[#111] truncate">{desc || '—'}</p>
                        <p className="text-[13px] font-semibold text-[#333] text-right">{fmt(d.amount)}</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpMenuPos({ depositId: d.id, anchor: e.currentTarget.getBoundingClientRect() })
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[#f4f4f4] text-[#bbb] hover:text-[#555]"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
          <div className="flex items-center justify-between border-t border-[#f0f0f0] px-5 py-3">
            <button onClick={() => setView('expenditure')} className="text-[12px] font-semibold text-[#888] hover:text-[#111] transition-colors">+ add</button>
            <p className={`text-[13px] font-bold ${deposits.filter((d) => d.type === 'Expenditure').reduce((s, d) => s + d.amount, 0) > 0 ? 'text-red-500' : 'text-[#bbb]'}`}>
              {(() => {
                const t = deposits.filter((d) => d.type === 'Expenditure').reduce((s, d) => s + d.amount, 0)
                return t > 0 ? `-${fmt(t)}` : fmt(0)
              })()}
            </p>
          </div>
        </div>


        {/* Sales | Held Receipts */}
        {(() => {
          const heldOrders = orders.filter((o) => o.status === 'held')
          const heldTotal = heldOrders.reduce((s, o) => s + o.total, 0)
          return (
            <div className="p-5">
              <p className="mb-4">
                <span className="text-[13px] font-bold text-[#111]">Sales</span>
                <span className="text-[13px] font-medium text-[#aaa]"> | Held Receipts</span>
              </p>
              <p className={`text-[36px] font-bold leading-none tracking-tight mb-4 ${heldTotal > 0 ? 'text-[#111]' : 'text-[#bbb]'}`}>
                {fmt(heldTotal)}
              </p>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    try { sessionStorage.setItem('ss_expand_held', '1') } catch {}
                    navigate({ to: '/convenience/sales' })
                  }}
                  className="text-[12px] font-semibold text-[#888] hover:text-[#111] transition-colors"
                >
                  view all
                </button>
                <p className={`text-[13px] font-bold ${heldOrders.length > 0 ? 'text-[#333]' : 'text-[#bbb]'}`}>
                  {heldOrders.length}
                </p>
              </div>
            </div>
          )
        })()}

      </div>

      {/* Modals */}
      {view === 'add' && <AddModal onClose={() => setView(null)} />}

      {view === 'expenditure' && (
        <ExpenditureModal
          hideBack
          onBack={() => setView(null)}
          onClose={() => setView(null)}
          shiftId={cstoreShift?.id}
        />
      )}

      {view === 'cash-deposit' && (
        <CashDepositModal
          initialAttendant=""
          onBack={() => setView(null)}
          onClose={() => setView(null)}
          shiftId={shift?.id}
        />
      )}

      {view === 'deposit' && (
        <DepositModal
          onBack={() => setView(null)}
          onClose={() => setView(null)}
          shiftId={shift?.id}
        />
      )}
      {showReportIssue && (
        <ReportIssueModal onClose={() => setShowReportIssue(false)} />
      )}

      {settleOrder && cstoreShift && (
        <SettleCreditModal
          order={settleOrder}
          shiftId={cstoreShift.id}
          onClose={() => setSettleOrder(null)}
        />
      )}

      {/* Expenditure row dropdown — portal so it renders above everything */}
      {expMenuPos && (() => {
        const dep = deposits.find((d) => d.id === expMenuPos.depositId)
        if (!dep) return null
        let meta: Record<string, unknown> = {}
        try { meta = JSON.parse(dep.metadata ?? '{}') } catch {}
        const expRow: ExpenditureRow = {
          type: 'expenditure',
          id: 1,
          depositId: dep.id,
          requestedBy: dep.attendant_name,
          description: String(meta.description ?? ''),
          amount: dep.amount,
          denominations: meta.denominations as Record<number, number> | undefined,
        }
        const anchor = expMenuPos.anchor
        const menuHeight = 148
        const up = window.innerHeight - anchor.bottom < menuHeight
        return createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setExpMenuPos(null)} />
            <div
              className="fixed z-50 bg-white border border-[#e8e8e8] rounded-2xl shadow-lg overflow-hidden min-w-[160px]"
              style={up
                ? { bottom: window.innerHeight - anchor.top + 4, right: window.innerWidth - anchor.right }
                : { top: anchor.bottom + 4, right: window.innerWidth - anchor.right }}
            >
              {[
                { label: 'View receipt', icon: FileText },
                { label: 'View details', icon: Eye },
                { label: 'Edit', icon: Pencil },
                { label: 'Delete', icon: Trash2, danger: true },
              ].map(({ label, icon: Icon, danger }) => (
                <button
                  key={label}
                  onClick={() => {
                    setExpMenuPos(null)
                    if (label === 'View receipt') setReceiptExp(expRow)
                    if (label === 'View details') setViewingExp(expRow)
                    if (label === 'Edit') setEditingExp(expRow)
                    if (label === 'Delete' && cstoreShift?.id) {
                      deleteDeposit(cstoreShift.id, dep.id).then(() =>
                        qc.invalidateQueries({ queryKey: ['shifts', cstoreShift.id, 'deposits'] })
                      )
                    }
                  }}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-semibold transition-colors text-left ${danger ? 'text-red-500 hover:bg-red-50' : 'text-[#333] hover:bg-[#f9f9f9]'}`}
                >
                  <Icon size={13} className="flex-shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </>,
          document.body
        )
      })()}

      {/* Order row dropdown — portal so it renders above everything */}
      {orderMenuPos && (() => {
        const order = orders.find((o) => o.id === orderMenuPos.orderId)
        if (!order) return null
        const anchor = orderMenuPos.anchor
        const menuHeight = (order.status === 'held' || order.status === 'credit') ? 140 : 100
        const up = window.innerHeight - anchor.bottom < menuHeight
        return createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOrderMenuPos(null)} />
            <div
              className="fixed z-50 bg-white border border-[#e8e8e8] rounded-2xl shadow-lg overflow-hidden min-w-[160px]"
              style={up
                ? { bottom: window.innerHeight - anchor.top + 4, right: window.innerWidth - anchor.right }
                : { top: anchor.bottom + 4, right: window.innerWidth - anchor.right }}
            >
              {order.status === 'held' && (
                <button
                  onClick={() => {
                    setOrderMenuPos(null)
                    handleUnhold(order)
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors text-left"
                >
                  <Play size={13} className="flex-shrink-0" />
                  Unhold
                </button>
              )}
              {order.status === 'credit' && (
                <button
                  onClick={() => {
                    setOrderMenuPos(null)
                    setSettleOrder(order)
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors text-left"
                >
                  <Check size={13} className="flex-shrink-0" />
                  Mark as paid
                </button>
              )}
              <button
                onClick={() => {
                  setOrderMenuPos(null)
                  printOrderReceipt(order, user?.business_name)
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors text-left"
              >
                <Printer size={13} className="flex-shrink-0" />
                Print receipt
              </button>
              <button
                onClick={() => {
                  setOrderMenuPos(null)
                  if (cstoreShift?.id && order.status !== 'voided') {
                    updateOrderStatus(cstoreShift.id, order.id, 'voided').then(() => {
                      qc.invalidateQueries({ queryKey: ['shifts', cstoreShift.id, 'orders'] })
                      qc.invalidateQueries({ queryKey: ['products'] })
                      qc.invalidateQueries({ queryKey: ['customers'] })
                    })
                  }
                }}
                disabled={order.status === 'voided'}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-semibold text-red-500 hover:bg-red-50 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Ban size={13} className="flex-shrink-0" />
                {order.status === 'voided' ? 'Voided' : 'Void'}
              </button>
            </div>
          </>,
          document.body
        )
      })()}

      {editingExp && (
        <ExpenditureModal
          hideBack
          isEditing
          depositId={editingExp.depositId}
          initialData={{ requestedBy: editingExp.requestedBy, description: editingExp.description, denominations: editingExp.denominations }}
          onBack={() => setEditingExp(null)}
          onClose={() => setEditingExp(null)}
          shiftId={cstoreShift?.id}
        />
      )}
      {viewingExp && (
        <ViewDetailsModal
          row={viewingExp}
          onClose={() => setViewingExp(null)}
          onEdit={() => { setEditingExp(viewingExp); setViewingExp(null) }}
        />
      )}
      {receiptExp && (
        <ExpenditureReceiptModal
          row={receiptExp}
          onClose={() => setReceiptExp(null)}
        />
      )}
    </div>
  )
}
