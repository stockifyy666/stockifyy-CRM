import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import PaymentsClient from './PaymentsClient'

export default async function PaymentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: customers = [] } = await admin
    .from('customers')
    .select('*, added_by_profile:profiles!customers_added_by_fkey(name, role)')
    .order('subscription_start', { ascending: false })

  return <PaymentsClient customers={customers ?? []} />
}
