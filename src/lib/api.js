import { supabase, hasSupabaseConfig } from './supabase'

// Two backends behind one API:
//   • Supabase mode  — reads come straight from the table (RLS: anon can SELECT);
//     writes + test-send go through the access-code-gated Edge Function.
//   • Demo mode      — no env configured → everything is localStorage, no code.

const FN_URL = import.meta.env.VITE_FUNCTIONS_URL
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
const LOCAL_KEY = 'arete-bday-demo'

export const isDemo = !hasSupabaseConfig
export const hasFunctions = Boolean(FN_URL)

// ── Edge Function call ────────────────────────────────────────────────────────
async function callFn(payload) {
  if (!FN_URL) throw new Error('VITE_FUNCTIONS_URL is not set — cannot reach the backend.')
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
    },
    body: JSON.stringify(payload),
  })
  let data = {}
  try { data = await res.json() } catch { /* non-JSON */ }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

// ── localStorage demo backend ────────────────────────────────────────────────
function localRead() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') } catch { return [] }
}
function localWrite(rows) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(rows))
}
function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function listBirthdays() {
  if (isDemo) return localRead()
  const { data, error } = await supabase.from('birthdays').select('*').order('full_name')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function verifyCode(accessCode) {
  await callFn({ mode: 'verify', accessCode })
  return true
}

export async function createBirthday(accessCode, payload) {
  if (isDemo) {
    const rows = localRead()
    const row = { id: uid(), is_active: true, created_at: new Date().toISOString(), ...payload }
    localWrite([...rows, row])
    return row
  }
  const { data } = await callFn({ mode: 'write', op: 'create', accessCode, payload })
  return data
}

export async function updateBirthday(accessCode, payload) {
  if (isDemo) {
    const rows = localRead().map((r) => (r.id === payload.id ? { ...r, ...payload } : r))
    localWrite(rows)
    return rows.find((r) => r.id === payload.id)
  }
  const { data } = await callFn({ mode: 'write', op: 'update', accessCode, payload })
  return data
}

export async function removeBirthday(accessCode, id) {
  if (isDemo) {
    localWrite(localRead().filter((r) => r.id !== id))
    return { id }
  }
  const { data } = await callFn({ mode: 'write', op: 'remove', accessCode, payload: { id } })
  return data
}

export async function sendTestEmail(accessCode) {
  if (isDemo) throw new Error('Test email needs the live Supabase backend (demo mode is offline).')
  return callFn({ mode: 'test', accessCode })
}

// Bulk import from CSV/Excel. Dedups on name + date. Works in demo mode too.
export async function importBirthdays(accessCode, rows) {
  if (isDemo) {
    const existing = localRead()
    const seen = new Set(existing.map((r) => `${(r.full_name || '').toLowerCase()}|${r.birth_date}`))
    const add = []
    for (const r of rows) {
      const k = `${(r.full_name || '').toLowerCase()}|${r.birth_date}`
      if (seen.has(k)) continue
      seen.add(k)
      add.push({ id: uid(), is_active: true, created_at: new Date().toISOString(), ...r })
    }
    localWrite([...existing, ...add])
    return { imported: add.length, skipped: rows.length - add.length, total: rows.length }
  }
  const { data } = await callFn({ mode: 'write', op: 'createMany', accessCode, payload: { rows } })
  return data
}

// Recipients (who gets the heads-up) — live backend only; gated by the Edge Function.
export async function listRecipients(accessCode) {
  const { data } = await callFn({ mode: 'recipients', op: 'list', accessCode })
  return data ?? []
}
export async function addRecipient(accessCode, email, name) {
  const { data } = await callFn({ mode: 'recipients', op: 'add', accessCode, payload: { email, name } })
  return data
}
export async function removeRecipient(accessCode, id) {
  return callFn({ mode: 'recipients', op: 'remove', accessCode, payload: { id } })
}
export async function toggleRecipient(accessCode, id, is_active) {
  const { data } = await callFn({ mode: 'recipients', op: 'toggle', accessCode, payload: { id, is_active } })
  return data
}

// Settings + testing tools (live backend only).
export async function getSettings(accessCode) {
  const { data } = await callFn({ mode: 'settings', op: 'get', accessCode })
  return data
}
export async function setSendHour(accessCode, send_hour) {
  const { data } = await callFn({ mode: 'settings', op: 'set', accessCode, payload: { send_hour } })
  return data
}
// Send today's greetings immediately, ignoring the scheduled hour.
export async function runGreetingsNow(accessCode) {
  return callFn({ mode: 'run', accessCode })
}
// Clear the "already greeted" history so a send can be repeated (testing).
export async function resetGreetingLog(accessCode) {
  return callFn({ mode: 'resetLog', accessCode })
}
