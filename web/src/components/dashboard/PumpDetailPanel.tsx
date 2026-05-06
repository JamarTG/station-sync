import type { Pump } from '../../lib/api'

const gradeLabels: Record<string, string> = {
  '87': 'UNLEADED 87',
  '90': 'UNLEADED 90',
  'ADO': 'AUTO DIESEL',
  'ULSD': 'ULTRA LOW SULPHUR',
}

const NOZZLE_COUNT = 12

interface Props {
  pump: Pump | undefined
  shiftId: string | undefined
  fuelType: string | null
  /*summaries: FuelSummary[]*/
}

export function PumpDetailPanel({ fuelType }: Props) {
  const label = fuelType ? (gradeLabels[fuelType] ?? fuelType) : '—'

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
              <th className="py-2 text-[11px] font-semibold text-[#aaa] text-center tracking-widest flex-1">
                OPENING
              </th>
              <th className="py-2 text-[11px] font-semibold text-[#aaa] text-center tracking-widest flex-1">
                CLOSING
              </th>
            </tr>
          </thead>
          <tbody className="overflow-y-auto flex-1 block">
            {Array.from({ length: NOZZLE_COUNT }, (_, i) => (
              <tr key={i} className="border-b border-[#f9f9f9] flex">
                <td className="w-8 pl-4 py-3 text-[11px] text-[#ccc] font-medium flex items-center">{i + 1}</td>
                <td className="py-3 text-center flex-1 flex items-center justify-center">
                  <input
                    type="text"
                    placeholder="—"
                    className="w-20 text-center text-[12px] font-medium text-[#333] bg-transparent outline-none placeholder:text-[#ddd] focus:bg-[#f5f5f5] rounded-md px-1 py-0.5 transition-colors"
                  />
                </td>
                <td className="py-3 text-center flex-1 flex items-center justify-center">
                  <input
                    type="text"
                    placeholder="—"
                    className="w-20 text-center text-[12px] font-medium text-[#333] bg-transparent outline-none placeholder:text-[#ddd] focus:bg-[#f5f5f5] rounded-md px-1 py-0.5 transition-colors"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-[#ebebeb] px-5 py-3 flex items-center justify-between flex-shrink-0">
          <span className="text-[12px] font-semibold text-[#888]">TOTAL LITRES</span>
          <span className="text-[13px] font-bold text-[#333]">—</span>
        </div>

        <div className="px-5 py-4 border-t border-[#f0f0f0] bg-[#fafafa] flex-shrink-0">
          <p className="text-[11px] font-semibold text-[#aaa] mb-1">Total Sales</p>
          <p className="text-[28px] font-bold text-[#111] leading-none tracking-tight">J$0.00</p>
        </div>
      </div>
    </div>
  )
}
