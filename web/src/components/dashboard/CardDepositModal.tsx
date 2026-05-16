import { useState, useEffect } from 'react'
import { ArrowLeft, X, Plus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useAuth } from '../../lib/authContext'
import { createDeposit, updateDeposit } from '../../lib/api'
import { fmtInput, parseInput, fmtNum } from '../../lib/fmt'

const banks = ['NCB', 'Scotiabank', 'JMMB', 'Sagicor', 'FirstGlobal']

interface CardDepositRecord {
  id: number
  amount: string
  bank: string
  transNo: string
}

interface Props {
  onBack: () => void
  onClose: () => void
  isEditing?: boolean
  depositId?: string
  initialData?: { depositedBy: string; description: string; amount: number; bank?: string; transNo?: string }
  shiftId?: string
}

let nextId = 1

export function CardDepositModal({ onBack, onClose, isEditing, depositId, initialData, shiftId }: Props) {
  useEscapeKey(onClose)
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [records, setRecords] = useState<CardDepositRecord[]>([
    { id: nextId++, amount: '', bank: initialData?.bank ?? 'NCB', transNo: '' },
  ])
  const [depositedBy, setDepositedBy] = useState('')
  const [description, setDescription] = useState('')
  const [touchedTransNo, setTouchedTransNo] = useState<Record<number, boolean>>({})
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 650)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function onResize() { setIsNarrow(window.innerWidth < 650) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function updateRecord(id: number, field: keyof CardDepositRecord, value: string) {
    setRecords((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r))
  }

  function addRecord() {
    setRecords((prev) => [...prev, { id: nextId++, amount: '', bank: 'NCB', transNo: '' }])
  }

  function isDuplicateTransNo(record: CardDepositRecord) {
    if (!record.transNo.trim()) return false
    return records.some(
      (r) => r.id !== record.id && r.bank === record.bank && r.transNo.trim() === record.transNo.trim()
    )
  }

  const hasDuplicates = records.some(isDuplicateTransNo)
  const total = records.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
  const effectiveTotal = total > 0 ? total : (isEditing && initialData?.amount ? initialData.amount : 0)

  async function handleSubmit() {
    if (!shiftId || !user || total === 0 || hasDuplicates) return
    setLoading(true)
    setError('')
    try {
      if (isEditing && depositId) {
        const r = records[0]
        await updateDeposit(shiftId, depositId, {
          attendant_id: user.id,
          type: 'CardDeposit',
          amount: parseFloat(r.amount) || (initialData?.amount ?? 0),
          metadata: JSON.stringify({ deposited_by: depositedBy || (initialData?.depositedBy ?? ''), description: description || (initialData?.description ?? ''), bank: r.bank, trans_no: r.transNo || (initialData?.transNo ?? '') }),
        })
      } else {
        for (const r of records) {
          const amt = parseFloat(r.amount) || 0
          if (amt === 0) continue
          await createDeposit(shiftId, {
            attendant_id: user.id,
            type: 'CardDeposit',
            amount: amt,
            metadata: JSON.stringify({ deposited_by: depositedBy, description, bank: r.bank, trans_no: r.transNo }),
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

        <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">{isEditing ? 'Edit card deposit' : 'Record card deposit'}</h2>
        <p className="text-[14px] text-[#888] font-medium mb-6">Please use accurate info</p>

        <div className="mb-6">
          <label className="text-[13px] font-semibold text-[#888] block mb-2">description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={initialData?.description || 'e.g. Card settlement'}
            className="w-full border border-[#e0e0e0] rounded-xl px-4 py-3 text-[13px] font-medium text-[#333] focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-3 mb-2">
          {records.map((r) => {
            const showTransError = touchedTransNo[r.id] && isDuplicateTransNo(r)
            return (
              <div key={r.id} className={`flex items-end gap-3${isNarrow ? ' flex-wrap' : ''}`}>
                <div className="flex-1">
                  {r.id === records[0].id && (
                    <label className="text-[13px] font-semibold text-[#888] block mb-2">amount</label>
                  )}
                  <div className="flex items-center border border-[#e0e0e0] rounded-xl px-4 py-2.5 gap-2">
                    <span className="text-[13px] font-bold text-[#aaa]">J$</span>
                    <input
                      type="text"
                      value={fmtInput(r.amount)}
                      onChange={(e) => updateRecord(r.id, 'amount', parseInput(e.target.value))}
                      placeholder={r.id === records[0].id && initialData?.amount ? fmtInput(String(initialData.amount)) : '0.00'}
                      className="flex-1 text-[13px] font-semibold text-[#333] focus:outline-none bg-transparent min-w-0"
                    />
                  </div>
                </div>
                <div>
                  {r.id === records[0].id && (
                    <label className="text-[13px] font-semibold text-[#888] block mb-2">bank</label>
                  )}
                  <select
                    value={r.bank}
                    onChange={(e) => updateRecord(r.id, 'bank', e.target.value)}
                    className="border border-[#e0e0e0] rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[#333] bg-white focus:outline-none cursor-pointer min-w-[120px]"
                  >
                    {banks.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  {r.id === records[0].id && (
                    <label className="text-[13px] font-semibold text-[#888] block mb-2">trans #</label>
                  )}
                  <input
                    type="text"
                    value={r.transNo}
                    onChange={(e) => updateRecord(r.id, 'transNo', e.target.value)}
                    onBlur={() => setTouchedTransNo((prev) => ({ ...prev, [r.id]: true }))}
                    placeholder={r.id === records[0].id && initialData?.transNo ? initialData.transNo : '—'}
                    className={`border rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[#333] focus:outline-none w-[100px] ${showTransError ? 'border-red-400 bg-red-50' : 'border-[#e0e0e0]'}`}
                  />
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
          disabled={loading || hasDuplicates || effectiveTotal === 0 || !shiftId}
          className="w-full py-4 rounded-2xl border border-[#e0e0e0] text-[15px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Submit'}
        </button>
      </div>
    </div>
  )
}
