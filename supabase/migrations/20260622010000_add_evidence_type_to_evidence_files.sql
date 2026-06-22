-- Migration: Add evidence_type column to evidence_files table
-- Project: Kronix Multi-Tenant Platform

ALTER TABLE public.evidence_files ADD COLUMN IF NOT EXISTS evidence_type VARCHAR(50) DEFAULT 'kills';
