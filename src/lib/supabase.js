import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

// Both env vars present → the app talks to Supabase. Otherwise it runs in a
// browser-only DEMO mode backed by localStorage (see src/lib/api.js).
export const hasSupabaseConfig = Boolean(url && anon)

export const supabase = hasSupabaseConfig ? createClient(url, anon) : null
