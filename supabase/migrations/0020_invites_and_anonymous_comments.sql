-- Keep anonymous news comment authors private at the database boundary while
-- exposing only safe display data through authenticated RPCs.
alter table public.news_comments
  add column if not exists is_anonymous boolean not null default false;

-- Existing clients continue to read ordinary comments. Anonymous rows are
-- hidden from other members at the table boundary; the new safe RPC below
-- displays them without exposing their author IDs or profile joins.
drop policy if exists "active users can read news comments" on public.news_comments;
create policy "active users can read visible news comments"
  on public.news_comments for select to authenticated
  using (
    public.is_active_student()
    and (is_anonymous = false or user_id = auth.uid() or public.is_current_user_admin())
  );

create or replace function public.get_news_comments(p_post_id uuid)
returns table (
  id uuid,
  post_id uuid,
  content text,
  created_at timestamptz,
  is_anonymous boolean,
  is_mine boolean,
  display_name text,
  avatar_path text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    c.id,
    c.post_id,
    c.content,
    c.created_at,
    c.is_anonymous,
    c.user_id = auth.uid(),
    case when c.is_anonymous then 'Anonymous member' else coalesce(p.display_name, 'Member') end,
    case when c.is_anonymous then null else p.avatar_path end
  from public.news_comments c
  left join public.profiles p on p.id = c.user_id
  where c.post_id = p_post_id
    and public.is_active_student()
    and exists (
      select 1 from public.news_posts n
      where n.id = c.post_id
        and (n.is_published = true or (n.author_id = auth.uid() and public.is_current_user_admin()))
    )
  order by c.created_at asc;
$$;

create or replace function public.get_news_comment_counts(p_post_ids uuid[])
returns table (post_id uuid, comment_count bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.post_id, count(*)::bigint
  from public.news_comments c
  where c.post_id = any(coalesce(p_post_ids, array[]::uuid[]))
    and public.is_active_student()
    and exists (
      select 1 from public.news_posts n
      where n.id = c.post_id
        and (n.is_published = true or (n.author_id = auth.uid() and public.is_current_user_admin()))
    )
  group by c.post_id;
$$;

create or replace function public.reveal_news_comment_author(p_comment_id uuid)
returns table (account_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.display_name
  from public.news_comments c
  join public.profiles p on p.id = c.user_id
  where c.id = p_comment_id
    and c.is_anonymous = true
    and public.is_current_user_admin();
$$;

revoke all on function public.get_news_comments(uuid) from public, anon;
revoke all on function public.get_news_comment_counts(uuid[]) from public, anon;
revoke all on function public.reveal_news_comment_author(uuid) from public, anon;
grant execute on function public.get_news_comments(uuid) to authenticated;
grant execute on function public.get_news_comment_counts(uuid[]) to authenticated;
grant execute on function public.reveal_news_comment_author(uuid) to authenticated;
