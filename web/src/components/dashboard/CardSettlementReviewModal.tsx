import { useState } from 'react'
import { ArrowLeft, X, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'

export interface CardTransaction {
  id: number
  transNo: string
  attendant: string
  amount: number
}

interface Props {
  bank: string
  transactions: CardTransaction[]
  onUpdate: (transactions: CardTransaction[]) => void
  onBack: () => void
  onClose: () => void
  onNext: () => void
}

export function CardSettlementReviewModal({ bank, transactions, onUpdate, onBack, onClose, onNext }: Props) {
  useEscapeKey(onClose)
  const [rows, setRows] = useState<CardTransaction[]>(transactions)
  const [index, setIndex] = useState(0)

  function deleteRow(id: number) {
    const updated = rows.filter((r) => r.id !== id)
    setRows(updated)
    onUpdate(updated)
    setIndex((prev) => Math.min(prev, updated.length - 1))
  }

  const total = rows.reduce((sum, r) => sum + r.amount, 0)
  const row = rows[index] ?? null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[560px] p-8 shadow-xl h-[650px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            <ArrowLeft size={13} />
            Go back
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors"
          >
            <X size={13} />
            Cancel
          </button>
        </div>

        <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Review</p>
        <h2 className="text-[32px] font-bold text-[#111] leading-none mb-1">{bank}</h2>
        <p className="text-[14px] text-[#888] font-medium mb-8">
          J$ {total.toLocaleString('en-US', { minimumFractionDigits: 2 })} total
        </p>

        <div className="flex-1 flex flex-col justify-between">
          {row ? (
            <div className="border border-[#ebebeb] rounded-2xl px-5 py-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">{bank}</p>
                  <p className="text-[28px] font-bold text-[#111] leading-none">
                    J$ {row.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <button
                  onClick={() => deleteRow(row.id)}
                  className="text-[#ccc] hover:text-red-400 transition-colors mt-0.5"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="flex items-center gap-4 pt-3 border-t border-[#f5f5f5]">
                <div>
                  <p className="text-[10px] font-semibold tracking-widest text-[#bbb] uppercase mb-0.5">Trans #</p>
                  <p className="text-[12px] font-semibold text-[#333]">{row.transNo}</p>
                </div>
                <div className="w-px h-6 bg-[#f0f0f0]" />
                <div>
                  <p className="text-[10px] font-semibold tracking-widest text-[#bbb] uppercase mb-0.5">Attendant</p>
                  <p className="text-[12px] font-semibold text-[#333]">{row.attendant}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-[13px] text-[#ccc] font-medium">No transactions</p>
          )}

          <div>
            {rows.length > 0 && (
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  disabled={index === 0}
                  className="flex items-center gap-1.5 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronLeft size={13} />
                  Prev
                </button>
                <span className="text-[12px] font-semibold text-[#aaa]">
                  {index + 1} of {rows.length}
                </span>
                <button
                  onClick={() => setIndex((i) => Math.min(rows.length - 1, i + 1))}
                  disabled={index === rows.length - 1}
                  className="flex items-center gap-1.5 border border-[#ddd] rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#333] hover:bg-[#f4f4f4] transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  Next
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
            <button
              onClick={onNext}
              className="w-full py-4 rounded-2xl bg-[#111] text-[15px] font-semibold text-white hover:bg-[#222] transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
