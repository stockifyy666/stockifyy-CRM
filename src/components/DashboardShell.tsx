'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import type { Profile } from '@/lib/types'

export default function DashboardShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar profile={profile} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <TopBar profile={profile} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
