import { useState } from 'react'
import { ArrowLeft, X, Package, Truck, User } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useQueryClient } from '@tanstack/react-query'
import { createProduct } from '../../lib/api'

const options = [
  {
    id: 'product',
    label: 'Product',
    description: 'Add a new product to your inventory',
    icon: Package,
  },
  {
    id: 'stock-receival',
    label: 'Stock Receival',
    description: 'Record a stock delivery or receival',
    icon: Truck,
  },
  {
    id: 'customer',
    label: 'Customer',
    description: 'Add a new customer to your records',
    icon: User,
  },
]

const CATEGORIES = [
  { name: 'Beverages',    label: 'Liquors & Beverages'  },
  { name: 'Snacks',       label: 'Snacks & Candies'      },
  { name: 'Meals',        label: 'Quick Meals'           },
  { name: 'Tobacco',      label: 'Smoking Products'      },
  { name: 'Household',    label: 'Household Items'       },
  { name: 'Automotive',   label: 'Lubes & Car Care'      },
  { name: 'Frozen',       label: 'Frozen Foods'          },
  { name: 'LPG',          label: 'LPG'                   },
  { name: 'Electronics',  label: 'Credit & Electronics'  },
  { name: 'Other',        label: 'Other'                 },
]

const UNITS = ['each', 'kg', 'g', 'lb', 'oz', 'L', 'mL', 'pack', 'box', 'case', 'bottle', 'can']

interface Props {
  onClose: () => void
}

// ── Add Product sub-form ──────────────────────────────────────────────────────

function AddProductForm({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  useEscapeKey(onClose)
  const qc = useQueryClient()
  const [name, setName]         = useState('')
  const [category, setCategory] = useState('Beverages')
  const [price, setPrice]       = useState('')
  const [cost, setCost]         = useState('')
  const [stockQty, setStockQty] = useState('')
  const [unit, setUnit]         = useState('each')
  const [sku, setSku]           = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit() {
    if (!name.trim() || !price) return
    setLoading(true)
    setError('')
    try {
      await createProduct({
        name: name.trim(),
        category,
        price: parseFloat(price),
        cost: cost ? parseFloat(cost) : null,
        stock_qty: stockQty ? parseInt(stockQty, 10) : 0,
        unit,
        sku: sku.trim() || null,
        upc: null,
      })
      qc.invalidateQueries({ queryKey: ['products'] })
      onClose()
    } catch {
      setError('Failed to add product. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full border border-[#e0e0e0] rounded-xl px-4 py-2.5 text-[13px] font-medium text-[#333] focus:outline-none focus:border-[#aaa] transition-colors bg-white'
  const labelCls = 'text-[13px] font-semibold text-[#888] block mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-[740px] p-8 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors">
            <ArrowLeft size={13} />
            Go back
          </button>
          <button onClick={onClose} className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors">
            <X size={13} />
            Cancel
          </button>
        </div>

        <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">Add a product</h2>
        <p className="text-[14px] text-[#888] font-medium mb-8">Please use accurate info</p>

        <div className="flex flex-col gap-5">
          <div>
            <label className={labelCls}>Name <span className="text-red-400">*</span></label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pepsi 500ml" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Category</label>
              <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.name} value={c.name}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Unit</label>
              <select className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Price (J$) <span className="text-red-400">*</span></label>
              <input className={inputCls} type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className={labelCls}>Cost (J$)</label>
              <input className={inputCls} type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Stock Qty</label>
              <input className={inputCls} type="number" min="0" value={stockQty} onChange={(e) => setStockQty(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>SKU</label>
              <input className={inputCls} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Optional" />
            </div>
          </div>
        </div>

        {error && <p className="text-[11px] font-semibold text-red-500 mt-4">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || !name.trim() || !price}
          className="w-full mt-8 py-4 rounded-2xl border border-[#e0e0e0] text-[15px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Adding...' : 'Add product'}
        </button>
      </div>
    </div>
  )
}

// ── Coming soon stub ──────────────────────────────────────────────────────────

function ComingSoonForm({ label, onBack, onClose }: { label: string; onBack: () => void; onClose: () => void }) {
  useEscapeKey(onClose)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-[740px] p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors">
            <ArrowLeft size={13} />
            Go back
          </button>
          <button onClick={onClose} className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors">
            <X size={13} />
            Cancel
          </button>
        </div>
        <h2 className="text-[32px] font-bold text-[#111] leading-none mb-2">{label}</h2>
        <p className="text-[14px] text-[#888] font-medium">This feature is coming soon.</p>
      </div>
    </div>
  )
}

// ── Main selection modal ──────────────────────────────────────────────────────

export function AddModal({ onClose }: Props) {
  useEscapeKey(onClose)
  const [selected, setSelected] = useState<string | null>(null)

  if (selected === 'product')       return <AddProductForm onBack={() => setSelected(null)} onClose={onClose} />
  if (selected === 'stock-receival') return <ComingSoonForm label="Stock Receival" onBack={() => setSelected(null)} onClose={onClose} />
  if (selected === 'customer')      return <ComingSoonForm label="Add Customer" onBack={() => setSelected(null)} onClose={onClose} />

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-[740px] p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-8">
          <div />
          <button onClick={onClose} className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors">
            <X size={13} />
            Cancel
          </button>
        </div>

        <div className="mb-8">
          <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">Add a...</h2>
          <p className="text-[14px] text-[#888] font-medium">Choose what you'd like to add</p>
        </div>

        <div className="flex flex-col gap-3">
          {options.map(({ id, label, description, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSelected(id)}
              className="flex items-center gap-5 border border-[#e0e0e0] rounded-2xl p-5 text-left hover:border-[#bbb] hover:bg-[#fafafa] transition-colors"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#f4f4f4] flex items-center justify-center flex-shrink-0">
                <Icon size={18} className="text-[#555]" />
              </div>
              <div>
                <p className="text-[16px] font-bold text-[#111] mb-0.5">{label}</p>
                <p className="text-[12px] text-[#888] leading-snug">{description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
