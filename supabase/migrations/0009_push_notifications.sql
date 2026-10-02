-- Expo push tokens are private to the signed-in account that registered them.
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx on public.push_tokens(user_id);
alter table public.push_tokens enable row level security;

create policy "active users can read their push tokens"
  on public.push_tokens for select to authenticated
  using (public.is_active_student() and user_id = auth.uid());
create policy "active users can register their push tokens"
  on public.push_tokens for insert to authenticated
  with check (public.is_active_student() and user_id = auth.uid());
create policy "active users can refresh their push tokens"
  on public.push_tokens for update to authenticated
  using (public.is_active_student() and user_id = auth.uid())
  with check (public.is_active_student() and user_id = auth.uid());
create policy "active users can remove their push tokens"
  on public.push_tokens for delete to authenticated
  using (public.is_active_student() and user_id = auth.uid());

grant select, insert, update, delete on public.push_tokens to authenticated;

