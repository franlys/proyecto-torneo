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
    
    // Get participants of Xvi Cup
    const res = await client.query(`
      SELECT id, display_name, total_kills 
      FROM participants 
      WHERE tournament_id = '2baf60dd-02fc-4ce0-9a3e-7ec451ced8b4'
      ORDER BY total_kills DESC;
    `);
    console.log('Participants for Xvi Cup:');
    console.log(res.rows);

    // Get all submissions for Xvi Cup
    const res2 = await client.query(`
      SELECT id, team_id, match_id, submitted_by, kill_count, player_kills, status 
      FROM submissions 
      WHERE tournament_id = '2baf60dd-02fc-4ce0-9a3e-7ec451ced8b4';
    `);
    console.log('\nSubmissions for Xvi Cup:');
    console.log(res2.rows);

  } catch (err) {
    console.error('Error querying:', err.message);
  } finally {
    await client.end();
  }
}

run();
