import { createAdminClient } from '../src/lib/supabase/server'

async function check() {
  const supabase = await createAdminClient()
  
  // Query metadata about the tickets table
  const { data, error } = await supabase
    .rpc('get_table_info', { table_name: 'tickets' })
  
  if (error) {
    // If rpc doesn't exist, we can just do a query or check columns using direct SQL via API (or try inserting a row with null email)
    console.log('RPC get_table_info failed, attempting direct insert test...')
    
    const { error: insErr } = await supabase
      .from('tickets')
      .insert({
        raffle_id: '2d4d0bc9-e50d-4551-a8cc-32df7f3f8e2b',
        ticket_number: '9999',
        buyer_name: 'Test Manual User',
        buyer_email: null, // Test if null is allowed
        buyer_phone: '809-555-0100',
        payment_status: 'verified'
      })

    if (insErr) {
      console.log('Insert with NULL email failed. Error detail:', insErr.message)
    } else {
      console.log('Insert with NULL email succeeded! Cleaning up...')
      await supabase.from('tickets').delete().eq('ticket_number', '9999')
    }
  } else {
    console.log('Table info:', data)
  }
}

check()
