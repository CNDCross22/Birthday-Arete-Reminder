-- ============================================================================
-- Arete Care — Greetings upgrade
-- Shift from "team heads-up 7 days before" to "personal greetings on the day"
-- for BOTH birthdays and work anniversaries (date hired). Run after 01_schema.sql.
-- Safe/idempotent.
-- ============================================================================

-- Work-anniversary date + index-friendly generated month/day.
alter table public.birthdays add column if not exists hire_date date;
alter table public.birthdays
  add column if not exists hire_month smallint generated always as (extract(month from hire_date)::smallint) stored,
  add column if not exists hire_day   smallint generated always as (extract(day   from hire_date)::smallint) stored;
create index if not exists birthdays_hire_mmdd_idx on public.birthdays (hire_month, hire_day) where is_active;

-- A person may now have only a hire date (birthday optional) — or vice-versa.
alter table public.birthdays alter column birth_date drop not null;

-- reminder_log: dedup PER PERSON, PER YEAR, PER KIND (birthday vs anniversary),
-- so the same person can get both a birthday and an anniversary greeting in one year.
alter table public.reminder_log add column if not exists kind text not null default 'birthday';

-- Drop the old 2-column unique and add the 3-column one.
alter table public.reminder_log drop constraint if exists reminder_log_birthday_id_reminder_year_key;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reminder_log_person_year_kind_key') then
    alter table public.reminder_log
      add constraint reminder_log_person_year_kind_key unique (birthday_id, reminder_year, kind);
  end if;
end $$;

-- Optional: start fresh so no stale heads-up rows block this year's greetings.
-- delete from public.reminder_log;
