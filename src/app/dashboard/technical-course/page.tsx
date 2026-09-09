import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import TechnicalCourseClient from './TechnicalCourseClient'

export default async function TechnicalCoursePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [{ data: profile }, { data: clients }] = await Promise.all([
    admin.from('profiles').select('*').eq('id', user.id).single(),
    admin
      .from('technical_course_clients')
      .select('*, added_by_profile:profiles!technical_course_clients_added_by_fkey(name, role)')
      .order('created_at', { ascending: false }),
  ])
  if (!profile) redirect('/login')

  return <TechnicalCourseClient clients={clients ?? []} profile={profile} />
}
