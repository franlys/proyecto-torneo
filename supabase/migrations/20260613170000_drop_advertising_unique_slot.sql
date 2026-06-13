-- Migration: Drop unique constraint on slot_name in advertising_placements
-- This allows having multiple banners for the same slot name and rotating them.
ALTER TABLE advertising_placements DROP CONSTRAINT IF EXISTS advertising_placements_slot_name_key;
