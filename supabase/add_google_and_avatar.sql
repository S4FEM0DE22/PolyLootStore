-- Add avatar_url column to customer_profiles and enhance Google OAuth profile sync.
-- Run this in your Supabase SQL Editor.

alter table public.customer_profiles add column if not exists avatar_url text;

create or replace function public.sync_customer_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  candidate_username text;
  avatar text;
  raw_first text;
  raw_last text;
  raw_full text;
begin
  if new.email is null then return new; end if;
  avatar := coalesce(nullif(new.raw_user_meta_data ->> 'avatar_url', ''), nullif(new.raw_user_meta_data ->> 'picture', ''));
  raw_first := coalesce(nullif(new.raw_user_meta_data ->> 'given_name', ''), nullif(new.raw_user_meta_data ->> 'first_name', ''));
  raw_last := coalesce(nullif(new.raw_user_meta_data ->> 'family_name', ''), nullif(new.raw_user_meta_data ->> 'last_name', ''));
  raw_full := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''));

  if tg_op = 'INSERT' then
    candidate_username := nullif(lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)), '[^a-z0-9_]', '', 'g')), '');
    if candidate_username is not null and length(candidate_username) < 3 then
      candidate_username := candidate_username || '_user';
    end if;
    if candidate_username is not null and length(candidate_username) > 24 then
      candidate_username := substring(candidate_username from 1 for 24);
    end if;
    if candidate_username is not null and exists (select 1 from public.customer_profiles where username = candidate_username) then
      candidate_username := substring(candidate_username from 1 for 19) || '_' || substring(replace(new.id::text, '-', '') from 1 for 4);
    end if;

    insert into public.customer_profiles (user_id, username, email, avatar_url)
    values (new.id, candidate_username, lower(new.email), avatar)
    on conflict (user_id) do update set
      email = excluded.email,
      avatar_url = coalesce(public.customer_profiles.avatar_url, excluded.avatar_url);
  else
    update public.customer_profiles
    set email = lower(new.email),
        avatar_url = coalesce(avatar, public.customer_profiles.avatar_url),
        session_version = session_version + case when new.encrypted_password is distinct from old.encrypted_password then 1 else 0 end
    where user_id = new.id;
  end if;
  return new;
end;
$$;
