-- Run on a NEW Supabase project only.
create table public.assets (
 id text primary key, title text not null, subtitle text not null, description text not null,
 price integer not null check (price > 0), author text not null, cover text not null, file text not null,
 active boolean not null default true, category text not null check (category in ('Characters','Environments','Weapons','Vehicles','Props')),
 formats text[] not null, engines text[] not null, version text not null, license text not null,
 file_size_bytes bigint not null default 0, source_url text
);
create table public.orders (
 id text primary key, asset_id text not null references public.assets(id), asset_ids text[],
 total_amount integer not null check (total_amount >= 0), items_snapshot jsonb not null,
 customer_name text not null, email text not null,
 status text not null default 'PENDING' check (status in ('PENDING','PAID','CANCELLED')),
 email_status text not null default 'NOT_SENT' check (email_status in ('NOT_SENT','DEMO','SENT','FAILED','NOT_CONFIGURED')),
 created_at timestamptz not null default now(), paid_at timestamptz, cancelled_at timestamptz
);
create index orders_email_idx on public.orders(email);
create table public.support_tickets (
 id text primary key, customer_id uuid not null, email text not null,
 category text not null check (category in ('DOWNLOAD','ORDER','PRODUCT','ACCOUNT','OTHER')),
 order_id text references public.orders(id), message text not null,
 status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','RESOLVED')),
 created_at timestamptz not null default now()
);
create index support_tickets_customer_idx on public.support_tickets(customer_id, created_at desc);
create table public.store_settings (
 id text primary key, contact_email text not null default '', contact_phone text not null default '',
 support_hours text not null default '', announcement text not null default '',
 faq jsonb not null default '[]'::jsonb, updated_at timestamptz
);
create table public.customer_preferences (
 customer_id uuid primary key references auth.users(id) on delete cascade,
 theme text not null default 'system' check (theme in ('light','dark','system')),
 language text not null default 'th' check (language in ('th','en')),
 notify_orders boolean not null default true,
 notify_support boolean not null default true,
 notify_announcements boolean not null default true,
 read_ids text[] not null default '{}'
);
alter table public.assets enable row level security;
alter table public.orders enable row level security;
alter table public.support_tickets enable row level security;
alter table public.store_settings enable row level security;
alter table public.customer_preferences enable row level security;
revoke all on public.assets from anon, authenticated;
revoke all on public.orders from anon, authenticated;
revoke all on public.support_tickets from anon, authenticated;
revoke all on public.store_settings from anon, authenticated;
revoke all on public.customer_preferences from anon, authenticated;
insert into storage.buckets (id,name,public) values ('assets','assets',false),('covers','covers',true)
on conflict (id) do update set public=excluded.public;

-- CC0 packs from Kenney. Upload matching ZIP files from fixtures/ to private Storage bucket assets.
insert into public.assets (id,title,subtitle,description,price,author,cover,file,category,formats,engines,version,license,file_size_bytes,source_url) values
('blocky-characters','Blocky Characters','Characters · Kenney CC0','แคแรกเตอร์บล็อก 18 โมเดล สำหรับเกมสไตล์ low poly',199,'Kenney','/assets/previews/blocky-characters.png','blocky-characters.zip','Characters',ARRAY['OBJ','FBX','GLB']::text[],ARRAY['Unity','Unreal','Godot']::text[],'2.0','CC0 1.0',2148510,'https://kenney.nl/assets/blocky-characters'),
('modular-dungeon-kit','Modular Dungeon Kit','Environments · Kenney CC0','ชิ้นส่วนดันเจียนแบบโมดูลาร์ 39 โมเดล สำหรับประกอบฉากและด่าน',149,'Kenney','/assets/previews/modular-dungeon-kit.png','modular-dungeon-kit.zip','Environments',ARRAY['OBJ','FBX','GLB']::text[],ARRAY['Unity','Unreal','Godot']::text[],'2.1','CC0 1.0',6886434,'https://kenney.nl/assets/modular-dungeon-kit'),
('blaster-kit','Blaster Kit','Weapons · Kenney CC0','ชุดอาวุธ blaster และอุปกรณ์ประกอบ 40 โมเดล',129,'Kenney','/assets/previews/blaster-kit.png','blaster-kit.zip','Weapons',ARRAY['OBJ','FBX','GLB']::text[],ARRAY['Unity','Unreal','Godot']::text[],'2.1','CC0 1.0',1724676,'https://kenney.nl/assets/blaster-kit'),
('car-kit','Car Kit','Vehicles · Kenney CC0','ชุดรถและอุปกรณ์ยานพาหนะ 50 โมเดล',179,'Kenney','/assets/previews/car-kit.png','car-kit.zip','Vehicles',ARRAY['OBJ','FBX','GLB']::text[],ARRAY['Unity','Unreal','Godot']::text[],'3.1','CC0 1.0',4814237,'https://kenney.nl/assets/car-kit'),
('furniture-kit','Furniture Kit','Props · Kenney CC0','ชุดเฟอร์นิเจอร์และของตกแต่งฉาก 140 โมเดล',99,'Kenney','/assets/previews/furniture-kit.png','furniture-kit.zip','Props',ARRAY['OBJ','FBX','GLB','DAE','STL']::text[],ARRAY['Unity','Unreal','Godot']::text[],'2.0','CC0 1.0',5130729,'https://kenney.nl/assets/furniture-kit');
