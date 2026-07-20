-- ============================================================================
-- Arete Care — Greetings :: in-app settings (send time configurable from the UI)
--
-- Before: the send time lived in the cron schedule (UTC), so it drifted an hour
--         with daylight saving and could only be changed via SQL.
-- Now:    cron runs EVERY HOUR, and the function sends only when the local hour
--         matches `send_hour` below. That's DST-proof and editable from the app.
--
-- Run after 04_greetings.sql. Then redeploy the Edge Function.
-- ============================================================================

create table if not exists public.app_settings (
  id          smallint primary key default 1,
  send_hour   smallint not null default 7,   -- 0–23, in LOCAL_TZ (Australia/Melbourne)
  updated_at  timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1),
  constraint app_settings_hour_range check (send_hour between 0 and 23)
);

insert into public.app_settings (id, send_hour) values (1, 7)
  on conflict (id) do nothing;

-- Managed only through the access-code-gated Edge Function (service_role).
alter table public.app_settings enable row level security;
-- (no anon policies on purpose)


-- ── Switch the schedule to hourly ──────────────────────────────────────────
-- The function now decides the exact hour, so cron just needs to check in often.
select cron.alter_job(
  job_id   => (select jobid from cron.job where jobname = 'birthday-reminder-daily'),
  schedule => '0 * * * *'      -- top of every hour
);


-- ── Check ──────────────────────────────────────────────────────────────────
select send_hour from public.app_settings where id = 1;
select jobname, schedule, active from cron.job where jobname = 'birthday-reminder-daily';
