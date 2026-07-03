import { Loader2 } from 'lucide-react'
import { useState } from 'react'

export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try { await onConfirm() } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 animate-fade-in" onMouseDown={onCancel}>
      <div className="w-full max-w-sm animate-scale-in rounded-2xl bg-white p-6 shadow-card" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-ink">{title}</h2>
        <p className="mt-1 text-sm text-muted">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-medium text-muted hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={go}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
