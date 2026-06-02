import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../api'
import { drain, pendingCount, type QueueItem } from './queue'

export type ConnectionState = 'online' | 'offline' | 'degraded'

interface ConnectionInfo {
  state: ConnectionState
  pending: number
  lastSyncedAt: number | null
}

// Performs the actual HTTP replay of one queued item to the server.
async function sendItem(item: QueueItem): Promise<void> {
  await api.request({
    method: item.method,
    url: item.url,
    data: item.body,
    headers: { 'Idempotency-Key': item.idempotencyKey },
  })
}

/**
 * Tracks connectivity and auto-drains the offline outbox when online.
 *
 *   online   — navigator online AND last server probe succeeded
 *   degraded — navigator online but probe failing (captive portal / dead link)
 *   offline  — navigator reports offline
 *
 * The Caribbean connectivity profile (flaky links, captive portals) is exactly
 * why we probe the server rather than trusting navigator.onLine alone.
 */
export function useConnection(probeMs = 15000): ConnectionInfo & { syncNow: () => Promise<void> } {
  const [state, setState] = useState<ConnectionState>(navigator.onLine ? 'online' : 'offline')
  const [pending, setPending] = useState(0)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const draining = useRef(false)

  const refreshPending = useCallback(async () => {
    try { setPending(await pendingCount()) } catch { /* ignore */ }
  }, [])

  const syncNow = useCallback(async () => {
    if (draining.current || !navigator.onLine) return
    draining.current = true
    try {
      const { sent } = await drain(sendItem)
      if (sent > 0) setLastSyncedAt(Date.now())
      setState('online')
    } catch {
      setState('degraded')
    } finally {
      draining.current = false
      await refreshPending()
    }
  }, [refreshPending])

  // Probe the server periodically; flip state and drain on recovery.
  useEffect(() => {
    let cancelled = false
    async function probe() {
      if (!navigator.onLine) { setState('offline'); return }
      try {
        await api.get('/sync/status', { timeout: 8000 })
        if (cancelled) return
        setState('online')
        void syncNow()
      } catch {
        if (!cancelled) setState('degraded')
      }
    }
    void probe()
    void refreshPending()
    const id = setInterval(probe, probeMs)
    return () => { cancelled = true; clearInterval(id) }
  }, [probeMs, syncNow, refreshPending])

  // React to browser online/offline events for instant feedback.
  useEffect(() => {
    const goOnline = () => { setState('online'); void syncNow() }
    const goOffline = () => setState('offline')
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [syncNow])

  return { state, pending, lastSyncedAt, syncNow }
}
