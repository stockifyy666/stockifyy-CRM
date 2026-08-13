import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import DashboardShell from '@/components/DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).single()

  if (!profile) {
    const { data: newProfile } = await admin
      .from('profiles')
      .insert({ id: user.id, name: user.email?.split('@')[0] ?? 'User', role: 'support' })
      .select('*')
      .single()
    if (!newProfile) redirect('/login')
    return <DashboardShell profile={newProfile}>{children}</DashboardShell>
  }

  return <DashboardShell profile={profile}>{children}</DashboardShell>
}
