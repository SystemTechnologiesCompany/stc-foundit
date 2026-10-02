-- Let an active signed-in member remove their own inbox membership.
-- The other participant's membership and messages remain unchanged.
grant delete on public.conversation_members to authenticated;

drop policy if exists "active members can remove their own conversation membership" on public.conversation_members;
create policy "active members can remove their own conversation membership"
  on public.conversation_members for delete to authenticated
  using (public.is_active_student() and user_id = auth.uid());
