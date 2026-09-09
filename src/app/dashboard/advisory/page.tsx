import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AdvisoryClient from './AdvisoryClient'

export default async function AdvisoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [{ data: profile }, { data: clients }] = await Promise.all([
    admin.from('profiles').select('*').eq('id', user.id).single(),
    admin
      .from('advisory_clients')
      .select('*, added_by_profile:profiles!advisory_clients_added_by_fkey(name, role)')
      .order('created_at', { ascending: false }),
  ])
  if (!profile) redirect('/login')

  return <AdvisoryClient clients={clients ?? []} profile={profile} />
}
