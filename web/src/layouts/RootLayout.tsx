import { useState } from 'react'
import { Outlet } from '@tanstack/react-router'
import { Sidebar } from '../components/Sidebar'
import { TopBar } from '../components/TopBar'

export function RootLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-[#f4f4f4] font-[Manrope]">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 min-[668px]:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto overflow-x-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
