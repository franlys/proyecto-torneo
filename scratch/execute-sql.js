const { Client } = require('pg');

const connectionString = 'postgresql://postgres.otssvwinchttedisfqtr:Progreso070901*@aws-1-us-east-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

const sql = `SELECT id, username, role, subscription_status FROM public.profiles;`;

async function run() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected. Running SQL query...');
    const res = await client.query(sql);
    console.log('Query result:', res.rows);
  } catch (err) {
    console.error('Database query error:', err.message);
  } finally {
    await client.end();
  }
}

run();
