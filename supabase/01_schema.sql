-- ============================================================================
-- Arete Care — Birthday Reminder :: schema, RLS, and Realtime
-- Run this FIRST in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: uses IF NOT EXISTS / idempotent guards where possible.
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ── Birthdays ───────────────────────────────────────────────────────────────
create table if not exists public.birthdays (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  birth_date   date not null,   -- real date incl. year. If the year is unknown,
                                 -- enter a leap year (e.g. 2000) so Feb-29 stays valid.
  department   text,
  notes        text,            -- gift ideas / context, shown in the email
  person_email text,            -- optional; NOT the send target
  is_active    boolean not null default true,
  -- generated month/day let the "ignore the year" lookup use an index:
  birth_month  smallint generated always as (extract(month from birth_date)::smallint) stored,
  birth_day    smallint generated always as (extract(day   from birth_date)::smallint) stored,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists birthdays_mmdd_idx
  on public.birthdays (birth_month, birth_day) where is_active;

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists birthdays_touch on public.birthdays;
create trigger birthdays_touch before update on public.birthdays
  for each row execute function public.touch_updated_at();

-- ── Reminder log (idempotency: never email twice per person per year) ────────
create table if not exists public.reminder_log (
  id            bigint generated always as identity primary key,
  birthday_id   uuid not null references public.birthdays(id) on delete cascade,
  observed_date date not null,      -- the target date, e.g. 2026-07-10
  reminder_year smallint not null,  -- year of observed_date
  sent_at       timestamptz not null default now(),
  unique (birthday_id, reminder_year)   -- the dedup key the Edge Fn claims against
);

-- ── Row-Level Security ───────────────────────────────────────────────────────
-- The anon key ships inside the public web bundle, so "what anon can do, the
-- internet can do". Therefore: anon may only READ. Every write goes through the
-- access-code-gated Edge Function, which uses the service_role key (bypasses RLS).
alter table public.birthdays    enable row level security;
alter table public.reminder_log enable row level security;

drop policy if exists birthdays_read_anon on public.birthdays;
create policy birthdays_read_anon on public.birthdays
  for select to anon, authenticated using (true);

-- reminder_log: no anon policies at all → invisible to the public key.

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Let the browser receive live INSERT/UPDATE/DELETE on birthdays.
-- (Realtime still enforces the RLS SELECT policy above for subscribers.)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'birthdays'
  ) then
    alter publication supabase_realtime add table public.birthdays;
  end if;
end $$;

-- Optional: seed a test row whose birthday is exactly LEAD_DAYS (7) away.
-- Adjust the interval to your LOCAL_TZ "today + 7". Uncomment to use:
-- insert into public.birthdays (full_name, birth_date, department, notes)
-- values ('Test Person', (current_date + interval '7 days')::date, 'QA', 'delete me');
