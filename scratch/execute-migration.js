const { Client } = require('pg');

const connectionString = 'postgresql://postgres.otssvwinchttedisfqtr:Progreso070901*@aws-1-us-east-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

const sql = `
ALTER TABLE scoring_rules ADD COLUMN use_multiplier BOOLEAN NOT NULL DEFAULT false;
`;

async function run() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected. Running SQL migration...');
    await client.query(sql);
    console.log('SQL migration ran successfully: use_multiplier column added to scoring_rules table!');
  } catch (err) {
    console.error('Database query error:', err.message);
  } finally {
    await client.end();
  }
}

run();
