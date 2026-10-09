-- Eseguire nel SQL Editor di un NUOVO progetto Supabase dedicato.
create extension if not exists pgcrypto;
create table if not exists public.ficulle_state(id integer primary key default 1 check(id=1), mode text not null default 'waiting' check(mode in ('waiting','playing','paused')),start_epoch double precision not null default 0,offset_seconds double precision not null default 0,revision bigint not null default 0);
insert into public.ficulle_state(id) values(1) on conflict do nothing;
create table if not exists public.ficulle_guests(guest uuid primary key,last_seen timestamptz not null default now());
create table if not exists public.ficulle_private(id integer primary key default 1 check(id=1),secret_hash text not null);
-- IMPORTANTE: sostituire il valore qui sotto con una password CASUALE lunga (almeno 20 caratteri).
-- NON condividere la password con gli invitati e NON inserirla nei file del sito.
insert into public.ficulle_private(id,secret_hash) values(1,crypt('CAMBIA-QUESTO-CODICE-LUNGO-E-CASUALE',gen_salt('bf'))) on conflict(id) do update set secret_hash=excluded.secret_hash;
alter table public.ficulle_state enable row level security;
alter table public.ficulle_guests enable row level security;
alter table public.ficulle_private enable row level security;
revoke all on public.ficulle_state,public.ficulle_guests,public.ficulle_private from anon,authenticated;
create or replace function public.ficulle_status() returns jsonb language plpgsql security definer set search_path=public as $$ declare s record;n int;begin select * into s from public.ficulle_state where id=1;select count(*) into n from public.ficulle_guests where last_seen>now()-interval '20 seconds';return jsonb_build_object('mode',s.mode,'start_epoch',s.start_epoch,'offset_seconds',s.offset_seconds,'revision',s.revision,'online_count',n);end $$;
create or replace function public.ficulle_heartbeat(p_guest uuid) returns void language plpgsql security definer set search_path=public as $$ begin insert into public.ficulle_guests(guest,last_seen) values(p_guest,now()) on conflict(guest) do update set last_seen=now();end $$;
create or replace function public.ficulle_control(p_secret text,p_action text) returns void language plpgsql security definer set search_path=public as $$ declare s record; t double precision:=extract(epoch from clock_timestamp());begin
if not exists(select 1 from public.ficulle_private where id=1 and secret_hash=crypt(p_secret,secret_hash)) then raise exception 'Codice regia non valido';end if;
select * into s from public.ficulle_state where id=1 for update;
if p_action in ('start','reset') then update public.ficulle_state set mode='playing',start_epoch=t+10,offset_seconds=0,revision=revision+1 where id=1;
elsif p_action='pause' and s.mode='playing' then update public.ficulle_state set mode='paused',offset_seconds=greatest(0,s.offset_seconds+t-s.start_epoch),revision=revision+1 where id=1;
elsif p_action='resume' and s.mode='paused' then update public.ficulle_state set mode='playing',start_epoch=t+5,revision=revision+1 where id=1;
else raise exception 'Comando non applicabile allo stato corrente';end if;end $$;
-- I conteggi indicano i dispositivi che hanno premuto SONO PRONTO, non tutti i visitatori.
revoke all on function public.ficulle_status(),public.ficulle_heartbeat(uuid),public.ficulle_control(text,text) from public;
grant execute on function public.ficulle_status(),public.ficulle_heartbeat(uuid),public.ficulle_control(text,text) to anon,authenticated;

-- Verifica del codice regia senza avviare il film.
create or replace function public.ficulle_verify_regia(p_secret text) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 return exists(select 1 from public.ficulle_private where id=1 and secret_hash=crypt(p_secret,secret_hash));
end $$;
revoke all on function public.ficulle_verify_regia(text) from public;
grant execute on function public.ficulle_verify_regia(text) to anon,authenticated;
