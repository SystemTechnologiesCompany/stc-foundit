-- Keep newly-created posts private until the client has finished saving media.
-- The push-events webhook should fire on UPDATE when is_published becomes true.
alter table public.news_posts
  add column if not exists is_published boolean not null default true;

drop policy if exists "active users can read news posts" on public.news_posts;
create policy "active users can read news posts" on public.news_posts
  for select to authenticated using (
    public.is_active_student()
    and (is_published = true or (author_id = auth.uid() and public.is_current_user_admin()))
  );

drop policy if exists "admins can publish news posts" on public.news_posts;
create policy "admins can publish news posts" on public.news_posts
  for insert to authenticated with check (public.is_current_user_admin() and author_id = auth.uid());

drop policy if exists "active members can view community media" on storage.objects;
create policy "active members can view community media" on storage.objects
  for select to authenticated using (
    bucket_id = 'community-media' and public.is_active_student()
    and exists (
      select 1 from public.news_posts p
      where p.id::text = (storage.foldername(name))[1] and p.is_published = true
    )
  );
