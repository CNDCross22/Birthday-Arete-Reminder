import { Pencil, Trash2, PartyPopper } from 'lucide-react'
import { formatDayMonth, countdownLabel, yearsSince, nextEvent } from '../lib/dates'

// Each person shows their birthday and/or work anniversary; sorted by the
// soonest upcoming celebration, with today/this-week highlighted.
export default function BirthdayList({ rows, onEdit, onDelete }) {
  const items = rows
    .map((r) => ({ ...r, ev: nextEvent(r) }))
    .filter((r) => r.ev)
    .sort((a, b) => a.ev.days - b.ev.days)

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
        <PartyPopper className="mx-auto mb-3 text-brand-300" size={32} />
        <p className="text-sm text-muted">No one added yet. Add a person (name + email + a birthday and/or date hired) to start greetings.</p>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {items.map((r) => {
        const today = r.is_active && r.ev.days === 0
        const soon = r.is_active && r.ev.days <= 7
        const years = r.hire_date ? yearsSince(r.hire_date) : null
        const icon = r.ev.kind === 'birthday' ? '🎂' : '🎉'
        return (
          <li
            key={r.id}
            className={`flex items-center gap-3 rounded-xl border bg-white p-3 shadow-soft transition ${
              today ? 'border-accent-300 ring-1 ring-accent-100' : soon ? 'border-brand-300 ring-1 ring-brand-100' : 'border-slate-200'
            } ${r.is_active ? '' : 'opacity-60'}`}
          >
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg text-xl ${
              today ? 'bg-accent-500' : soon ? 'bg-brand-500' : 'bg-brand-50'
            }`}>
              {icon}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-semibold text-ink">{r.full_name}</p>
                {!r.is_active && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-muted">inactive</span>}
              </div>
              {r.person_email && <p className="truncate text-xs text-slate-400">{r.person_email}</p>}
              <p className="truncate text-sm text-muted">
                {r.birth_date && <span>🎂 {formatDayMonth(r.birth_date)}</span>}
                {r.birth_date && r.hire_date && ' · '}
                {r.hire_date && <span>🎉 {formatDayMonth(r.hire_date)}{years != null ? ` (${years} yr${years === 1 ? '' : 's'})` : ''}</span>}
                {r.department && ` · ${r.department}`}
              </p>
            </div>

            <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline ${
              today ? 'bg-accent-50 text-accent-700' : soon ? 'bg-brand-50 text-brand-700' : 'text-muted'
            }`}>
              {countdownLabel(r.ev.days)}
            </span>

            <div className="flex shrink-0 items-center gap-1">
              <button onClick={() => onEdit(r)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="Edit">
                <Pencil size={16} />
              </button>
              <button onClick={() => onDelete(r)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Delete">
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
