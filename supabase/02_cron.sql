-- ============================================================================
-- Arete Care — Birthday Reminder :: daily schedule (pg_cron + pg_net)
-- Run this AFTER the Edge Function `birthday-reminder` is deployed.
--
-- What it does: once a day, POST to the Edge Function. The function figures out
-- whose birthday is exactly 7 days away (in LOCAL_TZ), dedups, and emails the team.
--
-- Project: yanaxjuqqhvnrpqwlusb (already filled in below).
-- Cron auth uses a dedicated CRON_SECRET (the service_role key did NOT match the value
-- Supabase injects into the function). Set the SAME random string in TWO places:
--   1. Edge Function secret:  CRON_SECRET = <your-random-string>
--   2. the Vault line below:   <CRON_SECRET> = the same string
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store the cron bearer in Vault (SAME value as the CRON_SECRET Edge Function secret).
-- If it already exists (duplicate-key error), use update_secret instead:
--   select vault.update_secret((select id from vault.secrets where name='birthday_cron_bearer'), '<CRON_SECRET>');
delete from vault.secrets where name = 'birthday_cron_bearer';
select vault.create_secret('<CRON_SECRET>', 'birthday_cron_bearer');

-- (Re)create the daily job. 0 21 * * *  = 21:00 UTC.
--   21:00 UTC ≈ 07:00 AEST / 08:00 AEDT (Australia/Melbourne morning, year-round).
--   Pick the UTC hour that lands mid-morning in your LOCAL_TZ.
select cron.unschedule('birthday-reminder-daily')
where exists (select 1 from cron.job where jobname = 'birthday-reminder-daily');

select cron.schedule(
  'birthday-reminder-daily',
  '0 21 * * *',
  $$
  select net.http_post(
    url     := 'https://yanaxjuqqhvnrpqwlusb.supabase.co/functions/v1/birthday-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'birthday_cron_bearer'
      )
    ),
    body    := jsonb_build_object('source', 'cron')
  );
  $$
);

-- ── Handy checks ─────────────────────────────────────────────────────────────
-- List jobs:            select jobid, schedule, jobname, active from cron.job;
-- Recent runs:          select * from cron.job_run_details order by start_time desc limit 20;
-- Actual HTTP result:   select id, status_code, content, created
--                         from net._http_response order by created desc limit 20;
--   ^ pg_net is ASYNC — the cron run row can say "succeeded" while the HTTP call
--     is still in flight. Trust net._http_response for the real status.
-- Remove the job:       select cron.unschedule('birthday-reminder-daily');
