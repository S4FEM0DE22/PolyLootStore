-- Additive history, server-only. Apply before deploying the notification API.
create table public.notification_events (
 id text primary key, customer_id uuid, type text not null check (type in ('order','support','announcement')),
 status text not null, detail text not null, href text not null, created_at timestamptz not null default now()
);
create index notification_events_customer_time on public.notification_events(customer_id, created_at desc, id desc);
create index notification_events_time on public.notification_events(created_at desc, id desc);
create table public.notification_receipts (
 viewer text not null, event_id text not null references public.notification_events(id) on delete cascade,
 read_at timestamptz not null default now(), primary key(viewer,event_id)
);
alter table public.notification_events enable row level security;
alter table public.notification_receipts enable row level security;
revoke all on public.notification_events, public.notification_receipts from anon, authenticated;
grant all on public.notification_events, public.notification_receipts to service_role;

create function public.capture_notification_event() returns trigger language plpgsql security invoker set search_path = '' as $$
declare event_id text; event_time timestamptz; kind text; owner_id uuid; content text; destination text;
begin
 if tg_table_name = 'orders' then
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  kind := 'order'; owner_id := new.customer_id; content := new.id; destination := '#order/' || new.id;
  event_id := 'order:' || new.id || ':' || new.status;
  event_time := case new.status when 'PAID' then coalesce(new.paid_at,now()) when 'CANCELLED' then coalesce(new.cancelled_at,now()) else new.created_at end;
 elsif tg_table_name = 'support_tickets' then
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  kind := 'support'; owner_id := new.customer_id; content := new.id; destination := '#help';
  event_id := 'ticket:' || new.id || ':' || new.status || case when tg_op = 'UPDATE' then ':' || gen_random_uuid()::text else '' end;
  event_time := case when tg_op = 'UPDATE' then now() else new.created_at end;
 else
  if tg_op = 'UPDATE' and new.announcement is not distinct from old.announcement then return new; end if;
  if trim(new.announcement) = '' then return new; end if;
  insert into public.notification_events(id,type,status,detail,href,created_at)
   values ('announcement:' || gen_random_uuid()::text,'announcement','NEW',new.announcement,'#help',coalesce(new.updated_at,now()));
  return new;
 end if;
 insert into public.notification_events(id,customer_id,type,status,detail,href,created_at)
 values(event_id,owner_id,kind,new.status,content,destination,event_time) on conflict(id) do nothing;
 return new;
end $$;
revoke execute on function public.capture_notification_event() from public, anon, authenticated;
grant execute on function public.capture_notification_event() to service_role;
create trigger orders_notification after insert or update on public.orders for each row execute function public.capture_notification_event();
create trigger tickets_notification after insert or update on public.support_tickets for each row execute function public.capture_notification_event();
create trigger announcement_notification after insert or update on public.store_settings for each row execute function public.capture_notification_event();

-- Backfill only transitions with known timestamps. Historical support transition
-- times cannot be recovered, so existing tickets keep their original timestamp.
insert into public.notification_events(id,customer_id,type,status,detail,href,created_at)
select 'order:' || id || ':PENDING',customer_id,'order','PENDING',id,'#order/' || id,created_at from public.orders
union all select 'order:' || id || ':PAID',customer_id,'order','PAID',id,'#order/' || id,paid_at from public.orders where paid_at is not null
union all select 'order:' || id || ':CANCELLED',customer_id,'order','CANCELLED',id,'#order/' || id,cancelled_at from public.orders where cancelled_at is not null;
insert into public.notification_events(id,customer_id,type,status,detail,href,created_at)
select 'ticket:' || id || ':' || status,customer_id,'support',status,id,'#help',created_at from public.support_tickets;
insert into public.notification_events(id,type,status,detail,href,created_at)
select 'announcement:' || gen_random_uuid()::text,'announcement','NEW',announcement,'#help',coalesce(updated_at,now()) from public.store_settings where trim(announcement) <> '';

create function public.notification_feed(p_viewer text, p_types text[], p_legacy_read text[], p_since timestamptz, p_unread boolean, p_type text, p_offset integer, p_limit integer)
returns jsonb language sql stable security invoker set search_path = '' as $$
 with owned as (
  select e.*, (r.event_id is not null or e.id = any(p_legacy_read)) as is_read
  from public.notification_events e left join public.notification_receipts r on r.event_id=e.id and r.viewer=p_viewer
  where e.type = any(p_types) and (case when p_viewer='admin' then e.type <> 'announcement' else e.customer_id::text=p_viewer or e.type='announcement' end)
 ), filtered as (
  select * from owned where (p_since is null or created_at >= p_since) and (not p_unread or not is_read) and (p_type='' or type=p_type)
 ), page as (select * from filtered order by created_at desc,id desc limit greatest(1,least(p_limit,100)) offset greatest(0,p_offset))
 select jsonb_build_object('notifications',coalesce((select jsonb_agg(jsonb_build_object('id',id,'type',type,'status',status,'detail',detail,'href',href,'createdAt',created_at,'read',is_read) order by created_at desc,id desc) from page),'[]'::jsonb),
 'total',(select count(*) from filtered),'unreadCount',(select count(*) from owned where not is_read),'hasMore',(select count(*) > p_offset+p_limit from filtered));
$$;
create function public.notification_mark_read(p_viewer text,p_types text[],p_ids text[],p_before timestamptz)
returns integer language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
 if p_ids is not null and exists(select 1 from unnest(p_ids) requested(id) where not exists(
  select 1 from public.notification_events e where e.id=requested.id and e.type=any(p_types)
  and e.created_at<=p_before and (case when p_viewer='admin' then e.type<>'announcement' else e.customer_id::text=p_viewer or e.type='announcement' end)
 )) then return 0; end if;
 insert into public.notification_receipts(viewer,event_id)
 select p_viewer,e.id from public.notification_events e where e.type=any(p_types) and e.created_at<=p_before
 and (p_ids is null or e.id=any(p_ids)) and (case when p_viewer='admin' then e.type<>'announcement' else e.customer_id::text=p_viewer or e.type='announcement' end)
 on conflict(viewer,event_id) do update set read_at=excluded.read_at;
 get diagnostics n = row_count;
 return n;
end $$;
revoke execute on function public.notification_feed(text,text[],text[],timestamptz,boolean,text,integer,integer), public.notification_mark_read(text,text[],text[],timestamptz) from public,anon,authenticated;
grant execute on function public.notification_feed(text,text[],text[],timestamptz,boolean,text,integer,integer), public.notification_mark_read(text,text[],text[],timestamptz) to service_role;
