'use client'

import { subStatus } from '@/lib/types'
import { fmtMoney, fmtDate, fmt } from '@/lib/utils'
import { TrendingUp, Calendar, Users, AlertTriangle, Download } from 'lucide-react'
import Link from 'next/link'

interface Props {
  metrics: {
    todayAmt: string; todayCount: number
    monthAmt: string; monthCount: number
    activeCount: number; totalCount: number
    expiringCount: number
  }
  chartData: { day: string; amount: number; isToday: boolean }[]
  breakdown: { type: string; count: number }[]
  recent: any[]
  todayCustomers: any[]
  weekCustomers: any[]
  monthCustomers: any[]
}

async function exportExcel(customers: any[], label: string, filename: string) {
  const { utils, writeFile } = await import('xlsx')

  const rows = customers.map((c, i) => ({
    '#': i + 1,
    'Customer Name': c.name,
    'Client Code': c.client_code ?? '—',
    'Mobile': c.mobile,
    'Subscription Type': c.subscription_type,
    'Amount (Rs)': c.amount,
    'Discount (Rs)': c.discount ?? 0,
    'Net Amount (Rs)': (c.amount ?? 0) - (c.discount ?? 0),
    'Start': fmt(c.subscription_start),
    'End': fmt(c.subscription_end),
    'Added By': c.added_by_profile?.name ?? '—',
    'Notes': c.notes ?? '',
    'Screenshot': c.screenshot_url ? 'Click to view' : '—',
  }))

  const ws = utils.json_to_sheet(rows)

  customers.forEach((c, i) => {
    if (!c.screenshot_url) return
    const cellRef = utils.encode_cell({ r: i + 1, c: 12 }) // col 12 = Screenshot (shifted by client_code)
    if (!ws[cellRef]) return
    ws[cellRef].l = { Target: c.screenshot_url, Tooltip: 'Open payment screenshot' }
    ws[cellRef].s = { font: { color: { rgb: '0563C1' }, underline: true } }
  })

  ws['!cols'] = [
    { wch: 4 }, { wch: 25 }, { wch: 14 }, { wch: 16 }, { wch: 28 },
    { wch: 14 }, { wch: 14 }, { wch: 16 },
    { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 30 },
    { wch: 18 },
  ]

  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, label.slice(0, 31))
  writeFile(wb, filename)
}

const TYPE_PILL: Record<string, string> = {
  'Swing with Stockifyy':      'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  'Trade with Stockifyy':      'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  'Invest with Stockifyy':     'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  'Portfolio Designing':       'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  'One on One Advisory':       'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  'Technical Analysis Course': 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
}
const STATUS_PILL: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  expiring: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  expired: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300',
}

export default function DashboardClient({ metrics, chartData, breakdown, recent, todayCustomers, weekCustomers, monthCustomers }: Props) {
  const now = new Date()
  const maxAmt = Math.max(...chartData.map(d => d.amount), 1)

  const METRIC_CARDS = [
    { label: "Today's Collections", value: metrics.todayAmt, sub: `${metrics.todayCount} payment${metrics.todayCount !== 1 ? 's' : ''}`, icon: TrendingUp },
    { label: 'This Month', value: metrics.monthAmt, sub: `${metrics.monthCount} payment${metrics.monthCount !== 1 ? 's' : ''}`, icon: Calendar },
    { label: 'Active Subscribers', value: String(metrics.activeCount), sub: `of ${metrics.totalCount} total`, icon: Users },
    { label: 'Expiring Soon', value: String(metrics.expiringCount), sub: 'within 7 days', icon: AlertTriangle },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {now.toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {[
            { label: 'Today', customers: todayCustomers, period: 'today' },
            { label: 'This Week', customers: weekCustomers, period: 'week' },
            { label: 'This Month', customers: monthCustomers, period: 'month' },
          ].map(({ label, customers, period }) => {
            const now = new Date()
            const dateStr = now.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
            return (
              <button
                key={period}
                onClick={() => exportExcel(customers, label, `Stockifyy-${period}-${dateStr}.xlsx`)}
                disabled={customers.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors shadow-sm flex-shrink-0"
              >
                <Download size={13} />
                <span>{label}</span>
                {customers.length > 0 && (
                  <span className="bg-white/20 text-white text-[10px] font-bold px-1 py-0.5 rounded-full leading-none">
                    {customers.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Metrics — 2 cols mobile, 4 desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-5">
        {METRIC_CARDS.map(({ label, value, sub, icon: Icon }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 lg:p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3 gap-2">
              <span className="text-xs lg:text-sm font-medium text-muted-foreground leading-tight">{label}</span>
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-3.5 h-3.5 text-primary" />
              </div>
            </div>
            <div className="text-xl lg:text-2xl font-bold text-foreground tabular-nums leading-none">{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{sub}</div>
          </div>
        ))}
      </div>

      {/* Charts + recent */}
      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_300px] gap-4">

        {/* Recent customers */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Recent Customers</span>
            <Link href="/dashboard/customers" className="text-xs text-primary font-semibold hover:underline">View all →</Link>
          </div>

          {recent.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">No customers yet</p>
          )}

          {/* Mobile: cards */}
          {recent.length > 0 && (
            <div className="md:hidden divide-y divide-border">
              {recent.map(c => {
                const st = subStatus(c.subscription_end)
                return (
                  <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground text-sm truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.mobile}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-foreground tabular-nums text-sm">{fmtMoney(c.amount)}</div>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_PILL[st]}`}>
                        {st === 'expiring' ? 'Expiring' : st.charAt(0).toUpperCase() + st.slice(1)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Desktop: table */}
          {recent.length > 0 && (
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-max">
                <thead>
                  <tr className="bg-muted/50">
                    {['Customer', 'Type', 'Amount', 'Status', 'Added'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map(c => {
                    const st = subStatus(c.subscription_end)
                    return (
                      <tr key={c.id} className="border-t border-border hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-semibold text-foreground text-sm">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.mobile}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TYPE_PILL[c.subscription_type] ?? 'bg-muted text-muted-foreground'}`}>
                            {c.subscription_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-foreground tabular-nums">{fmtMoney(c.amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_PILL[st]}`}>
                            {st === 'expiring' ? 'Expiring' : st.charAt(0).toUpperCase() + st.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(c.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
          {/* 30-day chart */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-4 lg:p-5">
            <div className="text-sm font-semibold text-foreground mb-3">30-Day Collections</div>
            <div className="flex items-end gap-0.5 h-14">
              {chartData.map((d, i) => {
                const h = d.amount === 0 ? 4 : Math.max((d.amount / maxAmt) * 100, 8)
                return (
                  <div key={i} className="flex-1 group relative">
                    <div
                      className={`w-full rounded-sm transition-opacity ${d.amount === 0 ? 'bg-border' : d.isToday ? 'bg-primary' : 'bg-primary/40 group-hover:bg-primary/70'}`}
                      style={{ height: `${h}%` }}
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-foreground text-background text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                      {fmtMoney(d.amount)}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="text-[11px] text-muted-foreground mt-2 text-center">Last 30 days</div>
          </div>

          {/* Breakdown */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-4 lg:p-5">
            <div className="text-sm font-semibold text-foreground mb-3">By Type</div>
            <div className="space-y-3">
              {breakdown.filter(b => b.count > 0).length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet</p>
              ) : breakdown.map(({ type, count }) => {
                const total = Math.max(breakdown.reduce((s, b) => s + b.count, 0), 1)
                const pct = Math.round(count / total * 100)
                if (count === 0) return null
                return (
                  <div key={type}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-medium text-foreground truncate pr-2">{type}</span>
                      <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
