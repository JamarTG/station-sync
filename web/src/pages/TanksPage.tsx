import { useState, useMemo } from 'react'
import { Droplets, FlaskConical, ChevronRight } from 'lucide-react'
import { LogoLoader } from '../components/StationSyncLogo'
import { useTanks } from '../hooks/useApi'
import type { Tank } from '../lib/api'
import { FuelIntelligencePage } from './FuelIntelligencePage'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-JM')
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function TankDetailPanel({ tank }: { tank: Tank }) {
  const rows = [
    { label: 'Name',      value: tank.name },
    { label: 'Fuel Type', value: tank.fuel_name },
    { label: 'Capacity',  value: `${fmt(tank.capacity_litres)} L` },
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-5 border-b border-[#f0f0f0] dark:border-[#1e1e1e] shrink-0">
        <p className="text-[13px] font-bold text-[#111] dark:text-[#e0e0e0]">Tank Details</p>
        <p className="text-[28px] font-bold text-[#111] dark:text-[#e0e0e0] leading-none mt-2">{tank.name}</p>
      </div>
      <div className="p-5 shrink-0">
        <p className="text-[11px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase mb-3">Info</p>
        <div className="space-y-0">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex items-center py-3 border-b border-[#f8f8f8] dark:border-[#1a1a1a] last:border-0">
              <span className="text-[12px] text-[#999] dark:text-[#666] w-28 shrink-0">{label}</span>
              <span className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0]">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function EmptyDetail() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <div className="w-10 h-10 rounded-full bg-[#f4f4f4] dark:bg-[#222] flex items-center justify-center">
        <Droplets size={18} className="text-[#ccc] dark:text-[#444]" />
      </div>
      <p className="text-[13px] font-medium text-[#bbb] dark:text-[#444]">Select a tank to view details</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

function FuelPerformanceModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 bg-black/40 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#0f0f0f] rounded-2xl shadow-2xl border border-[#ebebeb] dark:border-[#222] w-full max-w-6xl my-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-h-[88vh] overflow-y-auto">
          <FuelIntelligencePage onBack={onClose} />
        </div>
      </div>
    </div>
  )
}

export function TanksPage() {
  const { data: tanks = [], isLoading } = useTanks()
  const [selected, setSelected] = useState<Tank | null>(null)
  const [showFuelPerf, setShowFuelPerf] = useState(false)

  const totalCapacity = useMemo(() => tanks.reduce((s, t) => s + t.capacity_litres, 0), [tanks])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebebeb] dark:border-[#222] flex-shrink-0">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] dark:text-[#555] uppercase mb-0.5">Service Station</p>
          <h1 className="text-[22px] font-bold text-[#111] dark:text-[#e0e0e0] leading-tight">Tanks</h1>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: table + chart */}
        <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4 min-w-0">

          {/* Tanks table */}
          <div className="flex-1 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-[#ebebeb] dark:border-[#222] overflow-hidden flex flex-col min-h-0">
            <div className="grid grid-cols-[32px_1fr_1fr_1fr] gap-4 px-5 py-2.5 border-b border-[#f0f0f0] dark:border-[#1e1e1e] bg-[#fafafa] dark:bg-[#161616] shrink-0">
              {['#', 'Name', 'Fuel Type', 'Capacity'].map((h) => (
                <p key={h} className="text-[10px] font-bold tracking-widest text-[#bbb] dark:text-[#444] uppercase">{h}</p>
              ))}
            </div>

            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <LogoLoader />
              </div>
            ) : tanks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-1">
                <p className="text-[13px] font-semibold text-[#bbb] dark:text-[#444]">No tanks configured</p>
                <p className="text-[12px] font-medium text-[#ccc] dark:text-[#444]">Add tanks in Settings → Forecourt</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto">
                  {tanks.map((tank, i) => (
                    <button
                      key={tank.id}
                      onClick={() => setSelected((cur) => (cur?.id === tank.id ? null : tank))}
                      className={`w-full grid grid-cols-[32px_1fr_1fr_1fr] gap-4 items-center px-5 py-3.5 border-b border-[#f8f8f8] dark:border-[#1a1a1a] last:border-0 text-left transition-colors ${
                        selected?.id === tank.id ? 'bg-[#f4f4f4] dark:bg-[#222]' : 'hover:bg-[#fafafa] dark:hover:bg-[#161616]'
                      }`}
                    >
                      <p className="text-[12px] font-bold text-[#ccc] dark:text-[#444]">{i + 1}</p>
                      <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0]">{tank.name}</p>
                      <p className="text-[13px] text-[#666] dark:text-[#888]">{tank.fuel_name}</p>
                      <p className="text-[13px] font-semibold text-[#111] dark:text-[#e0e0e0]">{fmt(tank.capacity_litres)} L</p>
                    </button>
                  ))}
                </div>
                <div className="px-5 py-3 border-t border-[#f0f0f0] dark:border-[#1e1e1e] flex items-center justify-between shrink-0">
                  <p className="text-[20px] font-bold text-[#111] dark:text-[#e0e0e0]">{tanks.length}</p>
                  {totalCapacity > 0 && (
                    <p className="text-[12px] font-semibold text-[#aaa] dark:text-[#555]">{fmt(totalCapacity)} L total capacity</p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Fuel Performance — opens the Fuel Intelligence workspace in a modal */}
          <div className="shrink-0 border border-[#ebebeb] dark:border-[#222] rounded-2xl bg-white dark:bg-[#1a1a1a] overflow-hidden">
            <button
              onClick={() => setShowFuelPerf(true)}
              className="w-full flex items-center gap-2 px-5 py-3.5 hover:bg-[#fafafa] dark:hover:bg-[#161616] transition-colors"
            >
              <FlaskConical size={14} className="text-[#888]" />
              <span className="text-[13px] font-bold text-[#888]">Fuel Performance</span>
              <ChevronRight size={14} className="text-[#bbb] ml-auto" />
            </button>
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="w-[380px] shrink-0 border-l border-[#e8e8e8] h-full">
          {selected ? <TankDetailPanel tank={selected} /> : <EmptyDetail />}
        </div>
      </div>

      {showFuelPerf && <FuelPerformanceModal onClose={() => setShowFuelPerf(false)} />}
    </div>
  )
}
