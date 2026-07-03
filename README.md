# 🎂 Arete Care — Birthday Reminder

Emails the **team** a heads-up **7 days before** each person's birthday, so someone can sort a
card or gift. It does **not** email the birthday person, and does **not** send on the day.

- **Storage:** Supabase Postgres (`birthdays` table)
- **Live UI:** React + Vite + Tailwind on GitHub Pages, with Supabase Realtime (add/edit shows up instantly across devices)
- **Background job:** Supabase `pg_cron` → Edge Function, once a day
- **Email:** Office 365 SMTP (`smtp.office365.com`) from your Microsoft 365 mailbox
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
                                           ─► Office 365 SMTP ─► team inbox
```

Everyone with the URL can *read* the list (needed for realtime); **writing** requires signing in
with a **Task Board access code** — the Edge Function validates it against the shared `members`
table (HMAC-SHA256 + server-side pepper; plaintext codes are never stored). Grant birthday access
by adding a user in the **Task Board admin**. The daily cron authenticates with the `service_role` key.

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

### 2. Enable Office 365 SMTP on the sending mailbox  *(admin)*
Microsoft 365 Admin → **Users → the mailbox → Mail → Manage email apps → tick “Authenticated SMTP”.**
If your tenant has *Security Defaults* on, either turn on an **app password** for that mailbox or use a
dedicated shared mailbox that allows SMTP AUTH. (Test in step 5 confirms it works.)

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
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=birthdays@lionpathadvisors.com        # the M365 mailbox you enabled SMTP on
SMTP_PASSWORD=**********                          # mailbox password or app password
TEAM_RECIPIENTS=alice@lionpathadvisors.com,bob@lionpathadvisors.com
LOCAL_TZ=Australia/Melbourne                      # Arete's clock (matches Task Board BOARD_TZ)
LEAD_DAYS=7
OBSERVE_FEB29_ON=02-28                            # or 03-01
# BIRTHDAY_REQUIRE_ADMIN=true                      # optional: only 'admin' members can edit
# ALLOWED_ORIGINS=https://<user>.github.io         # optional: tighten CORS
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase — don't set them.
`ACCESS_CODE_PEPPER` is **already set** on this project (the Task Board's) and is what validates
logins — leave it as-is; you don't add it here.

### 5. Test the send  ✅
```bash
curl -i -X POST "https://yanaxjuqqhvnrpqwlusb.supabase.co/functions/v1/birthday-reminder" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"source":"cron"}'
```
- Seed one row whose birth date is **today + 7** first (uncomment the seed line in `01_schema.sql`), then expect `{"sent":true,...}` and an email in the team inbox.
- Run it **again** → `{"sent":false,"reason":"already sent this cycle"}` (dedup works).

### 6. Schedule the daily cron
Edit [`supabase/02_cron.sql`](supabase/02_cron.sql): the project ref is already filled in — just
replace `<SERVICE_ROLE_KEY>`, then run it in the SQL Editor. Verify: `select jobname, schedule, active from cron.job;`
The real HTTP result shows up in `select * from net._http_response order by created desc;`

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
| Edge Function secret | `SMTP_USER` / `SMTP_PASSWORD` | O365 mailbox login |
| ″ | `TEAM_RECIPIENTS` | comma-separated heads-up recipients |
| ″ | `ACCESS_CODE_PEPPER` (already set) | validates logins against the Task Board `members` table |
| ″ | `BIRTHDAY_REQUIRE_ADMIN` (optional) | `true` = only `admin` members may edit |
| ″ | `LOCAL_TZ` | timezone for "today + 7" (e.g. `Australia/Melbourne`) |
| ″ | `LEAD_DAYS` | days ahead to remind (default `7`) |
| ″ | `OBSERVE_FEB29_ON` | `02-28` or `03-01` for Feb-29 birthdays |
| Vault (cron) | `birthday_cron_bearer` | service_role key used by the daily job |

---

## Gotchas
- **SMTP AUTH must be enabled** on the mailbox or auth fails with `535 5.7.139` (see step 2).
- Microsoft is **retiring basic-auth SMTP** — this works today; if it's ever disabled, switch the send
  step in `index.ts` to **Microsoft Graph `sendMail`** (client-credentials). Nothing else changes.
- Use port **587 (STARTTLS)**, not 465. Exchange Online throttles ~30 msgs/min — fine for a team.
- The anon key ships in the bundle → the table is read-only to the public; all writes are gated.
- Wrong Vite `base` = blank page / 404 assets on the Pages URL; the workflow ships `404.html` for deep links.
- Logins reuse the Task Board's `members` + `ACCESS_CODE_PEPPER`. **Don't rotate that pepper** without re-hashing member codes — it would lock people out of **both** apps.
