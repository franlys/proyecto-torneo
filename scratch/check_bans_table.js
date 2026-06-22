const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

let supabaseUrl = '';
let supabaseKey = '';

try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
      supabaseUrl = line.split('=')[1].trim();
    }
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
      supabaseKey = line.split('=')[1].trim();
    }
  }
} catch (e) {
  console.error('Error al leer .env.local:', e);
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan variables de entorno', { supabaseUrl, supabaseKey });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Verificando la tabla creator_bans...');
  const { data, error } = await supabase
    .from('creator_bans')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error al consultar creator_bans:', error);
  } else {
    console.log('¡Tabla creator_bans consultada correctamente!', data);
  }
}

run();
