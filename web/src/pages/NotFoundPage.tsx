import { useNavigate, useRouter } from '@tanstack/react-router'
import { StationSyncLogo } from '../components/StationSyncLogo'

function NotFoundContent() {
  const navigate = useNavigate()
  const router = useRouter()

  return (
    <div className="text-center max-w-[360px]">
      <div className="inline-flex items-center justify-center w-14 h-14 bg-white border border-[#ebebeb] rounded-2xl shadow-sm mb-6">
        <StationSyncLogo size={28} />
      </div>

      <p className="text-[11px] font-bold tracking-widest text-[#bbb] uppercase mb-3">404</p>
      <h1 className="text-[26px] font-bold text-[#111] leading-tight mb-3">Page not found</h1>
      <p className="text-[13px] font-medium text-[#888] leading-relaxed mb-8">
        The page you're looking for doesn't exist or may have been moved.
      </p>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => router.history.back()}
          className="px-5 py-2.5 rounded-xl text-[13px] font-semibold text-[#555] bg-white border border-[#e0e0e0] hover:border-[#ccc] hover:text-[#111] transition-colors"
        >
          Go back
        </button>
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

// Standalone — used by the root route (unauthenticated context)
export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#f4f4f4] font-[Manrope] flex items-center justify-center p-6">
      <NotFoundContent />
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
