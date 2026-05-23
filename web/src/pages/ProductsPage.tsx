import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Candy, ChevronRight, Cigarette, Flame, GlassWater, Home, MoreHorizontal, Plus, Search, Smartphone, Snowflake, Utensils, Wrench, X,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useProducts, useInactiveProducts } from '../hooks/useApi'
import { createProduct, updateProduct, setProductActive, deleteProduct, type Product } from '../lib/api'

// ── Category meta ─────────────────────────────────────────────────────────────

const CATEGORY_META: { name: string; label: string; icon: React.ElementType }[] = [
  { name: 'Beverages',  label: 'Liquors & Beverages',  icon: GlassWater },
  { name: 'Snacks',     label: 'Snacks & Candies',     icon: Candy      },
  { name: 'Meals',      label: 'Quick Meals',          icon: Utensils   },
  { name: 'Tobacco',    label: 'Smoking Products',     icon: Cigarette  },
  { name: 'Household',  label: 'Household Items',      icon: Home       },
  { name: 'Automotive', label: 'Lubes & Car Care',     icon: Wrench     },
  { name: 'Frozen',     label: 'Frozen Foods',         icon: Snowflake  },
  { name: 'LPG',        label: 'Liquid Petroleum Gas', icon: Flame      },
  { name: 'Electronics',label: 'Credit & Electronics', icon: Smartphone },
  { name: 'Other',      label: 'Other',                icon: Home       },
]

function categoryMeta(name: string | null) {
  return CATEGORY_META.find((c) => c.name === name) ?? { label: name ?? 'Other', icon: Home }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return 'J$ ' + n.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function stockBadge(qty: number) {
  if (qty === 0) return 'bg-red-50 text-red-500'
  if (qty < 10)  return 'bg-[#fff3cd] text-[#856404]'
  return 'bg-[#d1e7dd] text-[#0a5435]'
}

// ── Categories Panel ──────────────────────────────────────────────────────────

function CategoriesPanel({ products }: { products: Product[] }) {
  const counts = CATEGORY_META.map((cat) => ({
    ...cat,
    count: products.filter((p) => p.category === cat.name).length,
  }))

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-5 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4">
          <p>
            <span className="text-[13px] font-bold text-[#111]">Products</span>
            <span className="text-[13px] font-medium text-[#aaa]"> | Categories</span>
          </p>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3 mb-2 px-1">
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">Category</p>
          <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase text-right">Items</p>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
          {counts.map((cat) => (
            <button key={cat.name}
              className="grid grid-cols-[1fr_auto] gap-3 items-center py-2.5 border-b border-[#f8f8f8] last:border-0 hover:bg-[#fafafa] -mx-1 px-1 rounded-lg transition-colors text-left">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-[#f4f4f4] flex items-center justify-center flex-shrink-0">
                  <cat.icon size={12} className="text-[#555]" />
                </div>
                <p className="text-[13px] font-semibold text-[#111] truncate">{cat.label}</p>
              </div>
              <p className="text-[13px] font-semibold text-[#bbb] text-right">{cat.count}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Low Stock Panel ───────────────────────────────────────────────────────────

function LowStockPanel({ products }: { products: Product[] }) {
  const low = products.filter((p) => p.stock_qty < 10).sort((a, b) => a.stock_qty - b.stock_qty)

  return (
    <div className="h-[300px] shrink-0 flex flex-col">
      <div className="px-5 pt-4 pb-3 shrink-0">
        <p>
          <span className="text-[13px] font-bold text-[#111]">Products</span>
          <span className="text-[13px] font-medium text-[#aaa]"> | Low Stock</span>
        </p>
      </div>
      {low.length === 0 ? (
        <div className="flex-1 flex items-center justify-center pb-4">
          <p className="text-[13px] font-medium text-[#bbb]">All stocked up</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[1fr_auto] gap-3 px-5 mb-1.5 shrink-0">
            <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">Name</p>
            <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase text-right">Stock</p>
          </div>
          <div className="overflow-y-auto flex flex-col px-4 pb-3">
            {low.map((p) => {
              const meta = categoryMeta(p.category)
              const Icon = meta.icon
              return (
                <div key={p.id} className="grid grid-cols-[1fr_auto] gap-3 items-center py-2 border-b border-[#f8f8f8] last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded-md bg-[#f4f4f4] flex items-center justify-center flex-shrink-0">
                      <Icon size={11} className="text-[#555]" />
                    </div>
                    <p className="text-[13px] font-semibold text-[#111] truncate">{p.name}</p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${stockBadge(p.stock_qty)}`}>
                    {p.stock_qty === 0 ? 'Out' : p.stock_qty}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Add Product Modal ─────────────────────────────────────────────────────────

const UNITS = ['pcs', 'pack', 'box', 'bottle', 'can', 'bag', 'kg', 'g', 'L', 'mL']

function AddProductModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<string>('')
  const [sku, setSku] = useState('')
  const [upc, setUpc] = useState('')
  const [price, setPrice] = useState('')
  const [cost, setCost] = useState('')
  const [stock, setStock] = useState('')
  const [unit, setUnit] = useState('pcs')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim() || !price || !stock) {
      setError('Name, price, and stock are required')
      return
    }
    setSaving(true)
    setError('')
    try {
      await createProduct({
        name: name.trim(),
        category: category || null,
        sku: sku.trim() || null,
        upc: upc.trim() || null,
        price: parseFloat(price),
        cost: cost !== '' ? parseFloat(cost) : null,
        stock_qty: parseInt(stock, 10),
        unit,
      })
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['products'] }),
        qc.invalidateQueries({ queryKey: ['products', 'inactive'] }),
      ])
      onClose()
    } catch {
      setError('Failed to add product')
      setSaving(false)
    }
  }

  const fieldClass = 'w-full px-3 py-2 text-[13px] font-medium text-[#111] bg-white border border-[#ddd] rounded-xl focus:outline-none focus:border-[#aaa] transition-colors'
  const labelClass = 'text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-[460px] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#ebebeb]">
          <p className="text-[14px] font-bold text-[#111]">Add Product</p>
          <button onClick={onClose} className="text-[#bbb] hover:text-[#555] transition-colors">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div>
            <p className={labelClass}>Name</p>
            <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sprite 500mL" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={labelClass}>Category</p>
              <select className={fieldClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">None</option>
                {CATEGORY_META.map((c) => (
                  <option key={c.name} value={c.name}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <p className={labelClass}>SKU</p>
              <input className={fieldClass} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={labelClass}>UPC</p>
              <input className={fieldClass} value={upc} onChange={(e) => setUpc(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={labelClass}>Price (J$)</p>
              <input className={fieldClass} type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <p className={labelClass}>Cost (J$)</p>
              <input className={fieldClass} type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={labelClass}>Stock Qty</p>
              <input className={fieldClass} type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" />
            </div>
            <div>
              <p className={labelClass}>Unit</p>
              <select className={fieldClass} value={unit} onChange={(e) => setUnit(e.target.value)}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-[12px] font-semibold text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-[#ddd] rounded-xl text-[13px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-[#111] rounded-xl text-[13px] font-semibold text-white hover:bg-[#333] transition-colors disabled:opacity-50">
              {saving ? 'Adding…' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Edit Product Modal ────────────────────────────────────────────────────────

function EditProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(product.name)
  const [category, setCategory] = useState(product.category ?? '')
  const [sku, setSku] = useState(product.sku ?? '')
  const [upc, setUpc] = useState(product.upc ?? '')
  const [price, setPrice] = useState(String(product.price))
  const [cost, setCost] = useState(product.cost != null ? String(product.cost) : '')
  const [stock, setStock] = useState(String(product.stock_qty))
  const [unit, setUnit] = useState(product.unit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim() || !price || !stock) { setError('Name, price, and stock are required'); return }
    setSaving(true); setError('')
    try {
      await updateProduct(product.id, {
        name: name.trim(),
        category: category || null,
        sku: sku.trim() || null,
        upc: upc.trim() || null,
        price: parseFloat(price),
        cost: cost !== '' ? parseFloat(cost) : null,
        stock_qty: parseInt(stock, 10),
        unit,
      })
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['products'] }),
        qc.invalidateQueries({ queryKey: ['products', 'inactive'] }),
      ])
      onClose()
    } catch {
      setError('Failed to save changes')
      setSaving(false)
    }
  }

  const fieldClass = 'w-full px-3 py-2 text-[13px] font-medium text-[#111] bg-white border border-[#ddd] rounded-xl focus:outline-none focus:border-[#aaa] transition-colors'
  const labelClass = 'text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-[460px] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#ebebeb]">
          <p className="text-[14px] font-bold text-[#111]">Edit Product</p>
          <button onClick={onClose} className="text-[#bbb] hover:text-[#555] transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div>
            <p className={labelClass}>Name</p>
            <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={labelClass}>Category</p>
              <select className={fieldClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">None</option>
                {CATEGORY_META.map((c) => <option key={c.name} value={c.name}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <p className={labelClass}>SKU</p>
              <input className={fieldClass} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={labelClass}>UPC</p>
              <input className={fieldClass} value={upc} onChange={(e) => setUpc(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={labelClass}>Price (J$)</p>
              <input className={fieldClass} type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <p className={labelClass}>Cost (J$)</p>
              <input className={fieldClass} type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={labelClass}>Stock Qty</p>
              <input className={fieldClass} type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
            <div>
              <p className={labelClass}>Unit</p>
              <select className={fieldClass} value={unit} onChange={(e) => setUnit(e.target.value)}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-[12px] font-semibold text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-[#ddd] rounded-xl text-[13px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-[#111] rounded-xl text-[13px] font-semibold text-white hover:bg-[#333] transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────

function DeleteConfirmModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const qc = useQueryClient()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setDeleting(true); setError('')
    try {
      await deleteProduct(product.id)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['products'] }),
        qc.invalidateQueries({ queryKey: ['products', 'inactive'] }),
      ])
      onClose()
    } catch {
      setError('Failed to delete product')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-[360px] shadow-2xl p-6">
        <p className="text-[15px] font-bold text-[#111] mb-1">Delete "{product.name}"?</p>
        <p className="text-[13px] font-medium text-[#888] mb-5">This action cannot be undone.</p>
        {error && <p className="text-[12px] font-semibold text-red-500 mb-3">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-[#ddd] rounded-xl text-[13px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="flex-1 px-4 py-2.5 bg-red-500 rounded-xl text-[13px] font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Products Table ────────────────────────────────────────────────────────────

type MenuPos = { id: string; right: number; y: number; up: boolean }

function ProductsTable({ products, inactiveProducts, onAdd }: { products: Product[]; inactiveProducts: Product[]; onAdd: () => void }) {
  const qc = useQueryClient()
  const [query, setQuery] = useState('')
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null)
  const [inactiveOpen, setInactiveOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  function openMenu(e: React.MouseEvent<HTMLButtonElement>, id: string) {
    const rect = e.currentTarget.getBoundingClientRect()
    const menuHeight = 116 // ~3 items × ~37px + 2px padding
    const up = window.innerHeight - rect.bottom < menuHeight
    setMenuPos({
      id,
      right: window.innerWidth - rect.right,
      y: up ? window.innerHeight - rect.top + 4 : rect.bottom + 4,
      up,
    })
  }

  async function handleToggleActive(p: Product) {
    setMenuPos(null)
    setTogglingId(p.id)
    try {
      await setProductActive(p.id, !p.active)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['products'] }),
        qc.invalidateQueries({ queryKey: ['products', 'inactive'] }),
      ])
    } finally {
      setTogglingId(null)
    }
  }

  const filtered = query.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          (p.category ?? '').toLowerCase().includes(query.toLowerCase()) ||
          (p.sku ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : products

  return (
    <div className="flex-1 overflow-hidden flex flex-col p-6 gap-3 min-w-0">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border border-[#ebebeb] rounded-xl shrink-0">
        <Search size={14} className="text-[#bbb] flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          className="flex-1 text-[13px] font-medium text-[#111] placeholder:text-[#bbb] focus:outline-none bg-transparent"
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-[#bbb] hover:text-[#555] transition-colors">
            <X size={13} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden bg-white border border-[#ebebeb] rounded-2xl flex flex-col">
        <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_80px_36px] gap-4 px-5 py-3 border-b border-[#f0f0f0] shrink-0">
          {['Name', 'Category', 'Price', 'Cost', 'Unit', 'Stock', ''].map((h) => (
            <p key={h} className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
          ))}
        </div>

        {products.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <p className="text-[13px] font-semibold text-[#bbb]">No products yet</p>
            <p className="text-[12px] font-medium text-[#ccc]">Add your first product to get started</p>
            <button onClick={onAdd} className="mt-3 flex items-center gap-1.5 px-5 py-2.5 bg-white border border-[#ddd] text-[#333] text-[12px] font-semibold rounded-xl hover:bg-[#f9f9f9] transition-colors">
              <Plus size={13} /> Add Product
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[13px] font-medium text-[#bbb]">No products matching "{query}"</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {filtered.map((p) => {
              const meta = categoryMeta(p.category)
              const Icon = meta.icon
              return (
                <div key={p.id} className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_80px_36px] gap-4 px-5 py-3 border-b border-[#f8f8f8] last:border-0 hover:bg-[#fafafa] transition-colors items-center">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#111] truncate">{p.name}</p>
                    {p.sku && <p className="text-[11px] font-medium text-[#bbb] mt-0.5">{p.sku}</p>}
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded-md bg-[#f4f4f4] flex items-center justify-center flex-shrink-0">
                      <Icon size={11} className="text-[#555]" />
                    </div>
                    <p className="text-[12px] font-medium text-[#555] truncate">{meta.label}</p>
                  </div>
                  <p className="text-[13px] font-semibold text-[#111]">{fmt(p.price)}</p>
                  <p className="text-[13px] font-medium text-[#888]">{p.cost != null ? fmt(p.cost) : <span className="text-[#ddd]">—</span>}</p>
                  <p className="text-[12px] font-medium text-[#888]">{p.unit}</p>
                  <p className={`text-[13px] font-semibold ${p.stock_qty === 0 ? 'text-red-500' : p.stock_qty < 10 ? 'text-[#856404]' : 'text-[#111]'}`}>
                    {p.stock_qty}
                  </p>
                  <div className="flex items-center justify-center">
                    <button
                      onClick={(e) => openMenu(e, p.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[#bbb] hover:text-[#555] hover:bg-[#f4f4f4] transition-colors"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Inactive products accordion */}
      {inactiveProducts.length > 0 && (
        <div className="shrink-0 border border-[#ebebeb] rounded-2xl bg-white overflow-hidden">
          <button
            onClick={() => setInactiveOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#fafafa] transition-colors"
          >
            <div className="flex items-center gap-2">
              <ChevronRight size={14} className={`text-[#888] transition-transform ${inactiveOpen ? 'rotate-90' : ''}`} />
              <span className="text-[13px] font-bold text-[#888]">Inactive</span>
              <span className="text-[11px] font-bold text-[#bbb] bg-[#f4f4f4] px-2 py-0.5 rounded-full">{inactiveProducts.length}</span>
            </div>
          </button>
          {inactiveOpen && (
            <div className="border-t border-[#f0f0f0] max-h-[280px] overflow-y-auto">
              <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_80px_36px] gap-4 px-5 py-2.5 border-b border-[#f4f4f4] bg-[#fafafa]">
                {['Name', 'Category', 'Price', 'Cost', 'Unit', 'Stock', ''].map((h) => (
                  <p key={h} className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
                ))}
              </div>
              {inactiveProducts.map((p) => {
                const meta = categoryMeta(p.category)
                const Icon = meta.icon
                return (
                  <div key={p.id} className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_80px_36px] gap-4 px-5 py-3 border-b border-[#f8f8f8] last:border-0 items-center opacity-60 hover:opacity-80 transition-opacity">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#111] truncate">{p.name}</p>
                      {p.sku && <p className="text-[11px] font-medium text-[#bbb] mt-0.5">{p.sku}</p>}
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-md bg-[#f4f4f4] flex items-center justify-center flex-shrink-0">
                        <Icon size={11} className="text-[#555]" />
                      </div>
                      <p className="text-[12px] font-medium text-[#555] truncate">{meta.label}</p>
                    </div>
                    <p className="text-[13px] font-semibold text-[#111]">{fmt(p.price)}</p>
                    <p className="text-[13px] font-medium text-[#888]">{p.cost != null ? fmt(p.cost) : <span className="text-[#ddd]">—</span>}</p>
                    <p className="text-[12px] font-medium text-[#888]">{p.unit}</p>
                    <p className="text-[13px] font-semibold text-[#aaa]">{p.stock_qty}</p>
                    <div className="flex items-center justify-center">
                      <button
                        onClick={(e) => openMenu(e, p.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#bbb] hover:text-[#555] hover:bg-[#f4f4f4] transition-colors"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {editProduct && <EditProductModal product={editProduct} onClose={() => setEditProduct(null)} />}
      {deleteTarget && <DeleteConfirmModal product={deleteTarget} onClose={() => setDeleteTarget(null)} />}

      {menuPos && (() => {
        const allProducts = [...products, ...inactiveProducts]
        const menuProduct = allProducts.find((p) => p.id === menuPos.id)
        if (!menuProduct) return null
        return createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuPos(null)} />
            <div
              className="fixed z-50 bg-white border border-[#e0e0e0] rounded-xl shadow-lg py-1 min-w-[130px]"
              style={{
                right: menuPos.right,
                ...(menuPos.up
                  ? { bottom: menuPos.y }
                  : { top: menuPos.y }),
              }}
            >
              <button
                onClick={() => { setMenuPos(null); setEditProduct(menuProduct) }}
                className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => handleToggleActive(menuProduct)}
                disabled={togglingId === menuProduct.id}
                className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors disabled:opacity-40"
              >
                {togglingId === menuProduct.id ? 'Updating…' : menuProduct.active ? 'Deactivate' : 'Reactivate'}
              </button>
              <button
                onClick={() => { setMenuPos(null); setDeleteTarget(menuProduct) }}
                className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-red-500 hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            </div>
          </>,
          document.body
        )
      })()}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ProductsPage() {
  const { data: products = [] } = useProducts()
  const { data: inactiveProducts = [] } = useInactiveProducts()
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebebeb] flex-shrink-0">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-0.5">Convenience Store</p>
          <h1 className="text-[22px] font-bold text-[#111] leading-tight">Products</h1>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#ddd] text-[#333] text-[13px] font-semibold rounded-xl hover:bg-[#f9f9f9] transition-colors">
          <Plus size={14} /> Add Product
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <ProductsTable products={products} inactiveProducts={inactiveProducts} onAdd={() => setShowAdd(true)} />
        <div className="w-[300px] shrink-0 border-l border-[#e8e8e8] h-full flex flex-col divide-y divide-[#e8e8e8]">
          <CategoriesPanel products={products} />
          <LowStockPanel products={products} />
        </div>
      </div>

      {showAdd && <AddProductModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
