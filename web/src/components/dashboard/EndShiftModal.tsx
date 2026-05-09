import { useState } from 'react'
import { ArrowLeft, X, Plus, Minus } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { CardSettlementReviewModal, type CardTransaction } from './CardSettlementReviewModal'
import { fmtInput, parseInput } from '../../lib/fmt'

const allDenominations = [5000, 2000, 1000, 500, 100, 50, 20, 10, 5, 1]
const zeroCounts = Object.fromEntries(allDenominations.map((d) => [d, 0]))

const fuelGrades = ['87', '90', 'ADO', 'ULSD']

const initialCardData: Record<string, CardTransaction[]> = {
  NCB: [
    { id: 1, transNo: 'TXN-001', attendant: 'S. Smith', amount: 23000.0 },
    { id: 2, transNo: 'TXN-002', attendant: 'A. Lewis', amount: 11500.0 },
  ],
  Scotiabank: [
    { id: 3, transNo: 'TXN-003', attendant: 'T. Brisco', amount: 15000.0 },
  ],
}

const banks = Object.keys(initialCardData)

type Step = 'password' | 'cash' | 'card' | 'summary'

interface Props {
  onClose: () => void
  onConfirm?: () => void
}

export function EndShiftModal({ onClose, onConfirm }: Props) {
  useEscapeKey(onClose)
  const [step, setStep] = useState<Step>('password')
  const [password, setPassword] = useState('')

  // Cash state
  const [savedCounts, setSavedCounts] = useState<Record<number, number>>(zeroCounts)
  const [editCounts, setEditCounts] = useState<Record<number, string>>({})
  const [isEditingCounts, setIsEditingCounts] = useState(false)
  const [showBagNo, setShowBagNo] = useState(false)
  const [bagNo, setBagNo] = useState('')

  const cashTotal = allDenominations.reduce((sum, d) => sum + d * (savedCounts[d] ?? 0), 0)

  function startEditing() {
    setEditCounts(Object.fromEntries(allDenominations.map((d) => [d, savedCounts[d] === 0 ? '' : String(savedCounts[d])])))
    setIsEditingCounts(true)
  }

  function saveEditing() {
    setSavedCounts(Object.fromEntries(allDenominations.map((d) => [d, parseInt(editCounts[d] ?? '') || 0])))
    setIsEditingCounts(false)
  }

  // Card state
  const [cardTransactions, setCardTransactions] = useState<Record<string, CardTransaction[]>>(initialCardData)
  const [settlementTotals, setSettlementTotals] = useState<Record<string, string>>({})
  const [settlementFiles, setSettlementFiles] = useState<Record<string, File | null>>({})
  const [settlementTouched, setSettlementTouched] = useState<Record<string, boolean>>({})
  const [reviewBank, setReviewBank] = useState<string | null>(null)

  const cardTotal = banks.reduce((sum, bank) => sum + (cardTransactions[bank] ?? []).reduce((s, t) => s + t.amount, 0), 0)

  const stepOrder: Step[] = ['password', 'cash', 'card', 'summary']

  function goBack() {
    const idx = stepOrder.indexOf(step)
    if (idx > 0) setStep(stepOrder[idx - 1])
  }

  function goNext() {
    const idx = stepOrder.indexOf(step)
    if (idx < stepOrder.length - 1) setStep(stepOrder[idx + 1])
  }

  const header = (
    <div className="flex items-center justify-between mb-8">
      {step !== 'password' && step !== 'cash' ? (
        <button
          onClick={goBack}
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
  )

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-3xl w-full max-w-[580px] p-8 shadow-xl h-[700px] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {header}

          {/* ── Step 1: Password ── */}
          {step === 'password' && (
            <>
              <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">End the shift</h2>
              <p className="text-[14px] text-[#888] font-medium mb-8">Enter your password to continue</p>

              <div className="mb-6">
                <label className="text-[13px] font-semibold text-[#888] block mb-2">supervisor</label>
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#f0f0f0] flex items-center justify-center flex-shrink-0">
                    <span className="text-[11px] font-bold text-[#555]">AL</span>
                  </div>
                  <span className="text-[20px] font-semibold text-[#333]">A. Lewis</span>
                </div>
              </div>

              <div className="mb-6">
                <label className="text-[13px] font-semibold text-[#888] block mb-2">password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && password.length > 0 && goNext()}
                  placeholder="••••••••"
                  className="w-full border border-[#e0e0e0] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex justify-end mb-4">
                <button type="button" className="text-[12px] font-semibold text-[#aaa] hover:text-[#555] transition-colors">
                  Forgot your password?
                </button>
              </div>

              <button
                onClick={() => password.length > 0 && goNext()}
                className="w-full py-4 rounded-2xl bg-[#111] text-[15px] font-semibold text-white hover:bg-[#222] transition-colors"
              >
                Continue
              </button>
            </>
          )}

          {/* ── Step 2: Cash ── */}
          {step === 'cash' && (
            <>
              <div className="flex items-end justify-between mb-8">
                <div>
                  <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">Cash</h2>
                  <p className="text-[14px] text-[#888] font-medium">
                    J$ {cashTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} total
                  </p>
                </div>
                {isEditingCounts ? (
                  <button onClick={saveEditing} className="px-4 py-1.5 rounded-lg bg-[#111] text-[13px] font-semibold text-white hover:bg-[#222] transition-colors">
                    Save
                  </button>
                ) : (
                  <button onClick={startEditing} className="text-[13px] font-semibold text-[#333] border border-[#ddd] rounded-lg px-3 py-1 hover:bg-[#f4f4f4] transition-colors">
                    Update
                  </button>
                )}
              </div>

              <div className="mb-4">
                {showBagNo && (
                  <div className="mb-2">
                    <label className="text-[13px] font-semibold text-[#888] block mb-2">bag no.</label>
                    <input
                      type="text"
                      value={bagNo}
                      onChange={(e) => setBagNo(e.target.value)}
                      placeholder="BAG-0000"
                      className="w-full border border-[#e0e0e0] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] focus:outline-none"
                    />
                  </div>
                )}
                <button
                  onClick={() => { setShowBagNo((v) => !v); if (showBagNo) setBagNo('') }}
                  className="flex items-center gap-1.5 text-[13px] font-semibold text-[#555] hover:text-[#111] transition-colors"
                >
                  {showBagNo ? <Minus size={13} /> : <Plus size={13} />}
                  {showBagNo ? 'Remove bag no.' : 'Add bag no.'}
                </button>
              </div>

              <div className="border border-[#e0e0e0] rounded-xl overflow-hidden mb-8">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#f0f0f0]">
                      <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#aaa] tracking-widest">DENOMINATION</th>
                      <th className="text-center px-4 py-2 text-[11px] font-semibold text-[#aaa] tracking-widest">COUNT</th>
                      <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#aaa] tracking-widest">SUBTOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allDenominations.map((d) => {
                      const count = isEditingCounts ? (parseInt(editCounts[d] ?? '') || 0) : (savedCounts[d] ?? 0)
                      const subtotal = d * count
                      return (
                        <tr key={d} className="border-b border-[#f9f9f9] last:border-0">
                          <td className="px-4 py-2.5 text-[13px] font-semibold text-[#333]">J$ {d.toLocaleString('en-US')}</td>
                          <td className="px-4 py-2.5 text-center">
                            {isEditingCounts ? (
                              <input
                                type="text"
                                min={0}
                                value={fmtInput(editCounts[d] ?? '')}
                                onChange={(e) => setEditCounts((prev) => ({ ...prev, [d]: parseInput(e.target.value) }))}
                                placeholder="0"
                                className="w-16 text-center text-[13px] font-medium text-[#333] bg-transparent outline-none placeholder:text-[#ddd] focus:bg-[#f5f5f5] rounded-md px-1 py-0.5 transition-colors"
                              />
                            ) : (
                              <span className="text-[13px] font-medium text-[#333]">
                                {count > 0 ? count : <span className="text-[#ccc]">—</span>}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right text-[13px] font-semibold text-[#333]">
                            {subtotal > 0
                              ? `J$ ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                              : <span className="text-[#ccc]">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <button onClick={goNext} className="w-full py-4 rounded-2xl bg-[#111] text-[15px] font-semibold text-white hover:bg-[#222] transition-colors">
                Continue
              </button>
            </>
          )}

          {/* ── Step 3: Card ── */}
          {step === 'card' && (
            <>
              <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">Card</h2>
              <p className="text-[14px] text-[#888] font-medium mb-8">
                J$ {cardTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} total
              </p>

              <div className="space-y-6 mb-8">
                {banks.map((bank) => {
                  const txns = cardTransactions[bank] ?? []
                  const bankTotal = txns.reduce((sum, t) => sum + t.amount, 0)
                  const settlementVal = parseFloat(settlementTotals[bank] ?? '')
                  const hasMismatch = settlementTouched[bank] && !isNaN(settlementVal) && settlementVal !== bankTotal

                  return (
                    <div key={bank}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[13px] font-bold text-[#111]">{bank}</p>
                        <p className="text-[13px] font-semibold text-[#333]">J$ {bankTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                      </div>

                      <div className="mb-3">
                        <label className="text-[13px] font-semibold text-[#888] block mb-2">settlement total</label>
                        <input
                          type="text"
                          value={fmtInput(settlementTotals[bank] ?? '')}
                          onChange={(e) => setSettlementTotals((prev) => ({ ...prev, [bank]: parseInput(e.target.value) }))}
                          onBlur={() => setSettlementTouched((prev) => ({ ...prev, [bank]: true }))}
                          placeholder="0.00"
                          className={`w-full border rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] focus:outline-none ${hasMismatch ? 'border-red-300 bg-red-50' : 'border-[#e0e0e0]'}`}
                        />
                        {hasMismatch && (
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-[12px] font-semibold text-red-500">Settlement does not match recorded total</p>
                            <button
                              onClick={() => setReviewBank(bank)}
                              className="text-[12px] font-semibold text-[#333] border border-[#ddd] rounded-lg px-3 py-1 hover:bg-[#f4f4f4] transition-colors"
                            >
                              Review
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-[13px] font-semibold text-[#888] block mb-2">settlement</label>
                        <label className="flex items-center justify-center w-full border border-[#e0e0e0] rounded-xl py-2.5 text-[13px] font-semibold text-[#555] hover:bg-[#f9f9f9] transition-colors cursor-pointer">
                          <input type="file" className="hidden" onChange={(e) => setSettlementFiles((prev) => ({ ...prev, [bank]: e.target.files?.[0] ?? null }))} />
                          {settlementFiles[bank] ? settlementFiles[bank]!.name : 'upload file'}
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>

              <button onClick={goNext} className="w-full py-4 rounded-2xl bg-[#111] text-[15px] font-semibold text-white hover:bg-[#222] transition-colors">
                Continue
              </button>
            </>
          )}

          {/* ── Step 4: Summary ── */}
          {step === 'summary' && (
            <>
              <h2 className="text-[32px] font-bold text-[#111] leading-none mb-8">Summary</h2>

              <div className="mb-6">
                <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-3">Fuel Sales</p>
                <div className="space-y-2">
                  {fuelGrades.map((g) => (
                    <div key={g} className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold tracking-widest text-[#aaa]">{g}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-[12px] font-semibold text-[#bbb]">0.00 L</span>
                        <span className="text-[12px] font-bold text-[#bbb]">J$ 0.00</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-[#f0f0f0] mt-3 pt-3 flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-widest text-[#aaa]">TOTAL</span>
                  <div className="flex items-center gap-4">
                    <span className="text-[12px] font-semibold text-[#888]">0.00 L</span>
                    <span className="text-[13px] font-bold text-[#111]">J$ 0.00</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#f0f0f0] mb-6" />

              <div className="mb-6">
                <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-3">FX</p>
                <div className="space-y-2">
                  {[
                    { label: 'USD', value: '0.00' },
                    { label: 'EUR', value: '0.00' },
                    { label: 'GBP', value: '0.00' },
                    { label: 'CAD', value: '0.00' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold tracking-widest text-[#aaa]">{label}</span>
                      <span className="text-[12px] font-bold text-[#bbb]">J$ {value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-[#f0f0f0] mb-6" />

              <div className="mb-6">
                <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-3">Convenience Store</p>
                <div className="space-y-2">
                  {[
                    { label: 'CASH', value: '0.00' },
                    { label: 'CARD', value: '0.00' },
                    { label: 'PHONE CREDIT', value: '0.00' },
                    { label: 'FX', value: '0.00' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold tracking-widest text-[#aaa]">{label}</span>
                      <span className="text-[12px] font-bold text-[#bbb]">J$ {value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-[#f0f0f0] mb-6" />

              <div className="mb-6 space-y-3">
                {[
                  { label: 'CHARGES', value: '0.00' },
                  { label: 'SALES', value: '0.00' },
                  { label: 'EXPENDITURES', value: '0.00' },
                  { label: 'DEPOSITED', value: '0.00' },
                  { label: 'SHORTAGES', value: '0.00' },
                  { label: 'OVERAGES', value: '0.00' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold tracking-widest text-[#aaa]">{label}</span>
                    <span className="text-[12px] font-bold text-[#bbb]">J$ {value}</span>
                  </div>
                ))}
                <div className="border-t border-[#f0f0f0] pt-3 flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-widest text-[#aaa]">BALANCE</span>
                  <span className="text-[13px] font-bold text-[#111]">J$ 0.00</span>
                </div>
              </div>

              <button onClick={() => { onConfirm?.(); onClose() }} className="w-full py-4 rounded-2xl bg-[#111] text-[15px] font-semibold text-white hover:bg-[#222] transition-colors">
                End Shift
              </button>
            </>
          )}
        </div>
      </div>

      {reviewBank && (
        <CardSettlementReviewModal
          bank={reviewBank}
          transactions={cardTransactions[reviewBank] ?? []}
          onUpdate={(txns) => setCardTransactions((prev) => ({ ...prev, [reviewBank]: txns }))}
          onBack={() => setReviewBank(null)}
          onClose={onClose}
          onNext={() => setReviewBank(null)}
        />
      )}
    </>
  )
}
