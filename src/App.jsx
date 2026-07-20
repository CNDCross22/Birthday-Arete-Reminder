import { useMemo, useState } from 'react'
import { Plus, Search, Send, LogOut, Loader2, WifiOff, Upload, Users, CalendarDays, List, Settings } from 'lucide-react'
import { useBirthdays } from './hooks/useBirthdays'
import { useToast } from './components/Toast'
import { useAccess } from './auth/AccessGate'
import { isDemo, hasFunctions, createBirthday, updateBirthday, removeBirthday, sendTestEmail, importBirthdays } from './lib/api'
import { nextEvent } from './lib/dates'
import BirthdayList from './components/BirthdayList'
import BirthdayForm from './components/BirthdayForm'
import ConfirmDialog from './components/ConfirmDialog'
import ImportModal from './components/ImportModal'
import RecipientsModal from './components/RecipientsModal'
import CalendarView from './components/CalendarView'
import SettingsModal from './components/SettingsModal'

export default function App() {
  const { rows, loading, error, reload } = useBirthdays()
  const { code, signOut } = useAccess()
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null) // row or {} for new
  const [deleting, setDeleting] = useState(null)
  const [testing, setTesting] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showRecipients, setShowRecipients] = useState(false)
  const [view, setView] = useState('list')
  const [showSettings, setShowSettings] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      [r.full_name, r.person_email, r.department].filter(Boolean).some((v) => v.toLowerCase().includes(q)),
    )
  }, [rows, query])

  const todayCount = useMemo(
    () => rows.filter((r) => { const ev = nextEvent(r); return r.is_active && ev && ev.days === 0 }).length,
    [rows],
  )

  const save = async (payload, wasEditing) => {
    if (wasEditing) await updateBirthday(code, payload)
    else await createBirthday(code, payload)
    await reload()
    toast(wasEditing ? 'Person updated.' : 'Person added.')
  }

  const confirmDelete = async () => {
    await removeBirthday(code, deleting.id)
    setDeleting(null)
    await reload()
    toast('Person removed.')
  }

  const runTest = async () => {
    setTesting(true)
    try {
      const res = await sendTestEmail(code)
      toast(`Test greeting sent to ${res.to}. Check the inbox.`)
    } catch (e) {
      toast(e.message || 'Test failed.', 'error')
    } finally {
      setTesting(false)
    }
  }

  const doImport = async (rows) => {
    const res = await importBirthdays(code, rows)
    await reload()
    setShowImport(false)
    toast(`Imported ${res.imported}${res.skipped ? ` (${res.skipped} already existed)` : ''}.`)
  }

  return (
    <div className={`mx-auto min-h-full px-4 pb-24 pt-6 ${view === 'calendar' ? 'max-w-4xl' : 'max-w-2xl'}`}>
      {/* Header */}
      <header className="mb-5 flex items-center gap-3">
        <img src={`${import.meta.env.BASE_URL}arete-logo.png`} alt="Arete Care" className="h-10 w-10 rounded-lg object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
        <div className="flex-1">
          <h1 className="text-xl font-extrabold leading-tight text-ink">Birthdays &amp; Anniversaries</h1>
          <p className="text-sm text-muted">
            A warm greeting to each person on their birthday and work anniversary.
          </p>
        </div>
        {!isDemo && (
          <button onClick={signOut} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-ink" title="Sign out">
            <LogOut size={18} />
          </button>
        )}
      </header>

      {isDemo && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <WifiOff size={16} />
          <span><strong>Demo mode</strong> — saving to this browser only. Add Supabase env vars to go live.</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, team…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white">
          <button
            onClick={() => setView('list')}
            className={`px-3 py-2.5 ${view === 'list' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            title="List view"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`px-3 py-2.5 ${view === 'calendar' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            title="Calendar view"
          >
            <CalendarDays size={16} />
          </button>
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50"
          title="Import from CSV or Excel"
        >
          <Upload size={16} /> <span className="hidden sm:inline">Import</span>
        </button>
        {!isDemo && hasFunctions && (
          <button
            onClick={() => setShowRecipients(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50"
            title="BCC copies of every greeting (e.g. HR)"
          >
            <Users size={16} /> <span className="hidden sm:inline">Copies</span>
          </button>
        )}
        {!isDemo && hasFunctions && (
          <button
            onClick={runTest}
            disabled={testing}
            className="flex items-center gap-2 rounded-lg border border-accent-200 bg-white px-3 py-2.5 text-sm font-semibold text-accent-700 hover:bg-accent-50 disabled:opacity-60"
            title="Preview a greeting"
          >
            {testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            <span className="hidden sm:inline">Test</span>
          </button>
        )}
        {!isDemo && hasFunctions && (
          <button
            onClick={() => setShowSettings(true)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-500 hover:bg-slate-50 hover:text-ink"
            title="Settings — send time & testing"
          >
            <Settings size={16} />
          </button>
        )}
        <button
          onClick={() => setEditing({})}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Summary chip */}
      {!loading && !error && (
        <p className="mb-3 text-sm text-muted">
          {rows.length} {rows.length === 1 ? 'person' : 'people'}
          {todayCount > 0 && (
            <span className="ml-1 rounded-full bg-accent-50 px-2 py-0.5 font-semibold text-accent-700">
              🎉 {todayCount} celebrating today
            </span>
          )}
        </p>
      )}

      {/* Body */}
      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="animate-spin text-brand-500" size={26} /></div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Couldn’t load people: {error}
        </div>
      ) : view === 'calendar' ? (
        <CalendarView rows={filtered} />
      ) : (
        <BirthdayList rows={filtered} onEdit={setEditing} onDelete={setDeleting} />
      )}

      {/* Modals */}
      {editing && (
        <BirthdayForm initial={editing.id ? editing : null} onClose={() => setEditing(null)} onSave={save} />
      )}
      {deleting && (
        <ConfirmDialog
          title="Remove person?"
          message={`This removes ${deleting.full_name} from greetings.`}
          confirmLabel="Remove"
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      )}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={doImport} />}
      {showRecipients && <RecipientsModal accessCode={code} onClose={() => setShowRecipients(false)} />}
      {showSettings && <SettingsModal accessCode={code} onClose={() => setShowSettings(false)} />}
    </div>
  )
}
