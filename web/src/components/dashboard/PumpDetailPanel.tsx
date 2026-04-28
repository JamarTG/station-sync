import type { PumpGrade } from './PumpsPanel'

const gradeLabels: Record<PumpGrade, string> = {
  '87': 'UNLEADED 87',
  '90': 'UNLEADED 90',
  'ADO': 'AUTO DIESEL',
  'ULSD': 'ULTRA LOW SULPHUR',
}

const NOZZLE_COUNT = 12

interface Props {
  grade: PumpGrade
}

export function PumpDetailPanel({ grade }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#f0f0f0]">
          <p className="text-[12px] font-bold text-[#111] tracking-widest">{gradeLabels[grade]}</p>
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
            {Array.from({ length: NOZZLE_COUNT }, (_, i) => (
              <tr key={i} className="border-b border-[#f9f9f9]">
                <td className="pl-4 py-2.5 text-[11px] text-[#ccc] font-medium">{i + 1}</td>
                <td className="py-2.5 text-center">
                  <input
                    type="text"
                    placeholder="—"
                    className="w-20 text-center text-[12px] font-medium text-[#333] bg-transparent outline-none placeholder:text-[#ddd] focus:bg-[#f5f5f5] rounded-md px-1 py-0.5 transition-colors"
                  />
                </td>
                <td className="py-2.5 text-center">
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

        <div className="border-t border-[#ebebeb] px-5 py-3 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[#888]">TOTAL LITRES</span>
          <span className="text-[13px] font-bold text-[#333]">2,5051</span>
        </div>

        <div className="px-5 py-4 border-t border-[#f0f0f0] bg-[#fafafa]">
          <p className="text-[11px] font-semibold text-[#aaa] mb-1">Total Sales</p>
          <p className="text-[28px] font-bold text-[#111] leading-none tracking-tight">J$0.00</p>
        </div>
      </div>
    </div>
  )
}
