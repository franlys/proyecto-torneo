-- Auto-update tournaments.matches_completed when a match is marked complete/incomplete
CREATE OR REPLACE FUNCTION public.sync_matches_completed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_completed IS DISTINCT FROM NEW.is_completed THEN
    UPDATE tournaments
    SET matches_completed = (
      SELECT COUNT(*) FROM matches
      WHERE tournament_id = NEW.tournament_id AND is_completed = true
    )
    WHERE id = NEW.tournament_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_matches_completed ON matches;
CREATE TRIGGER trg_sync_matches_completed
AFTER UPDATE ON matches
FOR EACH ROW EXECUTE FUNCTION public.sync_matches_completed();
