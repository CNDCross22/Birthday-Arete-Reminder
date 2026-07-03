-- ============================================================================
-- Arete Care — Birthday Reminder :: recipients (who gets the heads-up email)
-- Run this in the Supabase SQL Editor (after 01_schema.sql).
--
-- Managed in-app via the Edge Function (access-code gated). The table is
-- RLS-locked with NO anon policies, so staff emails are NOT exposed through the
-- public/anon key — only the service_role Edge Function can read/write them.
-- If this table has any active rows, the function sends to them; otherwise it
-- falls back to the TEAM_RECIPIENTS secret.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.recipients (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,   -- stored lowercased by the function
  name       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.recipients enable row level security;
-- (no anon policies on purpose → invisible to the public key)

-- Optional: seed the current test recipient so nothing changes until you edit it.
-- insert into public.recipients (email, name) values ('carlo@aretecare.com.au', 'Carlo')
--   on conflict (email) do nothing;
