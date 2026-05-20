import { useState } from 'react'
import {
  Candy, Cigarette, ChevronRight, Flame, GlassWater, Home, Plus, Search, Smartphone, Snowflake, Utensils, Wrench, X,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Category =
  | 'Liquors & Beverages'
  | 'Snacks & Candies'
  | 'Quick Meals'
  | 'Smoking Products'
  | 'Household Items'
  | 'Lubes & Car Care'
  | 'Frozen Foods'
  | 'LPG'
  | 'Credit & Electronics'

const CATEGORY_META: { name: Category; label: string; icon: React.ElementType }[] = [
  { name: 'Liquors & Beverages', label: 'Liquors & Beverages',   icon: GlassWater },
  { name: 'Snacks & Candies',    label: 'Snacks & Candies',      icon: Candy      },
  { name: 'Quick Meals',         label: 'Quick Meals',           icon: Utensils   },
  { name: 'Smoking Products',    label: 'Smoking Products',      icon: Cigarette  },
  { name: 'Household Items',     label: 'Household Items',       icon: Home       },
  { name: 'Lubes & Car Care',    label: 'Lubes & Car Care',      icon: Wrench     },
  { name: 'Frozen Foods',        label: 'Frozen Foods',          icon: Snowflake  },
  { name: 'LPG',                 label: 'Liquid Petroleum Gas',  icon: Flame      },
  { name: 'Credit & Electronics',label: 'Credit & Electronics',  icon: Smartphone },
]

const ALL_CATEGORIES = CATEGORY_META.map((c) => c.name)

function categoryLabel(name: Category) {
  return CATEGORY_META.find((c) => c.name === name)?.label ?? name
}

interface Product {
  id: string
  name: string
  category: Category
  price: number
  stock: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return '$' + n.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function stockBadge(stock: number) {
  if (stock === 0) return 'bg-red-50 text-red-500'
  if (stock < 10)  return 'bg-[#fff3cd] text-[#856404]'
  return 'bg-[#d1e7dd] text-[#0a5435]'
}

// ── Add Product Modal ─────────────────────────────────────────────────────────

function AddProductModal({ onClose, onAdd }: { onClose: () => void; onAdd: (p: Omit<Product, 'id'>) => void }) {
  const [form, setForm] = useState({
    name: '', category: ALL_CATEGORIES[0] as Category, price: '', stock: '',
  })

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onAdd({
      name: form.name,
      category: form.category,
      price: parseFloat(form.price) || 0,
      stock: parseInt(form.stock) || 0,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-[440px] p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[16px] font-bold text-[#111]">Add Product</h3>
          <button onClick={onClose} className="text-[#bbb] hover:text-[#555] transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#888] mb-1 uppercase tracking-widest">Product Name</label>
            <input
              type="text" required value={form.name} onChange={(e) => set('name', e.target.value)}
              className="w-full border border-[#ebebeb] rounded-xl px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#888] mb-1 uppercase tracking-widest">Category</label>
            <select value={form.category} onChange={(e) => set('category', e.target.value)}
              className="w-full border border-[#ebebeb] rounded-xl px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111]">
              {CATEGORY_META.map((c) => <option key={c.name} value={c.name}>{c.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#888] mb-1 uppercase tracking-widest">Price (JMD)</label>
              <input
                type="number" min="0" step="0.01" value={form.price} onChange={(e) => set('price', e.target.value)}
                className="w-full border border-[#ebebeb] rounded-xl px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#888] mb-1 uppercase tracking-widest">Stock</label>
              <input
                type="number" min="0" value={form.stock} onChange={(e) => set('stock', e.target.value)}
                className="w-full border border-[#ebebeb] rounded-xl px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111]"
              />
            </div>
          </div>
          <button type="submit"
            className="w-full bg-white border border-[#ddd] text-[#333] rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#f9f9f9] transition-colors mt-2">
            Add Product
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Add Category Modal ────────────────────────────────────────────────────────

function AddCategoryModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-[380px] p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[16px] font-bold text-[#111]">New Category</h3>
          <button onClick={onClose} className="text-[#bbb] hover:text-[#555] transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#888] mb-1 uppercase tracking-widest">Category Name</label>
            <input
              type="text"
              className="w-full border border-[#ebebeb] rounded-xl px-4 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#111]"
            />
          </div>
          <button
            className="w-full bg-[#111] text-white rounded-xl py-3 text-[13px] font-semibold hover:bg-[#333] transition-colors mt-2"
            onClick={onClose}
          >
            Add Category
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Categories Panel ──────────────────────────────────────────────────────────

function CategoriesPanel({ products }: { products: Product[] }) {
  const [showModal, setShowModal] = useState(false)

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
      <div className="flex items-center justify-between border-t border-[#f0f0f0] px-5 py-3">
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1 text-[12px] font-semibold text-[#888] hover:text-[#111] transition-colors">
          <Plus size={12} /> New
        </button>
        <p className="text-[13px] font-bold text-[#bbb]">{CATEGORY_META.length} categories</p>
      </div>
      {showModal && <AddCategoryModal onClose={() => setShowModal(false)} />}
    </div>
  )
}

// ── Low Stock Panel ───────────────────────────────────────────────────────────

function LowStockPanel({ products }: { products: Product[] }) {
  const low = products
    .filter((p) => p.stock < 10)
    .sort((a, b) => a.stock - b.stock)

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
              const meta = CATEGORY_META.find((c) => c.name === p.category)
              const Icon = meta?.icon
              return (
                <div key={p.id} className="grid grid-cols-[1fr_auto] gap-3 items-center py-2 border-b border-[#f8f8f8] last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {Icon && (
                      <div className="w-5 h-5 rounded-md bg-[#f4f4f4] flex items-center justify-center flex-shrink-0">
                        <Icon size={11} className="text-[#555]" />
                      </div>
                    )}
                    <p className="text-[13px] font-semibold text-[#111] truncate">{p.name}</p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${stockBadge(p.stock)}`}>
                    {p.stock === 0 ? 'Out' : p.stock}
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

// ── Products Table ────────────────────────────────────────────────────────────

function ProductsTable({ products, onAdd }: { products: Product[]; onAdd: () => void }) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.category.toLowerCase().includes(query.toLowerCase())
      )
    : products

  return (
    <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4 min-w-0">
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
      <div className="flex-1 bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col">
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr_32px] gap-4 px-5 py-2.5 border-b border-[#f0f0f0] bg-[#fafafa] shrink-0">
          {['Name', 'Category', 'Price', 'Stock', ''].map((h) => (
            <p key={h} className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
          ))}
        </div>
        {products.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <p className="text-[13px] font-semibold text-[#bbb]">No products yet</p>
            <p className="text-[12px] font-medium text-[#ccc]">Add your first product to get started</p>
            <button onClick={onAdd}
              className="mt-3 flex items-center gap-1.5 px-5 py-2.5 bg-white border border-[#ddd] text-[#333] text-[12px] font-semibold rounded-xl hover:bg-[#f9f9f9] transition-colors">
              <Plus size={13} /> Add Product
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[13px] font-medium text-[#bbb]">No products matching "{query}"</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {filtered.map((p) => (
              <button key={p.id}
                className="w-full grid grid-cols-[2fr_2fr_1fr_1fr_32px] gap-4 items-center px-5 py-3.5 border-b border-[#f8f8f8] last:border-0 hover:bg-[#fafafa] transition-colors text-left">
                <p className="text-[13px] font-semibold text-[#111] truncate">{p.name}</p>
                <p className="text-[13px] text-[#666] truncate">{categoryLabel(p.category)}</p>
                <p className="text-[13px] text-[#666]">{fmt(p.price)}</p>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit ${stockBadge(p.stock)}`}>
                  {p.stock === 0 ? 'Out' : `${p.stock}`}
                </span>
                <ChevronRight size={14} className="text-[#ccc]" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [showAdd, setShowAdd]   = useState(false)

  function addProduct(p: Omit<Product, 'id'>) {
    setProducts((prev) => [...prev, { ...p, id: crypto.randomUUID() }])
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebebeb] flex-shrink-0">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-0.5">Convenience Store</p>
          <h1 className="text-[22px] font-bold text-[#111] leading-tight">Products</h1>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#ddd] text-[#333] text-[13px] font-semibold rounded-xl hover:bg-[#f9f9f9] transition-colors">
          <Plus size={14} /> Add Product
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <ProductsTable products={products} onAdd={() => setShowAdd(true)} />
        <div className="w-[450px] shrink-0 border-l border-[#e8e8e8] h-full flex flex-col divide-y divide-[#e8e8e8]">
          <CategoriesPanel products={products} />
          <LowStockPanel products={products} />
        </div>
      </div>

      {showAdd && <AddProductModal onClose={() => setShowAdd(false)} onAdd={addProduct} />}
    </div>
  )
}
