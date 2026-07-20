-- ============================================================================
-- Arete Care — Greetings :: SEND TIME configuration
--
-- The send time is the pg_cron schedule. The Edge Function decides *who* is
-- celebrating; pg_cron decides *when* to ask. Change the time here.
--
-- ⚠️ cron schedules are in UTC. Melbourne is UTC+10 (AEST, ~Apr–Oct) and
--    UTC+11 (AEDT, ~Oct–Apr), so the local hour shifts by one with daylight
--    saving. Pick from the table below.
--
--    Melbourne     AEST (Apr–Oct)   AEDT (Oct–Apr)
--    ---------     --------------   --------------
--     7:00 am      '0 21 * * *'     '0 20 * * *'
--     8:00 am      '0 22 * * *'     '0 21 * * *'
--     9:00 am      '0 23 * * *'     '0 22 * * *'
--    10:00 am      '0 0  * * *'     '0 23 * * *'
--    12:00 pm      '0 2  * * *'     '0 1  * * *'
--
--    Format:  minute hour day-of-month month day-of-week
-- ============================================================================


-- ── 1) What's the schedule right now? ───────────────────────────────────────
select jobid, jobname, schedule, active
from cron.job
where jobname = 'birthday-reminder-daily';


-- ── 2) CHANGE THE DAILY SEND TIME ──────────────────────────────────────────
-- Edit the schedule string, then run.
select cron.alter_job(
  job_id   => (select jobid from cron.job where jobname = 'birthday-reminder-daily'),
  schedule => '0 21 * * *'          -- ← 7am AEST / 8am AEDT (the default)
);


-- ── 3) TESTING: fire every 5 minutes so you can watch it run by itself ──────
-- Handy for proving the automation works without waiting until morning.
-- select cron.alter_job(
--   job_id   => (select jobid from cron.job where jobname = 'birthday-reminder-daily'),
--   schedule => '*/5 * * * *'
-- );
--
-- NOTE: this will NOT spam anyone. The dedup means each person gets one
-- birthday + one anniversary greeting per year, so extra runs just do nothing.
-- To actually see a repeat send, clear the log between runs:
--   delete from public.reminder_log;
--
-- ⚠️ REMEMBER TO PUT IT BACK when you're done testing (re-run section 2).


-- ── 4) PAUSE / RESUME (no emails while paused) ─────────────────────────────
-- select cron.alter_job(job_id => (select jobid from cron.job where jobname='birthday-reminder-daily'), active => false);  -- pause
-- select cron.alter_job(job_id => (select jobid from cron.job where jobname='birthday-reminder-daily'), active => true);   -- resume


-- ── 5) DID IT RUN? ─────────────────────────────────────────────────────────
-- The scheduler's own record of firing:
-- select start_time, status from cron.job_run_details order by start_time desc limit 10;
--
-- What the function actually replied (the real answer — pg_net is async):
-- select created, status_code, content from net._http_response order by created desc limit 10;
