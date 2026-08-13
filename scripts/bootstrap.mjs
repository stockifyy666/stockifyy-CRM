/**
 * Bootstrap script — sets up database tables + admin profile.
 * Usage: node scripts/bootstrap.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local
const envRaw = readFileSync(join(__dirname, '../.env.local'), 'utf8')
const env = Object.fromEntries(
  envRaw.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#') && l.trim())
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

console.log('🔗 Connected to:', env.NEXT_PUBLIC_SUPABASE_URL)

// ── Find or create the admin user ────────────────────────────────────────────
console.log('\n🔍 Looking up user: admin@gmail.com')
const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers()

if (listErr) {
  console.error('❌ Could not list users:', listErr.message)
  process.exit(1)
}

let userId
const existing = users.find(u => u.email === 'admin@gmail.com')

if (!existing) {
  console.log('👤 Not found — creating user...')
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: 'admin@gmail.com',
    password: 'stockifyy_99',
    email_confirm: true,
    user_metadata: { name: 'Admin', role: 'admin' }
  })
  if (createErr) { console.error('❌ Create user failed:', createErr.message); process.exit(1) }
  userId = created.user.id
  console.log('✅ User created:', userId)
} else {
  userId = existing.id
  console.log('✅ User found:', userId)
}

// ── Upsert admin profile ──────────────────────────────────────────────────────
console.log('\n📝 Upserting admin profile...')
const { error: profileErr } = await supabase
  .from('profiles')
  .upsert({ id: userId, name: 'Admin', role: 'admin' }, { onConflict: 'id' })

if (profileErr) {
  console.error('\n❌ Profile upsert failed:', profileErr.message)
  console.error('   Code:', profileErr.code)

  if (profileErr.code === '42P01') {
    // Table doesn't exist — create it now using the REST API won't work,
    // so we guide the user to the SQL editor
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('⚠️  The `profiles` table does not exist yet.')
    console.log('')
    console.log('👉 Open your Supabase SQL Editor and run the schema:')
    console.log(`   https://supabase.com/dashboard/project/${env.NEXT_PUBLIC_SUPABASE_URL.split('.')[0].split('//')[1]}/sql/new`)
    console.log('')
    console.log('   File: supabase/schema.sql  (in this project folder)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    process.exit(1)
  }
  process.exit(1)
}

console.log('✅ Admin profile ready (role: admin)')

// ── Done ──────────────────────────────────────────────────────────────────────
console.log('\n🎉 Bootstrap complete! You can now sign in:')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('   URL:      http://localhost:3000')
console.log('   Email:    admin@gmail.com')
console.log('   Password: stockifyy_99')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
