import { useState, useRef, useEffect } from 'react'
import { MoreHorizontal, Search, GlassWater, Candy, Utensils, Home, Wrench, Snowflake, Flame, ChevronLeft, ChevronRight, Cigarette, Smartphone, Plus, ShoppingBag } from 'lucide-react'
import { useAuth } from '../../lib/authContext'
import { useOpenShift, useShiftDeposits, useProducts } from '../../hooks/useApi'
import type { Product } from '../../lib/api'
import { CashDepositModal } from './CashDropModal'
import { DepositModal } from './DepositModal'
import { ReportIssueModal } from './ReportIssueModal'
import { AddModal } from './AddModal'
import { InvoiceView, type CartItem } from './InvoiceView'

type View = 'add' | 'cash-deposit' | 'deposit' | null

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

export function CashierDashboard() {
  const { user } = useAuth()
  const { data: shift } = useOpenShift()
  const { data: deposits = [] } = useShiftDeposits(shift?.id)
  const { data: products = [] } = useProducts()
  const [view, setView] = useState<View>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [showInvoice, setShowInvoice] = useState(() => {
    try { return localStorage.getItem('ss_show_invoice') === 'true' } catch { return false }
  })
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
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === p.id)
      if (existing) return prev.map((i) => i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { product: p, quantity: 1, unitPrice: p.price }]
    })
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

  const btnClass = 'px-5 py-2.5 border border-[#ddd] rounded-xl text-[13px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors'

  if (showInvoice) {
    return (
      <div className="flex h-full overflow-hidden">
        <InvoiceView
          cart={cart}
          onUpdateCart={setCart}
          onReturn={() => setShowInvoice(false)}
          onCancel={() => { setCart([]); setShowInvoice(false) }}
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
                  <div className="absolute right-0 top-full mt-1 bg-white border border-[#e0e0e0] rounded-xl shadow-lg py-1 min-w-[160px] z-50">
                    <button
                      onClick={() => { setMoreOpen(false); setShowReportIssue(true) }}
                      className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors"
                    >
                      Report an issue
                    </button>
                    <button
                      className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors min-[416px]:hidden"
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

              <div className="flex-1 px-5 py-8 flex items-center justify-center">
                <p className="text-[13px] font-medium text-[#bbb]">No sales recorded yet</p>
              </div>

              <div className="px-5 py-3 border-t border-[#f0f0f0] flex items-center justify-between">
                <button className="text-[12px] font-semibold text-[#888] hover:text-[#111] transition-colors">view all</button>
                <div className="flex items-center gap-6">
                  <p className="text-[13px] font-bold text-[#bbb]">0</p>
                  <p className="text-[13px] font-bold text-[#bbb]">J$0.00</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Right column ── */}
      <div className="hidden min-[900px]:flex flex-col flex-[2] min-w-0 border-l border-[#e8e8e8] overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>

        {/* Customers | Outstanding Balances */}
        <div className="p-5 border-b border-[#e8e8e8]">
          <p className="mb-4">
            <span className="text-[13px] font-bold text-[#111]">Customers</span>
            <span className="text-[13px] font-medium text-[#aaa]"> | Outstanding Balances</span>
          </p>
          <div className="grid grid-cols-[28px_1fr_auto] gap-3 mb-2">
            <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">#</p>
            <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">Name</p>
            <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase text-right">Amount</p>
          </div>
          <div className="py-6 flex items-center justify-center">
            <p className="text-[13px] font-medium text-[#bbb]">No outstanding balances</p>
          </div>
          <div className="flex items-center justify-between border-t border-[#f0f0f0] pt-3">
            <button className="text-[12px] font-semibold text-[#888] hover:text-[#111] transition-colors">view all</button>
            <p className="text-[13px] font-bold text-[#bbb]">J$0.00</p>
          </div>
        </div>

        {/* Expenditures */}
        <div className="p-5 border-b border-[#e8e8e8]">
          <p className="mb-4">
            <span className="text-[13px] font-bold text-[#111]">Expenditures</span>
            <span className="text-[13px] font-medium text-[#aaa]"> | Cash</span>
          </p>
          {(() => {
            const expenditures = deposits.filter((d) => d.type === 'Expenditure')
            const expenditureTotal = expenditures.reduce((s, d) => s + d.amount, 0)
            return (
              <>
                {expenditures.length === 0 ? (
                  <div className="py-4 flex items-center justify-center">
                    <p className="text-[13px] font-medium text-[#bbb]">No expenditures</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 mb-3">
                    {expenditures.slice(0, 3).map((d) => (
                      <div key={d.id} className="flex items-center justify-between py-1.5">
                        <p className="text-[13px] font-semibold text-[#111]">{d.attendant_name}</p>
                        <p className="text-[13px] font-semibold text-[#333]">{fmt(d.amount)}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-[#f0f0f0] pt-3">
                  <span />
                  <p className={`text-[13px] font-bold ${expenditureTotal > 0 ? 'text-red-500' : 'text-[#bbb]'}`}>
                    {expenditureTotal > 0 ? `-${fmt(expenditureTotal)}` : fmt(0)}
                  </p>
                </div>
              </>
            )
          })()}
        </div>

        {/* Loyalty | Points Leaderboard */}
        <div className="p-5 border-b border-[#e8e8e8]">
          <p className="mb-4">
            <span className="text-[13px] font-bold text-[#111]">Loyalty Points</span>
            <span className="text-[13px] font-medium text-[#aaa]"> | Leaderboard</span>
          </p>
          <div className="grid grid-cols-[20px_1fr_auto] gap-3 mb-2">
            <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">#</p>
            <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">Customer</p>
            <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase text-right">Points</p>
          </div>
          {/* TODO: wire to real loyalty data */}
          <div className="py-4 flex items-center justify-center">
            <p className="text-[13px] font-medium text-[#bbb]">No loyalty data yet</p>
          </div>
          <div className="flex items-center justify-between border-t border-[#f0f0f0] pt-3">
            <button className="text-[12px] font-semibold text-[#888] hover:text-[#111] transition-colors">view all</button>
            <p className="text-[13px] font-bold text-[#bbb]">0 customers</p>
          </div>
        </div>

        {/* Sales | Held Receipts */}
        <div className="p-5">
          <p className="mb-4">
            <span className="text-[13px] font-bold text-[#111]">Sales</span>
            <span className="text-[13px] font-medium text-[#aaa]"> | Held Receipts</span>
          </p>
          <p className="text-[36px] font-bold text-[#bbb] leading-none tracking-tight mb-4">J$0.00</p>
          <button className="text-[12px] font-semibold text-[#888] hover:text-[#111] transition-colors">view all</button>
        </div>

      </div>

      {/* Modals */}
      {view === 'add' && <AddModal onClose={() => setView(null)} />}

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
    </div>
  )
}
