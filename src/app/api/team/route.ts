import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/team — list all profiles (admin only)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('profiles').select('*').order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/team — create a new team member (admin only)
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, email, password, role } = await req.json()
  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: 'name, email, password and role are required' }, { status: 400 })
  }
  if (!['admin', 'finance', 'support'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Create auth user
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,           // skip email verification
    user_metadata: { name, role }, // trigger picks these up
  })
  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 })

  // The trigger auto-inserts a profile row; now set the role explicitly
  const { error: roleErr } = await admin
    .from('profiles')
    .update({ name, role })
    .eq('id', created.user.id)
  if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 500 })

  const { data: newProfile } = await admin.from('profiles').select('*').eq('id', created.user.id).single()
  return NextResponse.json(newProfile, { status: 201 })
}

// DELETE /api/team — remove a team member (admin only, cannot delete self)
export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
  if (userId === user.id) return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// PATCH /api/team — update role (admin only, cannot demote self)
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, role } = await req.json()
  if (!userId || !role) return NextResponse.json({ error: 'userId and role required' }, { status: 400 })
  if (!['admin', 'finance', 'support'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  if (userId === user.id) return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('profiles').update({ role }).eq('id', userId).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
