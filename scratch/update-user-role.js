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

const emailToUpdate = 'elmaestrogonzalez30@gmail.com';
const newRole = 'SUPER_ADMIN';

async function updateRole() {
  console.log(`Buscando usuario con email: ${emailToUpdate}...`);
  
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (authError) {
    console.error('Error al obtener usuarios:', authError);
    return;
  }
  
  const user = authData.users.find(u => u.email && u.email.toLowerCase() === emailToUpdate.toLowerCase());
  if (!user) {
    console.log(`No se encontró el usuario con email ${emailToUpdate}.`);
    return;
  }
  
  console.log(`Usuario encontrado (ID: ${user.id}). Actualizando rol a ${newRole} en public.profiles...`);
  
  const { data: updatedProfile, error: updateError } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', user.id)
    .select()
    .single();
    
  if (updateError) {
    console.error('Error al actualizar el rol en profiles:', updateError);
    return;
  }
  
  console.log('¡Rol actualizado con éxito! Nuevo perfil:', {
    id: updatedProfile.id,
    username: updatedProfile.username,
    role: updatedProfile.role
  });
}

updateRole();
