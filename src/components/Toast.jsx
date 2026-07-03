import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

const ToastContext = createContext(() => {})
export const useToast = () => useContext(ToastContext)

let counter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const push = useCallback((message, type = 'success') => {
    const id = ++counter
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])

  const dismiss = (id) => setToasts((t) => t.filter((x) => x.id !== id))

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-xl border px-4 py-3 shadow-card animate-fade-in-up ${
              t.type === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-brand-200 bg-white text-ink'
            }`}
          >
            {t.type === 'error'
              ? <AlertCircle size={18} className="mt-0.5 shrink-0 text-rose-500" />
              : <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-brand-500" />}
            <p className="flex-1 text-sm">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
