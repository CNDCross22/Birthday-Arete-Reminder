-- ============================================================================
-- Arete Care — Birthday Reminder :: daily schedule (pg_cron + pg_net)
-- Run this AFTER the Edge Function `birthday-reminder` is deployed.
--
-- What it does: once a day, POST to the Edge Function. The function figures out
-- whose birthday is exactly 7 days away (in LOCAL_TZ), dedups, and emails the team.
--
-- Project: yanaxjuqqhvnrpqwlusb (reusing the existing Arete project — already filled in below).
-- BEFORE running: replace the ONE placeholder below.
--   <SERVICE_ROLE_KEY>   Dashboard → Project Settings → API → service_role key
--                        (server-side secret; used here only inside Vault)
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store the auth bearer once in Vault (do NOT paste it into the schedule body).
-- Re-runnable: delete any prior copy first.
delete from vault.secrets where name = 'birthday_cron_bearer';
select vault.create_secret('<SERVICE_ROLE_KEY>', 'birthday_cron_bearer');

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
