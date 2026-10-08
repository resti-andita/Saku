-- Run once in the SQL Editor of a NEW Supabase project dedicated to Saku.
create table if not exists public.ledgers (id text primary key, data text not null, version integer not null default 0);
create table if not exists public.receipts (id text primary key, name text not null, type text not null, size integer not null, actor text not null, ready boolean not null default false);
create table if not exists public.team_access (user_id text primary key, name text not null, first_seen text not null, last_seen text not null, last_edit text, last_action text);
alter table public.ledgers enable row level security;
alter table public.receipts enable row level security;
alter table public.team_access enable row level security;
revoke all on public.ledgers, public.receipts, public.team_access from anon, authenticated;
grant all on public.ledgers, public.receipts, public.team_access to service_role;
create or replace function public.record_saku_access(p_user_id text,p_name text,p_action text default null) returns void language sql set search_path=public as $$
insert into public.team_access(user_id,name,first_seen,last_seen,last_edit,last_action)
values(p_user_id,p_name,now()::text,now()::text,case when p_action is not null then now()::text end,p_action)
on conflict(user_id) do update set name=excluded.name,last_seen=excluded.last_seen,last_edit=coalesce(excluded.last_edit,team_access.last_edit),last_action=coalesce(excluded.last_action,team_access.last_action);
$$;
revoke all on function public.record_saku_access(text,text,text) from public,anon,authenticated;
grant execute on function public.record_saku_access(text,text,text) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('receipts','receipts',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
