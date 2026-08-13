'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { TrendingUp, Eye, EyeOff, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Invalid email or password.')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm mx-4">
        <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="h-1 bg-primary rounded-t-xl" />
          <div className="p-8">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <TrendingUp size={20} className="text-primary-foreground" strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-lg font-bold text-foreground tracking-tight">Stockifyy</div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest">CRM</div>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-1 tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground mb-6">Sign in to your account to continue</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm text-foreground bg-card placeholder:text-muted-foreground outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 pr-10 border border-border rounded-lg text-sm text-foreground bg-card placeholder:text-muted-foreground outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-sm">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground font-semibold rounded-lg text-sm transition-colors mt-2 shadow-sm"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Stockifyy Subscription Management System
        </p>
      </div>
    </div>
  )
}
