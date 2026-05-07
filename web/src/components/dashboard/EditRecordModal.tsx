import { useState } from 'react'
import { X } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import type { ActivityRow } from './RecentActivityCard'
import { fmtInput, parseInput } from '../../lib/fmt'

const fuelGrades = ['87', '90', 'ADO', 'ULSD']
const banks = ['NCB', 'Scotiabank', 'JMMB', 'Sagicor', 'FirstGlobal']
const currencies = ['USD', 'EUR', 'GBP', 'CAD']
const depositTypes = ['Cash', 'Card', 'FX']
const attendants = ['T. Brisco', 'S. Smith', 'S. Lawes', 'A. Lewis']
const pumps = ['Pump 1', 'Pump 2', 'Pump 3', 'Pump 4']

function title(row: ActivityRow): string {
  if (row.type === 'attendant') return 'Edit a Cash Drop'
  if (row.type === 'expenditure') return 'Edit an Expenditure'
  if (row.type === 'charges') return 'Edit a Charge'
  if (row.type === 'card') return 'Edit a Card Record'
  if (row.type === 'advance') return 'Edit an Advance'
  if (row.type === 'fx') return 'Edit an FX Record'
  if (row.type === 'deposit') return 'Edit a Deposit'
  if (row.type === 'attendants') return 'Edit an Attendant'
  return 'Edit Record'
}

interface Props {
  row: ActivityRow
  onClose: () => void
}

export function EditRecordModal({ row, onClose }: Props) {
  useEscapeKey(onClose)

  const [form, setForm] = useState<Record<string, string>>(() => {
    if (row.type === 'attendant') return { name: row.name, time: row.time, amount: String(row.amount) }
    if (row.type === 'expenditure') return { requestedBy: row.requestedBy, description: row.description, amount: String(row.amount) }
    if (row.type === 'charges') return { name: row.name, fuelType: row.fuelType, litres: String(row.litres), amount: String(row.amount) }
    if (row.type === 'card') return { name: row.name, bank: row.bank, litres: String(row.litres), amount: String(row.amount) }
    if (row.type === 'advance') return { name: row.name, fuelType: row.fuelType, litres: String(row.litres), amount: String(row.amount) }
    if (row.type === 'fx') return { name: row.name, fxAmount: String(row.fxAmount), currency: row.currency, amount: String(row.amount) }
    if (row.type === 'deposit') return { name: row.name, description: row.description, depositType: row.depositType, amount: String(row.amount) }
    if (row.type === 'attendants') return { name: row.name, pump: row.pump, balance: String(row.balance), clockIn: row.clockIn }
    return {}
  })

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  const inputCls = 'w-full border border-[#e0e0e0] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] focus:outline-none bg-white'
  const labelCls = 'text-[13px] font-semibold text-[#888] block mb-2'
  const fieldCls = 'mb-5'

  function SelectField({ label, k, options }: { label: string; k: string; options: string[] }) {
    return (
      <div className={fieldCls}>
        <label className={labelCls}>{label}</label>
        <select value={form[k] ?? ''} onChange={(e) => set(k, e.target.value)} className={inputCls + ' cursor-pointer'}>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    )
  }

  function TextField({ label, k }: { label: string; k: string }) {
    return (
      <div className={fieldCls}>
        <label className={labelCls}>{label}</label>
        <input type="text" value={form[k] ?? ''} onChange={(e) => set(k, e.target.value)} className={inputCls} />
      </div>
    )
  }

  function NumericField({ label, k }: { label: string; k: string }) {
    return (
      <div className={fieldCls}>
        <label className={labelCls}>{label}</label>
        <input
          type="text"
          value={fmtInput(form[k] ?? '')}
          onChange={(e) => set(k, parseInput(e.target.value))}
          className={inputCls}
        />
      </div>
    )
  }

  function AmountField({ label = 'Amount' }: { label?: string }) {
    return (
      <div className={fieldCls}>
        <label className={labelCls}>{label}</label>
        <div className="flex items-center border border-[#e0e0e0] rounded-xl px-4 py-2.5 gap-2">
          <span className="text-[13px] font-bold text-[#aaa]">J$</span>
          <input
            type="text"
            value={fmtInput(form['amount'] ?? '')}
            onChange={(e) => set('amount', parseInput(e.target.value))}
            className="flex-1 text-[13px] font-semibold text-[#333] focus:outline-none bg-transparent"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-[520px] p-8 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end mb-8">
          <button onClick={onClose} className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors">
            <X size={13} />
            Cancel
          </button>
        </div>

        <h2 className="text-[32px] font-bold text-[#111] leading-none mb-8">{title(row)}</h2>

        {row.type === 'attendant' && (
          <>
            <SelectField label="Attendant" k="name" options={attendants} />
            <TextField label="Time" k="time" />
            <AmountField />
          </>
        )}

        {row.type === 'expenditure' && (
          <>
            <SelectField label="Requested by" k="requestedBy" options={attendants} />
            <TextField label="Description" k="description" />
            <AmountField />
          </>
        )}

        {row.type === 'charges' && (
          <>
            <SelectField label="Attendant" k="name" options={attendants} />
            <SelectField label="Fuel type" k="fuelType" options={fuelGrades} />
            <NumericField label="Litres" k="litres" />
            <AmountField />
          </>
        )}

        {row.type === 'card' && (
          <>
            <SelectField label="Attendant" k="name" options={attendants} />
            <SelectField label="Bank" k="bank" options={banks} />
            <AmountField />
          </>
        )}

        {row.type === 'advance' && (
          <>
            <SelectField label="Attendant" k="name" options={attendants} />
            <SelectField label="Fuel type" k="fuelType" options={fuelGrades} />
            <NumericField label="Litres" k="litres" />
            <AmountField />
          </>
        )}

        {row.type === 'fx' && (
          <>
            <SelectField label="Attendant" k="name" options={attendants} />
            <SelectField label="Currency" k="currency" options={currencies} />
            <NumericField label="FX Amount" k="fxAmount" />
            <AmountField label="JMD Equivalent" />
          </>
        )}

        {row.type === 'deposit' && (
          <>
            <SelectField label="Deposited by" k="name" options={attendants} />
            <TextField label="Description" k="description" />
            <SelectField label="Type" k="depositType" options={depositTypes} />
            <AmountField />
          </>
        )}

        {row.type === 'attendants' && (
          <>
            <TextField label="Name" k="name" />
            <SelectField label="Pump" k="pump" options={pumps} />
            <TextField label="Clock in" k="clockIn" />
            <div className={fieldCls}>
              <label className={labelCls}>Balance</label>
              <div className="flex items-center border border-[#e0e0e0] rounded-xl px-4 py-2.5 gap-2">
                <span className="text-[13px] font-bold text-[#aaa]">J$</span>
                <input
                  type="text"
                  value={fmtInput(form['balance'] ?? '')}
                  onChange={(e) => set('balance', parseInput(e.target.value))}
                  className="flex-1 text-[13px] font-semibold text-[#333] focus:outline-none bg-transparent"
                />
              </div>
            </div>
          </>
        )}

        <button
          onClick={onClose}
          className="w-full py-4 rounded-2xl bg-[#111] text-[15px] font-semibold text-white hover:bg-[#222] transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  )
}
