'use client'

import { useState, useMemo } from 'react'
import type { Customer } from '@/lib/types'
import { SUB_TYPES } from '@/lib/types'
import { fmtMoney, fmt } from '@/lib/utils'

const TYPE_PILL: Record<string, string> = {
  'Swing with Stockifyy':      'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  'Trade with Stockifyy':      'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  'Invest with Stockifyy':     'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  'Portfolio Designing':       'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  'One on One Advisory':       'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  'Technical Analysis Course': 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
}

export default function PaymentsClient({ customers }: { customers: Customer[] }) {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const monthStr = now.toISOString().slice(0, 7)

  const [filterMonth, setFilterMonth] = useState('')
  const [filterType, setFilterType] = useState('')
  const [lightbox, setLightbox] = useState<string | null>(null)

  const months = useMemo(() => {
    const ms = [...new Set(customers.map(c => c.subscription_start?.slice(0, 7)).filter(Boolean))].sort().reverse()
    return ms as string[]
  }, [customers])

  const filtered = useMemo(() => customers.filter(c => {
    const matchM = !filterMonth || c.subscription_start?.slice(0, 7) === filterMonth
    const matchT = !filterType || c.subscription_type === filterType
    return matchM && matchT
  }), [customers, filterMonth, filterType])

  const todayAmt = customers.filter(c => c.subscription_start?.slice(0, 10) === todayStr).reduce((s, c) => s + c.amount, 0)
  const todayCount = customers.filter(c => c.subscription_start?.slice(0, 10) === todayStr).length
  const monthAmt = customers.filter(c => c.subscription_start?.slice(0, 7) === monthStr).reduce((s, c) => s + c.amount, 0)
  const monthCount = customers.filter(c => c.subscription_start?.slice(0, 7) === monthStr).length
  const totalAmt = customers.reduce((s, c) => s + c.amount, 0)

  function fmtMonth(m: string) {
    const [y, mo] = m.split('-')
    return new Date(Number(y), Number(mo) - 1, 1).toLocaleString('en-PK', { month: 'long', year: 'numeric' })
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight">Payments</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{customers.length} total records</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {[
          { label: "Today", value: fmtMoney(todayAmt), sub: `${todayCount} payment${todayCount !== 1 ? 's' : ''}` },
          { label: "This Month", value: fmtMoney(monthAmt), sub: `${monthCount} payment${monthCount !== 1 ? 's' : ''}` },
          { label: "All Time", value: fmtMoney(totalAmt), sub: `${customers.length} total` },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 lg:p-5 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground mb-2">{label}</div>
            <div className="text-xl lg:text-2xl font-bold text-foreground tabular-nums">{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-border rounded-lg outline-none bg-card text-foreground">
          <option value="">All Months</option>
          {months.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-border rounded-lg outline-none bg-card text-foreground">
          <option value="">All Types</option>
          {SUB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {filtered.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground shadow-sm">No payments found</div>
      )}

      {/* ── MOBILE: payment cards ── */}
      {filtered.length > 0 && (
        <div className="flex flex-col gap-3 md:hidden">
          {filtered.map(c => {
            const addedBy = (c as any).added_by_profile
            return (
              <div key={c.id} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="font-semibold text-foreground">{c.name}</div>
                    <div className="text-sm text-muted-foreground">{c.mobile}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-foreground tabular-nums">{fmtMoney(c.amount)}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{fmt(c.subscription_start)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TYPE_PILL[c.subscription_type] ?? 'bg-muted text-muted-foreground'}`}>{c.subscription_type}</span>
                  {addedBy && <span className="text-xs text-muted-foreground">by {addedBy.name}</span>}
                  {c.screenshot_url && (
                    <button onClick={() => setLightbox(c.screenshot_url!)} className="ml-auto">
                      <img src={c.screenshot_url} className="w-8 h-8 object-cover rounded-lg border border-border hover:opacity-75 transition-opacity" alt="screenshot" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          <div className="bg-muted/30 border border-border rounded-xl px-4 py-3 flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
            <span className="text-sm font-bold text-foreground tabular-nums">Total: {fmtMoney(filtered.reduce((s, c) => s + c.amount, 0))}</span>
          </div>
        </div>
      )}

      {/* ── DESKTOP: table ── */}
      {filtered.length > 0 && (
        <div className="hidden md:block bg-card border border-border rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full min-w-max">
            <thead>
              <tr className="bg-muted/50">
                {['#', 'Customer', 'Mobile', 'Type', 'Amount', 'Payment Date', 'Added By', 'Screenshot'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const addedBy = (c as any).added_by_profile
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-foreground text-sm whitespace-nowrap">{c.name}</td>
                    <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">{c.mobile}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TYPE_PILL[c.subscription_type] ?? 'bg-muted text-muted-foreground'}`}>{c.subscription_type}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-foreground tabular-nums whitespace-nowrap">{fmtMoney(c.amount)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(c.subscription_start)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{addedBy?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      {c.screenshot_url
                        ? <button onClick={() => setLightbox(c.screenshot_url!)}>
                            <img src={c.screenshot_url} className="w-9 h-9 object-cover rounded-lg border border-border hover:opacity-75 transition-opacity" alt="screenshot" />
                          </button>
                        : <span className="text-muted-foreground/30 text-xs">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-border flex justify-between items-center bg-muted/30">
            <span className="text-xs text-muted-foreground">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
            <span className="text-sm font-bold text-foreground tabular-nums">Total: {fmtMoney(filtered.reduce((s, c) => s + c.amount, 0))}</span>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl">✕</button>
          <img src={lightbox} className="max-w-full max-h-[90vh] rounded-lg" alt="screenshot" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
