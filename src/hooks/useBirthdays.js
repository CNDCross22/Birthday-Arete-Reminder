import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { listBirthdays } from '../lib/api'

function applyChange(prev, payload) {
  const { eventType, new: n, old: o } = payload
  if (eventType === 'INSERT') {
    if (prev.some((r) => r.id === n.id)) return prev
    return [...prev, n]
  }
  if (eventType === 'UPDATE') return prev.map((r) => (r.id === n.id ? n : r))
  if (eventType === 'DELETE') return prev.filter((r) => r.id !== o.id)
  return prev
}

export function useBirthdays() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    try {
      const data = await listBirthdays()
      setRows(data)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  // Live updates (Supabase mode only) — no manual refresh needed across tabs/devices.
  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel('birthdays-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'birthdays' }, (payload) => {
        setRows((prev) => applyChange(prev, payload))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  return { rows, loading, error, reload, setRows }
}
