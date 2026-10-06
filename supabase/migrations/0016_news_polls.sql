-- Admin-created community polls. Poll vote rows are private: members can only
-- read their own vote; aggregate results are exposed through a gated RPC.
alter table public.news_posts
  add column if not exists post_type text not null default 'standard',
  add column if not exists poll_options jsonb;

alter table public.news_posts
  drop constraint if exists news_posts_post_type_check,
  add constraint news_posts_post_type_check check (
    (post_type = 'standard' and poll_options is null)
    or (
      post_type = 'poll'
      and poll_options is not null
      and jsonb_typeof(poll_options) = 'array'
      and jsonb_array_length(poll_options) between 2 and 10
      and char_length(trim(body)) between 1 and 300
      and media_path is null
      and media_type is null
    )
  );

create table if not exists public.news_poll_votes (
  post_id uuid not null references public.news_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  option_index smallint not null check (option_index between 0 and 9),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists news_poll_votes_post_option_idx
  on public.news_poll_votes(post_id, option_index);

alter table public.news_poll_votes enable row level security;

drop policy if exists "members read own poll vote and admins read all" on public.news_poll_votes;
create policy "members read own poll vote and admins read all" on public.news_poll_votes
  for select to authenticated using (
    public.is_active_student()
    and (user_id = auth.uid() or public.is_current_user_admin())
  );

drop policy if exists "members vote once in active polls" on public.news_poll_votes;
create policy "members vote once in active polls" on public.news_poll_votes
  for insert to authenticated with check (
    public.is_active_student()
    and user_id = auth.uid()
    and exists (
      select 1 from public.news_posts p
      where p.id = post_id and p.is_published = true and p.post_type = 'poll'
        and option_index < jsonb_array_length(p.poll_options)
    )
  );

drop policy if exists "members can change their poll vote" on public.news_poll_votes;
create policy "members can change their poll vote" on public.news_poll_votes
  for update to authenticated using (
    public.is_active_student() and user_id = auth.uid()
  ) with check (
    public.is_active_student()
    and user_id = auth.uid()
    and exists (
      select 1 from public.news_posts p
      where p.id = post_id and p.is_published = true and p.post_type = 'poll'
        and option_index < jsonb_array_length(p.poll_options)
    )
  );

grant select, insert, update on public.news_poll_votes to authenticated;

-- Polls only accept votes; their discussion and reaction features stay off.
drop policy if exists "active users can comment on news" on public.news_comments;
create policy "active users can comment on news" on public.news_comments
  for insert to authenticated with check (
    public.is_active_student() and user_id = auth.uid()
    and exists (
      select 1 from public.news_posts p
      where p.id = post_id and p.is_published = true and p.post_type = 'standard'
    )
  );

drop policy if exists "active users can like news" on public.news_likes;
create policy "active users can like news" on public.news_likes
  for insert to authenticated with check (
    public.is_active_student() and user_id = auth.uid()
    and exists (
      select 1 from public.news_posts p
      where p.id = post_id and p.is_published = true and p.post_type = 'standard'
    )
  );

create or replace function public.get_news_poll_results(p_post_id uuid)
returns table(option_index integer, vote_count bigint, percentage numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  poll_options_value jsonb;
  is_admin_value boolean;
  has_voted_value boolean;
  total_votes_value bigint;
begin
  if auth.uid() is null or not public.is_active_student() then
    raise exception 'An active account is required to view poll results.';
  end if;

  select p.poll_options into poll_options_value
  from public.news_posts p
  where p.id = p_post_id and p.is_published = true and p.post_type = 'poll';

  if poll_options_value is null then
    return;
  end if;

  is_admin_value := public.is_current_user_admin();
  select exists (
    select 1 from public.news_poll_votes v
    where v.post_id = p_post_id and v.user_id = auth.uid()
  ) into has_voted_value;

  -- Members learn percentages only after casting a vote. Admins can inspect
  -- full counts before voting, as requested.
  if not is_admin_value and not has_voted_value then
    return;
  end if;

  select count(*) into total_votes_value
  from public.news_poll_votes v where v.post_id = p_post_id;

  return query
  select
    (choice.ordinality - 1)::integer,
    case when is_admin_value then count(v.user_id) else null end,
    case when total_votes_value = 0 then 0::numeric
      else round(count(v.user_id)::numeric * 100 / total_votes_value, 1) end
  from jsonb_array_elements(poll_options_value) with ordinality as choice(value, ordinality)
  left join public.news_poll_votes v
    on v.post_id = p_post_id and v.option_index = (choice.ordinality - 1)::smallint
  group by choice.ordinality
  order by choice.ordinality;
end;
$$;

revoke all on function public.get_news_poll_results(uuid) from public, anon;
grant execute on function public.get_news_poll_results(uuid) to authenticated;
