import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { fmtMoney } from '@/lib/utils'
import { subStatus } from '@/lib/types'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: customers = [] } = await admin
    .from('customers')
    .select('*, added_by_profile:profiles!customers_added_by_fkey(name, role)')
    .order('created_at', { ascending: false })

  const safe = customers ?? []
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const monthStr = now.toISOString().slice(0, 7)

  const todayCusts = safe.filter(c => c.subscription_start?.slice(0, 10) === todayStr)
  const monthCusts = safe.filter(c => c.subscription_start?.slice(0, 7) === monthStr)
  const active = safe.filter(c => subStatus(c.subscription_end) === 'active')
  const expiring = safe.filter(c => {
    const end = new Date(c.subscription_end)
    const diff = (end.getTime() - now.getTime()) / 86400000
    return diff >= 0 && diff <= 7
  })

  const todayAmt = todayCusts.reduce((s, c) => s + (c.amount ?? 0), 0)
  const monthAmt = monthCusts.reduce((s, c) => s + (c.amount ?? 0), 0)

  const days: string[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  const chartData = days.map(day => ({
    day,
    amount: safe.filter(c => c.subscription_start?.slice(0, 10) === day).reduce((s, c) => s + (c.amount ?? 0), 0),
    isToday: day === todayStr,
  }))

  const types = ['Advisory', 'Paltanium Group', 'Invest with Stockifyy', 'Other']
  const breakdown = types.map(t => ({ type: t, count: safe.filter(c => c.subscription_type === t).length }))

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
    />
  )
}
