'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users, CreditCard, Shield, ChevronRight, LogOut, TrendingUp, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}

const ALL_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/customers', label: 'Customers', icon: Users },
  { href: '/dashboard/payments', label: 'Payments', icon: CreditCard },
  { href: '/dashboard/team', label: 'Team', icon: Shield, adminOnly: true },
]

interface Props { profile: Profile; open: boolean; onClose: () => void }

export default function Sidebar({ profile, open, onClose }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const nav = ALL_NAV.filter(n => !n.adminOnly || profile.role === 'admin')

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = profile.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        'fixed top-0 left-0 z-50 h-full w-64 flex flex-col',
        'bg-sidebar border-r border-sidebar-border',
        'transition-transform duration-200 ease-in-out',
        'lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight text-foreground">
              Stockifyy<span className="text-primary"> CRM</span>
            </span>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 rounded-md hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 mb-2">Main Menu</p>
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border space-y-2">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{profile.name}</p>
              <p className="text-xs text-muted-foreground truncate capitalize">{profile.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}
