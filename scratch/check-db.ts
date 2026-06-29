import { createAdminClient } from '../src/lib/supabase/server'

async function check() {
  const supabase = await createAdminClient()
  const { data: raffles, error: rErr } = await supabase
    .from('raffles')
    .select('id, title, total_tickets')
  
  if (rErr) {
    console.error('Error fetching raffles:', rErr)
    return
  }

  console.log('Raffles found:', raffles.length)
  for (const r of raffles) {
    const { data: tickets, error: tErr } = await supabase
      .from('tickets')
      .select('id, ticket_number, payment_status')
      .eq('raffle_id', r.id)
    
    if (tErr) {
      console.error(`Error fetching tickets for raffle ${r.title}:`, tErr)
      continue
    }

    const statuses = tickets.reduce((acc: any, t) => {
      acc[t.payment_status] = (acc[t.payment_status] || 0) + 1
      return acc
    }, {})

    console.log(`Raffle: "${r.title}" (ID: ${r.id})`)
    console.log(`  Total tickets target: ${r.total_tickets}`)
    console.log(`  Total ticket rows found: ${tickets.length}`)
    console.log(`  By status:`, statuses)
  }
}

check()
