-- Migration to add rankings points decay for inactive players

-- 1. Add last_decay_at tracking column to user_discipline_rankings
ALTER TABLE public.user_discipline_rankings ADD COLUMN IF NOT EXISTS last_decay_at TIMESTAMPTZ;

-- 2. Make tournament_id optional in user_points_history (since decay is a platform adjustment, not a specific tournament action)
ALTER TABLE public.user_points_history ALTER COLUMN tournament_id DROP NOT NULL;

-- 3. Create postgres function to calculate and apply decay
CREATE OR REPLACE FUNCTION public.apply_rankings_decay()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
    decay_amount NUMERIC(8,2);
    new_points NUMERIC(8,2);
    target_decay_time TIMESTAMPTZ;
BEGIN
    FOR r IN 
        SELECT id, user_id, discipline, points, updated_at, last_decay_at
        FROM public.user_discipline_rankings
        WHERE points > 0 
          AND updated_at < now() - INTERVAL '30 days'
    LOOP
        -- Determine when the last decay took place
        -- If never decayed, the base is 30 days after updated_at (the start of decay eligibility)
        IF r.last_decay_at IS NULL THEN
            target_decay_time := r.updated_at + INTERVAL '30 days';
        ELSE
            target_decay_time := r.last_decay_at;
        END IF;

        -- If a full week (7 days) has passed since target_decay_time, apply decay
        IF now() - target_decay_time >= INTERVAL '7 days' THEN
            -- Calculate 10% decay
            decay_amount := r.points * 0.10;
            
            -- Clamp at 0 minimum points
            new_points := GREATEST(0, r.points - decay_amount);
            
            -- Update points and set last_decay_at to now
            UPDATE public.user_discipline_rankings
            SET points = new_points,
                last_decay_at = now()
            WHERE id = r.id;
            
            -- Record points history reduction (no tournament_id)
            INSERT INTO public.user_points_history (
                user_id,
                tournament_id,
                discipline,
                points_awarded,
                rank_achieved,
                created_at
            ) VALUES (
                r.user_id,
                NULL,
                r.discipline,
                -decay_amount,
                999, -- Special dummy code for decay
                now()
            );
        END IF;
    END LOOP;
END;
$$;
