import { createAdminClient } from '../src/lib/supabase/server'

async function check() {
  const supabase = await createAdminClient()
  const email = 'mayckolgonzalez@gmail.com'
  
  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('buyer_email', email)
  
  if (error) {
    console.error('Error:', error)
    return
  }

  console.log(`All tickets in DB for ${email} (total: ${tickets.length}):`)
  tickets.forEach(t => {
    console.log(`- Raffle ID: ${t.raffle_id}, Number: #${t.ticket_number}, Status: ${t.payment_status}, Created: ${t.created_at}`)
  })
}

check()
