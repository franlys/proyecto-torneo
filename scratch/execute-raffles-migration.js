const { Client } = require('pg');

const connectionString = 'postgresql://postgres.otssvwinchttedisfqtr:Progreso070901*@aws-1-us-east-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

const sql = `
-- 1. Create table public.raffles
CREATE TABLE IF NOT EXISTS public.raffles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    draw_date TIMESTAMPTZ NOT NULL,
    ticket_price NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'RD$',
    total_tickets INTEGER DEFAULT 1000,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'drawing', 'finished')),
    prize_image TEXT,
    winner_ticket_id UUID,
    winner_name VARCHAR(255),
    finished_at TIMESTAMPTZ,
    payment_bank_name VARCHAR(255) NOT NULL,
    payment_account_holder VARCHAR(255) NOT NULL,
    payment_bank_id VARCHAR(255) NOT NULL,
    payment_details TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on public.raffles
ALTER TABLE public.raffles ENABLE ROW LEVEL SECURITY;

-- 2. Create table public.tickets
CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id UUID NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ticket_number VARCHAR(10) NOT NULL,
    buyer_name VARCHAR(255) NOT NULL,
    buyer_email VARCHAR(255) NOT NULL,
    buyer_phone VARCHAR(255) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'pending_verification' CHECK (payment_status IN ('pending_verification', 'verified', 'rejected')),
    receipt_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on public.tickets
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist
DROP POLICY IF EXISTS "Permitir lectura publica de sorteos" ON public.raffles;
CREATE POLICY "Permitir lectura publica de sorteos" ON public.raffles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir gestion completa de sorteos a admins" ON public.raffles;
CREATE POLICY "Permitir gestion completa de sorteos a admins" ON public.raffles FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.id = auth.uid() 
    AND (public.profiles.role = 'SUPER_ADMIN' OR public.profiles.role = 'ADMIN')
  )
);

DROP POLICY IF EXISTS "Permitir lectura de boletos a admins y compradores" ON public.tickets;
CREATE POLICY "Permitir lectura de boletos a admins y compradores" ON public.tickets FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.id = auth.uid() 
    AND (public.profiles.role = 'SUPER_ADMIN' OR public.profiles.role = 'ADMIN')
  )
  OR auth.uid() = user_id
  OR true
);

DROP POLICY IF EXISTS "Permitir insercion publica de boletos" ON public.tickets;
CREATE POLICY "Permitir insercion publica de boletos" ON public.tickets FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir modificacion de boletos a admins" ON public.tickets;
CREATE POLICY "Permitir modificacion de boletos a admins" ON public.tickets FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.id = auth.uid() 
    AND (public.profiles.role = 'SUPER_ADMIN' OR public.profiles.role = 'ADMIN')
  )
);
`;

async function run() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected. Running SQL migration...');
    await client.query(sql);
    console.log('SQL migration ran successfully: raffles and tickets tables created!');
  } catch (err) {
    console.error('Database query error:', err.message);
  } finally {
    await client.end();
  }
}

run();
