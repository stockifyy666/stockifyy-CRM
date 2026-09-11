import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { fmtMoney } from '@/lib/utils'
import { subStatus, SUB_TYPES } from '@/lib/types'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Fetch all four tables in parallel
  const [
    { data: customers },
    { data: advisory },
    { data: portfolio },
    { data: technical },
  ] = await Promise.all([
    admin.from('customers').select('*').order('created_at', { ascending: false }),
    admin.from('advisory_clients').select('id, amount, adding_date, created_at'),
    admin.from('portfolio_clients').select('id, amount, created_at'),
    admin.from('technical_course_clients').select('id, amount, created_at'),
  ])

  const safe = customers ?? []
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const monthStr = now.toISOString().slice(0, 7)

  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 6)
  const weekAgoStr = weekAgo.toISOString().slice(0, 10)

  // Customer-based filters (for active/expiring counts and recent list)
  const todayCusts = safe.filter(c => c.subscription_start?.slice(0, 10) === todayStr)
  const weekCusts = safe.filter(c => {
    const d = c.subscription_start?.slice(0, 10)
    return d && d >= weekAgoStr && d <= todayStr
  })
  const monthCusts = safe.filter(c => c.subscription_start?.slice(0, 7) === monthStr)
  const active = safe.filter(c => subStatus(c.subscription_end) === 'active')
  const expiring = safe.filter(c => subStatus(c.subscription_end) === 'expiring')

  // Today's collection: customers + advisory + portfolio + technical
  const todayAdvisoryAmt = (advisory ?? [])
    .filter(c => (c.adding_date ?? c.created_at)?.slice(0, 10) === todayStr)
    .reduce((s, c) => s + (c.amount ?? 0), 0)
  const todayPortfolioAmt = (portfolio ?? [])
    .filter(c => c.created_at?.slice(0, 10) === todayStr)
    .reduce((s, c) => s + (c.amount ?? 0), 0)
  const todayTechnicalAmt = (technical ?? [])
    .filter(c => c.created_at?.slice(0, 10) === todayStr)
    .reduce((s, c) => s + (c.amount ?? 0), 0)
  const todayCustAmt = todayCusts.reduce((s, c) => s + (c.amount ?? 0), 0)
  const todayAmt = todayCustAmt + todayAdvisoryAmt + todayPortfolioAmt + todayTechnicalAmt

  // This month's collection: customers + advisory + portfolio + technical
  const monthAdvisoryAmt = (advisory ?? [])
    .filter(c => (c.adding_date ?? c.created_at)?.slice(0, 7) === monthStr)
    .reduce((s, c) => s + (c.amount ?? 0), 0)
  const monthPortfolioAmt = (portfolio ?? [])
    .filter(c => c.created_at?.slice(0, 7) === monthStr)
    .reduce((s, c) => s + (c.amount ?? 0), 0)
  const monthTechnicalAmt = (technical ?? [])
    .filter(c => c.created_at?.slice(0, 7) === monthStr)
    .reduce((s, c) => s + (c.amount ?? 0), 0)
  const monthCustAmt = monthCusts.reduce((s, c) => s + (c.amount ?? 0), 0)
  const monthAmt = monthCustAmt + monthAdvisoryAmt + monthPortfolioAmt + monthTechnicalAmt

  const days: string[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }

  const chartData = days.map(day => {
    const custAmt = safe.filter(c => c.subscription_start?.slice(0, 10) === day).reduce((s, c) => s + (c.amount ?? 0), 0)
    const advAmt = (advisory ?? []).filter(c => (c.adding_date ?? c.created_at)?.slice(0, 10) === day).reduce((s, c) => s + (c.amount ?? 0), 0)
    const portAmt = (portfolio ?? []).filter(c => c.created_at?.slice(0, 10) === day).reduce((s, c) => s + (c.amount ?? 0), 0)
    const techAmt = (technical ?? []).filter(c => c.created_at?.slice(0, 10) === day).reduce((s, c) => s + (c.amount ?? 0), 0)
    return { day, amount: custAmt + advAmt + portAmt + techAmt, isToday: day === todayStr }
  })

  const breakdown = SUB_TYPES.map(t => ({ type: t, count: safe.filter(c => c.subscription_type === t).length }))
  const recent = safe.slice(0, 7)

  return (
    <DashboardClient
      metrics={{
        todayAmt: fmtMoney(todayAmt),
        todayCount: todayCusts.length,
        monthAmt: fmtMoney(monthAmt),
        monthCount: monthCusts.length,
        activeCount: active.length,
        totalCount: safe.length,
        expiringCount: expiring.length,
      }}
      chartData={chartData}
      breakdown={breakdown}
      recent={recent}
      todayCustomers={todayCusts}
      weekCustomers={weekCusts}
      monthCustomers={monthCusts}
      allCustomers={safe}
    />
  )
}
