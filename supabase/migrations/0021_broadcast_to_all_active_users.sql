create or replace function public.broadcast_admin_message(p_content text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sender_id uuid := auth.uid();
  cleaned text := btrim(p_content);
  recipient record;
  recipient_count integer := 0;
begin
  if not public.is_current_user_admin() then
    raise exception 'Only an active admin can contact members.' using errcode = '42501';
  end if;
  if cleaned is null or char_length(cleaned) not between 1 and 2000 then
    raise exception 'Messages must contain between 1 and 2000 characters.' using errcode = '22023';
  end if;

  for recipient in
    select p.id from public.profiles p
    where p.id <> sender_id and p.is_banned = false
    order by p.id
  loop
    perform public.create_admin_thread_message(recipient.id, sender_id, cleaned);
    recipient_count := recipient_count + 1;
  end loop;

  return recipient_count;
end;
$$;
revoke all on function public.broadcast_admin_message(text) from public, anon;
grant execute on function public.broadcast_admin_message(text) to authenticated;
