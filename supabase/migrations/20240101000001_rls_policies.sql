-- Enable RLS on all tables
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bracket_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE bracket_matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_teams ENABLE ROW LEVEL SECURITY;

-- tournaments: creator full access
CREATE POLICY "creator_full_access" ON tournaments
  USING (creator_id = auth.uid());

-- tournaments: public read for active/finished
CREATE POLICY "public_read_active" ON tournaments
  FOR SELECT USING (status IN ('active', 'finished'));

-- team_standings: public read
CREATE POLICY "public_read" ON team_standings FOR SELECT USING (true);

-- submissions: captain can insert
CREATE POLICY "captain_insert" ON submissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.id = submitted_by
        AND p.is_captain = true
        AND p.tournament_id = submissions.tournament_id
    )
  );

-- creator can manage submissions
CREATE POLICY "creator_manage_submissions" ON submissions
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = submissions.tournament_id
        AND t.creator_id = auth.uid()
    )
  );

-- Public read policies for leaderboard-related tables
CREATE POLICY "public_read" ON teams FOR SELECT USING (true);
CREATE POLICY "public_read" ON participants FOR SELECT USING (true);
CREATE POLICY "public_read" ON matches FOR SELECT USING (true);
CREATE POLICY "public_read" ON leaderboard_themes FOR SELECT USING (true);
CREATE POLICY "public_read" ON bracket_rounds FOR SELECT USING (true);
CREATE POLICY "public_read" ON bracket_matchups FOR SELECT USING (true);
CREATE POLICY "public_read" ON groups FOR SELECT USING (true);
CREATE POLICY "public_read" ON group_teams FOR SELECT USING (true);
CREATE POLICY "public_read" ON scoring_rules FOR SELECT USING (true);
CREATE POLICY "public_read" ON evidence_files FOR SELECT USING (true);

-- Creator can manage their tournament's related data
CREATE POLICY "creator_manage" ON teams
  USING (
    EXISTS (SELECT 1 FROM tournaments t WHERE t.id = teams.tournament_id AND t.creator_id = auth.uid())
  );

CREATE POLICY "creator_manage" ON participants
  USING (
    EXISTS (SELECT 1 FROM tournaments t WHERE t.id = participants.tournament_id AND t.creator_id = auth.uid())
  );

CREATE POLICY "creator_manage" ON matches
  USING (
    EXISTS (SELECT 1 FROM tournaments t WHERE t.id = matches.tournament_id AND t.creator_id = auth.uid())
  );

CREATE POLICY "creator_manage" ON scoring_rules
  USING (
    EXISTS (SELECT 1 FROM tournaments t WHERE t.id = scoring_rules.tournament_id AND t.creator_id = auth.uid())
  );

CREATE POLICY "creator_manage" ON leaderboard_themes
  USING (
    EXISTS (SELECT 1 FROM tournaments t WHERE t.id = leaderboard_themes.tournament_id AND t.creator_id = auth.uid())
  );
