-- Migration: Add quintas (5v5) tournament mode to enum type
ALTER TYPE tournament_mode ADD VALUE IF NOT EXISTS 'quintas';
