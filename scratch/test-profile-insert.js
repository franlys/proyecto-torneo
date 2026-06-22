const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const supabaseServiceKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase URL or Service Role Key in .env.local.');
  process.exit(1);
}

// Use Service Role Client to bypass RLS and perform admin insert
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testInsert() {
  console.log('Testing insert into profiles with role = USER...');
  const tempId = '00000000-0000-0000-0000-000000000001';
  
  // Clean up if exists
  await supabase.from('profiles').delete().eq('id', tempId);

  const { data, error } = await supabase.from('profiles').insert({
    id: tempId,
    username: 'test_temp_profile_user',
    role: 'USER'
  }).select();

  if (error) {
    console.error('Insert Error:', error);
  } else {
    console.log('Insert Success:', data);
    // clean up
    await supabase.from('profiles').delete().eq('id', tempId);
  }
}

testInsert();
