-- ============================================================================
-- Arete Care — Greetings :: exact send time (hour AND minute)
--
-- 07_settings.sql gave whole hours. This adds minutes so the time can be set
-- to anything (e.g. 07:30). The cron now checks in every 5 minutes and the
-- function sends once the local time has reached the configured time — the
-- per-person/per-year dedup is what stops it repeating.
--
-- Run after 07_settings.sql, then redeploy the Edge Function.
-- ============================================================================

alter table public.app_settings add column if not exists send_minute smallint not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'app_settings_minute_range') then
    alter table public.app_settings
      add constraint app_settings_minute_range check (send_minute between 0 and 59);
  end if;
end $$;


-- ── Check in every 5 minutes so an exact minute can be honoured ────────────
select cron.alter_job(
  job_id   => (select jobid from cron.job where jobname = 'birthday-reminder-daily'),
  schedule => '*/5 * * * *'
);


-- ── Check ──────────────────────────────────────────────────────────────────
select send_hour, send_minute from public.app_settings where id = 1;
select jobname, schedule, active from cron.job where jobname = 'birthday-reminder-daily';
