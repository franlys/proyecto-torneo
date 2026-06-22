const { Client } = require('pg');

const connectionString = 'postgresql://postgres.otssvwinchttedisfqtr:Progreso070901*@aws-1-us-east-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Cleaning up test user testuser_temp_123@gmail.com...');
    
    // Delete from auth.users (cascades to public.profiles)
    await client.query("DELETE FROM auth.users WHERE email = 'testuser_temp_123@gmail.com'");
    console.log('Test user cleaned up successfully!');
  } catch (err) {
    console.error('Database query error:', err.message);
  } finally {
    await client.end();
  }
}

run();
