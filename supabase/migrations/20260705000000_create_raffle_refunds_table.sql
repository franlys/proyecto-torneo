-- 1. Create raffle_refund_requests table
CREATE TABLE IF NOT EXISTS public.raffle_refund_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id UUID NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
    buyer_name TEXT NOT NULL,
    buyer_phone TEXT NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'resolved', 'rejected'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.raffle_refund_requests ENABLE ROW LEVEL SECURITY;

-- 3. Create policies
CREATE POLICY "public_insert_refunds" ON public.raffle_refund_requests
    FOR INSERT WITH CHECK (true);

CREATE POLICY "admin_all_refunds" ON public.raffle_refund_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (role = 'ADMIN' OR role = 'SUPER_ADMIN')
        )
    );
