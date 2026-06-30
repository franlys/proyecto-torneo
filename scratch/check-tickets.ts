import { createAdminClient } from '../src/lib/supabase/server'

async function check() {
  const supabase = await createAdminClient()
  const raffleId = '2d4d0bc9-e50d-4551-a8cc-32df7f3f8e2b' // PS5 Pro y el GTA VI
  
  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('raffle_id', raffleId)
  
  if (error) {
    console.error('Error:', error)
    return
  }

  console.log(`Tickets in DB for PS5 Pro raffle (total: ${tickets.length}):`)
  tickets.forEach(t => {
    console.log(`- ID: ${t.id}, Number: #${t.ticket_number}, Status: ${t.payment_status}, Buyer: ${t.buyer_name} (${t.buyer_email}), Phone: ${t.buyer_phone}`)
  })
}

check()
