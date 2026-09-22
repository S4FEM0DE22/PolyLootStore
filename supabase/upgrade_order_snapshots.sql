-- Run in an existing PolyLoot Supabase project before deploying the order snapshot change.
-- Historical orders cannot recover their original price; the app falls back to current catalog data for them.
alter table public.orders add column if not exists total_amount integer;
alter table public.orders add column if not exists items_snapshot jsonb;
