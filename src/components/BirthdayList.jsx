import { Pencil, Trash2, Cake } from 'lucide-react'
import { daysUntilNextBirthday, formatDayMonth, countdownLabel, turningAge } from '../lib/dates'

// Sorted soonest-first; anything within the reminder window is highlighted.
export default function BirthdayList({ rows, leadDays = 7, onEdit, onDelete }) {
  const items = rows
    .map((r) => ({ ...r, days: daysUntilNextBirthday(r.birth_date) }))
    .sort((a, b) => a.days - b.days)

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
        <Cake className="mx-auto mb-3 text-brand-300" size={32} />
        <p className="text-sm text-muted">No birthdays yet. Add your first one to start the reminders.</p>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {items.map((r) => {
        const soon = r.is_active && r.days <= leadDays
        const age = turningAge(r.birth_date)
        return (
          <li
            key={r.id}
            className={`flex items-center gap-3 rounded-xl border bg-white p-3 shadow-soft transition ${
              soon ? 'border-brand-300 ring-1 ring-brand-100' : 'border-slate-200'
            } ${r.is_active ? '' : 'opacity-60'}`}
          >
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg text-sm font-bold ${
              soon ? 'bg-brand-500 text-white' : 'bg-brand-50 text-brand-600'
            }`}>
              {r.days}d
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-semibold text-ink">{r.full_name}</p>
                {!r.is_active && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-muted">inactive</span>}
              </div>
              <p className="truncate text-sm text-muted">
                {formatDayMonth(r.birth_date)}
                {age != null && ` · turning ${age}`}
                {r.department && ` · ${r.department}`}
              </p>
            </div>

            <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline ${
              soon ? 'bg-accent-50 text-accent-700' : 'text-muted'
            }`}>
              {countdownLabel(r.days)}
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
