-- Fix: Add write policies for team_standings so tournament creators can manage standings
-- Without this, createTeam's upsert to team_standings fails silently (only SELECT was allowed)

-- Allow tournament creator to INSERT standings for their tournament
CREATE POLICY "creator_manage_standings" ON team_standings
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = team_standings.tournament_id
        AND t.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = team_standings.tournament_id
        AND t.creator_id = auth.uid()
    )
  );

-- Allow service role full access (already bypasses RLS, but explicit is better)
-- This is a no-op since service role bypasses RLS, kept for documentation clarity.

-- Backfill: ensure every existing team has a standings row
-- This is idempotent due to ON CONFLICT DO NOTHING
INSERT INTO team_standings (tournament_id, team_id, total_points, total_kills, kill_rate, pot_top_count, vip_score, rank, previous_rank, updated_at)
SELECT
  t.tournament_id,
  t.id         AS team_id,
  0            AS total_points,
  0            AS total_kills,
  0            AS kill_rate,
  0            AS pot_top_count,
  0            AS vip_score,
  999          AS rank,
  999          AS previous_rank,
  now()        AS updated_at
FROM teams t
WHERE NOT EXISTS (
  SELECT 1 FROM team_standings ts
  WHERE ts.team_id = t.id
    AND ts.tournament_id = t.tournament_id
);
