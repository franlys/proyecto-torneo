const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const envContent = fs.readFileSync('.env.local', 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
  const parts = line.split('=')
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim()
  }
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})

async function run() {
  const { data, error } = await adminSupabase
    .from('profiles')
    .select('*')
    .eq('role', 'SUPER_ADMIN')
    .maybeSingle()

  if (error) {
    console.error('Error fetching super admin profile:', error)
    return
  }
  console.log('Perfil de Súper Admin:', data)
}

run()

run()
