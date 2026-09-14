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

  const [
    { data: customers },
    { data: advisory },
    { data: portfolio },
    { data: technical },
  ] = await Promise.all([
    admin.from('customers').select('*').order('created_at', { ascending: false }),
    admin.from('advisory_clients').select('id, full_name, phone, package, mentor, amount, adding_date, created_at').order('created_at', { ascending: false }),
    admin.from('portfolio_clients').select('id, full_name, client_code, phone, duration, capital, amount, risk, created_at').order('created_at', { ascending: false }),
    admin.from('technical_course_clients').select('id, name, client_code, mobile, subscription_type, amount, installments, created_at').order('created_at', { ascending: false }),
  ])

  const safe = customers ?? []
  const adv = advisory ?? []
  const port = portfolio ?? []
  const tech = technical ?? []

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const monthStr = now.toISOString().slice(0, 7)
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 6)
  const weekAgoStr = weekAgo.toISOString().slice(0, 10)

  // Customer-only filters (for active/expiring counts)
  const todayCusts = safe.filter(c => c.subscription_start?.slice(0, 10) === todayStr)
  const weekCusts  = safe.filter(c => { const d = c.subscription_start?.slice(0, 10); return d && d >= weekAgoStr && d <= todayStr })
  const monthCusts = safe.filter(c => c.subscription_start?.slice(0, 7) === monthStr)
  const active     = safe.filter(c => subStatus(c.subscription_end) === 'active')
  const expiring   = safe.filter(c => subStatus(c.subscription_end) === 'expiring')

  // Advisory/Portfolio/Technical filtered by period (using created_at / adding_date)
  const todayAdv   = adv.filter(c  => (c.adding_date ?? c.created_at)?.slice(0, 10) === todayStr)
  const weekAdv    = adv.filter(c  => { const d = (c.adding_date ?? c.created_at)?.slice(0, 10); return d && d >= weekAgoStr && d <= todayStr })
  const monthAdv   = adv.filter(c  => (c.adding_date ?? c.created_at)?.slice(0, 7) === monthStr)

  const todayPort  = port.filter(c => c.created_at?.slice(0, 10) === todayStr)
  const weekPort   = port.filter(c => { const d = c.created_at?.slice(0, 10); return d && d >= weekAgoStr && d <= todayStr })
  const monthPort  = port.filter(c => c.created_at?.slice(0, 7) === monthStr)

  const todayTech  = tech.filter(c => c.created_at?.slice(0, 10) === todayStr)
  const weekTech   = tech.filter(c => { const d = c.created_at?.slice(0, 10); return d && d >= weekAgoStr && d <= todayStr })
  const monthTech  = tech.filter(c => c.created_at?.slice(0, 7) === monthStr)

  const sum = (arr: any[], field = 'amount') => arr.reduce((s, c) => s + (c[field] ?? 0), 0)

  const todayAmt = sum(todayCusts) + sum(todayAdv) + sum(todayPort) + sum(todayTech)
  const monthAmt = sum(monthCusts) + sum(monthAdv) + sum(monthPort) + sum(monthTech)

  const days: string[] = []
  for (let i = 29; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); days.push(d.toISOString().slice(0, 10)) }

  const chartData = days.map(day => {
    const custAmt = safe.filter(c => c.subscription_start?.slice(0, 10) === day).reduce((s, c) => s + (c.amount ?? 0), 0)
    const advAmt  = adv.filter(c  => (c.adding_date ?? c.created_at)?.slice(0, 10) === day).reduce((s, c) => s + (c.amount ?? 0), 0)
    const portAmt = port.filter(c => c.created_at?.slice(0, 10) === day).reduce((s, c) => s + (c.amount ?? 0), 0)
    const techAmt = tech.filter(c => c.created_at?.slice(0, 10) === day).reduce((s, c) => s + (c.amount ?? 0), 0)
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
      todayAll={{ customers: todayCusts, advisory: todayAdv, portfolio: todayPort, technical: todayTech }}
      weekAll={{ customers: weekCusts, advisory: weekAdv, portfolio: weekPort, technical: weekTech }}
      monthAll={{ customers: monthCusts, advisory: monthAdv, portfolio: monthPort, technical: monthTech }}
      allCustomers={safe}
    />
  )
}
