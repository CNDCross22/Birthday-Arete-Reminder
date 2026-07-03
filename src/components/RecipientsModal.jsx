import { useEffect, useState } from 'react'
import { X, Loader2, Trash2, Plus, Mail } from 'lucide-react'
import { listRecipients, addRecipient, removeRecipient, toggleRecipient } from '../lib/api'
import { useToast } from './Toast'

// Manage who receives the heads-up email. Backed by the RLS-locked `recipients`
// table via the gated Edge Function (staff emails never touch the public key).
export default function RecipientsModal({ accessCode, onClose }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()

  const load = async () => {
    try { setRows(await listRecipients(accessCode)) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const add = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setError('')
    try {
      await addRecipient(accessCode, email.trim(), name.trim())
      setEmail('')
      setName('')
      await load()
      toast('Recipient added.')
    } catch (err) {
      setError(err.message || 'Could not add.')
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (r) => {
    try {
      const updated = await toggleRecipient(accessCode, r.id, !r.is_active)
      setRows((p) => p.map((x) => (x.id === r.id ? updated : x)))
    } catch (err) { setError(err.message) }
  }

  const del = async (r) => {
    try {
      await removeRecipient(accessCode, r.id)
      setRows((p) => p.filter((x) => x.id !== r.id))
      toast('Recipient removed.')
    } catch (err) { setError(err.message) }
  }

  const activeCount = rows.filter((r) => r.is_active).length

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-ink/40 p-4 animate-fade-in" onMouseDown={onClose}>
      <div className="w-full max-w-md animate-scale-in rounded-2xl bg-white p-6 shadow-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">Greeting copies (BCC)</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <p className="mb-4 text-sm text-muted">These people are BCC'd on every greeting (e.g. HR) — {activeCount} active.</p>

        <form onSubmit={add} className="mb-4 flex gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="email@aretecare.com.au"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="name"
            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <button type="submit" disabled={busy} className="grid w-10 shrink-0 place-items-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          </button>
        </form>

        {error && <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}

        {loading ? (
          <div className="grid place-items-center py-8"><Loader2 className="animate-spin text-brand-500" size={22} /></div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-muted">
            <Mail className="mx-auto mb-2 text-brand-300" size={22} />No recipients yet. Add one above.
          </div>
        ) : (
          <ul className="max-h-64 space-y-1.5 overflow-y-auto">
            {rows.map((r) => (
              <li key={r.id} className={`flex items-center gap-2 rounded-lg border p-2.5 ${r.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={r.is_active}
                    onChange={() => toggle(r)}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">{r.email}</span>
                    {r.name && <span className="block truncate text-xs text-muted">{r.name}</span>}
                  </span>
                </label>
                <button onClick={() => del(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-xs text-slate-400">
          Greetings always go <strong>to each person</strong>. Ticked people here are <strong>BCC'd</strong> a copy of every greeting — leave empty for none.
        </p>
      </div>
    </div>
  )
}
