-- Migration: Add Clash Royale Tournament Tag
ALTER TABLE tournaments ADD COLUMN clash_royale_tag VARCHAR(100);
