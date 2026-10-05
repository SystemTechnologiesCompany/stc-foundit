-- Let members update their account name, with a server-enforced seven-day cooldown.
alter table public.profiles
  add column if not exists display_name_changed_at timestamptz;

create or replace function public.enforce_profile_name_cooldown()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.display_name is distinct from old.display_name then
    new.display_name := btrim(new.display_name);
    if char_length(new.display_name) not between 1 and 50 then
      raise exception 'Account name must be between 1 and 50 characters.';
    end if;
    if old.display_name_changed_at is not null
      and now() < old.display_name_changed_at + interval '7 days' then
      raise exception 'You can change your account name once every 7 days.';
    end if;
    new.display_name_changed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_profile_name_cooldown on public.profiles;
create trigger enforce_profile_name_cooldown
  before update of display_name on public.profiles
  for each row execute function public.enforce_profile_name_cooldown();
