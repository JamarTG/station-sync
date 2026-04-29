import { useEffect, useState } from 'react'
import { apiFetch, type Pump, type FuelSummary } from '../../lib/api'

interface Props {
  pump: Pump
  shiftId: string | null
}

export function PumpDetailPanel({ pump, shiftId }: Props) {
  const [summaries, setSummaries] = useState<FuelSummary[]>([])

  useEffect(() => {
    if (!shiftId) return
    apiFetch<FuelSummary[]>(`/pumps/${pump.id}/shifts/${shiftId}/fuel-summary`)
      .then(setSummaries)
      .catch(() => {})
  }, [pump.id, shiftId])

  if (!shiftId) {
    return (
      <div className="bg-white rounded-2xl border border-[#ebebeb] px-5 py-8 text-center text-[13px] text-[#aaa]">
        No active shift for today.
      </div>
    )
  }

  if (summaries.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#ebebeb] px-5 py-8 text-center text-[13px] text-[#aaa]">
        No data for this pump.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {summaries.map((s) => (
        <div key={s.fuelType} className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#f0f0f0]">
            <p className="text-[12px] font-bold text-[#111] tracking-widest">{s.fuelType}</p>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f0f0f0]">
                <th className="w-8 pl-4 py-3" />
                <th className="py-3 text-[11px] font-semibold text-[#aaa] text-center tracking-widest">
                  OPENING
                </th>
                <th className="py-3 text-[11px] font-semibold text-[#aaa] text-center tracking-widest">
                  CLOSING
                </th>
              </tr>
            </thead>
            <tbody>
              {s.nozzles.map((n) => (
                <tr key={n.nozzleNumber} className="border-b border-[#f9f9f9]">
                  <td className="pl-4 py-2.5 text-[11px] text-[#ccc] font-medium">{n.nozzleNumber}</td>
                  <td className="py-2.5 text-center text-[12px] font-medium text-[#333]">
                    {n.openingReading > 0 ? n.openingReading.toLocaleString() : '—'}
                  </td>
                  <td className="py-2.5 text-center text-[12px] font-medium text-[#333]">
                    {n.closingReading > 0 ? n.closingReading.toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-[#ebebeb] px-5 py-3 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[#888]">TOTAL LITRES</span>
            <span className="text-[13px] font-bold text-[#333]">
              {s.totalLitresSold.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </span>
          </div>

          <div className="px-5 py-4 border-t border-[#f0f0f0] bg-[#fafafa]">
            <p className="text-[11px] font-semibold text-[#aaa] mb-1">Total Sales</p>
            <p className="text-[28px] font-bold text-[#111] leading-none tracking-tight">
              J${s.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
