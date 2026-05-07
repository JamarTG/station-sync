import { useState, useEffect } from 'react'
import clsx from 'clsx'
import type { Pump } from '../../lib/api'
import { fmtInput, parseInput, fmtNum } from '../../lib/fmt'

const gradeLabels: Record<string, string> = {
  '87': 'UNLEADED 87',
  '90': 'UNLEADED 90',
  'ADO': 'AUTO DIESEL',
  'ULSD': 'ULTRA LOW SULPHUR',
}

const NOZZLE_COUNT = 12

export interface NozzleRow {
  opening: string
  closing: string
}

interface Props {
  pump: Pump | undefined
  shiftId: string | undefined
  fuelType: string | null
  pricePerLitre?: number
  nozzles: NozzleRow[]
  onChange: (nozzles: NozzleRow[]) => void
}

export function PumpDetailPanel({ fuelType, pricePerLitre, nozzles, onChange }: Props) {
  const label = fuelType ? (gradeLabels[fuelType] ?? fuelType) : '—'
  const [touched, setTouched] = useState<Record<number, boolean>>({})

  useEffect(() => {
    setTouched({})
  }, [fuelType])

  const rows: NozzleRow[] = Array.from(
    { length: NOZZLE_COUNT },
    (_, i) => nozzles[i] ?? { opening: '', closing: '' }
  )

  function updateNozzle(index: number, field: 'opening' | 'closing', value: string) {
    const updated = rows.map((n, i) => (i === index ? { ...n, [field]: parseInput(value) } : n))
    onChange(updated)
  }

  function markTouched(index: number) {
    setTouched((prev) => ({ ...prev, [index]: true }))
  }

  const totalLitres = rows.reduce((sum, n) => {
    const o = parseFloat(n.opening)
    const c = parseFloat(n.closing)
    if (!isNaN(o) && !isNaN(c) && c >= o) return sum + (c - o)
    return sum
  }, 0)

  const hasAnyData = rows.some((n) => n.opening !== '' || n.closing !== '')
  const totalSales = pricePerLitre != null && hasAnyData ? totalLitres * pricePerLitre : null

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white rounded-none border border-[#ebebeb] flex flex-col flex-1 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#f0f0f0] flex-shrink-0">
          <p className="text-[12px] font-bold text-[#111] tracking-widest">{label}</p>
        </div>

        <table className="w-full flex flex-col flex-1 overflow-hidden">
          <thead className="flex-shrink-0">
            <tr className="border-b border-[#f0f0f0] flex">
              <th className="w-8 pl-4 py-2" />
              <th className="py-2 text-[11px] font-semibold text-[#aaa] text-center tracking-widest flex-1">OPENING</th>
              <th className="py-2 text-[11px] font-semibold text-[#aaa] text-center tracking-widest flex-1">CLOSING</th>
              <th className="py-2 text-[11px] font-semibold text-[#aaa] text-center tracking-widest flex-1">LITRES</th>
            </tr>
          </thead>
          <tbody className="overflow-y-auto flex-1 block">
            {rows.map((n, i) => {
              const o = parseFloat(n.opening)
              const c = parseFloat(n.closing)
              const hasError = touched[i] && !isNaN(o) && !isNaN(c) && o > c
              const litres = !isNaN(o) && !isNaN(c) && c >= o ? c - o : null

              return (
                <tr key={i} className={clsx('border-b border-[#f9f9f9] flex', hasError && 'bg-red-50')}>
                  <td className="w-8 pl-4 py-3 text-[11px] text-[#ccc] font-medium flex items-center">{i + 1}</td>
                  <td className="py-3 flex-1 flex items-center justify-center">
                    <input
                      type="text"
                      value={fmtInput(n.opening)}
                      onChange={(e) => updateNozzle(i, 'opening', e.target.value)}
                      onBlur={() => markTouched(i)}
                      placeholder="—"
                      className={clsx(
                        'w-20 text-center text-[12px] font-medium bg-transparent outline-none placeholder:text-[#ddd] focus:bg-[#f5f5f5] rounded-md px-1 py-0.5 transition-colors',
                        hasError ? 'text-red-500' : 'text-[#333]'
                      )}
                    />
                  </td>
                  <td className="py-3 flex-1 flex items-center justify-center">
                    <input
                      type="text"
                      value={fmtInput(n.closing)}
                      onChange={(e) => updateNozzle(i, 'closing', e.target.value)}
                      onBlur={() => markTouched(i)}
                      placeholder="—"
                      className={clsx(
                        'w-20 text-center text-[12px] font-medium bg-transparent outline-none placeholder:text-[#ddd] focus:bg-[#f5f5f5] rounded-md px-1 py-0.5 transition-colors',
                        hasError ? 'text-red-500' : 'text-[#333]'
                      )}
                    />
                  </td>
                  <td className="py-3 flex-1 flex items-center justify-center">
                    {hasError ? (
                      <span className="text-[11px] font-semibold text-red-400">Error</span>
                    ) : litres != null ? (
                      <span className="text-[12px] font-medium text-[#555]">{fmtNum(litres)}</span>
                    ) : (
                      <span className="text-[#ddd] text-[12px]">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="border-t border-[#ebebeb] px-5 py-3 flex items-center justify-between flex-shrink-0">
          <span className="text-[12px] font-semibold text-[#888]">TOTAL LITRES</span>
          <span className="text-[13px] font-bold text-[#333]">
            {hasAnyData ? fmtNum(totalLitres) : '—'}
          </span>
        </div>

        <div className="px-5 py-4 border-t border-[#f0f0f0] bg-[#fafafa] flex-shrink-0">
          <p className="text-[11px] font-semibold text-[#aaa] mb-1">Total Sales</p>
          <p className="text-[28px] font-bold text-[#111] leading-none tracking-tight">
            {totalSales != null ? `J$${fmtNum(totalSales)}` : 'J$0.00'}
          </p>
        </div>
      </div>
    </div>
  )
}
