import { useEffect, useState } from 'react'
import { X, Loader2, Clock, Play, RotateCcw, Save } from 'lucide-react'
import { getSettings, setSendHour, runGreetingsNow, resetGreetingLog } from '../lib/api'
import { useToast } from './Toast'

const hourLabel = (h) => {
  const ampm = h < 12 ? 'AM' : 'PM'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}:00 ${ampm}`
}

// Send-time configuration + testing tools, so nobody has to touch SQL.
export default function SettingsModal({ accessCode, onClose }) {
  const [cfg, setCfg] = useState(null)
  const [hour, setHour] = useState(7)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const toast = useToast()

  useEffect(() => {
    getSettings(accessCode)
      .then((d) => { setCfg(d); setHour(d.send_hour) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true); setError(''); setResult('')
    try {
      const d = await setSendHour(accessCode, Number(hour))
      setCfg(d)
      toast(`Greetings will now send at ${hourLabel(d.send_hour)}.`)
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  const runNow = async () => {
    setRunning(true); setError(''); setResult('')
    try {
      const r = await runGreetingsNow(accessCode)
      if (r.sent) {
        setResult(`✅ Sent — ${r.birthdays} birthday, ${r.anniversaries} anniversary.`)
        toast('Greetings sent.')
      } else {
        const extra = r.skipped?.length ? ` · skipped: ${r.skipped.join(', ')}` : ''
        setResult(`Nothing sent — ${r.reason || 'nobody is celebrating today'}${extra}`)
      }
    } catch (e) { setError(e.message) } finally { setRunning(false) }
  }

  const reset = async () => {
    setResetting(true); setError(''); setResult('')
    try {
      await resetGreetingLog(accessCode)
      setResult('History cleared — today\'s greetings can be sent again.')
      toast('Greeting history cleared.')
    } catch (e) { setError(e.message) } finally { setResetting(false) }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-ink/40 p-4 animate-fade-in" onMouseDown={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-card animate-scale-in" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="grid place-items-center py-10"><Loader2 className="animate-spin text-brand-500" size={22} /></div>
        ) : (
          <>
            {/* Send time */}
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Clock size={16} className="text-brand-600" />
                <h3 className="text-sm font-semibold text-ink">Daily send time</h3>
              </div>
              <p className="mb-3 text-xs text-muted">
                Greetings go out at this time, {cfg?.timezone || 'local'} time. It stays correct through daylight saving.
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={hour}
                  onChange={(e) => setHour(Number(e.target.value))}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{hourLabel(h)}</option>
                  ))}
                </select>
                <button
                  onClick={save}
                  disabled={saving || hour === cfg?.send_hour}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save
                </button>
              </div>
              {cfg && (
                <p className="mt-2 text-xs text-slate-400">
                  Currently <strong>{hourLabel(cfg.send_hour)}</strong> · it's {hourLabel(cfg.local_hour)} there now
                </p>
              )}
            </div>

            {/* Testing */}
            <div className="mt-4 rounded-xl border border-accent-200 bg-accent-50/40 p-4">
              <h3 className="mb-1 text-sm font-semibold text-ink">Testing</h3>
              <p className="mb-3 text-xs text-muted">
                Send right now without waiting for the scheduled time.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={runNow}
                  disabled={running}
                  className="flex items-center gap-1.5 rounded-lg bg-accent-600 px-3 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
                >
                  {running ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} Run greetings now
                </button>
                <button
                  onClick={reset}
                  disabled={resetting}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50 disabled:opacity-60"
                >
                  {resetting ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />} Reset history
                </button>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                <strong>Run now</strong> greets anyone whose birthday or work anniversary is today.
                Each person is only greeted once per year — use <strong>Reset history</strong> to allow a repeat while testing.
              </p>
            </div>

            {result && (
              <p className="mt-3 rounded-lg border border-brand-200 bg-brand-50 p-2.5 text-xs text-ink">{result}</p>
            )}
            {error && (
              <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">{error}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
