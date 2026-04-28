const grades = ['87', '90', 'ADO', 'ULSD']
const price = 190.90

export function PricesPanel() {
  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] font-semibold text-[#888]">Prices</p>
        <button className="text-[12px] font-semibold text-[#333] border border-[#ddd] rounded-lg px-3 py-1 hover:bg-[#f4f4f4] transition-colors">
          Edit
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {grades.map((g) => (
          <div key={g} className="bg-white border border-[#ebebeb] rounded-xl p-3 text-center">
            <p className="text-[12px] font-bold text-[#333] mb-2">{g}</p>
            <p className="text-[11px] text-[#888]">
              <span className="text-[10px] mr-0.5">J$</span>
              <span className="font-bold text-[#111]">{price.toFixed(2)}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
