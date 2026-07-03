import { createContext, useContext, useEffect, useState } from 'react'
import { KeyRound, Loader2, Cake } from 'lucide-react'
import { isDemo, hasFunctions, verifyCode } from '../lib/api'

const KEY = 'arete-bday-code'
const AccessContext = createContext({ code: '', signOut: () => {} })
export const useAccess = () => useContext(AccessContext)

// In demo mode there is no backend to verify against → open the app directly.
// In Supabase mode the team access code is verified by the Edge Function and
// then held in memory + localStorage; every write sends it along.
export function AccessGate({ children }) {
  const [code, setCode] = useState(() => localStorage.getItem(KEY) || '')
  const [unlocked, setUnlocked] = useState(isDemo)
  const [checking, setChecking] = useState(!isDemo && Boolean(localStorage.getItem(KEY)))

  // Re-validate a stored code on load.
  useEffect(() => {
    if (isDemo || !checking) return
    verifyCode(code)
      .then(() => setUnlocked(true))
      .catch(() => { localStorage.removeItem(KEY); setCode('') })
      .finally(() => setChecking(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = () => {
    localStorage.removeItem(KEY)
    setCode('')
    setUnlocked(false)
  }

  if (unlocked) {
    return <AccessContext.Provider value={{ code, signOut }}>{children}</AccessContext.Provider>
  }

  return (
    <Login
      checking={checking}
      onUnlock={(c) => {
        localStorage.setItem(KEY, c)
        setCode(c)
        setUnlocked(true)
      }}
    />
  )
}

function Login({ onUnlock, checking }) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await verifyCode(value.trim())
      onUnlock(value.trim())
    } catch (err) {
      setError(err.message?.includes('401') || err.message?.includes('invalid')
        ? 'That access code was not recognised.'
        : (err.message || 'Sign-in failed.'))
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="grid min-h-full place-items-center">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    )
  }

  return (
    <div className="grid min-h-full place-items-center p-6">
      <div className="w-full max-w-sm animate-scale-in rounded-2xl border border-slate-200 bg-white p-7 shadow-card">
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <Cake size={24} />
          </div>
          <h1 className="text-lg font-bold text-ink">Arete Care · Birthday Reminders</h1>
          <p className="mt-1 text-sm text-muted">Enter the team access code to continue.</p>
        </div>

        {!hasFunctions && (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
            <strong>VITE_FUNCTIONS_URL is not set.</strong> The backend function URL is required to sign in.
          </p>
        )}

        <form onSubmit={submit} className="space-y-2.5">
          <div className="relative">
            <KeyRound size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Access code"
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !value.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Checking…' : 'Continue'}
          </button>
          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">{error}</p>
          )}
        </form>
      </div>
    </div>
  )
}
