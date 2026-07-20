import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { parseISO, yearsSince } from '../lib/dates'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

// Month grid of celebrations. Days with a birthday/anniversary are highlighted;
// click one to see who. Only month + day matter, so this repeats every year.
export default function CalendarView({ rows }) {
  const today = new Date()
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() + 1 })
  const [selected, setSelected] = useState(null)

  const { cells, byDay, monthTotal } = useMemo(() => {
    const { y, m } = cursor
    const daysInMonth = new Date(y, m, 0).getDate()
    const firstWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7 // Monday = 0

    const byDay = {}
    const push = (day, kind, person) => {
      if (!byDay[day]) byDay[day] = { birthdays: [], anniversaries: [] }
      byDay[day][kind].push(person)
    }
    for (const r of rows) {
      if (!r.is_active) continue
      if (r.birth_date) {
        const d = parseISO(r.birth_date)
        if (d.m === m) push(d.d, 'birthdays', r)
      }
      if (r.hire_date) {
        const d = parseISO(r.hire_date)
        const yrs = yearsSince(r.hire_date)
        if (d.m === m && (yrs == null || yrs >= 1)) push(d.d, 'anniversaries', r)
      }
    }

    const cells = []
    for (let i = 0; i < firstWeekday; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)

    const monthTotal = Object.values(byDay).reduce((n, v) => n + v.birthdays.length + v.anniversaries.length, 0)
    return { cells, byDay, monthTotal }
  }, [rows, cursor])

  const isToday = (d) =>
    d && cursor.y === today.getFullYear() && cursor.m === today.getMonth() + 1 && d === today.getDate()

  const move = (delta) => {
    setSelected(null)
    setCursor(({ y, m }) => {
      const nm = m + delta
      if (nm < 1) return { y: y - 1, m: 12 }
      if (nm > 12) return { y: y + 1, m: 1 }
      return { y, m: nm }
    })
  }

  const sel = selected != null ? byDay[selected] : null

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => move(-1)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-ink" title="Previous month">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <div className="font-bold text-ink">{MONTHS[cursor.m - 1]} {cursor.y}</div>
          <div className="text-xs text-muted">
            {monthTotal} celebration{monthTotal === 1 ? '' : 's'} this month
          </div>
        </div>
        <button onClick={() => move(1)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-ink" title="Next month">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 pb-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const ev = byDay[d]
          const has = Boolean(ev)
          const active = selected === d
          return (
            <button
              key={i}
              onClick={() => setSelected(active ? null : d)}
              disabled={!has}
              className={`relative aspect-square rounded-lg border p-1 text-left transition ${
                active ? 'border-brand-500 bg-brand-100'
                  : has ? 'cursor-pointer border-brand-200 bg-brand-50 hover:border-brand-400'
                    : 'border-transparent'
              } ${isToday(d) ? 'ring-2 ring-accent-400' : ''}`}
            >
              <span className={`text-xs font-semibold ${
                isToday(d) ? 'text-accent-700' : has ? 'text-brand-700' : 'text-slate-500'
              }`}>{d}</span>
              {has && (
                <span className="absolute inset-x-0 bottom-1 flex items-center justify-center gap-0.5 text-[10px] leading-none">
                  {ev.birthdays.length > 0 && <span>🎂</span>}
                  {ev.anniversaries.length > 0 && <span>🎉</span>}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {sel && (
        <div className="mt-3 animate-fade-in rounded-xl border border-brand-200 bg-brand-50/60 p-3">
          <p className="mb-2 text-sm font-semibold text-ink">{MONTHS[cursor.m - 1]} {selected}</p>
          <ul className="space-y-1.5">
            {sel.birthdays.map((p) => (
              <li key={`b${p.id}`} className="flex items-center gap-2 text-sm">
                <span>🎂</span>
                <span className="truncate font-medium text-ink">{p.full_name}</span>
                <span className="shrink-0 text-xs text-muted">birthday</span>
              </li>
            ))}
            {sel.anniversaries.map((p) => {
              const yrs = yearsSince(p.hire_date)
              return (
                <li key={`a${p.id}`} className="flex items-center gap-2 text-sm">
                  <span>🎉</span>
                  <span className="truncate font-medium text-ink">{p.full_name}</span>
                  <span className="shrink-0 text-xs text-muted">{yrs != null ? `${yrs} year${yrs === 1 ? '' : 's'}` : 'anniversary'}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <span>🎂 Birthday</span>
        <span>🎉 Work anniversary</span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded ring-2 ring-accent-400" /> Today
        </span>
      </div>
    </div>
  )
}
