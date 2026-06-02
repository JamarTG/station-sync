import { useState, useEffect } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useShiftAttendance, useShiftFuelPrices, useFuels, useCustomers } from '../../hooks/useApi'
import { createDeposit, updateDeposit } from '../../lib/api'
import { loadChargeIds } from '../../lib/chargeIds'
import { fmtInput, parseInput, fmtNum } from '../../lib/fmt'

interface Props {
  onBack: () => void
  onClose: () => void
  isEditing?: boolean
  depositId?: string
  initialData?: { name: string; fuelType: string; amount: number }
  shiftId?: string
}

export function ChargeModal({ onBack, onClose, isEditing, depositId, initialData, shiftId }: Props) {
  useEscapeKey(onClose)
  const queryClient = useQueryClient()
  const { data: attendance = [] } = useShiftAttendance(shiftId)
  const { data: fuelPricesData = [] } = useShiftFuelPrices(shiftId)
  const { data: fuels = [] } = useFuels()
  const { data: allCustomers = [] } = useCustomers()

  // Charge customer options
  const chargeIds = loadChargeIds()
  const customerOptions = allCustomers.filter(
    (c) => c.customer_type === 'charge' || chargeIds.has(c.id)
  )

  // First shift attendant used silently as attendant_id (required by API)
  const attendantOptions = attendance.reduce<{ id: string; name: string }[]>((acc, a) => {
    if (!acc.some((o) => o.id === a.user_id)) acc.push({ id: a.user_id, name: a.user_name })
    return acc
  }, [])

  const pricePerLitre: Record<string, number> = Object.fromEntries(
    fuelPricesData.map((fp) => [fp.fuel_name, fp.price])
  )

  const [fuelGrade,    setFuelGrade]    = useState(initialData?.fuelType ?? '')
  const [amount,       setAmount]       = useState('')
  const [customer,     setCustomer]     = useState(initialData?.name ?? '')
  const [licencePlate, setLicencePlate] = useState('')
  const [attendantId,  setAttendantId]  = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')

  useEffect(() => {
    if (fuels.length > 0 && !fuelGrade) setFuelGrade(fuels[0].name)
  }, [fuels.length])

  useEffect(() => {
    if (customerOptions.length > 0 && !customer) setCustomer(customerOptions[0].name)
  }, [customerOptions.length])

  useEffect(() => {
    if (attendantOptions.length > 0 && !attendantId) setAttendantId(attendantOptions[0].id)
  }, [attendantOptions.length])

  const numAmount = parseFloat(amount) || 0
  const effectiveAmount = numAmount > 0 ? numAmount : (initialData?.amount ?? 0)
  const litres = fuelGrade && pricePerLitre[fuelGrade] ? effectiveAmount / pricePerLitre[fuelGrade] : 0

  async function handleSubmit() {
    if (!shiftId || effectiveAmount === 0 || !fuelGrade || !customer || !licencePlate.trim() || !attendantId) return
    const entry = attendantOptions.find((a) => a.id === attendantId)
    if (!entry) return
    setLoading(true)
    setError('')
    try {
      const payload = {
        attendant_id: entry.id,
        type: 'Charge',
        amount: effectiveAmount,
        metadata: JSON.stringify({
          customer_name: customer,
          license_plate: licencePlate.trim() || null,
          fuel_type: fuelGrade,
          litres: parseFloat(litres.toFixed(4)),
        }),
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

        <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">{isEditing ? 'Edit a charge' : 'Record charge'}</h2>
        <p className="text-[14px] text-[#888] font-medium mb-6">Please use accurate info</p>

        <div className="mb-6">
          <label className="text-[13px] font-semibold text-[#888] block mb-2">fuel</label>
          <select
            value={fuelGrade}
            onChange={(e) => setFuelGrade(e.target.value)}
            className="border border-[#ddd] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] bg-white focus:outline-none cursor-pointer min-w-[200px]"
          >
            <option value="">Select...</option>
            {fuels.map((f) => (
              <option key={f.id} value={f.name}>{f.name}</option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <label className="text-[13px] font-semibold text-[#888] block mb-2">amount</label>
          <div className="flex items-center border border-[#e0e0e0] rounded-xl px-4 py-3 gap-2">
            <span className="text-[15px] font-bold text-[#aaa]">J$</span>
            <input
              type="text"
              value={fmtInput(amount)}
              onChange={(e) => setAmount(parseInput(e.target.value))}
              placeholder={initialData?.amount ? fmtInput(String(initialData.amount)) : '0'}
              className="flex-1 text-[15px] font-semibold text-[#333] focus:outline-none bg-transparent"
            />
          </div>
        </div>

        <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Litres</p>
        <p className="text-[36px] font-bold text-[#111] leading-none tracking-tight mb-6">
          {fmtNum(litres)}
        </p>

        <p className="text-[13px] font-semibold text-[#888] mb-2">license plate no.</p>
        <input
          type="text"
          value={licencePlate}
          onChange={(e) => setLicencePlate(e.target.value)}
          placeholder="e.g. AB 1234"
          className="w-48 border border-[#e0e0e0] rounded-xl px-4 py-3 text-[13px] font-medium text-[#333] focus:outline-none mb-6"
        />

        <div className="mb-6">
          <label className="text-[13px] font-semibold text-[#888] block mb-2">customer</label>
          <select
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="border border-[#ddd] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] bg-white focus:outline-none cursor-pointer min-w-[200px]"
          >
            <option value="">Select...</option>
            {customerOptions.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="mb-8">
          <label className="text-[13px] font-semibold text-[#888] block mb-2">attendant</label>
          <select
            value={attendantId}
            onChange={(e) => setAttendantId(e.target.value)}
            className="border border-[#ddd] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] bg-white focus:outline-none cursor-pointer min-w-[200px]"
          >
            <option value="">Select...</option>
            {attendantOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-[11px] font-semibold text-red-500 mb-3">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || effectiveAmount === 0 || !fuelGrade || !customer || !licencePlate.trim() || !attendantId || !shiftId}
          className="w-full py-4 rounded-2xl border border-[#e0e0e0] text-[15px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Submit'}
        </button>
      </div>
    </div>
  )
}
