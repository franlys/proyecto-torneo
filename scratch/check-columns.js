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
    await client.connect();
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'participants';
    `);
    console.log('Columns in participants:');
    console.log(res.rows);

    const res2 = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'creator_bans';
    `);
    console.log('Columns in creator_bans:');
    console.log(res2.rows);

  } catch (err) {
    console.error('Error querying columns:', err.message);
  } finally {
    await client.end();
  }
}

run();
