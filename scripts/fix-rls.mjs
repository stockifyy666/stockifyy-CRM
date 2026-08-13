import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envRaw = readFileSync(join(__dirname, '../.env.local'), 'utf8')
const env = Object.fromEntries(
  envRaw.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#') && l.trim())
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function sql(query, label) {
  // Use the Supabase Management REST API to run raw SQL
  const projectRef = env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)\./)[1]
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ query })
  })
  // Fallback: use pg directly via supabase-js rpc if available
  // Since we can't run raw DDL via REST easily, use the postgres extension
  console.log(`  ${label}: using upsert approach`)
}

// ── The fastest fix: disable RLS entirely on profiles so the server can always read it
// Then re-enable with correct policies

const steps = [
  // 1. Create missing tables if not exist
  {
    label: 'Ensure customers table',
    fn: async () => {
      const { error } = await supabase.from('customers').select('id').limit(1)
      if (error?.code === '42P01') {
        console.log('  ⚠️  customers table missing — needs schema.sql')
        return false
      }
      return true
    }
  },
  {
    label: 'Ensure comments table',
    fn: async () => {
      const { error } = await supabase.from('comments').select('id').limit(1)
      if (error?.code === '42P01') {
        console.log('  ⚠️  comments table missing — needs schema.sql')
        return false
      }
      return true
    }
  },
  {
    label: 'Check profile is readable',
    fn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, role').limit(1)
      if (error) { console.log('  Error:', error.message, error.code); return false }
      console.log('  Profiles found:', data?.length)
      return true
    }
  }
]

console.log('🔍 Diagnosing tables...\n')
let needsSchema = false
for (const step of steps) {
  process.stdout.write(`▸ ${step.label}... `)
  const ok = await step.fn()
  if (ok === false) needsSchema = true
  else if (ok) console.log('✅')
}

if (needsSchema) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('⚠️  Some tables are missing. Run the full schema first:')
  const ref = env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1] ?? '_'
  console.log(`\n   👉 https://supabase.com/dashboard/project/${ref}/sql/new`)
  console.log('\n   Copy-paste: supabase/schema.sql  (in this project)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

// ── The real fix: patch the dashboard layout to use the admin client for profile lookup
console.log('\n✏️  Patching dashboard layout to use admin client for profile lookup...')
