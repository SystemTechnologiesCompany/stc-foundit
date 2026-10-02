-- Add moderation fields used by the admin UI and enforce them in Postgres.
alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists is_banned boolean not null default false;

-- Enforce upload limits in Storage itself, not only in the web form.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'report-images';

create or replace function public.is_active_student()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_banned = false
    );
$$;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true and p.is_banned = false
    );
$$;

revoke all on function public.is_active_student() from public, anon;
revoke all on function public.is_current_user_admin() from public, anon;
grant execute on function public.is_active_student() to authenticated;
grant execute on function public.is_current_user_admin() to authenticated;

-- Profiles are created by the auth.users trigger. Users may edit only their
-- display name and university; admin status is managed through trusted SQL.
drop policy if exists "users can insert their own profile" on public.profiles;
drop policy if exists "users can update their own profile" on public.profiles;
drop policy if exists "admins can update moderation status" on public.profiles;
create policy "users can update their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_active_student())
  with check (id = auth.uid() and public.is_active_student());
create policy "admins can update moderation status"
  on public.profiles for update to authenticated
  using (public.is_current_user_admin() and is_admin = false)
  with check (public.is_current_user_admin() and is_admin = false);
revoke insert, update on public.profiles from authenticated;
grant update (display_name, university, is_banned) on public.profiles to authenticated;

create or replace function public.guard_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null then
    if new.is_admin is distinct from old.is_admin then
      raise exception 'Admin roles can only be changed by a trusted database operator';
    end if;
    if new.is_banned is distinct from old.is_banned
       and not public.is_current_user_admin() then
      raise exception 'Only an admin can change moderation status';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_security_fields on public.profiles;
create trigger guard_profile_security_fields
  before update on public.profiles
  for each row execute function public.guard_profile_security_fields();

-- Restrict report access and writes to verified active accounts at the RLS
-- boundary. The client-side route gate is only a convenience layer.
drop policy if exists "profiles are readable by authenticated users" on public.profiles;
drop policy if exists "profiles are readable by active users" on public.profiles;
create policy "profiles are readable by active users"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_active_student() or public.is_current_user_admin());

drop policy if exists "active reports are readable by authenticated users" on public.reports;
drop policy if exists "active reports are readable by active users" on public.reports;
create policy "active reports are readable by active users"
  on public.reports for select to authenticated
  using (public.is_active_student());
drop policy if exists "users can create their own reports" on public.reports;
drop policy if exists "active users can create their own reports" on public.reports;
create policy "active users can create their own reports"
  on public.reports for insert to authenticated
  with check (auth.uid() = user_id and public.is_active_student());
drop policy if exists "users can update their own reports" on public.reports;
drop policy if exists "active users can update their own reports" on public.reports;
create policy "active users can update their own reports"
  on public.reports for update to authenticated
  using (auth.uid() = user_id and public.is_active_student())
  with check (auth.uid() = user_id and public.is_active_student());
drop policy if exists "users can delete their own reports" on public.reports;
drop policy if exists "active users can delete their own reports" on public.reports;
create policy "active users can delete their own reports"
  on public.reports for delete to authenticated
  using (auth.uid() = user_id and public.is_active_student());
drop policy if exists "admins can delete any report" on public.reports;
create policy "admins can delete any report"
  on public.reports for delete to authenticated
  using (public.is_current_user_admin());

drop policy if exists "report images readable by authenticated users" on public.report_images;
drop policy if exists "report images readable by active users" on public.report_images;
create policy "report images readable by active users"
  on public.report_images for select to authenticated
  using (public.is_active_student());
drop policy if exists "users can attach images to their own reports" on public.report_images;
drop policy if exists "active users can attach images to their own reports" on public.report_images;
create policy "active users can attach images to their own reports"
  on public.report_images for insert to authenticated
  with check (
    public.is_active_student()
    and exists (
      select 1 from public.reports r
      where r.id = report_images.report_id and r.user_id = auth.uid()
    )
  );

drop policy if exists "campus locations are readable by authenticated users" on public.campus_locations;
drop policy if exists "campus locations are readable by active users" on public.campus_locations;
create policy "campus locations are readable by active users"
  on public.campus_locations for select to authenticated
  using (public.is_active_student());

drop policy if exists "match visible to the two involved reporters" on public.matches;
drop policy if exists "match visible to active involved reporters" on public.matches;
create policy "match visible to active involved reporters"
  on public.matches for select to authenticated
  using (
    public.is_active_student() and (
      exists (select 1 from public.reports r where r.id = matches.lost_report_id and r.user_id = auth.uid())
      or exists (select 1 from public.reports r where r.id = matches.found_report_id and r.user_id = auth.uid())
    )
  );

drop policy if exists "members can read their conversations" on public.conversations;
drop policy if exists "active members can read their conversations" on public.conversations;
create policy "active members can read their conversations"
  on public.conversations for select to authenticated
  using (public.is_active_student() and exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversations.id and cm.user_id = auth.uid()
  ));
drop policy if exists "members can read their membership rows" on public.conversation_members;
drop policy if exists "active members can read their membership rows" on public.conversation_members;
create policy "active members can read their membership rows"
  on public.conversation_members for select to authenticated
  using (public.is_active_student() and user_id = auth.uid());
drop policy if exists "members can update their own read marker" on public.conversation_members;
drop policy if exists "active members can update their own read marker" on public.conversation_members;
create policy "active members can update their own read marker"
  on public.conversation_members for update to authenticated
  using (public.is_active_student() and user_id = auth.uid())
  with check (public.is_active_student() and user_id = auth.uid());
revoke update on public.conversation_members from authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;
drop policy if exists "members can read messages in their conversations" on public.messages;
drop policy if exists "active members can read messages in their conversations" on public.messages;
create policy "active members can read messages in their conversations"
  on public.messages for select to authenticated
  using (public.is_active_student() and exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid()
  ));
drop policy if exists "members can send messages in their conversations" on public.messages;
drop policy if exists "active members can send messages in their conversations" on public.messages;
create policy "active members can send messages in their conversations"
  on public.messages for insert to authenticated
  with check (
    public.is_active_student()
    and sender_id = auth.uid()
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid()
    )
  );

drop policy if exists "authenticated users can upload report images" on storage.objects;
drop policy if exists "active users can upload report images" on storage.objects;
create policy "active users can upload report images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'report-images'
    and public.is_active_student()
    and exists (
      select 1 from public.reports r
      where r.id::text = (storage.foldername(name))[1]
        and r.user_id = auth.uid()
    )
  );
drop policy if exists "signed in users can view report images" on storage.objects;
drop policy if exists "active users can view report images" on storage.objects;
create policy "active users can view report images"
  on storage.objects for select to authenticated
  using (bucket_id = 'report-images' and public.is_active_student());

-- Defense in depth: a suspended user cannot start a conversation through the
-- SECURITY DEFINER RPC even if they call it directly.
create or replace function public.start_conversation(target_report_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requester uuid := auth.uid();
  owner uuid;
  existing_id uuid;
  new_id uuid;
begin
  if requester is null or not public.is_active_student() then
    raise exception 'An active signed-in account is required';
  end if;
  select user_id into owner from public.reports where id = target_report_id;
  if owner is null then raise exception 'Report not found'; end if;
  if owner = requester then raise exception 'Cannot start a conversation about your own report'; end if;
  if not exists (
    select 1 from public.profiles p where p.id = owner and p.is_banned = false
  ) then raise exception 'Report owner is not available'; end if;

  select c.id into existing_id
  from public.conversations c
  where c.report_id = target_report_id
    and exists (select 1 from public.conversation_members m where m.conversation_id = c.id and m.user_id = requester)
    and exists (select 1 from public.conversation_members m where m.conversation_id = c.id and m.user_id = owner)
  limit 1;
  if existing_id is not null then return existing_id; end if;

  insert into public.conversations (report_id) values (target_report_id) returning id into new_id;
  insert into public.conversation_members (conversation_id, user_id)
    values (new_id, requester), (new_id, owner);
  return new_id;
end;
$$;

revoke all on function public.start_conversation(uuid) from public, anon;
grant execute on function public.start_conversation(uuid) to authenticated;
