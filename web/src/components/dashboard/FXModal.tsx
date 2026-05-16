import { useState, useEffect } from 'react'
import { ArrowLeft, X, Plus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useShiftAttendance } from '../../hooks/useApi'
import { createDeposit, updateDeposit } from '../../lib/api'
import { fmtInput, parseInput, fmtNum } from '../../lib/fmt'

const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'TTD']

const ratePerCurrency: Record<string, number> = {
  USD: 150,
  EUR: 160,
  GBP: 185,
  CAD: 110,
  TTD: 22,
}

interface FXRecord {
  id: number
  amount: string
  currency: string
}

interface Props {
  onBack: () => void
  onClose: () => void
  isEditing?: boolean
  depositId?: string
  initialData?: { name: string; currency: string; fxAmount: number }
  shiftId?: string
}

let nextId = 1

export function FXModal({ onBack, onClose, isEditing, depositId, initialData, shiftId }: Props) {
  useEscapeKey(onClose)
  const queryClient = useQueryClient()
  const { data: attendance = [] } = useShiftAttendance(shiftId)
  const attendantOptions = attendance.reduce<{ id: string; name: string }[]>((acc, a) => {
    if (!acc.some((o) => o.id === a.user_id)) acc.push({ id: a.user_id, name: a.user_name })
    return acc
  }, [])

  const [records, setRecords] = useState<FXRecord[]>([
    { id: nextId++, amount: '', currency: initialData?.currency ?? 'USD' },
  ])
  const [attendant, setAttendant] = useState(initialData?.name ?? '')
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 650)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (attendantOptions.length > 0 && !attendant) setAttendant(attendantOptions[0].name)
  }, [attendantOptions.length])

  useEffect(() => {
    function onResize() { setIsNarrow(window.innerWidth < 650) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function updateRecord(id: number, field: keyof FXRecord, value: string) {
    setRecords((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r))
  }

  function addRecord() {
    setRecords((prev) => [...prev, { id: nextId++, amount: '', currency: 'USD' }])
  }

  function convertToJMD(r: FXRecord) {
    const amt = parseFloat(r.amount) || 0
    return amt * (ratePerCurrency[r.currency] ?? 0)
  }

  const total = records.reduce((sum, r) => sum + convertToJMD(r), 0)
  const effectiveTotal = total > 0 ? total : (isEditing && initialData?.fxAmount
    ? initialData.fxAmount * (ratePerCurrency[records[0].currency] ?? 0)
    : 0)

  async function handleSubmit() {
    if (!shiftId || effectiveTotal === 0) return
    const entry = attendantOptions.find((a) => a.name === attendant)
    if (!entry) return
    setLoading(true)
    setError('')
    try {
      if (isEditing && depositId) {
        const r = records[0]
        const fxAmt = parseFloat(r.amount) || (initialData?.fxAmount ?? 0)
        await updateDeposit(shiftId, depositId, {
          attendant_id: entry.id,
          type: 'FX',
          amount: convertToJMD(r),
          metadata: JSON.stringify({ fx_amount: fxAmt, currency: r.currency }),
        })
      } else {
        for (const r of records) {
          const fxAmt = parseFloat(r.amount) || 0
          if (fxAmt === 0) continue
          await createDeposit(shiftId, {
            attendant_id: entry.id,
            type: 'FX',
            amount: convertToJMD(r),
            metadata: JSON.stringify({ fx_amount: fxAmt, currency: r.currency }),
          })
        }
      }
      queryClient.invalidateQueries({ queryKey: ['shifts', shiftId, 'deposits'] })
      onClose()
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[740px] p-8 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-8">
          {!isEditing ? (
            <button onClick={onBack} className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors">
              <ArrowLeft size={13} />
              Go back
            </button>
          ) : <div />}
          <button onClick={onClose} className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors">
            <X size={13} />
            Cancel
          </button>
        </div>

        <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">{isEditing ? 'Edit an FX Record' : 'Record fx'}</h2>
        <p className="text-[14px] text-[#888] font-medium mb-6">Please use accurate info</p>

        <div className="flex flex-col gap-3 mb-2">
          {records.map((r, i) => {
            const rate = ratePerCurrency[r.currency] ?? 0
            const jmd = convertToJMD(r)
            return (
              <div key={r.id} className={`flex items-end gap-4${isNarrow ? ' flex-wrap' : ''}`}>
                <div className="flex-1">
                  {i === 0 && (
                    <label className="text-[13px] font-semibold text-[#888] block mb-2">amount</label>
                  )}
                  <div className="flex items-center border border-[#e0e0e0] rounded-xl px-4 py-2.5 gap-2">
                    <span className="text-[13px] font-bold text-[#aaa]">$</span>
                    <input
                      type="text"
                      value={fmtInput(r.amount)}
                      onChange={(e) => updateRecord(r.id, 'amount', parseInput(e.target.value))}
                      placeholder={i === 0 && initialData?.fxAmount ? String(initialData.fxAmount) : '0.00'}
                      className="flex-1 text-[13px] font-semibold text-[#333] focus:outline-none bg-transparent min-w-0"
                    />
                    <span className="text-[11px] font-semibold text-[#bbb] flex-shrink-0">
                      rate J${rate}
                    </span>
                  </div>
                </div>
                <div>
                  {i === 0 && (
                    <label className="text-[13px] font-semibold text-[#888] block mb-2">FX</label>
                  )}
                  <select
                    value={r.currency}
                    onChange={(e) => updateRecord(r.id, 'currency', e.target.value)}
                    className="border border-[#e0e0e0] rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[#333] bg-white focus:outline-none cursor-pointer min-w-[100px]"
                  >
                    {currencies.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-shrink-0">
                  {i === 0 && <div className="mb-2 h-[18px]" />}
                  <p className="py-2.5 text-[22px] font-bold text-[#111] leading-none">
                    <span className="text-[13px] font-bold text-[#aaa] mr-0.5">J$</span>
                    {fmtNum(jmd)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={addRecord}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-[#555] hover:text-[#111] transition-colors mb-6 ml-auto"
        >
          <Plus size={13} />
          Add another record
        </button>

        <div className="border-t border-[#ebebeb] mb-6" />

        <div className="mb-6">
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Total</p>
          <p className="text-[36px] font-bold text-[#111] leading-none tracking-tight">
            <span className="text-[20px] font-bold text-[#aaa] mr-1">J$</span>
            {fmtNum(total)}
          </p>
        </div>

        <div className="mb-8">
          <label className="text-[13px] font-semibold text-[#888] block mb-2">Attendant</label>
          <select
            value={attendant}
            onChange={(e) => setAttendant(e.target.value)}
            className="border border-[#ddd] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] bg-white focus:outline-none cursor-pointer min-w-[200px]"
          >
            <option value="">Select...</option>
            {attendantOptions.map((a) => (
              <option key={a.id} value={a.name}>{a.name}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-[11px] font-semibold text-red-500 mb-3">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || effectiveTotal === 0 || !attendant || !shiftId}
          className="w-full py-4 rounded-2xl border border-[#e0e0e0] text-[15px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Submit'}
        </button>
      </div>
    </div>
  )
}
