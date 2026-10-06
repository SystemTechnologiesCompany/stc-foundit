-- Members may cast one vote per poll and cannot edit it afterward.
-- Admins can still change their own choice for testing/moderation purposes.
drop policy if exists "members can change their poll vote" on public.news_poll_votes;
drop policy if exists "admins can change their poll vote" on public.news_poll_votes;

create policy "admins can change their poll vote" on public.news_poll_votes
  for update to authenticated using (
    public.is_active_student()
    and public.is_current_user_admin()
    and user_id = auth.uid()
  ) with check (
    public.is_active_student()
    and public.is_current_user_admin()
    and user_id = auth.uid()
    and exists (
      select 1 from public.news_posts p
      where p.id = post_id and p.is_published = true and p.post_type = 'poll'
        and option_index < jsonb_array_length(p.poll_options)
    )
  );
