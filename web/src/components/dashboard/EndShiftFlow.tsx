import { useState } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { useShiftDeposits } from '../../hooks/useApi'
import { fmtNum } from '../../lib/fmt'

type Step = 'cash' | 'cards' | 'summary' | 'done'

interface Props {
  shiftId: string
  totalSales: number
  attendantSales: Record<string, number>  // name → total sales
  onEndShift: () => Promise<void>
  onLogout: () => void
  onClose: () => void
}

const cancelBtn = 'flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors'
const primaryBtn = 'w-full py-4 rounded-2xl bg-[#111] text-[15px] font-semibold text-white hover:bg-[#222] transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

function fmt(n: number) {
  return `J$ ${fmtNum(n)}`
}

export function EndShiftFlow({ shiftId, totalSales, attendantSales, onEndShift, onLogout, onClose }: Props) {
  const { data: deposits = [] } = useShiftDeposits(shiftId)

  const [step, setStep]     = useState<Step>('cash')
  const [bagNo, setBagNo]   = useState('')
  const [batchNos, setBatchNos] = useState<Record<string, string>>({})
  const [isEnding, setIsEnding] = useState(false)

  // ── Derived data ─────────────────────────────────────────────────────────────

  const cashDeposits = deposits.filter((d) => d.type === 'Cash')
  const totalCash    = cashDeposits.reduce((s, d) => s + d.amount, 0)

  const cardsByBank = deposits
    .filter((d) => d.type === 'Card')
    .reduce<Record<string, number>>((acc, d) => {
      let bank = 'Other'
      try { bank = JSON.parse(d.metadata ?? '{}')?.bank ?? 'Other' } catch {}
      acc[bank] = (acc[bank] ?? 0) + d.amount
      return acc
    }, {})
  const totalCards  = Object.values(cardsByBank).reduce((s, v) => s + v, 0)
  const bankEntries = Object.entries(cardsByBank)

  const attendantCash = cashDeposits.reduce<Record<string, number>>((acc, d) => {
    acc[d.attendant_name] = (acc[d.attendant_name] ?? 0) + d.amount
    return acc
  }, {})

  // ── Actions ───────────────────────────────────────────────────────────────────

  async function handleEnd() {
    // Persist per-attendant overage / shortage so StaffPage can display them
    const attendantOverages: Record<string, { overage: number; shortage: number }> = {}
    for (const [name, sales] of Object.entries(attendantSales)) {
      const cash = attendantCash[name] ?? 0
      const diff = cash - sales
      attendantOverages[name] = {
        overage:  diff > 0 ? diff : 0,
        shortage: diff < 0 ? Math.abs(diff) : 0,
      }
    }
    try {
      const prev = JSON.parse(localStorage.getItem('ss_attendant_overages') ?? '{}')
      prev[shiftId] = attendantOverages
      localStorage.setItem('ss_attendant_overages', JSON.stringify(prev))
    } catch {}

    setIsEnding(true)
    try {
      await onEndShift()
      setStep('done')
    } finally {
      setIsEnding(false)
    }
  }

  // ── Shell ─────────────────────────────────────────────────────────────────────

  function Shell({ back, children }: { back?: () => void; children: React.ReactNode }) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-3xl w-full max-w-[520px] p-8 shadow-xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-8">
            {back
              ? <button onClick={back} className={cancelBtn}><ArrowLeft size={13} />Go back</button>
              : <div />}
            <button onClick={onClose} className={cancelBtn}><X size={13} />Cancel</button>
          </div>
          {children}
        </div>
      </div>
    )
  }

  // ── Step 1 — Cash ─────────────────────────────────────────────────────────────

  if (step === 'cash') return (
    <Shell>
      <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">Cash</h2>
      <p className="text-[14px] text-[#888] font-medium mb-8">Review cash deposited this shift.</p>

      <div className="bg-[#f9f9f9] rounded-2xl p-5 mb-6">
        <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mb-1">Total Cash Deposited</p>
        <p className="text-[36px] font-bold text-[#111] leading-none tracking-tight mt-1">
          <span className="text-[20px] font-bold text-[#aaa] mr-1">J$</span>{fmtNum(totalCash)}
        </p>
        {cashDeposits.length > 0 && (
          <p className="text-[12px] text-[#aaa] mt-2">
            {cashDeposits.length} drop{cashDeposits.length !== 1 ? 's' : ''} recorded
          </p>
        )}
      </div>

      <div className="mb-8">
        <label className="text-[13px] font-semibold text-[#888] block mb-2">Bag #</label>
        <input
          type="text"
          value={bagNo}
          onChange={(e) => setBagNo(e.target.value)}
          placeholder="Enter bag number"
          className="w-full border border-[#e0e0e0] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#333] focus:outline-none focus:border-[#bbb] transition-colors"
        />
      </div>

      <button onClick={() => setStep('cards')} className={primaryBtn}>
        Next
      </button>
    </Shell>
  )

  // ── Step 2 — Cards ────────────────────────────────────────────────────────────

  if (step === 'cards') return (
    <Shell back={() => setStep('cash')}>
      <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">Cards</h2>
      <p className="text-[14px] text-[#888] font-medium mb-8">Card payments by bank.</p>

      {bankEntries.length === 0 ? (
        <div className="bg-[#f9f9f9] rounded-2xl px-5 py-8 mb-6 text-center">
          <p className="text-[13px] font-semibold text-[#bbb]">No card transactions this shift</p>
        </div>
      ) : (
        <>
          <div className="border border-[#ebebeb] rounded-2xl overflow-hidden mb-4">
            {bankEntries.map(([bank, amount], i) => (
              <div
                key={bank}
                className={`flex items-center gap-4 px-5 py-4 ${i < bankEntries.length - 1 ? 'border-b border-[#f0f0f0]' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[#111]">{bank}</p>
                  <p className="text-[12px] font-semibold text-[#aaa] mt-0.5">{fmt(amount)}</p>
                </div>
                <input
                  type="text"
                  value={batchNos[bank] ?? ''}
                  onChange={(e) => setBatchNos((prev) => ({ ...prev, [bank]: e.target.value }))}
                  placeholder="Batch #"
                  className="border border-[#e0e0e0] rounded-xl px-3 py-2 text-[13px] font-semibold text-[#333] focus:outline-none focus:border-[#bbb] transition-colors w-[110px] text-center flex-shrink-0"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between px-1 mb-8">
            <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Total Cards</p>
            <p className="text-[16px] font-bold text-[#111]">{fmt(totalCards)}</p>
          </div>
        </>
      )}

      <button onClick={() => setStep('summary')} className={primaryBtn}>
        Next
      </button>
    </Shell>
  )

  // ── Step 3 — Summary ──────────────────────────────────────────────────────────

  if (step === 'summary') {
    const attendantEntries = Object.entries(attendantSales)
    return (
      <Shell back={() => setStep('cards')}>
        <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">Summary</h2>
        <p className="text-[14px] text-[#888] font-medium mb-8">Review before closing the shift.</p>

        <div className="border border-[#ebebeb] rounded-2xl overflow-hidden mb-6">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
            <p className="text-[13px] font-semibold text-[#888]">Total Sales</p>
            <p className="text-[14px] font-bold text-[#111]">{fmt(totalSales)}</p>
          </div>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
            <p className="text-[13px] font-semibold text-[#888]">Cash Deposited</p>
            <p className="text-[14px] font-bold text-[#111]">{fmt(totalCash)}</p>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-[13px] font-semibold text-[#888]">Cards Recorded</p>
            <p className="text-[14px] font-bold text-[#111]">{fmt(totalCards)}</p>
          </div>
        </div>

        {attendantEntries.length > 0 && (
          <>
            <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mb-3">Attendants</p>
            <div className="border border-[#ebebeb] rounded-2xl overflow-hidden mb-8">
              {attendantEntries.map(([name, sales], i) => {
                const dropped = attendantCash[name] ?? 0
                const diff    = dropped - sales
                return (
                  <div
                    key={name}
                    className={`flex items-center justify-between px-5 py-3.5 ${i < attendantEntries.length - 1 ? 'border-b border-[#f0f0f0]' : ''}`}
                  >
                    <div>
                      <p className="text-[13px] font-semibold text-[#111]">{name}</p>
                      <p className="text-[11px] text-[#aaa] mt-0.5">Sales {fmt(sales)}</p>
                    </div>
                    <div className="text-right">
                      {diff === 0 ? (
                        <span className="text-[12px] font-bold text-[#bbb]">Balanced</span>
                      ) : (
                        <>
                          <p className={`text-[13px] font-bold ${diff > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {diff > 0 ? `+${fmt(diff)}` : fmt(diff)}
                          </p>
                          <p className={`text-[10px] font-bold uppercase tracking-widest ${diff > 0 ? 'text-green-500' : 'text-red-400'}`}>
                            {diff > 0 ? 'Overage' : 'Shortage'}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <button onClick={handleEnd} disabled={isEnding} className={primaryBtn}>
          {isEnding ? 'Ending shift…' : 'End Shift'}
        </button>
      </Shell>
    )
  }

  // ── Step 4 — Done ─────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-[520px] p-8 shadow-xl text-center">
        <div className="w-12 h-12 rounded-full bg-[#f0f0f0] flex items-center justify-center mx-auto mb-6">
          <div className="w-5 h-5 rounded-full bg-[#333]" />
        </div>
        <h2 className="text-[28px] font-bold text-[#111] leading-none mb-2">Shift ended</h2>
        <p className="text-[14px] text-[#888] font-medium mb-8">
          The shift has been closed successfully.
        </p>
        <button onClick={onLogout} className={primaryBtn}>
          Start a new shift
        </button>
      </div>
    </div>
  )
}
