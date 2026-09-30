-- Allow Thai characters in customer usernames
-- Run this in your Supabase SQL Editor if you have an existing database.

alter table public.customer_profiles drop constraint if exists customer_username_format;
alter table public.customer_profiles add constraint customer_username_format check (username is null or username ~* '^[a-z0-9_\u0e00-\u0e7f]{3,24}$');
