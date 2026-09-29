-- Additive, service-only support conversation. Keep historical ticket text intact.
alter table public.support_tickets add column if not exists updated_at timestamptz;
create table if not exists public.support_messages (
 id uuid primary key, ticket_id text not null references public.support_tickets(id),
 author_role text not null check(author_role in ('customer','admin')),
 body text not null check(char_length(body) between 1 and 4000),
 created_at timestamptz not null default now(),
 email_status text not null default 'PENDING' check(email_status in ('PENDING','SENT','FAILED','NOT_CONFIGURED','DEMO','NOT_REQUIRED')),
 email_id text, email_attempt_at timestamptz
);
create index if not exists support_messages_ticket_time on public.support_messages(ticket_id,created_at,id);
alter table public.support_messages enable row level security;
revoke all on public.support_messages from public,anon,authenticated;
grant all on public.support_messages to service_role;

create or replace function public.support_reply(p_ticket text,p_actor uuid,p_admin boolean,p_id uuid,p_body text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.support_tickets; m public.support_messages; role_name text; n integer;
begin
 select * into t from public.support_tickets where id=p_ticket for update;
 if t.id is null or (not p_admin and t.customer_id is distinct from p_actor) then
  raise exception 'ticket not found' using errcode='P0002';
 end if;
 role_name := case when p_admin then 'admin' else 'customer' end;
 select * into m from public.support_messages where id=p_id;
 if m.id is not null then
  if m.ticket_id<>p_ticket or m.author_role<>role_name or m.body<>p_body then raise exception 'request conflict' using errcode='23505'; end if;
  return jsonb_build_object('message',to_jsonb(m),'ticket',to_jsonb(t),'reused',true);
 end if;
 select count(*) into n from public.support_messages where ticket_id=p_ticket;
 if n>=200 then raise exception 'conversation full' using errcode='P0001'; end if;
 select count(*) into n from public.support_messages where ticket_id=p_ticket and author_role=role_name and created_at>now()-interval '10 minutes';
 if n>=10 then raise exception 'reply rate limit' using errcode='P0001'; end if;
 insert into public.support_messages(id,ticket_id,author_role,body,email_status)
 values(p_id,p_ticket,role_name,p_body,case when p_admin then 'PENDING' else 'NOT_REQUIRED' end) returning * into m;
 update public.support_tickets set updated_at=m.created_at,
 status=case when not p_admin and status='RESOLVED' then 'OPEN' else status end where id=p_ticket returning * into t;
 insert into public.notification_events(id,customer_id,type,status,detail,href,created_at)
 values('reply:'||m.id::text,case when p_admin then t.customer_id else null end,'support',
 case when p_admin then 'ADMIN_REPLY' else 'CUSTOMER_REPLY' end,p_ticket,'#ticket/'||p_ticket,m.created_at);
 return jsonb_build_object('message',to_jsonb(m),'ticket',to_jsonb(t),'reused',false);
end $$;
revoke execute on function public.support_reply(text,uuid,boolean,uuid,text) from public,anon,authenticated;
grant execute on function public.support_reply(text,uuid,boolean,uuid,text) to service_role;
