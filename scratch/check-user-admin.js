const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Parse .env.local
const envPath = './.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    envVars[key] = value.trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is missing from .env.local!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const emailToSearch = 'elmaestrogonzalez30@gmail.com';

async function verifyUser() {
  console.log(`Buscando usuario en auth.users con email: ${emailToSearch}...`);
  
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  
  if (authError) {
    console.error('Error al consultar auth.users:', authError);
    return;
  }
  
  const user = authData.users.find(u => u.email && u.email.toLowerCase() === emailToSearch.toLowerCase());
  
  if (!user) {
    console.log(`No se encontró ningún usuario en auth.users con el correo ${emailToSearch}.`);
    console.log('Usuarios registrados disponibles:');
    authData.users.forEach(u => {
      console.log(`- ${u.email} (ID: ${u.id})`);
    });
    return;
  }
  
  console.log('Usuario encontrado en auth.users:', {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at
  });
  
  console.log(`Buscando perfil en public.profiles para la ID: ${user.id}...`);
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
    
  if (profileError) {
    console.error('Error al consultar tabla profiles:', profileError);
    return;
  }
  
  if (!profile) {
    console.log('El usuario NO tiene un perfil creado en la tabla public.profiles.');
    return;
  }
  
  console.log('Perfil encontrado en public.profiles:', {
    id: profile.id,
    username: profile.username,
    role: profile.role,
    subscription_status: profile.subscription_status,
    has_ranking_license: profile.has_ranking_license
  });
}

verifyUser();
