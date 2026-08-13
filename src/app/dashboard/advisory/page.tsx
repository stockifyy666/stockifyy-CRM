import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AdvisoryClient from './AdvisoryClient'

export default async function AdvisoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const admin = createAdminClient()
  const { data: clients = [] } = await admin
    .from('advisory_clients')
    .select('*, added_by_profile:profiles!advisory_clients_added_by_fkey(name, role)')
    .order('created_at', { ascending: false })

  return <AdvisoryClient clients={clients ?? []} profile={profile} />
}
