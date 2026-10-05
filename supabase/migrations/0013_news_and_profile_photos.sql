-- Community News feed, member profile photos, and private admin media.
alter table public.profiles add column if not exists avatar_path text;
grant update (avatar_path) on public.profiles to authenticated;

create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 5000),
  media_path text,
  media_type text check (media_type in ('image', 'video')),
  created_at timestamptz not null default now()
);

create table if not exists public.news_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.news_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.news_likes (
  post_id uuid not null references public.news_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists news_posts_created_at_idx on public.news_posts(created_at desc);
create index if not exists news_comments_post_created_idx on public.news_comments(post_id, created_at);

alter table public.news_posts enable row level security;
alter table public.news_comments enable row level security;
alter table public.news_likes enable row level security;

drop policy if exists "active users can read news posts" on public.news_posts;
create policy "active users can read news posts" on public.news_posts
  for select to authenticated using (public.is_active_student());
drop policy if exists "admins can publish news posts" on public.news_posts;
create policy "admins can publish news posts" on public.news_posts
  for insert to authenticated with check (public.is_current_user_admin() and author_id = auth.uid());
drop policy if exists "admins can edit news posts" on public.news_posts;
create policy "admins can edit news posts" on public.news_posts
  for update to authenticated using (public.is_current_user_admin()) with check (public.is_current_user_admin());
drop policy if exists "admins can delete news posts" on public.news_posts;
create policy "admins can delete news posts" on public.news_posts
  for delete to authenticated using (public.is_current_user_admin());

drop policy if exists "active users can read news comments" on public.news_comments;
create policy "active users can read news comments" on public.news_comments
  for select to authenticated using (public.is_active_student());
drop policy if exists "active users can comment on news" on public.news_comments;
create policy "active users can comment on news" on public.news_comments
  for insert to authenticated with check (
    public.is_active_student() and user_id = auth.uid()
    and exists (select 1 from public.news_posts p where p.id = post_id)
  );
drop policy if exists "comment author or admin can delete news comments" on public.news_comments;
create policy "comment author or admin can delete news comments" on public.news_comments
  for delete to authenticated using (public.is_active_student() and (user_id = auth.uid() or public.is_current_user_admin()));

drop policy if exists "active users can read news likes" on public.news_likes;
create policy "active users can read news likes" on public.news_likes
  for select to authenticated using (public.is_active_student());
drop policy if exists "active users can like news" on public.news_likes;
create policy "active users can like news" on public.news_likes
  for insert to authenticated with check (
    public.is_active_student() and user_id = auth.uid()
    and exists (select 1 from public.news_posts p where p.id = post_id)
  );
drop policy if exists "members can remove their own news likes" on public.news_likes;
create policy "members can remove their own news likes" on public.news_likes
  for delete to authenticated using (public.is_active_student() and user_id = auth.uid());

grant select, insert, update, delete on public.news_posts to authenticated;
grant select, insert, delete on public.news_comments to authenticated;
grant select, insert, delete on public.news_likes to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-media', 'community-media', false, 52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins can upload community media" on storage.objects;
create policy "admins can upload community media" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'community-media' and public.is_current_user_admin()
    and exists (select 1 from public.news_posts p where p.id::text = (storage.foldername(name))[1] and p.author_id = auth.uid())
  );
drop policy if exists "active members can view community media" on storage.objects;
create policy "active members can view community media" on storage.objects
  for select to authenticated using (
    bucket_id = 'community-media' and public.is_active_student()
    and exists (select 1 from public.news_posts p where p.id::text = (storage.foldername(name))[1])
  );
drop policy if exists "admins can delete community media" on storage.objects;
create policy "admins can delete community media" on storage.objects
  for delete to authenticated using (bucket_id = 'community-media' and public.is_current_user_admin());

drop policy if exists "active users can upload own profile photos" on storage.objects;
create policy "active users can upload own profile photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'profile-photos' and public.is_active_student()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "active users can view profile photos" on storage.objects;
create policy "active users can view profile photos" on storage.objects
  for select to authenticated using (bucket_id = 'profile-photos' and public.is_active_student());
drop policy if exists "users can update own profile photos" on storage.objects;
create policy "users can update own profile photos" on storage.objects
  for update to authenticated using (
    bucket_id = 'profile-photos' and public.is_active_student() and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'profile-photos' and public.is_active_student() and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "users can delete own profile photos" on storage.objects;
create policy "users can delete own profile photos" on storage.objects
  for delete to authenticated using (
    bucket_id = 'profile-photos' and public.is_active_student() and (storage.foldername(name))[1] = auth.uid()::text
  );
