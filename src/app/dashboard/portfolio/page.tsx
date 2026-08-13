import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import PortfolioClient from './PortfolioClient'

export default async function PortfolioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const admin = createAdminClient()
  const { data: clients = [] } = await admin
    .from('portfolio_clients')
    .select('*, added_by_profile:profiles!portfolio_clients_added_by_fkey(name, role)')
    .order('created_at', { ascending: false })

  return <PortfolioClient clients={clients ?? []} profile={profile} />
}
