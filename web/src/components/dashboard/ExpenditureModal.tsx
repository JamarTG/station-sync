import { useState, useEffect } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useUsers } from '../../hooks/useApi'
import { createDeposit, updateDeposit } from '../../lib/api'
import { fmtInput, parseInput } from '../../lib/fmt'

const denominations = [5000, 2000, 1000, 500, 100, 50, 20, 10, 5, 1]

interface Props {
  onBack: () => void
  onClose: () => void
  isEditing?: boolean
  hideBack?: boolean
  depositId?: string
  initialData?: { requestedBy: string; description: string; denominations?: Record<number, number> }
  shiftId?: string
}

export function ExpenditureModal({ onBack, onClose, isEditing, hideBack, depositId, initialData, shiftId }: Props) {
  useEscapeKey(onClose)
  const queryClient = useQueryClient()
  const { data: users = [] } = useUsers()
  const managerRoles = new Set(['Super Admin', 'Admin', 'Manager'])
  const attendantOptions = users.filter((u) => managerRoles.has(u.role)).map((u) => ({ id: u.id, name: u.name }))

  const [counts, setCounts] = useState<Record<number, string>>({})
  const [description, setDescription] = useState('')
  const [requestedBy, setRequestedBy] = useState(initialData?.requestedBy ?? '')

  useEffect(() => {
    if (attendantOptions.length > 0 && !requestedBy) setRequestedBy(attendantOptions[0].name)
  }, [attendantOptions.length])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const total = denominations.reduce((sum, d) => {
    const n = parseInt(counts[d] ?? '', 10)
    return sum + (isNaN(n) ? 0 : n * d)
  }, 0)

  const nonEmpty = Object.fromEntries(
    denominations.filter((d) => parseInt(counts[d] ?? '', 10) > 0).map((d) => [d, parseInt(counts[d], 10)])
  )

  const initialTotal = denominations.reduce((sum, d) => sum + (initialData?.denominations?.[d] ?? 0) * d, 0)
  const effectiveTotal = total > 0 ? total : initialTotal
  const effectiveCounts = total > 0 ? nonEmpty : (initialData?.denominations ?? {})

  async function handleSubmit() {
    if (!shiftId || effectiveTotal === 0) return
    const entry = attendantOptions.find((a) => a.name === requestedBy)
    if (!entry) return
    setLoading(true)
    setError('')
    try {
      const payload = {
        attendant_id: entry.id,
        type: 'Expenditure',
        amount: effectiveTotal,
        metadata: JSON.stringify({ description: description || (initialData?.description ?? ''), denominations: effectiveCounts }),
      }
      if (isEditing && depositId) {
        await updateDeposit(shiftId, depositId, payload)
      } else {
        await createDeposit(shiftId, payload)
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
          {!isEditing && !hideBack ? (
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

        <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">{isEditing ? 'Edit an expenditure' : 'Record expenditure'}</h2>
        <p className="text-[14px] text-[#888] font-medium mb-6">Please use accurate info</p>

        <p className="text-[13px] font-semibold text-[#888] mb-2">description</p>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={initialData?.description ?? ''}
          className="w-full border border-[#e0e0e0] rounded-xl px-4 py-3 text-[13px] font-medium text-[#333] focus:outline-none mb-6"
        />

        <p className="text-[13px] font-semibold text-[#888] mb-2">amount</p>
        <table className="w-full border border-[#e0e0e0] rounded-xl overflow-hidden mb-6">
          <tbody>
            {denominations.map((d) => (
              <tr key={d} className="border-b border-[#e0e0e0] last:border-b-0">
                <td className="border-r border-[#e0e0e0] px-3 py-2 w-1/2">
                  <input
                    type="text"
                    value={fmtInput(counts[d] ?? '')}
                    onChange={(e) => setCounts((prev) => ({ ...prev, [d]: parseInput(e.target.value) }))}
                    placeholder={String(initialData?.denominations?.[d] ?? '')}
                    className="w-full text-[13px] font-medium text-[#333] focus:outline-none bg-transparent"
                  />
                </td>
                <td className="px-3 py-2 text-center text-[13px] font-medium text-[#333]">
                  {d.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Total</p>
        <p className="text-[36px] font-bold text-[#111] leading-none tracking-tight mb-6">
          <span className="text-[20px] font-bold text-[#aaa] mr-1">J$</span>
          {total.toLocaleString()}
        </p>

        <div className="mb-6">
          <label className="text-[13px] font-semibold text-[#888] block mb-2">requested by</label>
          <select
            value={requestedBy}
            onChange={(e) => setRequestedBy(e.target.value)}
            className="border border-[#ddd] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] bg-white focus:outline-none cursor-pointer min-w-[200px]"
          >
            <option value="">Select...</option>
            {attendantOptions.map((a) => (
              <option key={a.id} value={a.name}>{a.name}</option>
            ))}
          </select>
        </div>

        <div className="mb-8">
          <label className="text-[13px] font-semibold text-[#888] block mb-2">invoice</label>
          <label className="flex items-center justify-center w-full border border-[#e0e0e0] rounded-xl py-3 text-[13px] font-semibold text-[#333] hover:bg-[#f9f9f9] transition-colors cursor-pointer">
            <input type="file" className="hidden" />
            upload a file
          </label>
        </div>

        {error && <p className="text-[11px] font-semibold text-red-500 mb-3">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || effectiveTotal === 0 || !requestedBy || !shiftId}
          className="w-full py-4 rounded-2xl border border-[#e0e0e0] text-[15px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Submit'}
        </button>
      </div>
    </div>
  )
}
