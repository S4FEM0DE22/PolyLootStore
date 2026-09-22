-- Run on an existing PolyLoot Supabase project before deploying Settings.
create table if not exists public.store_settings (
 id text primary key, contact_email text not null default '', contact_phone text not null default '',
 support_hours text not null default '', announcement text not null default '',
 faq jsonb not null default '[]'::jsonb, updated_at timestamptz
);
create table if not exists public.customer_preferences (
 customer_id uuid primary key references auth.users(id) on delete cascade,
 theme text not null default 'system' check (theme in ('light','dark','system')),
 language text not null default 'th' check (language in ('th','en')),
 notify_orders boolean not null default true,
 notify_support boolean not null default true,
 notify_announcements boolean not null default true,
 read_ids text[] not null default '{}'
);
alter table public.store_settings enable row level security;
alter table public.customer_preferences enable row level security;
revoke all on public.store_settings from anon, authenticated;
revoke all on public.customer_preferences from anon, authenticated;
