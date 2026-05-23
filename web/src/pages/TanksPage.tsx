import { useState } from 'react'
import { Droplets } from 'lucide-react'
import { LogoLoader } from '../components/StationSyncLogo'
import { useTanks } from '../hooks/useApi'
import type { Tank } from '../lib/api'

// ── Detail panel ──────────────────────────────────────────────────────────────

function TankDetailPanel({ tank }: { tank: Tank }) {
  const rows = [
    { label: 'Name',          value: tank.name },
    { label: 'Fuel Type',     value: tank.fuel_name },
    { label: 'Capacity',      value: `${tank.capacity_litres.toLocaleString('en-JM')} L` },
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-5 border-b border-[#f0f0f0] shrink-0">
        <p className="text-[13px] font-bold text-[#111]">Tank Details</p>
        <p className="text-[28px] font-bold text-[#111] leading-none mt-2">{tank.name}</p>
      </div>

      {/* Info rows */}
      <div className="p-5 shrink-0">
        <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mb-3">Info</p>
        <div className="space-y-0">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex items-center py-3 border-b border-[#f8f8f8] last:border-0">
              <span className="text-[12px] text-[#999] w-28 shrink-0">{label}</span>
              <span className="text-[13px] font-semibold text-[#111]">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Empty detail panel ────────────────────────────────────────────────────────

function EmptyDetail() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <div className="w-10 h-10 rounded-full bg-[#f4f4f4] flex items-center justify-center">
        <Droplets size={18} className="text-[#ccc]" />
      </div>
      <p className="text-[13px] font-medium text-[#bbb]">Select a tank to view details</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function TanksPage() {
  const { data: tanks = [], isLoading } = useTanks()
  const [selected, setSelected] = useState<Tank | null>(null)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebebeb] flex-shrink-0">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-0.5">Service Station</p>
          <h1 className="text-[22px] font-bold text-[#111] leading-tight">Tanks</h1>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: tanks table */}
        <div className="flex-1 overflow-hidden flex flex-col p-6 min-w-0">
          <div className="flex-1 bg-white rounded-2xl border border-[#ebebeb] overflow-hidden flex flex-col">
            {/* Table header */}
            <div className="grid grid-cols-[32px_1fr_1fr_1fr] gap-4 px-5 py-2.5 border-b border-[#f0f0f0] bg-[#fafafa] shrink-0">
              {['#', 'Name', 'Fuel Type', 'Capacity'].map((h) => (
                <p key={h} className="text-[10px] font-bold tracking-widest text-[#bbb] uppercase">{h}</p>
              ))}
            </div>

            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <LogoLoader />
              </div>
            ) : tanks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-1">
                <p className="text-[13px] font-semibold text-[#bbb]">No tanks configured</p>
                <p className="text-[12px] font-medium text-[#ccc]">Add tanks in Settings → Forecourt</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto">
                  {tanks.map((tank, i) => (
                    <button
                      key={tank.id}
                      onClick={() => setSelected((cur) => (cur?.id === tank.id ? null : tank))}
                      className={`w-full grid grid-cols-[32px_1fr_1fr_1fr] gap-4 items-center px-5 py-3.5 border-b border-[#f8f8f8] last:border-0 text-left transition-colors ${
                        selected?.id === tank.id ? 'bg-[#f4f4f4]' : 'hover:bg-[#fafafa]'
                      }`}
                    >
                      <p className="text-[12px] font-bold text-[#ccc]">{i + 1}</p>
                      <p className="text-[13px] font-semibold text-[#111]">{tank.name}</p>
                      <p className="text-[13px] text-[#666]">{tank.fuel_name}</p>
                      <p className="text-[13px] font-semibold text-[#111]">
                        {tank.capacity_litres.toLocaleString('en-JM')} L
                      </p>
                    </button>
                  ))}
                </div>

                {/* Footer count */}
                <div className="px-5 py-3 border-t border-[#f0f0f0] shrink-0">
                  <p className="text-[20px] font-bold text-[#111]">{tanks.length}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="w-[380px] shrink-0 border-l border-[#e8e8e8] h-full">
          {selected ? <TankDetailPanel tank={selected} /> : <EmptyDetail />}
        </div>
      </div>
    </div>
  )
}
