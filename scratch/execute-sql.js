const { Client } = require('pg');

const connectionString = 'postgresql://postgres.otssvwinchttedisfqtr:Progreso070901*@aws-1-us-east-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

const sql = `
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'username',
    CASE WHEN (SELECT COUNT(*) FROM public.profiles) = 0 THEN 'ADMIN'::user_role ELSE 'USER'::user_role END
  );
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

async function run() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected. Running SQL query...');
    await client.query(sql);
    console.log('SQL trigger safety function updated successfully!');
  } catch (err) {
    console.error('Database query error:', err.message);
  } finally {
    await client.end();
  }
}

run();
