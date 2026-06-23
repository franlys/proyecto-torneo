-- Migration: Fix streamer_staff RLS policy to allow invited staff members to accept invitations
-- Project: Proyecto-Torneos

DROP POLICY IF EXISTS "streamer_staff_modify_policy" ON public.streamer_staff;

CREATE POLICY "streamer_staff_modify_policy" ON public.streamer_staff
    FOR ALL USING (
        auth.uid() = streamer_id 
        OR auth.uid() = staff_id
        OR public.is_admin_user()
    );
