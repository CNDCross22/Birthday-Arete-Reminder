-- ============================================================================
-- Arete Care — Greetings :: enforce "one person = one email address"
-- Same NAME twice is fine (different people can share a name).
-- The same EMAIL twice is not (that's the same person, and they'd be greeted twice).
--
-- Run the CHECK first. Only run the INDEX if the check returns zero rows.
-- ============================================================================

-- ── 1) CHECK: any existing duplicate emails? (should return NO rows) ────────
select lower(person_email) as email,
       count(*)            as copies,
       string_agg(full_name, '  |  ') as names
from public.birthdays
where person_email is not null and person_email <> ''
group by lower(person_email)
having count(*) > 1;

-- If rows came back, clean them up first (keep one, delete the extras), e.g.:
--   delete from public.birthdays where id = '<the-duplicate-id>';


-- ── 2) ENFORCE: one row per email address ──────────────────────────────────
-- Case-insensitive, so Maria@… and maria@… count as the same person.
-- People with a blank/NULL email are unaffected (Postgres allows many NULLs).
create unique index if not exists birthdays_email_uniq
  on public.birthdays (lower(person_email))
  where person_email is not null and person_email <> '';
