-- Permanently remove a conversation and its messages for both members.
-- Only an active member of the target conversation may request this.
create or replace function public.delete_conversation_for_everyone(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_active_student() then
    raise exception 'An active account is required to delete this conversation.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = auth.uid()
  ) then
    raise exception 'You are not a member of this conversation.'
      using errcode = '42501';
  end if;

  delete from public.conversations c
  where c.id = p_conversation_id;
end;
$$;

revoke all on function public.delete_conversation_for_everyone(uuid) from public, anon;
grant execute on function public.delete_conversation_for_everyone(uuid) to authenticated;
