import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
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
    { data: techInstallments },
  ] = await Promise.all([
    admin.from('customers').select('*').order('created_at', { ascending: false }),
    admin.from('advisory_clients').select('id, full_name, phone, package, mentor, amount, adding_date, created_at').order('created_at', { ascending: false }),
    admin.from('portfolio_clients').select('id, full_name, client_code, phone, duration, capital, amount, risk, created_at').order('created_at', { ascending: false }),
    admin.from('technical_course_clients').select('id, name, client_code, mobile, subscription_type, amount, installments, adding_date, created_at').order('created_at', { ascending: false }),
    admin.from('technical_installments').select('id, client_id, amount, paid_date, created_at').order('paid_date', { ascending: false }),
  ])

  const safe  = customers ?? []
  const adv   = advisory ?? []
  const port  = portfolio ?? []
  const tech  = technical ?? []
  const tinst = techInstallments ?? []

  const now = new Date()
  const todayStr   = now.toISOString().slice(0, 10)
  const monthStr   = now.toISOString().slice(0, 7)
  const weekAgo    = new Date(now); weekAgo.setDate(weekAgo.getDate() - 6)
  const weekAgoStr = weekAgo.toISOString().slice(0, 10)

  const techDate = (c: any) => (c.adding_date ?? c.created_at)?.slice(0, 10)

  // Pre-filtered period buckets (for download buttons)
  const todayAll = {
    customers: safe.filter(c => c.subscription_start?.slice(0, 10) === todayStr),
    advisory:  adv.filter(c  => (c.adding_date ?? c.created_at)?.slice(0, 10) === todayStr),
    portfolio: port.filter(c => c.created_at?.slice(0, 10) === todayStr),
    technical: tech.filter(c => techDate(c) === todayStr),
  }
  const weekAll = {
    customers: safe.filter(c => { const d = c.subscription_start?.slice(0, 10); return d && d >= weekAgoStr && d <= todayStr }),
    advisory:  adv.filter(c  => { const d = (c.adding_date ?? c.created_at)?.slice(0, 10); return d && d >= weekAgoStr && d <= todayStr }),
    portfolio: port.filter(c => { const d = c.created_at?.slice(0, 10); return d && d >= weekAgoStr && d <= todayStr }),
    technical: tech.filter(c => { const d = techDate(c); return d && d >= weekAgoStr && d <= todayStr }),
  }
  const monthAll = {
    customers: safe.filter(c => c.subscription_start?.slice(0, 7) === monthStr),
    advisory:  adv.filter(c  => (c.adding_date ?? c.created_at)?.slice(0, 7) === monthStr),
    portfolio: port.filter(c => c.created_at?.slice(0, 7) === monthStr),
    technical: tech.filter(c => techDate(c)?.slice(0, 7) === monthStr),
  }

  return (
    <DashboardClient
      allCustomers={safe}
      allAdvisory={adv}
      allPortfolio={port}
      allTechnical={tech}
      allTechInstallments={tinst}
      todayAll={todayAll}
      weekAll={weekAll}
      monthAll={monthAll}
    />
  )
}
