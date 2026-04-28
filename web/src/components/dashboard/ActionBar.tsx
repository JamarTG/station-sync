import { MoreHorizontal, Circle } from 'lucide-react'

export function ActionBar() {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button className="px-5 py-2.5 border border-[#ddd] rounded-xl text-[13px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors">
        Record a ...
      </button>
      <button className="hidden min-[474px]:block px-5 py-2.5 border border-[#ddd] rounded-xl text-[13px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors">
        Export
      </button>
      <button className="px-5 py-2.5 border border-[#ddd] rounded-xl text-[13px] font-semibold text-[#333] bg-white hover:bg-[#f9f9f9] transition-colors">
        Start a new shift
      </button>
      <button className="hidden min-[474px]:flex w-9 h-9 border border-[#ddd] rounded-xl items-center justify-center bg-white hover:bg-[#f9f9f9] transition-colors text-[#888]">
        <Circle size={16} />
      </button>
      <button className="w-9 h-9 border border-[#ddd] rounded-xl flex items-center justify-center bg-white hover:bg-[#f9f9f9] transition-colors text-[#888]">
        <MoreHorizontal size={16} />
      </button>
    </div>
  )
}
