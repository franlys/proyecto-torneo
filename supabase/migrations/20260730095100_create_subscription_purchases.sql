-- Migration: Subscription Purchases and Settings
-- Project: Proyecto-Torneos (PT)

-- 1. Create table for tracking VIP passes purchases
CREATE TABLE IF NOT EXISTS public.subscription_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    plan_duration INT NOT NULL, -- duration in days (e.g., 30, 90, 365)
    amount_paid NUMERIC(10,2) NOT NULL,
    paypal_order_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RLS
ALTER TABLE public.subscription_purchases ENABLE ROW LEVEL SECURITY;

-- Users can view their own purchases
DROP POLICY IF EXISTS "Users can view their own purchases" ON public.subscription_purchases;
CREATE POLICY "Users can view their own purchases" ON public.subscription_purchases 
FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all purchases
DROP POLICY IF EXISTS "Admins can view all purchases" ON public.subscription_purchases;
CREATE POLICY "Admins can view all purchases" ON public.subscription_purchases 
FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Note: Inserts will be handled by the Server API (Service Role) so we don't need public insert policies.
