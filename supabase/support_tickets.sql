-- Run on an existing PolyLoot Supabase project before deploying the support form.
create table if not exists public.support_tickets (
 id text primary key, customer_id uuid not null, email text not null,
 category text not null check (category in ('DOWNLOAD','ORDER','PRODUCT','ACCOUNT','OTHER')),
 order_id text references public.orders(id), message text not null,
 status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','RESOLVED')),
 created_at timestamptz not null default now()
);
create index if not exists support_tickets_customer_idx on public.support_tickets(customer_id, created_at desc);
alter table public.support_tickets enable row level security;
revoke all on public.support_tickets from anon, authenticated;
