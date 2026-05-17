import { useState, useRef, useEffect } from 'react'
import { Eye, EyeOff, Check, Plus, Fuel, Trash2, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { StationSyncLogo } from '../components/StationSyncLogo'
import { signUp, createFuel, createPump, createNozzle } from '../lib/api'
import { useAuth } from '../lib/authContext'

const categories = [
  {
    id: 'station',
    title: 'Service Station',
    features: [
      {
        id: 'station_general',
        label: 'General management of sales & staff',
        subFeatures: [
          { title: 'Real-time sales tracking', detail: 'Monitor pump sales, cash drops, card transactions, and FX records as they happen across every shift.' },
          { title: 'Attendant management', detail: 'Assign attendants to pumps, track individual performance, and manage accountability per shift.' },
          { title: 'Fuel inventory & tank monitoring', detail: 'Track tank levels, log deliveries, and get visibility into fuel stock across your station.' },
          { title: 'Shift performance reports', detail: 'Generate detailed end-of-shift reports covering sales totals, shortages, overages, and reconciliation summaries.' },
          { title: 'Expense & expenditure tracking', detail: 'Record and categorise operational expenses to keep your shift financials accurate and auditable.' },
        ],
      },
    ],
  },
  {
    id: 'convenience',
    title: 'Convenience Store & LPG Depot',
    features: [
      {
        id: 'conv_general',
        label: 'General management of store operations',
        subFeatures: [
          { title: 'Inventory management & stock control', detail: 'Track stock levels in real time, set reorder points, and receive low-stock alerts to prevent costly stockouts.' },
          { title: 'Supplier & purchase order management', detail: 'Manage supplier contacts, raise and track purchase orders, and log deliveries to keep procurement organised.' },
          { title: 'LPG depot tracking', detail: 'Monitor cylinder stock, record LPG sales, and manage depot inventory alongside your convenience store.' },
          { title: 'Staff management & performance tracking', detail: 'Oversee staff assignments, track individual performance, and manage roles and access levels across your store.' },
          { title: 'Daily sales reconciliation', detail: 'Reconcile daily sales totals, identify discrepancies early, and maintain accurate financial records every shift.' },
        ],
      },
    ],
  },
]

const sharedFeatures = [
  { id: 'shared_payroll', label: 'Staff scheduling & payroll management' },
  { id: 'shared_locations', label: 'Multi-location management & oversight' },
]

const allFeatureIds = [
  ...categories.flatMap((c) => c.features.map((f) => f.id)),
  ...sharedFeatures.map((f) => f.id),
]

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: 499,
    description: 'Everything you need to get one station up and running.',
    features: [
      '1 station',
      'Up to 10 attendants',
      'Sales & shift tracking',
      'Cash, card & FX recording',
      'Basic shift reports',
      '5 GB account storage',
      'Email support',
    ],
    popular: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 999,
    description: 'Advanced tools for growing multi-station operations.',
    features: [
      'Up to 5 stations',
      'Unlimited attendants',
      'Everything in Starter',
      'Advanced analytics & reporting',
      'Payroll & scheduling management',
      'Multi-user access & roles',
      '20 GB account storage',
      'Priority support',
    ],
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 1999,
    description: 'Full-scale management for large or multi-site operators.',
    features: [
      'Unlimited stations',
      'Everything in Professional',
      'Custom integrations & API access',
      'Dedicated account manager',
      'SLA guarantee',
      'Custom branding & white-label',
      '50 GB account storage',
      '24/7 phone support',
    ],
    popular: false,
  },
]

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none ${
        on ? 'bg-[#111]' : 'bg-[#ddd]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 mt-0.5 ${
          on ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

function InterestsPanel({ onContinue }: { onContinue: () => void }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(allFeatureIds.map((id) => [id, false]))
  )

  function toggle(id: string) {
    setEnabled((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const anyEnabled = Object.values(enabled).some(Boolean)

  return (
    <div className="min-h-screen bg-[#f4f4f4] font-[Manrope] flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-sm border border-[#ebebeb] w-full max-w-[900px] p-10">

        <div className="flex items-center gap-3 mb-10">
          <div className="w-9 h-9 bg-[#111] rounded-xl flex items-center justify-center flex-shrink-0">
            <StationSyncLogo size={20} color="white" />
          </div>
          <span className="text-[15px] font-bold text-[#111] tracking-wide">StationSync</span>
        </div>

        <h1 className="text-[26px] font-bold text-[#111] leading-tight mb-1.5">
          What would you be interested in?
        </h1>
        <p className="text-[13px] text-[#888] font-medium mb-8">Enable the features that apply to your operation.</p>

        <div className="grid grid-cols-1 min-[540px]:grid-cols-2 gap-6 mb-4">
          {categories.map((cat) => (
            <div key={cat.id}>
              <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-3">{cat.title}</p>
              <div className="flex flex-col gap-2">
                {cat.features.map((f) => {
                  if (f.subFeatures) {
                    return (
                      <div key={f.id} onClick={() => toggle(f.id)} className="flex flex-col bg-white border border-[#ebebeb] rounded-2xl h-[320px] cursor-pointer select-none">
                        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 border-b border-[#f4f4f4]">
                          <span className="text-[13px] font-semibold text-[#222]">{f.label}</span>
                          <div onClick={(e) => e.stopPropagation()}>
                            <Toggle on={enabled[f.id]} onToggle={() => toggle(f.id)} />
                          </div>
                        </div>
                        <ul className="flex flex-col gap-3 overflow-y-auto px-5 py-4">
                          {f.subFeatures.map((sf) => (
                            <li key={sf.title} className="flex items-start gap-2.5">
                              <div className="w-4 h-4 rounded-full bg-[#f0f0f0] flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Check size={9} strokeWidth={3} className="text-[#888]" />
                              </div>
                              <div>
                                <p className="text-[12px] font-bold text-[#333]">{sf.title}</p>
                                <p className="text-[11px] font-medium text-[#aaa] leading-snug mt-0.5">{sf.detail}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  }
                  return (
                    <div key={f.id} onClick={() => toggle(f.id)} className="flex items-center justify-between px-5 py-4 bg-white border border-[#ebebeb] rounded-2xl cursor-pointer select-none">
                      <span className="text-[13px] font-semibold text-[#222]">{f.label}</span>
                      <div onClick={(e) => e.stopPropagation()}>
                        <Toggle on={enabled[f.id]} onToggle={() => toggle(f.id)} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 mb-8">
          {sharedFeatures.map((f) => (
            <div key={f.id} onClick={() => toggle(f.id)} className="flex items-center justify-between px-5 py-4 bg-white border border-[#ebebeb] rounded-2xl cursor-pointer select-none">
              <span className="text-[13px] font-semibold text-[#222]">{f.label}</span>
              <div onClick={(e) => e.stopPropagation()}>
                <Toggle on={enabled[f.id]} onToggle={() => toggle(f.id)} />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => onContinue()}
          disabled={!anyEnabled}
          className="w-full py-3.5 rounded-2xl bg-[#111] text-white text-[13px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Continue to plans
        </button>
      </div>
    </div>
  )
}

function PlansPanel({ onDone }: { onDone: () => void }) {
  const [selected, setSelected] = useState('professional')

  return (
    <div className="min-h-screen bg-[#f4f4f4] font-[Manrope] flex items-center justify-center p-6">
      <div className="w-full max-w-[960px]">

        <div className="flex items-center gap-3 mb-10">
          <div className="w-9 h-9 bg-[#111] rounded-xl flex items-center justify-center flex-shrink-0">
            <StationSyncLogo size={20} color="white" />
          </div>
          <span className="text-[15px] font-bold text-[#111] tracking-wide">StationSync</span>
        </div>

        <h1 className="text-[32px] font-bold text-[#111] leading-tight mb-1.5">Choose your plan</h1>
        <p className="text-[13px] text-[#888] font-medium mb-10">
          All plans include a 14-day free trial. No credit card required.
        </p>

        <div className="grid grid-cols-1 min-[640px]:grid-cols-3 gap-4 mb-8">
          {plans.map((plan) => {
            const active = selected === plan.id
            return (
              <button
                key={plan.id}
                onClick={() => setSelected(plan.id)}
                className={`relative text-left rounded-3xl border-2 p-7 transition-all flex flex-col ${
                  active ? 'border-[#111] bg-[#111]' : 'border-[#ebebeb] bg-white hover:border-[#ccc]'
                }`}
              >
                {plan.popular && (
                  <span className={`absolute top-5 right-5 text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full ${
                    active ? 'bg-white/20 text-white' : 'bg-[#111] text-white'
                  }`}>
                    Most popular
                  </span>
                )}

                <p className={`text-[12px] font-bold tracking-widest uppercase mb-4 ${active ? 'text-white/50' : 'text-[#aaa]'}`}>
                  {plan.name}
                </p>

                <div className="mb-1">
                  <span className={`text-[40px] font-bold leading-none tracking-tight ${active ? 'text-white' : 'text-[#111]'}`}>
                    ${plan.price.toLocaleString()}
                  </span>
                  <span className={`text-[13px] font-medium ml-1 ${active ? 'text-white/50' : 'text-[#aaa]'}`}>/mo</span>
                </div>

                <p className={`text-[12px] font-medium leading-snug mb-6 ${active ? 'text-white/60' : 'text-[#888]'}`}>
                  {plan.description}
                </p>

                <ul className="flex flex-col gap-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        active ? 'bg-white/20' : 'bg-[#f4f4f4]'
                      }`}>
                        <Check size={9} strokeWidth={3} className={active ? 'text-white' : 'text-[#888]'} />
                      </div>
                      <span className={`text-[12px] font-medium leading-snug ${active ? 'text-white/80' : 'text-[#555]'}`}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>

        <button
          onClick={onDone}
          className="w-full py-3.5 rounded-2xl bg-[#111] text-white text-[13px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
        >
          Get started
        </button>

        <p className="text-center text-[12px] text-[#bbb] font-medium mt-4">
          You can upgrade or downgrade your plan at any time.
        </p>
      </div>
    </div>
  )
}

const fuelGrades = ['90', '93', '87', 'ADO', 'ULSD']

const parishes = [
  'Kingston', 'St. Andrew', 'St. Thomas', 'Portland', 'St. Mary',
  'St. Ann', 'Trelawny', 'St. James', 'Hanover', 'Westmoreland',
  'St. Elizabeth', 'Manchester', 'Clarendon', 'St. Catherine',
]

interface BusinessDetailsContinueArgs {
  branchName: string
  grades: string[]
  addressLine1: string
  addressLine2: string
  city: string
  parish: string
}

function BusinessDetailsPanel({ onContinue }: { onContinue: (args: BusinessDetailsContinueArgs) => Promise<void> }) {
  const [branchName, setBranchName] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [parish, setParish] = useState('')
  const [selectedGrades, setSelectedGrades] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function toggleGrade(grade: string) {
    setSelectedGrades((prev) => {
      const next = new Set(prev)
      next.has(grade) ? next.delete(grade) : next.add(grade)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedGrades.size === 0 || !parish || !branchName.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await onContinue({ branchName: branchName.trim(), grades: [...selectedGrades], addressLine1, addressLine2, city, parish })
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string }
      const msg = axiosErr?.response?.data?.error ?? axiosErr?.message ?? 'Unknown error'
      setError(`Failed: ${msg}`)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f4f4] font-[Manrope] flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-sm border border-[#ebebeb] w-full max-w-[520px] p-10">

        <div className="flex items-center gap-3 mb-10">
          <div className="w-9 h-9 bg-[#111] rounded-xl flex items-center justify-center flex-shrink-0">
            <StationSyncLogo size={20} color="white" />
          </div>
          <span className="text-[15px] font-bold text-[#111] tracking-wide">StationSync</span>
        </div>

        <h1 className="text-[26px] font-bold text-[#111] leading-tight mb-1.5">Tell us about your business</h1>
        <p className="text-[13px] text-[#888] font-medium mb-8">This helps us set up your workspace correctly.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase block mb-2">Business Name</label>
            <input
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="e.g. Shell Portmore"
              required
              className="w-full bg-white border border-[#e0e0e0] rounded-xl px-4 py-3 text-[13px] font-semibold text-[#333] placeholder:text-[#ccc] placeholder:font-normal focus:outline-none focus:border-[#aaa] transition-colors"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase block mb-2">Address Line 1</label>
            <input
              type="text"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="e.g. 12 Main Street"
              required
              className="w-full bg-white border border-[#e0e0e0] rounded-xl px-4 py-3 text-[13px] font-semibold text-[#333] placeholder:text-[#ccc] placeholder:font-normal focus:outline-none focus:border-[#aaa] transition-colors"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase block mb-2">Address Line 2 <span className="normal-case tracking-normal font-medium text-[#ccc]">(optional)</span></label>
            <input
              type="text"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="e.g. Shop 3, Plaza Building"
              className="w-full bg-white border border-[#e0e0e0] rounded-xl px-4 py-3 text-[13px] font-semibold text-[#333] placeholder:text-[#ccc] placeholder:font-normal focus:outline-none focus:border-[#aaa] transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase block mb-2">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Kingston"
                required
                className="w-full bg-white border border-[#e0e0e0] rounded-xl px-4 py-3 text-[13px] font-semibold text-[#333] placeholder:text-[#ccc] placeholder:font-normal focus:outline-none focus:border-[#aaa] transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase block mb-2">Parish</label>
              <select
                value={parish}
                onChange={(e) => setParish(e.target.value)}
                required
                className="w-full bg-white border border-[#e0e0e0] rounded-xl px-4 py-3 text-[13px] font-semibold text-[#333] focus:outline-none focus:border-[#aaa] transition-colors appearance-none"
              >
                <option value="" disabled>Select...</option>
                {parishes.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase block mb-2">Fuel Grades</label>
            <p className="text-[12px] text-[#bbb] font-medium mb-3">Select all grades available at your station.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {fuelGrades.map((grade) => {
                const active = selectedGrades.has(grade)
                return (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => toggleGrade(grade)}
                    className={`px-4 py-2 rounded-xl text-[13px] font-semibold border transition-all ${
                      active
                        ? 'bg-[#111] border-[#111] text-white'
                        : 'bg-white border-[#e0e0e0] text-[#333] hover:border-[#aaa]'
                    }`}
                  >
                    {grade}
                  </button>
                )
              })}
            </div>
          </div>

          {error && <p className="text-[11px] font-semibold text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={selectedGrades.size === 0 || submitting}
            className="w-full py-3.5 rounded-2xl bg-[#111] text-white text-[13px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors mt-2 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating account...' : 'Configure pumps'}
          </button>
        </form>
      </div>
    </div>
  )
}

type Nozzle = { id: string; grade: string }
type Pump = { id: string; name: string; nozzles: Nozzle[] }

function ConfigurePumpsPanel({ grades, onBack, onDone }: { grades: string[]; onBack: () => void; onDone: (pumps: Pump[]) => Promise<void> }) {
  const [pumps, setPumps] = useState<Pump[]>([])
  const [saving, setSaving] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const nameRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const scrollRef = useRef<HTMLDivElement>(null)

  function checkScroll() {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 1)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', checkScroll)
    window.addEventListener('resize', checkScroll)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [])

  useEffect(() => { setTimeout(checkScroll, 100) }, [pumps.length])

  function addPump() {
    const id = String(Date.now())
    setPumps((prev) => [...prev, { id, name: `Pump ${prev.length + 1}`, nozzles: [] }])
    setTimeout(() => {
      scrollRef.current?.scrollTo({ left: scrollRef.current.scrollWidth, behavior: 'smooth' })
      const input = nameRefs.current[id]
      if (input) { input.focus(); input.select() }
    }, 80)
  }

  function updateName(id: string, name: string) {
    setPumps((prev) => prev.map((p) => p.id === id ? { ...p, name } : p))
  }

  function toggleGrade(pumpId: string, grade: string) {
    setPumps((prev) => prev.map((p) => {
      if (p.id !== pumpId) return p
      const has = p.nozzles.some((n) => n.grade === grade)
      return {
        ...p,
        nozzles: has
          ? p.nozzles.filter((n) => n.grade !== grade)
          : [...p.nozzles, { id: String(Date.now()), grade }],
      }
    }))
  }

  function deletePump(id: string) {
    setPumps((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="h-screen bg-[#f4f4f4] font-[Manrope] flex flex-col">
      <div className="flex-shrink-0 px-10 pt-10 pb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-white transition-colors mb-8"
        >
          <ArrowLeft size={13} />
          Go back
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 bg-[#111] rounded-xl flex items-center justify-center flex-shrink-0">
            <StationSyncLogo size={20} color="white" />
          </div>
          <span className="text-[15px] font-bold text-[#111] tracking-wide">StationSync</span>
        </div>

        <h1 className="text-[26px] font-bold text-[#111] leading-tight mb-1">Configure your pumps</h1>
        <p className="text-[13px] text-[#888] font-medium">Add your pumps and select the fuel grades available on each one.</p>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          className="h-full overflow-x-auto overflow-y-hidden px-10 py-6"
        >
          <div className="flex flex-row gap-4 w-max h-full items-start">

            {pumps.map((pump) => (
              <div
                key={pump.id}
                className="w-[200px] bg-white border-2 border-[#e0e0e0] rounded-2xl p-5 flex flex-col"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-[#f4f4f4] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Fuel size={18} className="text-[#bbb]" />
                  </div>
                  <button
                    onClick={() => deletePump(pump.id)}
                    className="text-[#ddd] hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <input
                  ref={(el) => { nameRefs.current[pump.id] = el }}
                  value={pump.name}
                  onChange={(e) => updateName(pump.id, e.target.value)}
                  className="text-[14px] font-bold text-[#111] bg-transparent focus:outline-none focus:bg-[#f4f4f4] rounded-lg px-1.5 py-0.5 mb-4 -mx-1.5 selection:bg-[#111] selection:text-white"
                />

                <div className="flex flex-col gap-2">
                  {grades.map((grade) => {
                    const checked = pump.nozzles.some((n) => n.grade === grade)
                    return (
                      <button
                        key={grade}
                        type="button"
                        onClick={() => toggleGrade(pump.id, grade)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-left ${
                          checked
                            ? 'bg-[#111] border-[#111]'
                            : 'bg-white border-[#e0e0e0] hover:border-[#aaa]'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                          checked ? 'bg-white/20 border-white/30' : 'border-[#ddd]'
                        }`}>
                          {checked && <Check size={9} strokeWidth={3} className="text-white" />}
                        </div>
                        <span className={`text-[13px] font-semibold ${checked ? 'text-white' : 'text-[#333]'}`}>
                          {grade}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {pump.nozzles.length === 0 && (
                  <p className="text-[11px] font-medium text-[#ccc] mt-3 text-center">Select at least one grade</p>
                )}
              </div>
            ))}

            <button
              onClick={addPump}
              className="w-[200px] h-[80px] border-2 border-dashed border-[#ddd] rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:border-[#aaa] transition-colors bg-white/60 flex-shrink-0"
            >
              <Plus size={20} className="text-[#bbb]" />
              <span className="text-[12px] font-semibold text-[#bbb]">Add pump</span>
            </button>
          </div>
        </div>

        {canScrollLeft && (
          <button
            onClick={() => scrollRef.current?.scrollBy({ left: -280, behavior: 'smooth' })}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-[#111] text-white flex items-center justify-center shadow-lg z-30 hover:bg-[#333] transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        {canScrollRight && (
          <button
            onClick={() => scrollRef.current?.scrollBy({ left: 280, behavior: 'smooth' })}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-[#111] text-white flex items-center justify-center shadow-lg z-30 hover:bg-[#333] transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      <div className="flex-shrink-0 px-10 py-6">
        <button
          onClick={async () => { setSaving(true); try { await onDone(pumps) } finally { setSaving(false) } }}
          disabled={pumps.length === 0 || pumps.some((p) => p.nozzles.length === 0) || saving}
          className="w-full py-3.5 rounded-2xl bg-[#111] text-white text-[13px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Complete setup'}
        </button>
      </div>
    </div>
  )
}

// ─── Main sign-up page ────────────────────────────────────────────────────────

type Step = 'form' | 'interests' | 'plans' | 'business' | 'pumps'

export function SignUpPage() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('form')
  const [grades, setGrades] = useState<string[]>([])
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [createdUser, setCreatedUser] = useState<AuthUser | null>(null)

  const passwordMismatch = confirmPassword.length > 0 && confirmPassword !== password

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (passwordMismatch) return
    setStep('interests')
  }

  if (step === 'interests') {
    return (
      <InterestsPanel
        onContinue={() => setStep('plans')}
      />
    )
  }

  if (step === 'plans') {
    return <PlansPanel onDone={() => setStep('business')} />
  }

  if (step === 'business') {
    return (
      <BusinessDetailsPanel
        onContinue={async ({ branchName, grades: g, addressLine1, addressLine2, city, parish }) => {
          setGrades(g)
          const user = await signUp({
            business_name: company,
            branch_name: branchName,
            name: fullName,
            email,
            password,
            address_line1: addressLine1,
            address_line2: addressLine2,
            city,
            parish,
          })
          setCreatedUser(user)
          setStep('pumps')
        }}
      />
    )
  }

  if (step === 'pumps') {
    return (
      <ConfigurePumpsPanel
        grades={grades}
        onBack={() => setStep('business')}
        onDone={async (configuredPumps) => {
          const fuelMap: Record<string, string> = {}
          for (const grade of grades) {
            const fuel = await createFuel({ name: grade })
            fuelMap[grade] = fuel.id
          }
          for (const pump of configuredPumps) {
            const created = await createPump({ name: pump.name })
            for (const nozzle of pump.nozzles) {
              if (fuelMap[nozzle.grade]) {
                await createNozzle(created.id, fuelMap[nozzle.grade])
              }
            }
          }
          setUser(createdUser!)
          navigate({ to: '/' })
        }}
      />
    )
  }

  return (
    <div className="min-h-screen font-[Manrope] relative flex overflow-hidden">

      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover scale-105"
        style={{ filter: 'blur(12px)' }}
      >
        <source src="/bg-video.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/50" />

      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 relative z-10">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 border border-white/30 rounded-xl flex items-center justify-center">
              <StationSyncLogo size={20} color="white" />
            </div>
            <span className="text-[15px] font-bold text-white tracking-wide">StationSync</span>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-bold tracking-widest text-white/40 uppercase mb-4">Built for fuel stations</p>
          <h2 className="text-[42px] font-bold text-white leading-tight mb-4">
            Everything you need<br />to run your shift.
          </h2>
          <p className="text-[15px] text-white/50 font-medium leading-relaxed max-w-sm">
            Track sales, manage attendants, record drops, and close shifts — all in one place.
          </p>
        </div>

        <p className="text-[11px] text-white/25 font-medium">
          © {new Date().getFullYear()} StationSync. All rights reserved.
        </p>
      </div>

      <div className="w-full lg:w-auto lg:flex-none flex items-center justify-center p-6 lg:p-8 relative z-10">
        <div className="w-full lg:w-[620px] bg-white/20 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 px-14 py-12 overflow-y-auto max-h-[calc(100vh-48px)]">
          <div className="w-full max-w-[480px] mx-auto">

            <div className="flex lg:hidden items-center gap-3 mb-10">
              <div className="w-9 h-9 bg-white/20 border border-white/30 rounded-xl flex items-center justify-center">
                <StationSyncLogo size={20} color="white" />
              </div>
              <span className="text-[15px] font-bold text-white tracking-wide">StationSync</span>
            </div>

            <h1 className="text-[28px] font-bold text-white leading-none mb-1.5">Create an account</h1>
            <p className="text-[13px] text-white/60 font-medium mb-8">Get started with StationSync today</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label className="text-[11px] font-bold tracking-widest text-white/50 uppercase block mb-2">Company</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Lewis Service Station"
                  required
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-[13px] font-semibold text-white placeholder:text-white/30 placeholder:font-normal focus:outline-none focus:border-white/50 transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold tracking-widest text-white/50 uppercase block mb-2">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Andre Lewis"
                  required
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-[13px] font-semibold text-white placeholder:text-white/30 placeholder:font-normal focus:outline-none focus:border-white/50 transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold tracking-widest text-white/50 uppercase block mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-[13px] font-semibold text-white placeholder:text-white/30 placeholder:font-normal focus:outline-none focus:border-white/50 transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold tracking-widest text-white/50 uppercase block mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-11 text-[13px] font-semibold text-white placeholder:text-white/30 placeholder:font-normal focus:outline-none focus:border-white/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold tracking-widest text-white/50 uppercase block mb-2">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className={`w-full bg-white/10 border rounded-xl px-4 py-3 pr-11 text-[13px] font-semibold text-white placeholder:text-white/30 placeholder:font-normal focus:outline-none transition-colors ${
                      passwordMismatch ? 'border-red-400 focus:border-red-400' : 'border-white/20 focus:border-white/50'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  >
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {passwordMismatch && (
                  <p className="text-[11px] font-semibold text-red-400 mt-1.5">Passwords do not match</p>
                )}
              </div>

              <button
                type="submit"
                disabled={passwordMismatch}
                className="w-full py-3.5 rounded-2xl bg-black/50 backdrop-blur-sm border border-white/15 text-white text-[13px] font-bold uppercase tracking-widest hover:bg-black/65 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Create account
              </button>
            </form>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-white/20" />
              <span className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-white/20" />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled
                className="flex-1 flex items-center justify-center gap-2.5 bg-white/80 border border-white/40 rounded-2xl py-3 text-[13px] font-semibold text-[#333] opacity-50 cursor-not-allowed backdrop-blur-sm"
              >
                <svg width="17" height="17" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </button>
              <button
                type="button"
                disabled
                className="flex-1 flex items-center justify-center gap-2.5 bg-[#1877F2] rounded-2xl py-3 text-[13px] font-semibold text-white opacity-50 cursor-not-allowed transition-colors"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="white">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
              </button>
            </div>

            <p className="text-center text-[13px] text-white/50 font-medium mt-8">
              Already have an account?{' '}
              <button onClick={() => navigate({ to: '/login' })} className="text-white font-bold hover:underline transition-colors">
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
