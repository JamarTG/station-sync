export function ChargesPage() {
  return (
    <div className="p-6 max-w-[960px] mx-auto flex flex-col gap-6">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Service Station</p>
          <h1 className="text-[28px] font-bold text-[#111] leading-tight">Charges</h1>
        </div>

        <div className="bg-white rounded-2xl border border-[#ebebeb] flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-[13px] font-semibold text-[#bbb]">No charges yet</p>
          <p className="text-[12px] font-medium text-[#ccc]">Charge records will appear here</p>
        </div>
    </div>
  )
}
