-- Admin outreach uses the existing private chat UI so members can reply.
alter table public.conversations
  alter column report_id drop not null,
  add column if not exists admin_recipient_id uuid references public.profiles(id) on delete cascade;

alter table public.conversations
  drop constraint if exists conversations_report_or_admin_thread;
alter table public.conversations
  add constraint conversations_report_or_admin_thread
  check (
    (report_id is not null and admin_recipient_id is null)
    or (report_id is null and admin_recipient_id is not null)
  );

create unique index if not exists conversations_one_admin_thread_per_recipient
  on public.conversations(admin_recipient_id)
  where admin_recipient_id is not null;

create or replace function public.create_admin_thread_message(
  p_user_id uuid,
  p_sender_id uuid,
  p_content text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  thread_id uuid;
  sent_at timestamptz;
begin
  insert into public.conversations (report_id, admin_recipient_id)
  values (null, p_user_id)
  on conflict (admin_recipient_id) where admin_recipient_id is not null do nothing
  returning id into thread_id;

  if thread_id is null then
    select c.id into thread_id
    from public.conversations c
    where c.admin_recipient_id = p_user_id;
  end if;

  insert into public.conversation_members (conversation_id, user_id)
  values (thread_id, p_user_id), (thread_id, p_sender_id)
  on conflict (conversation_id, user_id) do nothing;

  insert into public.messages (conversation_id, sender_id, content)
  values (thread_id, p_sender_id, p_content)
  returning created_at into sent_at;

  -- A new thread and its first message share one transaction timestamp by default.
  -- Keep the recipient's read marker just before the message so inboxes show it unread.
  update public.conversation_members
  set last_read_at = sent_at - interval '1 microsecond'
  where conversation_id = thread_id and user_id = p_user_id;

  return thread_id;
end;
$$;
revoke all on function public.create_admin_thread_message(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.send_admin_message(p_user_id uuid, p_content text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sender_id uuid := auth.uid();
  cleaned text := btrim(p_content);
begin
  if not public.is_current_user_admin() then
    raise exception 'Only an active admin can contact members.' using errcode = '42501';
  end if;
  if p_user_id is null or p_user_id = sender_id then
    raise exception 'Choose a member to contact.' using errcode = '22023';
  end if;
  if cleaned is null or char_length(cleaned) not between 1 and 2000 then
    raise exception 'Messages must contain between 1 and 2000 characters.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.is_admin = false and p.is_banned = false
  ) then
    raise exception 'That active member could not be found.' using errcode = '22023';
  end if;

  return public.create_admin_thread_message(p_user_id, sender_id, cleaned);
end;
$$;
revoke all on function public.send_admin_message(uuid, text) from public, anon;
grant execute on function public.send_admin_message(uuid, text) to authenticated;

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
    where p.is_admin = false and p.is_banned = false
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
