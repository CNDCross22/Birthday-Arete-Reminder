# 🎂 Arete Care — Birthday Reminder

Emails the **team** a heads-up **7 days before** each person's birthday, so someone can sort a
card or gift. It does **not** email the birthday person, and does **not** send on the day.

- **Storage:** Supabase Postgres (`birthdays` table)
- **Live UI:** React + Vite + Tailwind on GitHub Pages, with Supabase Realtime (add/edit shows up instantly across devices)
- **Background job:** Supabase `pg_cron` → Edge Function, once a day
- **Email:** Microsoft 365 via **Graph API** (`sendMail`, OAuth app — no password/SMTP needed)
- **Cost:** free tiers only

> **Try it right now with zero setup:** `npm install && npm run dev`. With no env vars the app
> runs in **demo mode** (saves to your browser) so you can see the UI. Wire up the steps below to go live.

---

## How it works

```
Browser (GitHub Pages)  ──read──►  Supabase birthdays table  ──Realtime──►  Browser
      │  add/edit/delete (access-code gated)          ▲
      └────────► Edge Function (service_role) ─writes─┘
                                    ▲
pg_cron (daily) ─POST─► birthday-reminder ─► finds MM-DD = today+7 (your timezone)
                                           ─► dedups via reminder_log
                                           ─► Microsoft Graph sendMail ─► team inbox
```

Everyone with the URL can *read* the list (needed for realtime); **writing** requires signing in
with a **Task Board access code** — the Edge Function validates it against the shared `members`
table (HMAC-SHA256 + server-side pepper; plaintext codes are never stored). Grant birthday access
by adding a user in the **Task Board admin**. The daily cron authenticates with a dedicated `CRON_SECRET`.

---

## Repo layout

```
supabase/
  01_schema.sql                      # tables, RLS, realtime — run FIRST
  02_cron.sql                        # daily pg_cron schedule — run AFTER the function is deployed
  functions/birthday-reminder/
    index.ts                         # cron send + gated writes + test email
scripts/make-access-hash.mjs         # OPTIONAL — only if you ever want a standalone code
src/                                 # the React app
.github/workflows/deploy.yml         # GitHub Pages deploy
```

---

## Setup (one time)

### 1. Database
This project **reuses the existing Arete project `yanaxjuqqhvnrpqwlusb`** (its project refs are
already filled into the SQL / URLs below). It only *adds* `birthdays` + `reminder_log` — your
Task Board tables are untouched. Supabase Dashboard → **SQL Editor** → paste and run
[`supabase/01_schema.sql`](supabase/01_schema.sql).

### 2. Register a Microsoft Graph app  *(Entra admin)*
SMTP basic-auth is blocked by MFA/Security Defaults, so email goes via **Microsoft Graph**.
In **entra.microsoft.com → App registrations → New registration** (single-tenant):
- Copy the **Directory (tenant) ID** and **Application (client) ID** from Overview.
- **Certificates & secrets → New client secret** → copy the **Value** (shown once).
- **API permissions → Microsoft Graph → Application permissions → `Mail.Send`** → **Grant admin consent** (green ✓).

### 3. Access — reuse your Task Board logins  *(nothing to set up)*
The birthday tool validates each typed code against the Task Board's `members` table using the
project's existing `ACCESS_CODE_PEPPER`. So there is **no code or hash to generate**:
- Any **active member** can sign in and edit birthdays with their **existing Task Board code**.
- Grant access by **adding a user in the Task Board admin**.
- To restrict editing to admins, set the Edge Function secret `BIRTHDAY_REQUIRE_ADMIN=true` (step 4).

### 4. Deploy the Edge Function + set its secrets
```bash
# link once (if not already):  supabase link --project-ref yanaxjuqqhvnrpqwlusb
supabase functions deploy birthday-reminder --no-verify-jwt

# Set secrets (use a file so nothing lands in your shell history):
supabase secrets set --env-file supabase/functions/.env
```
Create `supabase/functions/.env` (git-ignored) with:
```
GRAPH_TENANT_ID=<Directory (tenant) ID>
GRAPH_CLIENT_ID=<Application (client) ID>
GRAPH_CLIENT_SECRET=<the client secret Value>
GRAPH_SENDER=carlo@aretecare.com.au              # the mailbox to send as
TEAM_RECIPIENTS=alice@aretecare.com.au,bob@aretecare.com.au
CRON_SECRET=<a long random string>               # also stored in Vault (step 6)
LOCAL_TZ=Australia/Melbourne                      # Arete's clock (matches Task Board BOARD_TZ)
LEAD_DAYS=7
OBSERVE_FEB29_ON=02-28                            # or 03-01
# BIRTHDAY_REQUIRE_ADMIN=true                      # optional: only 'admin' members can edit
# ALLOWED_ORIGINS=https://<user>.github.io         # optional: tighten CORS
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase — don't set them.
`ACCESS_CODE_PEPPER` is **already set** on this project (the Task Board's) and is what validates
logins — leave it as-is; you don't add it here. *(Note: the service_role key can't be used as the cron
bearer — the value Supabase injects differs from the dashboard copy — hence the dedicated `CRON_SECRET`.)*

### 5. Test the send  ✅
Easiest: open the web app, sign in with a Task Board code, click **Test email**. (Or hit the cron
path with `Authorization: Bearer <CRON_SECRET>` and body `{"source":"cron"}`.) With a birthday seeded
at **today + 7**, expect `{"sent":true,...}` and an email; run again → `{"sent":false,"reason":"already sent this cycle"}` (dedup).

### 6. Schedule the daily cron
Set `CRON_SECRET` (from step 4) as an Edge Function secret, and store the **same value** in Vault as
`birthday_cron_bearer`. Then edit [`supabase/02_cron.sql`](supabase/02_cron.sql) (project ref already
filled) and run it in the SQL Editor. Verify: `select jobname, schedule, active from cron.job;`
Real HTTP result: `select status_code, content from net._http_response order by created desc limit 1;` (expect `200`).

### 7. The web app on GitHub Pages
1. In [`vite.config.js`](vite.config.js) set `base` to `/<your-repo-name>/`.
2. Push to a new GitHub repo. Repo → **Settings → Pages → Source = GitHub Actions**.
3. Repo → **Settings → Secrets and variables → Actions** → add:
   - `VITE_SUPABASE_URL` = `https://yanaxjuqqhvnrpqwlusb.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = your publishable/anon key
   - `VITE_FUNCTIONS_URL` = `https://yanaxjuqqhvnrpqwlusb.supabase.co/functions/v1/birthday-reminder`
4. Push to `main` → the workflow builds and deploys. Open the Pages URL, enter the team code, add a birthday, and watch a second tab update live.

---

## Local development
```bash
npm install
# create .env.local from .env.example with your real values, then:
npm run dev
```
Leave `.env.local` blank to use demo mode.

---

## Configuration reference

| Where | Key | Purpose |
|---|---|---|
| GitHub Actions secret / `.env.local` | `VITE_SUPABASE_URL` | Supabase project URL (public) |
| ″ | `VITE_SUPABASE_ANON_KEY` | Publishable/anon key (public, RLS-protected) |
| ″ | `VITE_FUNCTIONS_URL` | Edge Function URL |
| Edge Function secret | `GRAPH_TENANT_ID` / `GRAPH_CLIENT_ID` / `GRAPH_CLIENT_SECRET` | Microsoft Graph app (OAuth) |
| ″ | `GRAPH_SENDER` | mailbox to send as (e.g. `carlo@aretecare.com.au`) |
| ″ | `TEAM_RECIPIENTS` | comma-separated heads-up recipients |
| ″ | `CRON_SECRET` | shared secret the daily cron authenticates with |
| ″ | `ACCESS_CODE_PEPPER` (already set) | validates logins against the Task Board `members` table |
| ″ | `BIRTHDAY_REQUIRE_ADMIN` (optional) | `true` = only `admin` members may edit |
| ″ | `LOCAL_TZ` | timezone for "today + 7" (e.g. `Australia/Melbourne`) |
| ″ | `LEAD_DAYS` | days ahead to remind (default `7`) |
| ″ | `OBSERVE_FEB29_ON` | `02-28` or `03-01` for Feb-29 birthdays |
| Vault (cron) | `birthday_cron_bearer` | = the `CRON_SECRET` value; sent by the daily job |

---

## Gotchas
- Email uses **Microsoft Graph** (`Mail.Send` application permission). If sends return **403**, the **admin consent** wasn't granted (green ✓ in Azure → API permissions).
- The **`GRAPH_CLIENT_SECRET` expires** (e.g. 24 mo) — renew it in Azure before then or sends will fail.
- Cron auth is **`CRON_SECRET`**, not the service_role key (the injected value differs from the dashboard copy). Keep the Edge Function secret and the Vault `birthday_cron_bearer` identical.
- Optional hardening: an **Application Access Policy** (Exchange PowerShell) restricts the Graph app to only send as `GRAPH_SENDER`.
- The anon key ships in the bundle → the table is read-only to the public; all writes are gated.
- Wrong Vite `base` = blank page / 404 assets on the Pages URL; the workflow ships `404.html` for deep links.
- Logins reuse the Task Board's `members` + `ACCESS_CODE_PEPPER`. **Don't rotate that pepper** without re-hashing member codes — it would lock people out of **both** apps.
