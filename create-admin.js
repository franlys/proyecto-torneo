const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://otssvwinchttedisfqtr.supabase.co',
  'sb_publishable_p2fVfPXNLmehYppcTb-2bQ_CLaIvB6G'
)

async function createAdmin() {
  const { data, error } = await supabase.auth.signUp({
    email: 'torneos@admin.com',
    password: 'Password123!',
  })
  
  if (error) {
    console.error('Error creating admin:', error.message)
  } else {
    console.log('Nuevo usuario creado con la confirmación apagada!')
  }
}

createAdmin()
