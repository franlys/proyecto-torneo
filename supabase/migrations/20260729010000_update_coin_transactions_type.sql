-- Drop the existing check constraint on coin_transactions type
ALTER TABLE public.coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_type_check;

-- Add updated check constraint with 'raffle_ticket' and 'withdrawal'
ALTER TABLE public.coin_transactions ADD CONSTRAINT coin_transactions_type_check 
CHECK (type IN ('deposit', 'bet_placed', 'bet_won', 'bet_refunded', 'raffle_ticket', 'withdrawal'));
