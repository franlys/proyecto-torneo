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
  const { data, error } = await adminSupabase.from('profiles').select('*').limit(1)
  if (error) {
    console.error('Error fetching profiles:', error)
    return
  }
  console.log('Fila de perfiles recuperada:', data[0])
  console.log('Columnas disponibles:', Object.keys(data[0] || {}))
}

run()

run()
