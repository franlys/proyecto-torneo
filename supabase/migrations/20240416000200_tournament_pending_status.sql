-- Add 'pending' status to tournaments
-- pending = torneo anunciado, configurado y con apuestas abiertas, pero aún no ha comenzado.
-- draft → pending → active → finished

ALTER TYPE tournament_status ADD VALUE IF NOT EXISTS 'pending' AFTER 'draft';
