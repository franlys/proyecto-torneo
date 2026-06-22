const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://otssvwinchttedisfqtr.supabase.co';
const supabaseKey = 'sb_publishable_p2fVfPXNLmehYppcTb-2bQ_CLaIvB6G';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching one scoring rule to check columns...');
  const { data, error } = await supabase
    .from('scoring_rules')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Columns and data:', data);
  }
}

run();
