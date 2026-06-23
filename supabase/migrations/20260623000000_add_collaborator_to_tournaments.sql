-- Add collaborator_id to tournaments table
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS collaborator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Drop existing collaborator policies if they exist (just in case)
DROP POLICY IF EXISTS "collaborator_full_access" ON tournaments;
DROP POLICY IF EXISTS "collaborator_manage" ON teams;
DROP POLICY IF EXISTS "collaborator_manage" ON participants;
DROP POLICY IF EXISTS "collaborator_manage" ON matches;
DROP POLICY IF EXISTS "collaborator_manage" ON scoring_rules;
DROP POLICY IF EXISTS "collaborator_manage" ON leaderboard_themes;
DROP POLICY IF EXISTS "collaborator_manage_submissions" ON submissions;

-- Create collaborator policies to allow select/update/delete by the collaborator
CREATE POLICY "collaborator_full_access" ON tournaments
  USING (collaborator_id = auth.uid());

CREATE POLICY "collaborator_manage" ON teams
  USING (
    EXISTS (SELECT 1 FROM tournaments t WHERE t.id = teams.tournament_id AND t.collaborator_id = auth.uid())
  );

CREATE POLICY "collaborator_manage" ON participants
  USING (
    EXISTS (SELECT 1 FROM tournaments t WHERE t.id = participants.tournament_id AND t.collaborator_id = auth.uid())
  );

CREATE POLICY "collaborator_manage" ON matches
  USING (
    EXISTS (SELECT 1 FROM tournaments t WHERE t.id = matches.tournament_id AND t.collaborator_id = auth.uid())
  );

CREATE POLICY "collaborator_manage" ON scoring_rules
  USING (
    EXISTS (SELECT 1 FROM tournaments t WHERE t.id = scoring_rules.tournament_id AND t.collaborator_id = auth.uid())
  );

CREATE POLICY "collaborator_manage" ON leaderboard_themes
  USING (
    EXISTS (SELECT 1 FROM tournaments t WHERE t.id = leaderboard_themes.tournament_id AND t.collaborator_id = auth.uid())
  );

CREATE POLICY "collaborator_manage_submissions" ON submissions
  USING (
    EXISTS (SELECT 1 FROM tournaments t WHERE t.id = submissions.tournament_id AND t.collaborator_id = auth.uid())
  );
