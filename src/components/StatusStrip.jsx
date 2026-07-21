import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, Moon } from 'lucide-react'
import { getStatus } from '../lib/api'

const at = (iso, tz) => {
  try {
    return new Date(iso).toLocaleTimeString('en-AU', { timeZone: tz, hour: 'numeric', minute: '2-digit' })
  } catch { return '' }
}
const on = (iso, tz) => {
  try {
    return new Date(iso).toLocaleDateString('en-AU', { timeZone: tz, day: 'numeric', month: 'short' })
  } catch { return '' }
}

// Answers the question people actually have about automation: "did it run?"
export default function StatusStrip({ accessCode, refreshKey }) {
  const [s, setS] = useState(null)

  useEffect(() => {
    let alive = true
    getStatus(accessCode).then((d) => { if (alive) setS(d) }).catch(() => {})
    return () => { alive = false }
  }, [accessCode, refreshKey])

  if (!s) return null

  const { due_today: due, sent_today: sent, last_sent_at: last, send_time, timezone } = s
  const allSent = due > 0 && sent >= due
  const pending = due > 0 && sent < due

  let Icon = Moon
  let tone = 'border-slate-200 bg-white text-muted'
  let text = (
    <>Nothing due today{last && <> · last greeting sent {on(last, timezone)}</>}</>
  )

  if (allSent) {
    Icon = CheckCircle2
    tone = 'border-brand-300 bg-brand-50 text-ink'
    text = (
      <>All <strong>{due}</strong> greeting{due === 1 ? '' : 's'} sent today
        {last && <> at <strong>{at(last, timezone)}</strong></>}</>
    )
  } else if (pending) {
    Icon = Clock
    tone = 'border-accent-300 bg-accent-50 text-ink'
    text = (
      <><strong>{due}</strong> greeting{due === 1 ? '' : 's'} due today — sending at <strong>{send_time}</strong></>
    )
  }

  return (
    <div className={`mb-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${tone}`}>
      <Icon size={16} className="shrink-0" />
      <span className="min-w-0 truncate">{text}</span>
    </div>
  )
}
