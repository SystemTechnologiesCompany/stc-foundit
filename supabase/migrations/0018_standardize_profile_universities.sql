-- Standardize current accounts and limit signup choices to the two supported values.
update public.profiles
set university = 'Kasdi Merbah University'
where university is distinct from 'Kasdi Merbah University';

update auth.users
set raw_user_meta_data = jsonb_set(
  coalesce(raw_user_meta_data, '{}'::jsonb),
  '{university}',
  to_jsonb('Kasdi Merbah University'::text),
  true
)
where raw_user_meta_data->>'university' is distinct from 'Kasdi Merbah University';

alter table public.profiles
  alter column university set not null;

alter table public.profiles
  drop constraint if exists profiles_university_allowed_values;
alter table public.profiles
  add constraint profiles_university_allowed_values
  check (university in ('Kasdi Merbah University', 'Other University'));

-- Keep the university fixed for signed-in members at the database boundary.
revoke update (university) on public.profiles from authenticated;

create or replace function public.prevent_profile_university_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and new.university is distinct from old.university then
    raise exception 'University cannot be changed after account creation';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_university_change on public.profiles;
create trigger prevent_profile_university_change
  before update of university on public.profiles
  for each row execute function public.prevent_profile_university_change();

-- Only accept the two signup choices. Older or missing metadata safely maps to KMU.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_university text := new.raw_user_meta_data->>'university';
begin
  insert into public.profiles (id, display_name, university)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'New user'),
    case
      when requested_university = 'Other University' then 'Other University'
      else 'Kasdi Merbah University'
    end
  );
  return new;
end;
$$;
