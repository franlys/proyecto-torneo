-- Migration: Fix invitations_modify_policy RLS to allow invited users to accept/reject their own invitations
-- Project: Proyecto-Torneos

DROP POLICY IF EXISTS "invitations_modify_policy" ON public.streamer_staff_invitations;

CREATE POLICY "invitations_modify_policy" ON public.streamer_staff_invitations
    FOR ALL USING (
        auth.uid() = streamer_id 
        OR email = auth.jwt() ->> 'email'
        OR public.is_admin_user()
    );
