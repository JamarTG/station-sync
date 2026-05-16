import { useState, useEffect } from 'react'
import { ArrowLeft, X, Plus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useAuth } from '../../lib/authContext'
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

interface FXDepositRecord {
  id: number
  amount: string
  currency: string
}

interface Props {
  onBack: () => void
  onClose: () => void
  isEditing?: boolean
  depositId?: string
  initialData?: { depositedBy: string; description: string; fxAmount: number; currency: string }
  shiftId?: string
}

let nextId = 1

export function FXDepositModal({ onBack, onClose, isEditing, depositId, initialData, shiftId }: Props) {
  useEscapeKey(onClose)
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [records, setRecords] = useState<FXDepositRecord[]>([
    { id: nextId++, amount: '', currency: initialData?.currency ?? 'USD' },
  ])
  const [depositedBy, setDepositedBy] = useState('')
  const [description, setDescription] = useState('')
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 650)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function onResize() { setIsNarrow(window.innerWidth < 650) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function updateRecord(id: number, field: keyof FXDepositRecord, value: string) {
    setRecords((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r))
  }

  function addRecord() {
    setRecords((prev) => [...prev, { id: nextId++, amount: '', currency: 'USD' }])
  }

  function convertToJMD(r: FXDepositRecord) {
    const amt = parseFloat(r.amount) || 0
    return amt * (ratePerCurrency[r.currency] ?? 0)
  }

  const total = records.reduce((sum, r) => sum + convertToJMD(r), 0)
  const effectiveTotal = total > 0 ? total : (isEditing && initialData?.fxAmount
    ? initialData.fxAmount * (ratePerCurrency[records[0].currency] ?? 0)
    : 0)

  async function handleSubmit() {
    if (!shiftId || !user || total === 0) return
    setLoading(true)
    setError('')
    try {
      if (isEditing && depositId) {
        const r = records[0]
        const fxAmt = parseFloat(r.amount) || (initialData?.fxAmount ?? 0)
        await updateDeposit(shiftId, depositId, {
          attendant_id: user.id,
          type: 'FXDeposit',
          amount: fxAmt * (ratePerCurrency[r.currency] ?? 0),
          metadata: JSON.stringify({ deposited_by: depositedBy || (initialData?.depositedBy ?? ''), description: description || (initialData?.description ?? ''), fx_amount: fxAmt, currency: r.currency }),
        })
      } else {
        for (const r of records) {
          const fxAmt = parseFloat(r.amount) || 0
          if (fxAmt === 0) continue
          await createDeposit(shiftId, {
            attendant_id: user.id,
            type: 'FXDeposit',
            amount: convertToJMD(r),
            metadata: JSON.stringify({ deposited_by: depositedBy, description, fx_amount: fxAmt, currency: r.currency }),
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
            <button
              onClick={onBack}
              className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
            >
              <ArrowLeft size={13} />
              Go back
            </button>
          ) : <div />}
          <button
            onClick={onClose}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            <X size={13} />
            Cancel
          </button>
        </div>

        <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">{isEditing ? 'Edit FX deposit' : 'Record FX deposit'}</h2>
        <p className="text-[14px] text-[#888] font-medium mb-6">Please use accurate info</p>

        <div className="mb-6">
          <label className="text-[13px] font-semibold text-[#888] block mb-2">description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={initialData?.description || 'e.g. FX deposit'}
            className="w-full border border-[#e0e0e0] rounded-xl px-4 py-3 text-[13px] font-medium text-[#333] focus:outline-none"
          />
        </div>

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
          <p className="text-[32px] font-bold text-[#111] leading-none tracking-tight">
            <span className="text-[18px] font-bold text-[#aaa] mr-1">J$</span>{fmtNum(total)}
          </p>
        </div>

        <div className="mb-8">
          <label className="text-[13px] font-semibold text-[#888] block mb-2">deposited by</label>
          <input
            type="text"
            value={depositedBy}
            onChange={(e) => setDepositedBy(e.target.value)}
            placeholder={initialData?.depositedBy ?? ''}
            className="border border-[#ddd] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] focus:outline-none min-w-[200px]"
          />
        </div>

        {error && <p className="text-[11px] font-semibold text-red-500 mb-3">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || effectiveTotal === 0 || !shiftId}
          className="w-full py-4 rounded-2xl border border-[#e0e0e0] text-[15px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Submit'}
        </button>
      </div>
    </div>
  )
}
