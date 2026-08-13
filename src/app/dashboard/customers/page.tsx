import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import CustomersClient from './CustomersClient'

export default async function CustomersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: customers = [] } = await admin
    .from('customers')
    .select('*, added_by_profile:profiles!customers_added_by_fkey(name, role)')
    .order('created_at', { ascending: false })

  return <CustomersClient customers={customers ?? []} profile={profile} />
}
