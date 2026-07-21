import { Pencil, Trash2, PartyPopper } from 'lucide-react'
import { formatDayMonth, countdownLabel, yearsSince, nextEvent } from '../lib/dates'

// Compact one-line-per-person list, sorted by the soonest celebration.
export default function BirthdayList({ rows, onEdit, onDelete }) {
  const items = rows
    .map((r) => ({ ...r, ev: nextEvent(r) }))
    .filter((r) => r.ev)
    .sort((a, b) => a.ev.days - b.ev.days)

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
        <PartyPopper className="mx-auto mb-2 text-brand-300" size={26} />
        <p className="text-sm text-muted">Nobody here. Add or import people to start greetings.</p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
      {items.map((r) => {
        const today = r.is_active && r.ev.days === 0
        const soon = r.is_active && r.ev.days <= 7
        const years = r.hire_date ? yearsSince(r.hire_date) : null
        return (
          <li
            key={r.id}
            className={`flex items-center gap-2.5 px-3 py-2 transition hover:bg-slate-50 ${
              today ? 'bg-accent-50/60' : ''
            } ${r.is_active ? '' : 'opacity-55'}`}
          >
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-sm ${
              today ? 'bg-accent-500' : soon ? 'bg-brand-500' : 'bg-slate-100'
            }`}>
              {r.ev.kind === 'birthday' ? '🎂' : '🎉'}
            </span>

            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold text-ink">
                {r.full_name}
                {!r.is_active && <span className="ml-1.5 text-[10px] font-normal text-muted">(inactive)</span>}
              </p>
              <p className="truncate text-xs text-muted">
                {r.birth_date && <span>🎂 {formatDayMonth(r.birth_date)}</span>}
                {r.birth_date && r.hire_date && <span className="text-slate-300"> · </span>}
                {r.hire_date && (
                  <span>🎉 {formatDayMonth(r.hire_date)}{years != null ? ` · ${years}y` : ''}</span>
                )}
              </p>
            </div>

            <span className={`shrink-0 whitespace-nowrap text-xs font-semibold ${
              today ? 'text-accent-700' : soon ? 'text-brand-700' : 'text-slate-400'
            }`}>
              {countdownLabel(r.ev.days)}
            </span>

            <div className="flex shrink-0 items-center">
              <button onClick={() => onEdit(r)} className="rounded p-1.5 text-slate-300 hover:bg-slate-100 hover:text-brand-600" title="Edit">
                <Pencil size={14} />
              </button>
              <button onClick={() => onDelete(r)} className="rounded p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-600" title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
