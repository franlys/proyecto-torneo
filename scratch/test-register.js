const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const supabaseKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Anon Key in .env.local.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSignUp() {
  console.log('Testing SignUp for testuser_temp_123@gmail.com...');
  const { data, error } = await supabase.auth.signUp({
    email: 'testuser_temp_123@gmail.com',
    password: 'Password123!',
  });

  if (error) {
    console.error('SignUp Error:', error);
  } else {
    console.log('SignUp Success:', data);
  }
}

testSignUp();
