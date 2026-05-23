import { useState, useEffect, useRef } from 'react'
import { Trash2, ArrowLeft, Search, Printer, ChevronDown, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/authContext'
import { useOpenCStoreShift, useProducts, useCustomers } from '../../hooks/useApi'
import { createOrder, type Order } from '../../lib/api'
import type { Product } from '../../lib/api'
import { fmtInput, parseInput } from '../../lib/fmt'
import { printOrderReceipt } from '../../lib/printReceipt'

const DENOMINATIONS = [5000, 2000, 1000, 500, 100, 50, 20, 10, 5, 1]

export interface CartItem {
  product: Product
  quantity: number
  unitPrice: number
}

interface Props {
  cart: CartItem[]
  onUpdateCart: (cart: CartItem[]) => void
  onReturn: () => void
  onCancel: () => void
  initialInvoiceNo?: string
}

function fmt(n: number) {
  return 'J$ ' + n.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const CURRENCIES = [
  { code: 'JMD', symbol: 'J$',  rate: 1        },
  { code: 'USD', symbol: 'US$', rate: 0.0064   },
  { code: 'CAD', symbol: 'CA$', rate: 0.0088   },
  { code: 'GBP', symbol: '£',   rate: 0.0051   },
  { code: 'EUR', symbol: '€',   rate: 0.0059   },
]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function genInvoiceNo() {
  const a = String(Math.floor(Math.random() * 900) + 100)
  const b = String(Math.floor(Math.random() * 9000) + 1000)
  return `INV - ${a} ${b}`
}

const TAX_RATE = 0.15
const MOCK_PROMO: Record<string, number> = { SAVE10: 0.10, DISC20: 0.20 }
const POINTS_PER_DOLLAR = 1

// ── Customer Combobox ─────────────────────────────────────────────────────────

function CustomerCombobox({ value, onChange, customers }: {
  value: string
  onChange: (v: string) => void
  customers: string[]
}) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const ref               = useRef<HTMLDivElement>(null)
  const inputRef          = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const filtered = customers.filter((c) =>
    !query || c.toLowerCase().includes(query.toLowerCase())
  )

  function select(name: string) {
    onChange(name)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="relative w-44" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-1.5 bg-[#f4f4f4] rounded-lg px-3 py-1.5 focus:outline-none hover:bg-[#ebebeb] transition-colors"
      >
        <span className={`text-[12px] font-semibold truncate ${value ? 'text-[#333]' : 'text-[#bbb] font-normal'}`}>
          {value || 'Optional'}
        </span>
        {value ? (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onChange('') }}
            className="text-[#bbb] hover:text-[#555] transition-colors flex-shrink-0"
          >
            <X size={12} />
          </span>
        ) : (
          <ChevronDown size={12} className="text-[#bbb] flex-shrink-0" />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-[#e8e8e8] rounded-2xl shadow-lg z-30 overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#f0f0f0]">
            <Search size={12} className="text-[#ccc] shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query.trim()) select(query.trim())
                if (e.key === 'Escape') { setOpen(false); setQuery('') }
              }}
              placeholder="Search or type name…"
              className="flex-1 text-[12px] font-medium text-[#333] placeholder-[#ccc] outline-none bg-transparent"
            />
          </div>

          <div className="max-h-52 overflow-y-auto">
            {/* "Use typed name" row when query doesn't match any existing */}
            {query.trim() && !filtered.some((c) => c.toLowerCase() === query.trim().toLowerCase()) && (
              <button
                onClick={() => select(query.trim())}
                className="w-full px-4 py-2.5 text-left flex items-center gap-2 hover:bg-[#f9f9f9] transition-colors border-b border-[#f8f8f8]"
              >
                <span className="text-[11px] font-bold text-[#bbb] uppercase tracking-wide shrink-0">New</span>
                <span className="text-[12px] font-semibold text-[#111] truncate">"{query.trim()}"</span>
              </button>
            )}

            {filtered.length === 0 && !query.trim() && (
              <p className="px-4 py-3 text-[12px] text-[#bbb]">No customers yet</p>
            )}

            {filtered.map((c) => (
              <button
                key={c}
                onClick={() => select(c)}
                className={`w-full px-4 py-2.5 text-left text-[12px] font-semibold hover:bg-[#f9f9f9] transition-colors ${
                  value === c ? 'text-[#111] bg-[#f4f4f4]' : 'text-[#333]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function InvoiceView({ cart, onUpdateCart, onReturn, onCancel, initialInvoiceNo }: Props) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data: cstoreShift }   = useOpenCStoreShift()
  const { data: customers = [] } = useCustomers()

  const [invoiceNo]           = useState(() => initialInvoiceNo ?? genInvoiceNo())
  const [date]                = useState(todayISO)
  const [customerName, setCustomerName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null)

  const [promoCode, setPromoCode]           = useState('')
  const [promoApplied, setPromoApplied]     = useState(false)
  const [promoError, setPromoError]         = useState('')
  const [currencyCode, setCurrencyCode]     = useState('JMD')
  const [menuOpen, setMenuOpen]             = useState(false)
  const [addingItem, setAddingItem]         = useState(false)
  const [checkoutStep, setCheckoutStep] = useState<null | 'method' | 'cash'>(null)
  const [cashCounts, setCashCounts]     = useState<Record<number, string>>({})
  const [itemSearch, setItemSearch]     = useState('')
  const menuRef                         = useRef<HTMLDivElement>(null)
  const addItemRef                      = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  useEffect(() => {
    if (!addingItem) return
    function handleClick(e: MouseEvent) {
      if (addItemRef.current && !addItemRef.current.contains(e.target as Node)) {
        setAddingItem(false)
        setItemSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [addingItem])

  // Keep quantities editable per row
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(cart.map((item) => [item.product.id, item.quantity]))
  )
  const [prices, setPrices] = useState<Record<string, number>>(() =>
    Object.fromEntries(cart.map((item) => [item.product.id, item.unitPrice]))
  )

  useEffect(() => {
    // sync any new products added from outside
    setQuantities((prev) => {
      const next = { ...prev }
      for (const item of cart) {
        if (!(item.product.id in next)) next[item.product.id] = item.quantity
      }
      return next
    })
    setPrices((prev) => {
      const next = { ...prev }
      for (const item of cart) {
        if (!(item.product.id in next)) next[item.product.id] = item.unitPrice
      }
      return next
    })
  }, [cart.length])

  function setQty(id: string, val: string) {
    const n = parseInt(val, 10)
    if (!isNaN(n) && n >= 1) setQuantities((p) => ({ ...p, [id]: n }))
  }

  function setPrice(id: string, val: string) {
    const n = parseFloat(val)
    if (!isNaN(n) && n >= 0) setPrices((p) => ({ ...p, [id]: n }))
  }

  function removeItem(id: string) {
    const next = cart.filter((i) => i.product.id !== id)
    onUpdateCart(next)
  }

  function applyPromo() {
    const code = promoCode.trim().toUpperCase()
    if (MOCK_PROMO[code] !== undefined) {
      setPromoApplied(true)
      setPromoError('')
    } else {
      setPromoError('Invalid promo code.')
      setPromoApplied(false)
    }
  }

  const { data: allProducts = [] } = useProducts()
  const searchedProducts = allProducts.filter((p) =>
    p.active && (
      !itemSearch ||
      p.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      (p.sku?.toLowerCase().includes(itemSearch.toLowerCase()) ?? false)
    )
  )

  function addItemToCart(product: Product) {
    const existing = cart.find((i) => i.product.id === product.id)
    if (existing) {
      setQuantities((p) => ({ ...p, [product.id]: (p[product.id] ?? existing.quantity) + 1 }))
      onUpdateCart(cart.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i))
    } else {
      setPrices((p) => ({ ...p, [product.id]: product.price }))
      setQuantities((p) => ({ ...p, [product.id]: 1 }))
      onUpdateCart([...cart, { product, quantity: 1, unitPrice: product.price }])
    }
    setItemSearch('')
    setAddingItem(false)
  }

  const currency      = CURRENCIES.find((c) => c.code === currencyCode) ?? CURRENCIES[0]
  const fmtC          = (jmd: number) => {
    const v = jmd * currency.rate
    return currency.symbol + ' ' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const lineTotal     = (id: string) => (quantities[id] ?? 1) * (prices[id] ?? 0)
  const subtotal      = cart.reduce((s, i) => s + lineTotal(i.product.id), 0)
  const tax           = subtotal * TAX_RATE
  const promoDiscount = promoApplied ? subtotal * (MOCK_PROMO[promoCode.toUpperCase()] ?? 0) : 0
  const grandTotal    = subtotal + tax - promoDiscount
  const pointsEarned  = Math.floor(grandTotal * POINTS_PER_DOLLAR)

  async function handleCheckout(paymentMethod: string, changeGiven?: number | null) {
    if (!cstoreShift?.id) { setError('No open convenience store shift.'); return }
    if (cart.length === 0) return
    setLoading(true)
    setError('')
    setCheckoutStep(null)
    try {
      const order = await createOrder(cstoreShift.id, {
        cashier_name:   user?.name ?? '',
        customer_name:  customerName.trim() || null,
        payment_method: paymentMethod,
        subtotal,
        discount:       promoDiscount,
        tax,
        total:          grandTotal,
        change_given:   changeGiven ?? null,
        invoice_no:     invoiceNo,
        status:         paymentMethod === 'Credit' ? 'credit' : 'paid',
        items: cart.map((item) => ({
          product_id: item.product.id,
          name:       item.product.name,
          sku:        item.product.sku,
          quantity:   quantities[item.product.id] ?? item.quantity,
          unit_price: prices[item.product.id] ?? item.unitPrice,
          discount:   0,
          total:      lineTotal(item.product.id),
        })),
      })
      qc.invalidateQueries({ queryKey: ['shifts', cstoreShift.id, 'orders'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['customers'] })
      setCompletedOrder(order)
      onUpdateCart([])
    } catch {
      setError('Failed to place order. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleHold() {
    setMenuOpen(false)
    if (!cstoreShift?.id) { setError('No open convenience store shift.'); return }
    if (cart.length === 0) return
    setLoading(true)
    setError('')
    try {
      await createOrder(cstoreShift.id, {
        cashier_name:   user?.name ?? '',
        customer_name:  customerName.trim() || null,
        payment_method: null,
        subtotal,
        discount:       promoDiscount,
        tax,
        total:          grandTotal,
        change_given:   null,
        invoice_no:     invoiceNo,
        status:         'held',
        items: cart.map((item) => ({
          product_id: item.product.id,
          name:       item.product.name,
          sku:        item.product.sku,
          quantity:   quantities[item.product.id] ?? item.quantity,
          unit_price: prices[item.product.id] ?? item.unitPrice,
          discount:   0,
          total:      lineTotal(item.product.id),
        })),
      })
      qc.invalidateQueries({ queryKey: ['shifts', cstoreShift.id, 'orders'] })
      onUpdateCart([])
      onReturn()
    } catch {
      setError('Failed to hold sale. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handlePrintReceipt() {
    if (!completedOrder) return
    printOrderReceipt(completedOrder, user?.business_name)
  }

  if (completedOrder) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
        <div className="text-center">
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-2">{completedOrder.invoice_no ?? `Order #${completedOrder.order_no}`}</p>
          <p className="text-[28px] font-bold text-[#111] mb-1">Order placed</p>
          <p className="text-[14px] text-[#888]">{fmtC(completedOrder.total)} · {completedOrder.payment_method ?? 'unpaid'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrintReceipt}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-semibold hover:bg-[#333] transition-colors"
          >
            <Printer size={14} />
            Print receipt
          </button>
          <button onClick={onReturn} className="px-6 py-2.5 border border-[#ddd] rounded-xl text-[13px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors">
            Return to dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Action bar ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0] flex-shrink-0">
        <button
          onClick={onReturn}
          className="flex items-center gap-2 px-5 py-2 border border-[#ddd] rounded-xl text-[13px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors"
        >
          <ArrowLeft size={13} />
          Go back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCheckoutStep('method')}
            disabled={loading || cart.length === 0 || !cstoreShift}
            className="px-5 py-2 border border-[#ddd] rounded-xl text-[13px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Proceed to checkout'}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-[minmax(0,_480px)_1fr] gap-5 items-start content-start" style={{ scrollbarWidth: 'none' }}>

        {/* Left — invoice meta */}
        <div className="flex flex-col gap-0 border border-[#e8e8e8] rounded-2xl overflow-hidden">

          <div className="p-6 border-b border-[#f0f0f0]">
            <div className="flex items-center justify-between mb-5">
              <p className="text-[26px] font-bold text-[#111] tracking-tight">{invoiceNo}</p>
              <div className="relative flex-shrink-0" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="w-8 h-8 border border-[#ddd] rounded-xl flex items-center justify-center text-[#555] hover:bg-[#f4f4f4] transition-colors text-[16px] font-bold"
                >
                  ···
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-40 bg-white dark:bg-[#1c1c1c] border border-[#e8e8e8] dark:border-[#2a2a2a] rounded-2xl shadow-lg dark:shadow-black/40 overflow-hidden z-10">
                    <button
                      onClick={handleHold}
                      disabled={cart.length === 0 || loading}
                      className="w-full px-4 py-2.5 text-left text-[12px] font-semibold text-[#333] dark:text-[#e0e0e0] hover:bg-[#f9f9f9] dark:hover:bg-[#272727] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Hold
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); onCancel() }}
                      className="w-full px-4 py-2.5 text-left text-[12px] font-semibold text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[13px] font-semibold text-[#888]">Customer</p>
                <CustomerCombobox
                  value={customerName}
                  onChange={setCustomerName}
                  customers={customers.map((cu) => cu.name)}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <p className="text-[13px] font-semibold text-[#888]">Date</p>
                <p className="text-[12px] font-semibold text-[#333]">{fmtDate(date)}</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] font-semibold text-[#888]">Currency</p>
              <select
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
                className="text-[12px] font-bold text-[#333] border border-[#ddd] rounded-lg px-3 py-1 focus:outline-none focus:border-[#aaa] transition-colors bg-white"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2 mb-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium text-[#888]">Subtotal</p>
                <p className="text-[13px] font-semibold text-[#333]">{fmtC(subtotal)}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium text-[#888]">Tax <span className="text-[11px]">(15%)</span></p>
                <p className="text-[13px] font-semibold text-[#333]">{fmtC(tax)}</p>
              </div>
              {promoDiscount > 0 && (
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-medium text-green-600">Promo <span className="text-[11px]">({promoCode.toUpperCase()})</span></p>
                  <p className="text-[13px] font-semibold text-green-600">-{fmtC(promoDiscount)}</p>
                </div>
              )}
            </div>

            <div className="border-t border-[#f0f0f0] pt-4 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-[#888]">Grand Total</p>
              <p className="text-[24px] font-bold text-[#111] tracking-tight">{fmtC(grandTotal)}</p>
            </div>

            {/* ── Promo Code ── */}
            <div className="border-t border-[#f0f0f0] pt-4 mt-4">
              <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mb-3">Promo Code</p>
              {promoApplied ? (
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-green-600">{promoCode.toUpperCase()} applied</span>
                  <button
                    onClick={() => { setPromoApplied(false); setPromoCode('') }}
                    className="text-[11px] font-semibold text-[#bbb] hover:text-red-400 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
                    placeholder="Enter code"
                    className="flex-1 border border-[#e0e0e0] rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[#333] focus:outline-none focus:border-[#aaa] transition-colors placeholder:text-[#bbb] placeholder:font-normal"
                  />
                  <button
                    onClick={applyPromo}
                    className="px-3 py-1.5 border border-[#ddd] rounded-lg text-[12px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors whitespace-nowrap"
                  >
                    Apply
                  </button>
                </div>
              )}
              {promoError && <p className="text-[11px] font-semibold text-red-400 mt-1.5">{promoError}</p>}
            </div>

            {/* ── Loyalty Points ── */}
            <div className="border-t border-[#f0f0f0] pt-4 mt-4 flex items-center justify-between">
              <p className="text-[13px] font-medium text-[#888]">Loyalty Points Earned</p>
              <span className="text-[13px] font-semibold text-[#333]">{pointsEarned.toLocaleString()} pts</span>
            </div>

            {error && <p className="text-[11px] font-semibold text-red-500 mt-3">{error}</p>}
          </div>
        </div>

        {/* Right — items */}
        <div className="border border-[#e8e8e8] rounded-2xl">
          <div className="px-5 py-4 border-b border-[#f0f0f0]">
            <p className="text-[13px] font-bold text-[#111]">Items</p>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_80px_100px_100px_36px] gap-3 px-5 py-2.5 border-b border-[#f4f4f4]">
            {['Name', 'Quantity', 'Price', 'Total', ''].map((h, i) => (
              <p key={i} className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
            ))}
          </div>

          {/* Rows */}
          {cart.map((item) => {
            const id  = item.product.id
            const qty = quantities[id] ?? item.quantity
            const prc = prices[id] ?? item.unitPrice
            const tot = qty * prc
            return (
              <div key={id} className="grid grid-cols-[1fr_80px_100px_100px_36px] gap-3 items-center px-5 py-3 border-b border-[#f4f4f4] last:border-b-0">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#111] truncate">{item.product.name}</p>
                  {item.product.sku && <p className="text-[11px] text-[#bbb]">{item.product.sku}</p>}
                </div>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(id, e.target.value)}
                  className="w-full border border-[#e0e0e0] rounded-lg px-2 py-1.5 text-[12px] font-semibold text-[#333] text-center focus:outline-none focus:border-[#aaa]"
                />
                <p className="text-[12px] font-semibold text-[#333]">{fmtC(prc)}</p>
                <p className="text-[12px] font-semibold text-[#111]">{fmtC(tot)}</p>
                <button
                  onClick={() => removeItem(id)}
                  className="w-7 h-7 border border-[#e0e0e0] rounded-lg flex items-center justify-center text-[#bbb] hover:text-red-400 hover:border-red-200 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )
          })}

          <div className="relative border-t border-[#f0f0f0]" ref={addItemRef}>
            {addingItem ? (
              <>
                <div className="flex items-center px-5 py-4 gap-3">
                  <input
                    autoFocus
                    type="text"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Search products..."
                    className="flex-1 text-[13px] font-semibold text-[#333] focus:outline-none placeholder:text-[#bbb] placeholder:font-normal"
                  />
                  <Search size={14} className="text-[#bbb] flex-shrink-0" />
                </div>
                <div className="absolute top-full left-0 right-0 bg-white border border-[#e8e8e8] rounded-2xl shadow-lg overflow-y-auto z-20 mt-1" style={{ maxHeight: 600 }}>
                  {searchedProducts.length === 0 ? (
                    <p className="px-5 py-4 text-[13px] text-[#bbb]">No products found</p>
                  ) : searchedProducts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addItemToCart(p)}
                      className="w-full flex items-center justify-between px-5 py-3 hover:bg-[#f9f9f9] transition-colors border-b border-[#f4f4f4] last:border-b-0 text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[#111] truncate">{p.name}</p>
                        {p.sku && <p className="text-[11px] text-[#bbb]">{p.sku}</p>}
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-[13px] font-semibold text-[#333]">{fmtC(p.price)}</p>
                        <p className="text-[11px] text-[#bbb]">{p.stock_qty} in stock</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <button
                onClick={() => setAddingItem(true)}
                className="w-full px-5 py-4 text-[13px] font-semibold text-[#888] text-center hover:bg-[#fafafa] transition-colors"
              >
                Scan or Add an item
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Payment Method Modal ── */}
      {checkoutStep === 'method' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
          onClick={() => setCheckoutStep(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-[340px] p-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-2">Checkout</p>
            <h2 className="text-[24px] font-bold text-[#111] mb-1">Payment Method</h2>
            <p className="text-[13px] text-[#888] mb-6">{fmtC(grandTotal)}</p>

            <div className="flex flex-col gap-3">
              {[
                { key: 'Cash',   label: 'Cash',   desc: 'Pay with physical cash' },
                { key: 'Card',   label: 'Card',   desc: 'Debit or credit card' },
                ...(customerName.trim()
                  ? [{ key: 'Credit', label: 'Credit', desc: 'Charge to customer account' }]
                  : []),
              ].map(({ key, label, desc }) => (
                <button
                  key={key}
                  onClick={() => {
                    if (key === 'Cash') { setCheckoutStep('cash') }
                    else handleCheckout(key)
                  }}
                  className="w-full flex items-center justify-between px-5 py-4 border border-[#e0e0e0] rounded-2xl hover:bg-[#f9f9f9] hover:border-[#ccc] transition-colors text-left"
                >
                  <div>
                    <p className="text-[14px] font-semibold text-[#111]">{label}</p>
                    <p className="text-[12px] text-[#888]">{desc}</p>
                  </div>
                  <span className="text-[#bbb] text-[18px]">›</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setCheckoutStep(null)}
              className="w-full mt-4 py-3 text-[13px] font-semibold text-[#888] hover:text-[#333] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Cash Denomination Modal ── */}
      {checkoutStep === 'cash' && (() => {
        const cashTotal = DENOMINATIONS.reduce((sum, d) => {
          const n = parseInt(cashCounts[d] ?? '', 10)
          return sum + (isNaN(n) ? 0 : n * d)
        }, 0)
        const change = cashTotal - grandTotal
        const canSubmit = cashTotal >= grandTotal

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
            onClick={() => setCheckoutStep(null)}
          >
            <div
              className="bg-white rounded-3xl w-full max-w-[480px] p-8 shadow-xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8">
                <button
                  onClick={() => setCheckoutStep('method')}
                  className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
                >
                  <ArrowLeft size={13} />
                  Go back
                </button>
              </div>

              <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-2">Cash Payment</p>
              <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">{invoiceNo}</h2>
              <p className="text-[14px] text-[#888] font-medium mb-6">Total due: {fmt(grandTotal)}</p>

              <p className="text-[13px] font-semibold text-[#888] mb-2">amount tendered</p>
              <table className="w-full border border-[#e0e0e0] rounded-xl overflow-hidden mb-6">
                <tbody>
                  {DENOMINATIONS.map((d) => (
                    <tr key={d} className="border-b border-[#e0e0e0] last:border-b-0">
                      <td className="border-r border-[#e0e0e0] px-3 py-2 w-1/2">
                        <input
                          type="text"
                          value={fmtInput(cashCounts[d] ?? '')}
                          onChange={(e) =>
                            setCashCounts((prev) => ({ ...prev, [d]: parseInput(e.target.value) }))
                          }
                          placeholder="0"
                          className="w-full text-[13px] font-medium text-[#333] focus:outline-none bg-transparent"
                        />
                      </td>
                      <td className="px-3 py-2 text-center text-[13px] font-medium text-[#333]">
                        {d.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex flex-col gap-3 mb-6">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-[#888]">Tendered</p>
                  <p className="text-[13px] font-bold text-[#111]">{fmt(cashTotal)}</p>
                </div>
                <div className="text-left">
                  <p className={`text-[32px] font-bold leading-none tracking-tight ${change < 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {change >= 0 ? fmt(change) : `-${fmt(Math.abs(change))}`}
                  </p>
                  <p className="text-[12px] font-semibold text-[#888] mt-1.5">Change</p>
                </div>
              </div>

              {error && <p className="text-[11px] font-semibold text-red-500 mb-3">{error}</p>}

              <button
                onClick={() => handleCheckout('Cash', change > 0 ? change : 0)}
                disabled={!canSubmit || loading}
                className="w-full py-4 rounded-2xl border border-[#e0e0e0] text-[15px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
