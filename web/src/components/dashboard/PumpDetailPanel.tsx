import type { Pump, FuelSummary } from '../../lib/api'

interface Props {
  pump: Pump | undefined
  shiftId: string | undefined
  fuelType: string | null
  summaries: FuelSummary[]
}

export function PumpDetailPanel({ pump, shiftId, fuelType, summaries }: Props) {
  const summary = summaries.find((s) => s.fuelType === fuelType)

  const reason = !pump
    ? 'No pump configured'
    : !shiftId
    ? 'No shift found for today'
    : !fuelType
    ? 'No fuel types configured'
    : summaries.length === 0
    ? 'No readings recorded for this shift'
    : `No readings for "${fuelType}" on this pump`

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center py-10 min-[1200px]:py-0 min-[1200px]:h-full px-6 text-center gap-1.5">
        <p className="text-[13px] font-semibold text-[#ccc]">{reason}</p>
        <p className="text-[11px] text-[#ddd]">Data will appear once a shift is active</p>
      </div>
    )
  }

  return (
    <>
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
          {summary.nozzles.map((n) => (
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
          {summary.totalLitresSold.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          })}
        </span>
      </div>

      <div className="px-5 py-4 border-t border-[#f0f0f0] bg-[#fafafa]">
        <p className="text-[11px] font-semibold text-[#aaa] mb-1">Total Sales</p>
        <p className="text-[28px] font-bold text-[#111] leading-none tracking-tight">
          J$
          {summary.totalSales.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
      </div>
    </>
  )
}
