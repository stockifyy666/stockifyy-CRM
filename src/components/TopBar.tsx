'use client'

import { Sun, Moon, Menu } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import type { Profile } from '@/lib/types'

interface Props { profile: Profile; onMenuClick: () => void }

export default function TopBar({ profile, onMenuClick }: Props) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 sticky top-0 z-30">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>
      <h1 className="text-sm font-semibold text-foreground flex-1 truncate">
        Welcome back, <span className="text-primary">{profile.name}</span>
      </h1>
      {mounted && (
        <button
          className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors flex-shrink-0"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      )}
    </header>
  )
}
