-- 1. Add balance to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS balance NUMERIC(10,2) NOT NULL DEFAULT 0.00;

-- 2. Create deposits table
CREATE TABLE IF NOT EXISTS public.deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) DEFAULT 'USD',
    gateway VARCHAR(50) DEFAULT 'paypal',
    gateway_tx_id TEXT UNIQUE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMPTZ
);

-- Enable RLS for deposits
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

-- 3. Create bet_markets table
CREATE TABLE IF NOT EXISTS public.bet_markets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
    game_type VARCHAR(50) NOT NULL, -- 'clash_royale', 'warzone', etc.
    market_type VARCHAR(50) NOT NULL, -- 'winner', 'most_kills', etc.
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- e.g. [{"id": "1", "name": "Team A", "odds": 1.8}, {"id": "2", "name": "Team B", "odds": 2.0}]
    status VARCHAR(20) DEFAULT 'open' NOT NULL CHECK (status IN ('open', 'closed', 'resolved', 'cancelled')),
    winning_option_id VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS for bet_markets
ALTER TABLE public.bet_markets ENABLE ROW LEVEL SECURITY;

-- 4. Create user_bets table
CREATE TABLE IF NOT EXISTS public.user_bets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID NOT NULL REFERENCES public.bet_markets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    selected_option_id VARCHAR(50) NOT NULL,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    odds NUMERIC(5,2) NOT NULL CHECK (odds > 0),
    potential_payout NUMERIC(10,2) NOT NULL CHECK (potential_payout > 0),
    status VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'won', 'lost', 'refunded')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS for user_bets
ALTER TABLE public.user_bets ENABLE ROW LEVEL SECURITY;

-- 5. Create coin_transactions table
CREATE TABLE IF NOT EXISTS public.coin_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL, -- positive for credit, negative for debit
    type VARCHAR(50) NOT NULL CHECK (type IN ('deposit', 'bet_placed', 'bet_won', 'bet_refunded')),
    reference_id UUID, -- links to deposit_id or bet_id
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS for coin_transactions
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies

-- Deposits Policies
DROP POLICY IF EXISTS "Users can view their own deposits" ON public.deposits;
CREATE POLICY "Users can view their own deposits" ON public.deposits
    FOR SELECT USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'ADMIN' OR role = 'SUPER_ADMIN')
    ));

DROP POLICY IF EXISTS "Admins can manage deposits" ON public.deposits;
CREATE POLICY "Admins can manage deposits" ON public.deposits
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'ADMIN' OR role = 'SUPER_ADMIN')
    ));

-- Bet Markets Policies
DROP POLICY IF EXISTS "Anyone can view bet markets" ON public.bet_markets;
CREATE POLICY "Anyone can view bet markets" ON public.bet_markets
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage bet markets" ON public.bet_markets;
CREATE POLICY "Admins can manage bet markets" ON public.bet_markets
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'ADMIN' OR role = 'SUPER_ADMIN')
    ));

-- User Bets Policies
DROP POLICY IF EXISTS "Users can view their own bets" ON public.user_bets;
CREATE POLICY "Users can view their own bets" ON public.user_bets
    FOR SELECT USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'ADMIN' OR role = 'SUPER_ADMIN')
    ));

DROP POLICY IF EXISTS "Users can insert their own bets" ON public.user_bets;
CREATE POLICY "Users can insert their own bets" ON public.user_bets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all bets" ON public.user_bets;
CREATE POLICY "Admins can manage all bets" ON public.user_bets
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'ADMIN' OR role = 'SUPER_ADMIN')
    ));

-- Coin Transactions Policies
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.coin_transactions;
CREATE POLICY "Users can view their own transactions" ON public.coin_transactions
    FOR SELECT USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'ADMIN' OR role = 'SUPER_ADMIN')
    ));

DROP POLICY IF EXISTS "Admins can manage transactions" ON public.coin_transactions;
CREATE POLICY "Admins can manage transactions" ON public.coin_transactions
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'ADMIN' OR role = 'SUPER_ADMIN')
    ));
