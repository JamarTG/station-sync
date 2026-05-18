import { useNavigate } from '@tanstack/react-router'
import { StationSyncLogo } from '../components/StationSyncLogo'

function NotFoundContent() {
  return (
    <div className="text-center max-w-[360px]">
      <div className="inline-flex items-center justify-center w-14 h-14 bg-white border border-[#ebebeb] rounded-2xl shadow-sm mb-6">
        <StationSyncLogo size={28} />
      </div>
      <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mb-3">404</p>
      <h1 className="text-[26px] font-bold text-[#111] leading-tight mb-3">Page not found</h1>
      <p className="text-[13px] font-medium text-[#888] leading-relaxed">
        The page you're looking for doesn't exist or may have been moved.
      </p>
    </div>
  )
}

// Standalone — full-screen, used by the root route (outside sidebar)
export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-[#f4f4f4] font-[Manrope] flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-8">
        <NotFoundContent />
        <button
          onClick={() => navigate({ to: '/' })}
          className="px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-[#111] hover:bg-[#333] transition-colors"
        >
          Go home
        </button>
      </div>
    </div>
  )
}

// In-app — used by the protected layout route, renders inside the sidebar
export function AppNotFound() {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <NotFoundContent />
    </div>
  )
}
