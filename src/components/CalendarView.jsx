import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { parseISO, yearsSince } from '../lib/dates'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAYS_MIN = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

// Name chips that fit in a day cell before it becomes "+N more".
const VIS_SM = 2  // tablet-height cells
const VIS_LG = 4  // tall cells on a desktop monitor

// Outlook-style month view: names appear on the day cells (desktop) and in an
// agenda underneath (always). Only month + day matter, so it repeats yearly.
export default function CalendarView({ rows }) {
  const today = new Date()
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() + 1 })

  const { cells, byDay, agenda } = useMemo(() => {
    const { y, m } = cursor
    const daysInMonth = new Date(y, m, 0).getDate()
    const firstWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7 // Monday = 0

    const byDay = {}
    const add = (day, ev) => { (byDay[day] = byDay[day] || []).push(ev) }
    for (const r of rows) {
      if (!r.is_active) continue
      if (r.birth_date) {
        const d = parseISO(r.birth_date)
        if (d.m === m) add(d.d, { kind: 'birthday', person: r })
      }
      if (r.hire_date) {
        const d = parseISO(r.hire_date)
        const yrs = yearsSince(r.hire_date)
        if (d.m === m && (yrs == null || yrs >= 1)) add(d.d, { kind: 'anniversary', person: r, years: yrs })
      }
    }

    const cells = []
    for (let i = 0; i < firstWeekday; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)

    const agenda = Object.keys(byDay).map(Number).sort((a, b) => a - b)
      .flatMap((day) => byDay[day].map((ev) => ({ day, ...ev })))

    return { cells, byDay, agenda }
  }, [rows, cursor])

  const isToday = (d) =>
    d && cursor.y === today.getFullYear() && cursor.m === today.getMonth() + 1 && d === today.getDate()

  const move = (delta) => setCursor(({ y, m }) => {
    const nm = m + delta
    if (nm < 1) return { y: y - 1, m: 12 }
    if (nm > 12) return { y: y + 1, m: 1 }
    return { y, m: nm }
  })

  const weekdayOf = (day) => DOW[new Date(cursor.y, cursor.m - 1, day).getDay()]

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-soft sm:p-4 lg:p-5">
      {/* Month nav */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <button onClick={() => move(-1)} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-ink" title="Previous month">
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0 text-center">
          <div className="truncate text-base font-bold text-ink">{MONTHS[cursor.m - 1]} {cursor.y}</div>
          <div className="text-xs text-muted">
            {agenda.length} celebration{agenda.length === 1 ? '' : 's'}
          </div>
        </div>
        <button onClick={() => move(1)} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-ink" title="Next month">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Weekday header — abbreviated on phones */}
      <div className="grid grid-cols-7 gap-0.5 pb-1 sm:gap-1">
        {WEEKDAYS.map((w, i) => (
          <div key={w + i} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:text-[11px] lg:text-xs">
            <span className="sm:hidden">{WEEKDAYS_MIN[i]}</span>
            <span className="hidden sm:inline">{w}</span>
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="min-h-[46px] sm:min-h-[92px] lg:min-h-[116px]" />
          const evs = byDay[d] || []
          const has = evs.length > 0
          return (
            <div
              key={i}
              className={`min-h-[46px] overflow-hidden rounded-lg border p-1 sm:min-h-[92px] lg:min-h-[116px] lg:p-1.5 ${
                has ? 'border-brand-200 bg-brand-50/60' : 'border-slate-100'
              } ${isToday(d) ? 'ring-2 ring-accent-400' : ''}`}
            >
              <div className="flex items-start justify-between gap-1">
                <span className={`text-[11px] font-semibold sm:text-xs lg:text-sm ${
                  isToday(d) ? 'text-accent-700' : has ? 'text-brand-700' : 'text-slate-400'
                }`}>{d}</span>
                {/* phones: compact markers only (names live in the agenda below) */}
                {has && (
                  <span className="text-[9px] leading-none sm:hidden">
                    {evs.some((e) => e.kind === 'birthday') && '🎂'}
                    {evs.some((e) => e.kind === 'anniversary') && '🎉'}
                  </span>
                )}
              </div>

              {/* desktop: Outlook-style name chips */}
              {has && (
                <div className="mt-1 hidden flex-col gap-0.5 sm:flex">
                  {/* Taller cells on wide screens fit more names, so chips 3-4
                      appear there and the overflow count adjusts to match. */}
                  {evs.slice(0, VIS_LG).map((ev, k) => (
                    <span
                      key={k}
                      title={`${ev.person.full_name} — ${ev.kind === 'birthday' ? 'birthday' : `${ev.years} years`}`}
                      className={`items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] leading-tight lg:text-xs ${
                        k < VIS_SM ? 'flex' : 'hidden lg:flex'
                      } ${ev.kind === 'birthday' ? 'bg-accent-100 text-accent-800' : 'bg-brand-100 text-brand-800'}`}
                    >
                      <span className="shrink-0">{ev.kind === 'birthday' ? '🎂' : '🎉'}</span>
                      <span className="truncate">{ev.person.full_name}</span>
                    </span>
                  ))}
                  {evs.length > VIS_SM && (
                    <span className="px-1 text-[10px] font-semibold text-brand-600 lg:hidden">
                      +{evs.length - VIS_SM} more
                    </span>
                  )}
                  {evs.length > VIS_LG && (
                    <span className="hidden px-1 text-xs font-semibold text-brand-600 lg:block">
                      +{evs.length - VIS_LG} more
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Agenda — always visible, so names are readable on every screen size */}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {MONTHS[cursor.m - 1]} celebrations
        </p>
        {agenda.length === 0 ? (
          <p className="py-2 text-sm text-muted">Nothing in {MONTHS[cursor.m - 1]}.</p>
        ) : (
          <ul className="space-y-1">
            {agenda.map((ev, i) => (
              <li
                key={i}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                  isToday(ev.day) ? 'bg-accent-50 ring-1 ring-accent-200' : 'hover:bg-slate-50'
                }`}
              >
                <span className="w-14 shrink-0 text-xs font-semibold text-muted">
                  {weekdayOf(ev.day)} {ev.day}
                </span>
                <span className="shrink-0">{ev.kind === 'birthday' ? '🎂' : '🎉'}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{ev.person.full_name}</span>
                <span className="shrink-0 text-xs text-muted">
                  {ev.kind === 'birthday' ? 'birthday' : `${ev.years} yr${ev.years === 1 ? '' : 's'}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>🎂 Birthday</span>
        <span>🎉 Work anniversary</span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded ring-2 ring-accent-400" /> Today
        </span>
      </div>
    </div>
  )
}
