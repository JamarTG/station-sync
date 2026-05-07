import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { FuelReceivalModal } from './FuelReceivalModal'
import { fmtInput, parseInput, fmtNum } from '../../lib/fmt'

export type TankGrade = '87' | '90' | 'ADO' | 'ULSD'

interface Props {
  grade: TankGrade
  tankReading: { opening: string; closing: string }
  onReadingChange: (r: { opening: string; closing: string }) => void
  actualLitresSold: number | null
}

export function TankDetailPanel({ grade, tankReading, onReadingChange, actualLitresSold }: Props) {
  const [hasReceival, setHasReceival] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    setHasReceival(false)
    setShowAdd(false)
    setShowEdit(false)
    setTouched(false)
  }, [grade])

  const tOpen = parseFloat(tankReading.opening)
  const tClose = parseFloat(tankReading.closing)
  const hasData = tankReading.opening !== '' || tankReading.closing !== ''
  const tankError = touched && !isNaN(tOpen) && !isNaN(tClose) && tClose > tOpen
  const suggestedLitres = !isNaN(tOpen) && !isNaN(tClose) && tOpen >= tClose ? tOpen - tClose : null
  const variance = suggestedLitres != null && actualLitresSold != null ? suggestedLitres - actualLitresSold : null
  const wetStockPct =
    variance != null && actualLitresSold != null && actualLitresSold > 0
      ? (variance / actualLitresSold) * 100
      : null

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white rounded-none border border-[#ebebeb] overflow-hidden flex flex-col flex-1">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#f0f0f0]">
              <th className="py-2 text-[11px] font-semibold text-[#aaa] text-center tracking-widest pl-5">OPENING</th>
              <th className="py-2 text-[11px] font-semibold text-[#aaa] text-center tracking-widest pr-5">CLOSING</th>
            </tr>
          </thead>
          <tbody>
            <tr className={clsx('border-b border-[#f9f9f9]', tankError && 'bg-red-50')}>
              <td className="py-3 text-center">
                <input
                  type="text"
                  value={fmtInput(tankReading.opening)}
                  onChange={(e) => onReadingChange({ ...tankReading, opening: parseInput(e.target.value) })}
                  onBlur={() => setTouched(true)}
                  placeholder="—"
                  className={clsx(
                    'w-24 text-center text-[13px] font-medium bg-transparent outline-none placeholder:text-[#ddd] focus:bg-[#f5f5f5] rounded-md px-1 py-0.5 transition-colors',
                    tankError ? 'text-red-500' : 'text-[#333]'
                  )}
                />
              </td>
              <td className="py-3 text-center">
                <input
                  type="text"
                  value={fmtInput(tankReading.closing)}
                  onChange={(e) => onReadingChange({ ...tankReading, closing: parseInput(e.target.value) })}
                  onBlur={() => setTouched(true)}
                  placeholder="—"
                  className={clsx(
                    'w-24 text-center text-[13px] font-medium bg-transparent outline-none placeholder:text-[#ddd] focus:bg-[#f5f5f5] rounded-md px-1 py-0.5 transition-colors',
                    tankError ? 'text-red-500' : 'text-[#333]'
                  )}
                />
              </td>
            </tr>
          </tbody>
        </table>

        <div className="px-5 pt-4 pb-2 border-t border-[#f0f0f0] space-y-3 mt-auto">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-widest text-[#aaa]">SUGGESTED LITRES SOLD</span>
            <span className="text-[12px] font-bold text-[#333]">
              {suggestedLitres != null ? fmtNum(suggestedLitres) : <span className="text-[#bbb]">---</span>}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-widest text-[#aaa]">ACTUAL LITRES SOLD</span>
            <span className="text-[12px] font-bold text-[#333]">
              {actualLitresSold != null ? fmtNum(actualLitresSold) : <span className="text-[#bbb]">---</span>}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-widest text-[#aaa]">VARIANCE</span>
            <span className={clsx('text-[12px] font-bold', variance != null ? (variance < 0 ? 'text-red-500' : 'text-[#333]') : 'text-[#bbb]')}>
              {variance != null ? fmtNum(variance) : '---'}
            </span>
          </div>
        </div>

        <div className="px-5 pt-2 pb-5">
          <p className="text-[10px] font-semibold tracking-widest text-[#aaa] mb-1">WET STOCK SUMMARY</p>
          <p className={clsx('text-[28px] font-bold leading-none tracking-tight', wetStockPct != null && wetStockPct < 0 ? 'text-red-500' : 'text-[#111]')}>
            {wetStockPct != null
              ? `${wetStockPct >= 0 ? '+' : ''}${wetStockPct.toFixed(2)}%`
              : hasData || actualLitresSold != null ? '—' : '+0.00%'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-none border border-[#ebebeb] p-5 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[12px] font-bold tracking-widest text-[#111]">RECEIVAL LOG</p>
          {hasReceival ? (
            <button onClick={() => setShowEdit(true)} className="text-[12px] font-semibold text-[#333] border border-[#ddd] rounded-lg px-3 py-1 hover:bg-[#f4f4f4] transition-colors">
              Edit
            </button>
          ) : (
            <button onClick={() => setShowAdd(true)} className="text-[12px] font-semibold text-[#333] border border-[#ddd] rounded-lg px-3 py-1 hover:bg-[#f4f4f4] transition-colors">
              Add
            </button>
          )}
        </div>
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-widest text-[#aaa]">FUEL ORDERED</span>
            <span className="text-[12px] font-bold text-[#bbb]">---</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-widest text-[#aaa]">FUEL RECEIVED</span>
            <span className="text-[12px] font-bold text-[#bbb]">---</span>
          </div>
        </div>
        <p className="text-[11px] font-semibold text-[#aaa] mb-1">Variance</p>
        <p className="text-[28px] font-bold text-[#111] leading-none">0.00</p>
      </div>

      {showAdd && (
        <FuelReceivalModal
          onBack={() => setShowAdd(false)}
          onClose={() => setShowAdd(false)}
          onSubmit={() => { setHasReceival(true); setShowAdd(false) }}
        />
      )}
      {showEdit && (
        <FuelReceivalModal
          isEditing
          onBack={() => setShowEdit(false)}
          onClose={() => setShowEdit(false)}
          onSubmit={() => setShowEdit(false)}
        />
      )}
    </div>
  )
}
