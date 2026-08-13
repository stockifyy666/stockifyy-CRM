import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import TeamClient from './TeamClient'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  // Use admin client to read all profiles, bypassing RLS
  const admin = createAdminClient()
  const { data: team = [] } = await admin.from('profiles').select('*').order('created_at')

  return <TeamClient team={team ?? []} currentUserId={user.id} />
}
