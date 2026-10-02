'use client'

import { useState, useMemo } from 'react'
import { subStatus, SUB_TYPES } from '@/lib/types'
import { fmtMoney, fmtDate, fmt } from '@/lib/utils'
import { TrendingUp, Calendar, Users, AlertTriangle, Download } from 'lucide-react'
import Link from 'next/link'
import DateRangeFilter, { type DateRange } from '@/components/DateRangeFilter'

type TimePeriod = 'this-month' | 'all-time' | 'this-quarter' | 'last-6mo' | 'this-year' | 'custom'
type SectionTab  = 'overall' | 'customers' | 'advisory' | 'portfolio' | 'technical'

interface PeriodData { customers: any[]; advisory: any[]; portfolio: any[]; technical: any[] }
interface Props {
  chartData: { day: string; amount: number; isToday: boolean }[]
  allCustomers: any[]; allAdvisory: any[]; allPortfolio: any[]; allTechnical: any[]
  todayAll: PeriodData; weekAll: PeriodData; monthAll: PeriodData
}

// ─── Export ──────────────────────────────────────────────────────────────────
async function exportExcel(data: PeriodData, label: string, filename: string) {
  const { utils, writeFile } = await import('xlsx')
  const rows: any[] = []
  let idx = 1
  data.customers.forEach(c => rows.push({
    '#': idx++, 'Type': 'Customer', 'Name': c.name, 'Client Code': c.client_code ?? '—',
    'Mobile': c.mobile, 'Package / Subscription': c.subscription_type,
    'Amount (Rs)': c.amount ?? 0, 'Discount (Rs)': c.discount ?? 0,
    'Net Amount (Rs)': (c.amount ?? 0) - (c.discount ?? 0),
    'Start': fmt(c.subscription_start), 'End': fmt(c.subscription_end), 'Notes': c.notes ?? '',
  }))
  data.advisory.forEach(c => rows.push({
    '#': idx++, 'Type': 'Advisory', 'Name': c.full_name, 'Client Code': '—',
    'Mobile': c.phone, 'Package / Subscription': c.package ?? '—',
    'Amount (Rs)': c.amount ?? 0, 'Discount (Rs)': 0, 'Net Amount (Rs)': c.amount ?? 0,
    'Start': fmt(c.adding_date ?? c.created_at), 'End': '—', 'Notes': '',
  }))
  data.portfolio.forEach(c => rows.push({
    '#': idx++, 'Type': 'Portfolio', 'Name': c.full_name, 'Client Code': c.client_code ?? '—',
    'Mobile': c.phone, 'Package / Subscription': `Duration: ${c.duration}`,
    'Amount (Rs)': c.amount ?? 0, 'Discount (Rs)': 0, 'Net Amount (Rs)': c.amount ?? 0,
    'Start': fmt(c.created_at), 'End': '—', 'Notes': '',
  }))
  data.technical.forEach(c => rows.push({
    '#': idx++, 'Type': 'Technical Course', 'Name': c.name, 'Client Code': c.client_code ?? '—',
    'Mobile': c.mobile, 'Package / Subscription': c.subscription_type,
    'Amount (Rs)': c.amount ?? 0, 'Discount (Rs)': 0, 'Net Amount (Rs)': c.amount ?? 0,
    'Start': fmt(c.created_at), 'End': '—', 'Notes': '',
  }))
  const ws = utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 4 }, { wch: 16 }, { wch: 25 }, { wch: 14 }, { wch: 16 },
    { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 22 }, { wch: 30 },
  ]
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, label.slice(0, 31))
  writeFile(wb, filename)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getRange(period: TimePeriod, custom: DateRange): { from: string; to: string } | null {
  const now   = new Date()
  const today = now.toISOString().slice(0, 10)
  if (period === 'all-time') return null
  if (period === 'this-month') {
    const [y, m] = today.slice(0, 7).split('-')
    return { from: `${y}-${m}-01`, to: today }
  }
  if (period === 'this-quarter') {
    const q    = Math.floor(now.getMonth() / 3)
    const from = new Date(now.getFullYear(), q * 3, 1).toISOString().slice(0, 10)
    return { from, to: today }
  }
  if (period === 'last-6mo') {
    const from = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10)
    return { from, to: today }
  }
  if (period === 'this-year') return { from: `${now.getFullYear()}-01-01`, to: today }
  if (period === 'custom')    return custom
  return null
}

function inRange(d: string | null | undefined, range: { from: string; to: string } | null): boolean {
  if (!range) return true
  const s = d?.slice(0, 10)
  return !!s && s >= range.from && s <= range.to
}

const sumAmt = (arr: any[]) => arr.reduce((s, c) => s + (c.amount ?? 0), 0)

// ─── Styles ──────────────────────────────────────────────────────────────────
const TYPE_PILL: Record<string, string> = {
  'Swing with Stockifyy':      'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  'Trade with Stockifyy':      'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  'Invest with Stockifyy':     'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  'Portfolio Designing':       'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  'One on One Advisory':       'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  'Technical Analysis Course': 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
}
const STATUS_PILL: Record<string, string> = {
  active:   'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  expiring: 'bg-amber-50   text-amber-700   dark:bg-amber-950/40   dark:text-amber-300',
  expired:  'bg-red-50     text-red-600     dark:bg-red-950/40     dark:text-red-300',
}
const PKG_PILL: Record<string, string> = {
  Diamond:  'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  Platinum: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  Gold:     'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
}
const RISK_PILL: Record<string, string> = {
  Low:       'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  Medium:    'bg-amber-50   text-amber-700   dark:bg-amber-950/40   dark:text-amber-300',
  High:      'bg-orange-50  text-orange-700  dark:bg-orange-950/40  dark:text-orange-300',
  'Very High': 'bg-red-50   text-red-600     dark:bg-red-950/40     dark:text-red-300',
}

const TIME_TABS: { key: TimePeriod; label: string }[] = [
  { key: 'this-month',   label: 'This Month'   },
  { key: 'all-time',     label: 'All Time'      },
  { key: 'this-quarter', label: 'This Quarter'  },
  { key: 'last-6mo',     label: 'Last 6 Mo.'    },
  { key: 'this-year',    label: 'This Year'     },
  { key: 'custom',       label: 'Custom'        },
]

const SECTION_TABS: { key: SectionTab; label: string; viewHref: string }[] = [
  { key: 'overall',   label: 'Overall',             viewHref: '/dashboard/customers'      },
  { key: 'customers', label: 'Customer Dashboard',  viewHref: '/dashboard/customers'      },
  { key: 'advisory',  label: 'One on One',          viewHref: '/dashboard/advisory'       },
  { key: 'portfolio', label: 'Portfolio Designing', viewHref: '/dashboard/portfolio'      },
  { key: 'technical', label: 'Technical Course',    viewHref: '/dashboard/technical-course' },
]

// ─── Component ───────────────────────────────────────────────────────────────
export default function DashboardClient({
  chartData, allCustomers, allAdvisory, allPortfolio, allTechnical,
  todayAll, weekAll, monthAll,
}: Props) {
  const now      = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const monthStr = now.toISOString().slice(0, 7)
  const maxAmt   = Math.max(...chartData.map(d => d.amount), 1)

  const [period,      setPeriod]      = useState<TimePeriod>('this-month')
  const [section,     setSection]     = useState<SectionTab>('overall')
  const [customRange, setCustomRange] = useState<DateRange>(null)

  const range = useMemo(() => getRange(period, customRange), [period, customRange])

  // ── Filtered arrays ──────────────────────────────────────────────────────
  const filtCusts = useMemo(() =>
    allCustomers.filter(c => inRange(c.subscription_start ?? c.created_at, range)),
    [allCustomers, range])
  const filtAdv = useMemo(() =>
    allAdvisory.filter(c => inRange(c.adding_date ?? c.created_at, range)),
    [allAdvisory, range])
  const filtPort = useMemo(() =>
    allPortfolio.filter(c => inRange(c.created_at, range)),
    [allPortfolio, range])
  const filtTech = useMemo(() =>
    allTechnical.filter(c => inRange(c.created_at, range)),
    [allTechnical, range])

  // ── Today sub-totals (for "This Month" mode cards) ───────────────────────
  const todayCusts = useMemo(() =>
    allCustomers.filter(c => (c.subscription_start ?? c.created_at)?.slice(0, 10) === todayStr),
    [allCustomers, todayStr])
  const todayAdv = useMemo(() =>
    allAdvisory.filter(c => (c.adding_date ?? c.created_at)?.slice(0, 10) === todayStr),
    [allAdvisory, todayStr])
  const todayPort = useMemo(() =>
    allPortfolio.filter(c => c.created_at?.slice(0, 10) === todayStr),
    [allPortfolio, todayStr])
  const todayTech = useMemo(() =>
    allTechnical.filter(c => c.created_at?.slice(0, 10) === todayStr),
    [allTechnical, todayStr])

  // ── Month sub-totals ─────────────────────────────────────────────────────
  const monthCusts = useMemo(() =>
    allCustomers.filter(c => (c.subscription_start ?? c.created_at)?.slice(0, 7) === monthStr),
    [allCustomers, monthStr])
  const monthAdv  = useMemo(() =>
    allAdvisory.filter(c => (c.adding_date ?? c.created_at)?.slice(0, 7) === monthStr),
    [allAdvisory, monthStr])
  const monthPort = useMemo(() =>
    allPortfolio.filter(c => c.created_at?.slice(0, 7) === monthStr),
    [allPortfolio, monthStr])
  const monthTech = useMemo(() =>
    allTechnical.filter(c => c.created_at?.slice(0, 7) === monthStr),
    [allTechnical, monthStr])

  // ── Real-time active / expiring (always customers only) ─────────────────
  const activeCount   = useMemo(() => allCustomers.filter(c => subStatus(c.subscription_end) === 'active').length,   [allCustomers])
  const expiringCount = useMemo(() => allCustomers.filter(c => subStatus(c.subscription_end) === 'expiring').length, [allCustomers])

  // ── Stat cards ───────────────────────────────────────────────────────────
  const statCards = useMemo(() => {
    const isThisMonth = period === 'this-month'

    // ── Overall ─────────────────────────────────────────────────────────
    if (section === 'overall') {
      if (isThisMonth) {
        const todayCount = todayCusts.length + todayAdv.length + todayPort.length + todayTech.length
        const monthCount = monthCusts.length + monthAdv.length + monthPort.length + monthTech.length
        return [
          { label: "Today's Collections", value: fmtMoney(sumAmt(todayCusts) + sumAmt(todayAdv) + sumAmt(todayPort) + sumAmt(todayTech)), sub: `${todayCount} payment${todayCount !== 1 ? 's' : ''}`, icon: TrendingUp },
          { label: 'This Month',          value: fmtMoney(sumAmt(monthCusts) + sumAmt(monthAdv) + sumAmt(monthPort) + sumAmt(monthTech)), sub: `${monthCount} payments`, icon: Calendar },
          { label: 'Active Subscribers',  value: String(activeCount),   sub: `of ${allCustomers.length} total`,  icon: Users },
          { label: 'Expiring Soon',       value: String(expiringCount), sub: 'within 2 days', icon: AlertTriangle },
        ]
      }
      const totalAmt     = sumAmt(filtCusts) + sumAmt(filtAdv) + sumAmt(filtPort) + sumAmt(filtTech)
      const totalMembers = filtCusts.length  + filtAdv.length  + filtPort.length  + filtTech.length
      return [
        { label: 'Total Collections',  value: fmtMoney(totalAmt), sub: `all sections combined`,            icon: TrendingUp },
        { label: 'Members Added',      value: String(totalMembers), sub: 'in selected period',              icon: Calendar   },
        { label: 'Active Subscribers', value: String(activeCount),   sub: `of ${allCustomers.length} total`, icon: Users      },
        { label: 'Expiring Soon',      value: String(expiringCount), sub: 'within 2 days',                  icon: AlertTriangle },
      ]
    }

    // ── Customers ────────────────────────────────────────────────────────
    if (section === 'customers') {
      if (isThisMonth) {
        return [
          { label: "Today's Collections", value: fmtMoney(sumAmt(todayCusts)), sub: `${todayCusts.length} payment${todayCusts.length !== 1 ? 's' : ''}`, icon: TrendingUp },
          { label: 'This Month',          value: fmtMoney(sumAmt(monthCusts)), sub: `${monthCusts.length} payments`,  icon: Calendar },
          { label: 'Active Subscribers',  value: String(activeCount),           sub: `of ${allCustomers.length} total`, icon: Users },
          { label: 'Expiring Soon',       value: String(expiringCount),         sub: 'within 2 days', icon: AlertTriangle },
        ]
      }
      return [
        { label: 'Total Collections',  value: fmtMoney(sumAmt(filtCusts)),    sub: `in selected period`,              icon: TrendingUp },
        { label: 'Customers Added',    value: String(filtCusts.length),        sub: 'in selected period',              icon: Calendar   },
        { label: 'Active Subscribers', value: String(activeCount),             sub: `of ${allCustomers.length} total`, icon: Users      },
        { label: 'Expiring Soon',      value: String(expiringCount),           sub: 'within 2 days',                   icon: AlertTriangle },
      ]
    }

    // ── Advisory ─────────────────────────────────────────────────────────
    if (section === 'advisory') {
      const diam = filtAdv.filter(c => c.package === 'Diamond').length
      const plat = filtAdv.filter(c => c.package === 'Platinum').length
      const gold = filtAdv.filter(c => c.package === 'Gold').length
      if (isThisMonth) {
        return [
          { label: "Today's Collections", value: fmtMoney(sumAmt(todayAdv)), sub: `${todayAdv.length} client${todayAdv.length !== 1 ? 's' : ''}`, icon: TrendingUp },
          { label: 'This Month',          value: fmtMoney(sumAmt(monthAdv)), sub: `${monthAdv.length} clients`, icon: Calendar },
          { label: 'Total Clients',       value: String(allAdvisory.length), sub: 'all time',                   icon: Users },
          { label: 'Packages (in period)',value: `D:${diam}  P:${plat}  G:${gold}`, sub: 'Diamond / Platinum / Gold', icon: AlertTriangle },
        ]
      }
      return [
        { label: 'Total Collections',     value: fmtMoney(sumAmt(filtAdv)), sub: 'in selected period',            icon: TrendingUp },
        { label: 'Clients Added',         value: String(filtAdv.length),    sub: 'in selected period',            icon: Calendar   },
        { label: 'Total Clients',         value: String(allAdvisory.length),sub: 'all time',                      icon: Users      },
        { label: 'Packages (in period)', value: `D:${diam}  P:${plat}  G:${gold}`, sub: 'Diamond / Platinum / Gold', icon: AlertTriangle },
      ]
    }

    // ── Portfolio ────────────────────────────────────────────────────────
    if (section === 'portfolio') {
      const totalCapital = filtPort.reduce((s: number, c: any) => s + (c.capital ?? 0), 0)
      if (isThisMonth) {
        return [
          { label: "Today's Collections", value: fmtMoney(sumAmt(todayPort)), sub: `${todayPort.length} client${todayPort.length !== 1 ? 's' : ''}`, icon: TrendingUp },
          { label: 'This Month',          value: fmtMoney(sumAmt(monthPort)), sub: `${monthPort.length} clients`, icon: Calendar },
          { label: 'Total Clients',       value: String(allPortfolio.length), sub: 'all time',                    icon: Users },
          { label: 'Total Capital',       value: fmtMoney(allPortfolio.reduce((s: number, c: any) => s + (c.capital ?? 0), 0)), sub: 'all-time managed capital', icon: TrendingUp },
        ]
      }
      return [
        { label: 'Total Collections', value: fmtMoney(sumAmt(filtPort)), sub: 'in selected period',         icon: TrendingUp },
        { label: 'Clients Added',     value: String(filtPort.length),    sub: 'in selected period',         icon: Calendar   },
        { label: 'Total Clients',     value: String(allPortfolio.length),sub: 'all time',                   icon: Users      },
        { label: 'Capital (period)',  value: fmtMoney(totalCapital),     sub: 'managed in period',          icon: AlertTriangle },
      ]
    }

    // ── Technical ────────────────────────────────────────────────────────
    if (section === 'technical') {
      const avgAmt = filtTech.length > 0 ? Math.round(sumAmt(filtTech) / filtTech.length) : 0
      if (isThisMonth) {
        return [
          { label: "Today's Collections", value: fmtMoney(sumAmt(todayTech)), sub: `${todayTech.length} client${todayTech.length !== 1 ? 's' : ''}`, icon: TrendingUp },
          { label: 'This Month',          value: fmtMoney(sumAmt(monthTech)), sub: `${monthTech.length} clients`, icon: Calendar },
          { label: 'Total Clients',       value: String(allTechnical.length), sub: 'all time',                    icon: Users },
          { label: 'Clients This Month',  value: String(monthTech.length),    sub: 'added this month',            icon: AlertTriangle },
        ]
      }
      return [
        { label: 'Total Collections', value: fmtMoney(sumAmt(filtTech)), sub: 'in selected period',   icon: TrendingUp },
        { label: 'Clients Added',     value: String(filtTech.length),    sub: 'in selected period',   icon: Calendar   },
        { label: 'Total Clients',     value: String(allTechnical.length),sub: 'all time',              icon: Users      },
        { label: 'Avg per Client',    value: fmtMoney(avgAmt),           sub: 'in selected period',   icon: AlertTriangle },
      ]
    }

    return []
  }, [section, period, filtCusts, filtAdv, filtPort, filtTech, todayCusts, todayAdv, todayPort, todayTech, monthCusts, monthAdv, monthPort, monthTech, activeCount, expiringCount, allCustomers, allAdvisory, allPortfolio, allTechnical])

  // ── Breakdown (right column) ─────────────────────────────────────────────
  const displayBreakdown = useMemo(() => {
    if (section === 'advisory') {
      return ['Diamond', 'Platinum', 'Gold'].map(p => ({ type: p, count: filtAdv.filter((c: any) => c.package === p).length }))
    }
    if (section === 'portfolio') {
      return ['Low', 'Medium', 'High', 'Very High'].map(r => ({ type: r, count: filtPort.filter((c: any) => c.risk === r).length }))
    }
    if (section === 'technical') {
      return SUB_TYPES.map(t => ({ type: t, count: filtTech.filter((c: any) => c.subscription_type === t).length }))
    }
    const base = section === 'customers' ? filtCusts : allCustomers
    return SUB_TYPES.map(t => ({ type: t, count: base.filter((c: any) => c.subscription_type === t).length }))
  }, [section, filtCusts, filtAdv, filtPort, filtTech, allCustomers])

  // ── Recent list ──────────────────────────────────────────────────────────
  const { recentList, recentLabel, recentHref } = useMemo(() => {
    if (section === 'advisory')  return { recentList: filtAdv.slice(0, 20),  recentLabel: 'Advisory Clients',       recentHref: '/dashboard/advisory'        }
    if (section === 'portfolio') return { recentList: filtPort.slice(0, 20), recentLabel: 'Portfolio Clients',      recentHref: '/dashboard/portfolio'       }
    if (section === 'technical') return { recentList: filtTech.slice(0, 20), recentLabel: 'Technical Course Clients', recentHref: '/dashboard/technical-course' }
    // overall / customers
    const list = (period === 'all-time' && section === 'overall') ? allCustomers.slice(0, 20) : filtCusts.slice(0, 20)
    return { recentList: list, recentLabel: period === 'all-time' && section === 'overall' ? 'Recent Customers' : `Customers (${filtCusts.length})`, recentHref: '/dashboard/customers' }
  }, [section, period, filtCusts, filtAdv, filtPort, filtTech, allCustomers])

  // ── Render ───────────────────────────────────────────────────────────────
  const dateStr = now.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {now.toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {([
            { label: 'Today',      data: todayAll, period: 'today' },
            { label: 'This Week',  data: weekAll,  period: 'week'  },
            { label: 'This Month', data: monthAll, period: 'month' },
          ] as const).map(({ label, data, period: p }) => {
            const total = data.customers.length + data.advisory.length + data.portfolio.length + data.technical.length
            return (
              <button key={p}
                onClick={() => exportExcel(data as PeriodData, label, `Stockifyy-${p}-${dateStr}.xlsx`)}
                disabled={total === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors shadow-sm flex-shrink-0"
              >
                <Download size={13} />
                <span>{label}</span>
                {total > 0 && (
                  <span className="bg-white/20 text-white text-[10px] font-bold px-1 py-0.5 rounded-full leading-none">{total}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Section tabs ── */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {SECTION_TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setSection(key)}
            className={`px-3.5 py-2 text-sm font-semibold rounded-lg whitespace-nowrap transition-colors flex-shrink-0 ${
              section === key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Time period tabs ── */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {TIME_TABS.map(({ key, label }) => (
          <button key={key} onClick={() => { setPeriod(key); if (key !== 'custom') setCustomRange(null) }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors flex-shrink-0 ${
              period === key
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Custom range picker ── */}
      {period === 'custom' && (
        <div className="mb-4">
          <DateRangeFilter value={customRange} onChange={setCustomRange} label="Select date range:" />
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-5">
        {statCards.map(({ label, value, sub, icon: Icon }) => (
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

      {/* ── Recent list + right column ── */}
      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_300px] gap-4">

        {/* Recent list */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">{recentLabel}</span>
            <Link href={recentHref} className="text-xs text-primary font-semibold hover:underline">View all →</Link>
          </div>

          {recentList.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">No records in this period</p>
          )}

          {/* Advisory list */}
          {recentList.length > 0 && section === 'advisory' && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max">
                <thead>
                  <tr className="bg-muted/50">
                    {['Full Name', 'Phone', 'Package', 'Mentor', 'Amount', 'Adding Date'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentList.map((c: any) => (
                    <tr key={c.id} className="border-t border-border hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground text-sm whitespace-nowrap">{c.full_name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{c.phone}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {c.package ? (
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PKG_PILL[c.package] ?? 'bg-muted text-muted-foreground'}`}>{c.package}</span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{c.mentor}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-foreground tabular-nums">{c.amount ? fmtMoney(c.amount) : '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(c.adding_date ?? c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Portfolio list */}
          {recentList.length > 0 && section === 'portfolio' && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max">
                <thead>
                  <tr className="bg-muted/50">
                    {['Full Name', 'Phone', 'Duration', 'Capital', 'Amount Paid', 'Risk', 'Added'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentList.map((c: any) => (
                    <tr key={c.id} className="border-t border-border hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground text-sm whitespace-nowrap">{c.full_name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{c.phone}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{c.duration}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-foreground tabular-nums">{fmtMoney(c.capital)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-foreground tabular-nums">{c.amount ? fmtMoney(c.amount) : '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {c.risk ? (
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${RISK_PILL[c.risk] ?? 'bg-muted text-muted-foreground'}`}>{c.risk}</span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Technical list */}
          {recentList.length > 0 && section === 'technical' && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max">
                <thead>
                  <tr className="bg-muted/50">
                    {['Name', 'Mobile', 'Type', 'Amount', 'Installments', 'Added'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentList.map((c: any) => (
                    <tr key={c.id} className="border-t border-border hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground text-sm whitespace-nowrap">{c.name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{c.mobile}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TYPE_PILL[c.subscription_type] ?? 'bg-muted text-muted-foreground'}`}>{c.subscription_type}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-foreground tabular-nums">{fmtMoney(c.amount)}</td>
                      <td className="px-4 py-3 text-sm text-center text-muted-foreground">{c.installments ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Customers list (overall + customers section) */}
          {recentList.length > 0 && (section === 'overall' || section === 'customers') && (
            <>
              {/* Mobile */}
              <div className="md:hidden divide-y divide-border">
                {recentList.map((c: any) => {
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
              {/* Desktop */}
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
                    {recentList.map((c: any) => {
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
            </>
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
                    <div className={`w-full rounded-sm transition-opacity ${d.amount === 0 ? 'bg-border' : d.isToday ? 'bg-primary' : 'bg-primary/40 group-hover:bg-primary/70'}`} style={{ height: `${h}%` }} />
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
            <div className="text-sm font-semibold text-foreground mb-3">
              {section === 'advisory' ? 'By Package' : section === 'portfolio' ? 'By Risk' : 'By Type'}
            </div>
            <div className="space-y-3">
              {displayBreakdown.filter(b => b.count > 0).length === 0 ? (
                <p className="text-sm text-muted-foreground">No data</p>
              ) : displayBreakdown.map(({ type, count }) => {
                const total = Math.max(displayBreakdown.reduce((s, b) => s + b.count, 0), 1)
                const pct   = Math.round(count / total * 100)
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
