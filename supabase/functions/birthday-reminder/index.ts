// ============================================================================
// Arete Care — Birthday Reminder :: Edge Function (Deno)
//
// One function, three jobs:
//   1. CRON  — POST { source:"cron" } with Authorization: Bearer <service_role|CRON_SECRET>
//              → find birthdays exactly LEAD_DAYS away, dedup, email the team.
//   2. WRITE — POST { mode:"write", op, accessCode, payload }  (from the web UI)
//              → access-code gated create/update/remove on the birthdays table.
//   3. TEST  — POST { mode:"test", accessCode }                (from the web UI)
//              → send a labelled test email now, to confirm SMTP works.
//   ( verify — POST { mode:"verify", accessCode } → 200/401, used by the login gate )
//
// Deploy:  supabase functions deploy birthday-reminder --no-verify-jwt
// (We do our own auth: a shared bearer for cron, an HMAC'd access code for the UI.)
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Config from Edge Function secrets ────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Access gate: the typed code is validated against the Task Board's `members`
// table — same identity system, so you grant access by adding a user in the Task
// Board admin. Uses the SHARED ACCESS_CODE_PEPPER because member hashes use it.
const PEPPER = Deno.env.get("ACCESS_CODE_PEPPER") ?? "";
// Set BIRTHDAY_REQUIRE_ADMIN=true to restrict editing to members with role='admin'.
const REQUIRE_ADMIN = (Deno.env.get("BIRTHDAY_REQUIRE_ADMIN") ?? "false").toLowerCase() === "true";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

// Microsoft Graph (OAuth client-credentials) — modern, MFA-independent sending.
const GRAPH_TENANT_ID = Deno.env.get("GRAPH_TENANT_ID") ?? "";
const GRAPH_CLIENT_ID = Deno.env.get("GRAPH_CLIENT_ID") ?? "";
const GRAPH_CLIENT_SECRET = Deno.env.get("GRAPH_CLIENT_SECRET") ?? "";
const GRAPH_SENDER = Deno.env.get("GRAPH_SENDER") ?? Deno.env.get("SMTP_USER") ?? "";
const TEAM_RECIPIENTS = (Deno.env.get("TEAM_RECIPIENTS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);

// Arete's canonical clock (matches the Task Board's BOARD_TZ). The whole team
// works to Melbourne time even though some staff are in Manila.
const LOCAL_TZ = Deno.env.get("LOCAL_TZ") ?? "Australia/Melbourne";
const LEAD_DAYS = Number(Deno.env.get("LEAD_DAYS") ?? "7");
const OBSERVE_FEB29_ON = Deno.env.get("OBSERVE_FEB29_ON") ?? "02-28"; // or "03-01"
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);

const supa = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const te = new TextEncoder();

// ── Small helpers ────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function hmacHex(message: string, key: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw", te.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, te.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Member = { id: string; name: string; role: string };
async function checkAccessCode(code: string): Promise<{ ok: boolean; member?: Member }> {
  if (!code) return { ok: false };
  const hash = await hmacHex(code, PEPPER); // same HMAC the Task Board stores
  const { data, error } = await supa
    .from("members")
    .select("id, name, role, active")
    .eq("accessCodeHash", hash)
    .eq("active", true)
    .maybeSingle();
  if (error || !data) return { ok: false };
  if (REQUIRE_ADMIN && data.role !== "admin") return { ok: false };
  return { ok: true, member: { id: data.id, name: data.name, role: data.role } };
}

function corsHeaders(origin: string): Record<string, string> {
  let allow = "*";
  if (ALLOWED_ORIGINS.length) allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  else if (origin) allow = origin;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const json = (obj: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

// ── Date logic: "today + LEAD_DAYS" in LOCAL_TZ, as a plain calendar date ─────
function localToday(tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: g("year"), m: g("month"), d: g("day") };
}

function targetDate() {
  const t = localToday(LOCAL_TZ);
  // Add LEAD_DAYS as a pure date op (UTC math on date parts avoids DST drift).
  const target = new Date(Date.UTC(t.y, t.m - 1, t.d + LEAD_DAYS));
  return { month: target.getUTCMonth() + 1, day: target.getUTCDate(), year: target.getUTCFullYear() };
}

type Row = { id: string; full_name: string; birth_date: string; department: string | null; notes: string | null };

async function findDue() {
  const { month, day, year } = targetDate();
  const { data, error } = await supa
    .from("birthdays")
    .select("id, full_name, birth_date, department, notes")
    .eq("is_active", true).eq("birth_month", month).eq("birth_day", day);
  if (error) throw error;
  let due: Row[] = data ?? [];

  // Feb-29 people never match in a non-leap year → observe on the configured day.
  const observeFeb29Today =
    (OBSERVE_FEB29_ON === "02-28" && month === 2 && day === 28 && !isLeap(year)) ||
    (OBSERVE_FEB29_ON === "03-01" && month === 3 && day === 1 && !isLeap(year));
  if (observeFeb29Today) {
    const r = await supa
      .from("birthdays")
      .select("id, full_name, birth_date, department, notes")
      .eq("is_active", true).eq("birth_month", 2).eq("birth_day", 29);
    if (!r.error && r.data) due = [...due, ...r.data];
  }
  return { due, month, day, year };
}

// ── Email ────────────────────────────────────────────────────────────────────
function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

async function graphToken(): Promise<string> {
  const form = new URLSearchParams({
    client_id: GRAPH_CLIENT_ID,
    client_secret: GRAPH_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(`https://login.microsoftonline.com/${GRAPH_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Graph auth failed: ${j.error_description || j.error || res.status}`);
  return j.access_token as string;
}

async function sendEmail(people: Row[], opts: { testMode: boolean }) {
  if (!GRAPH_TENANT_ID || !GRAPH_CLIENT_ID || !GRAPH_CLIENT_SECRET) {
    throw new Error("GRAPH_TENANT_ID / GRAPH_CLIENT_ID / GRAPH_CLIENT_SECRET not configured");
  }
  if (!GRAPH_SENDER) throw new Error("GRAPH_SENDER not configured");
  if (TEAM_RECIPIENTS.length === 0) throw new Error("TEAM_RECIPIENTS not configured");

  const dateFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", timeZone: "UTC" });
  const nice = (iso: string) => dateFmt.format(new Date(iso + "T00:00:00Z"));

  const htmlItems = people.map((p) => {
    const dept = p.department ? ` <span style="color:#7b7689">(${esc(p.department)})</span>` : "";
    const notes = p.notes ? `<div style="color:#7b7689;font-size:13px">💡 ${esc(p.notes)}</div>` : "";
    return `<li style="margin:6px 0"><strong>${esc(p.full_name)}</strong>${dept} — ${esc(nice(p.birth_date))}${notes}</li>`;
  }).join("");

  const tag = opts.testMode ? "[TEST] " : "";
  const subject = `${tag}🎂 Upcoming birthday${people.length > 1 ? "s" : ""} in ${LEAD_DAYS} days`;
  const intro = opts.testMode
    ? "TEST EMAIL — this is a delivery check. If you can read this, Microsoft Graph email sending is working."
    : `Heads-up team — time to sort a card / gift. Coming up in ${LEAD_DAYS} days:`;

  const html = `
    <div style="font-family:Inter,Segoe UI,system-ui,sans-serif;color:#2c2740;max-width:560px">
      <div style="background:#3a9ca3;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-weight:700">
        🎂 Arete Care · Birthday Reminder
      </div>
      <div style="border:1px solid #e4e6ee;border-top:0;border-radius:0 0 12px 12px;padding:18px 20px">
        <p style="margin:0 0 12px">${esc(intro)}</p>
        <ul style="margin:0;padding-left:18px">${htmlItems}</ul>
        <p style="margin:16px 0 0;color:#7a5c8e;font-size:13px">— Arete Care Birthday Bot</p>
      </div>
    </div>`;

  const message = {
    subject,
    body: { contentType: "HTML", content: html },
    toRecipients: TEAM_RECIPIENTS.map((address) => ({ emailAddress: { address } })),
  };
  const token = await graphToken();
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(GRAPH_SENDER)}/sendMail`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message, saveToSentItems: true }),
    },
  );
  if (!res.ok) throw new Error(`Graph sendMail failed (${res.status}): ${await res.text()}`);
}

// ── The three jobs ────────────────────────────────────────────────────────────
async function runCronReminder() {
  const { due, month, day, year } = await findDue();
  const target = `${pad(month)}-${pad(day)}`;
  if (due.length === 0) return { sent: false, reason: "no birthdays due", target };

  // Claim-then-send: insert a reminder_log row per person; the unique
  // (birthday_id, reminder_year) constraint makes a duplicate run a no-op.
  const claimed: Row[] = [];
  for (const p of due) {
    const { data, error } = await supa
      .from("reminder_log")
      .insert({ birthday_id: p.id, observed_date: `${year}-${target}`, reminder_year: year })
      .select("birthday_id");
    if (!error && data && data.length) claimed.push(p); // unique conflict → skip
  }
  if (claimed.length === 0) return { sent: false, reason: "already sent this cycle", target };

  try {
    await sendEmail(claimed, { testMode: false });
  } catch (e) {
    // Roll back the claims so the next run retries instead of silently dropping.
    await supa.from("reminder_log").delete()
      .in("birthday_id", claimed.map((p) => p.id)).eq("reminder_year", year);
    throw e;
  }
  return { sent: true, count: claimed.length, names: claimed.map((p) => p.full_name), target };
}

async function runTestSend() {
  const { due, month, day, year } = await findDue();
  const people: Row[] = due.length
    ? due
    : [{
        id: "sample", full_name: "Sample Person",
        birth_date: `${year}-${pad(month)}-${pad(day)}`,
        department: "Demo", notes: "chocolate cake 🎂",
      }];
  await sendEmail(people, { testMode: true });
  return { sent: true, testMode: true, count: people.length };
}

function sanitize(p: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if (p.full_name !== undefined) out.full_name = String(p.full_name).trim();
  if (p.birth_date !== undefined) out.birth_date = p.birth_date; // 'YYYY-MM-DD'
  if (p.department !== undefined) out.department = p.department || null;
  if (p.notes !== undefined) out.notes = p.notes || null;
  if (p.person_email !== undefined) out.person_email = p.person_email || null;
  if (p.is_active !== undefined) out.is_active = !!p.is_active;
  return out;
}

async function handleWrite(op: string, payload: Record<string, unknown>) {
  if (op === "create") {
    const row = sanitize(payload);
    if (!row.full_name || !row.birth_date) throw new Error("full_name and birth_date are required");
    const { data, error } = await supa.from("birthdays").insert(row).select().single();
    if (error) throw error;
    return data;
  }
  if (op === "update") {
    const { id, ...rest } = payload as { id?: string };
    if (!id) throw new Error("id required");
    const { data, error } = await supa.from("birthdays").update(sanitize(rest)).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }
  if (op === "remove") {
    const id = (payload as { id?: string }).id;
    if (!id) throw new Error("id required");
    const { error } = await supa.from("birthdays").delete().eq("id", id);
    if (error) throw error;
    return { id };
  }
  throw new Error(`unknown op: ${op}`);
}

// ── HTTP entrypoint ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") ?? "";
  const cors = corsHeaders(origin);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405, cors);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const auth = req.headers.get("Authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const isCron =
    !!bearer &&
    ((CRON_SECRET && timingSafeEqual(bearer, CRON_SECRET)) ||
      (SERVICE_ROLE && timingSafeEqual(bearer, SERVICE_ROLE)));

  // 1) Cron
  if (isCron || body.source === "cron") {
    if (!isCron) return json({ error: "unauthorized" }, 401, cors);
    try {
      return json(await runCronReminder(), 200, cors);
    } catch (e) {
      return json({ error: String((e as Error)?.message ?? e) }, 500, cors);
    }
  }

  // 2) Everything else is access-code gated
  const code = String(body.accessCode ?? body.code ?? "");
  const gate = await checkAccessCode(code);

  if (body.mode === "verify") return json({ ok: gate.ok, member: gate.member ?? null }, gate.ok ? 200 : 401, cors);
  if (!gate.ok) return json({ error: "invalid access code" }, 401, cors);

  try {
    if (body.mode === "test") return json(await runTestSend(), 200, cors);
    if (body.mode === "write") {
      const data = await handleWrite(String(body.op ?? ""), (body.payload as Record<string, unknown>) ?? {});
      return json({ ok: true, data }, 200, cors);
    }
    return json({ error: "unknown mode" }, 400, cors);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500, cors);
  }
});
