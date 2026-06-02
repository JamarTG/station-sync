// Durable client-side outbox — the first offline boundary (client ↔ edge).
//
// Every mutating action a terminal performs is enqueued here *first* (so a
// receipt can print instantly), then drained to the edge API. If the edge or
// network is down, items persist in IndexedDB across reloads and replay on
// reconnect with exponential backoff. Nothing is ever silently dropped.

import { idbPut, idbGetAll, idbDelete, idbCount, OUTBOX_STORE, isOfflineStorageAvailable } from './db'

export type QueueItemType = 'sale' | 'payroll' | 'inventory' | 'tank_reading' | 'loyalty' | 'attendance' | 'generic'
export type QueueStatus = 'queued' | 'inflight' | 'failed' | 'dead'

export interface QueueItem {
  id: string
  type: QueueItemType
  priority: 1 | 2 | 3 // 1 = financial (drained first)
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  url: string // edge API path, e.g. '/local/sales' or a '/v1/...' path
  body: unknown
  idempotencyKey: string
  attempts: number
  maxAttempts: number
  nextRetryAt: number
  status: QueueStatus
  lastError?: string
  createdAt: number
}

const MAX_ATTEMPTS = 25
const BACKOFF_CAP_MS = 5 * 60 * 1000

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/** Enqueue a mutation. Returns the item id (also used as idempotency key). */
export async function enqueue(opts: {
  type: QueueItemType
  priority?: 1 | 2 | 3
  method?: QueueItem['method']
  url: string
  body: unknown
}): Promise<string> {
  const id = uuid()
  const item: QueueItem = {
    id,
    type: opts.type,
    priority: opts.priority ?? (opts.type === 'sale' ? 1 : 2),
    method: opts.method ?? 'POST',
    url: opts.url,
    body: opts.body,
    idempotencyKey: id,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    nextRetryAt: Date.now(),
    status: 'queued',
    createdAt: Date.now(),
  }
  if (!isOfflineStorageAvailable()) throw new Error('offline storage unavailable')
  await idbPut(OUTBOX_STORE, item)
  return id
}

export async function pendingCount(): Promise<number> {
  if (!isOfflineStorageAvailable()) return 0
  const all = await idbGetAll<QueueItem>(OUTBOX_STORE)
  return all.filter((i) => i.status === 'queued' || i.status === 'failed').length
}

export async function deadCount(): Promise<number> {
  if (!isOfflineStorageAvailable()) return 0
  const all = await idbGetAll<QueueItem>(OUTBOX_STORE)
  return all.filter((i) => i.status === 'dead').length
}

export async function totalCount(): Promise<number> {
  return idbCount(OUTBOX_STORE)
}

function backoff(attempts: number): number {
  const ms = Math.min(1000 * 2 ** attempts, BACKOFF_CAP_MS)
  return ms + Math.floor(Math.random() * 1000) // jitter
}

/**
 * Drain the outbox to the server. `send` performs the actual HTTP call and
 * resolves on 2xx, rejects otherwise. Items are processed financial-first, then
 * by age. On failure each item is rescheduled with exponential backoff; after
 * maxAttempts it moves to the dead-letter state for manual review.
 */
export async function drain(
  send: (item: QueueItem) => Promise<void>,
): Promise<{ sent: number; failed: number }> {
  if (!isOfflineStorageAvailable()) return { sent: 0, failed: 0 }
  const now = Date.now()
  const all = await idbGetAll<QueueItem>(OUTBOX_STORE)
  const ready = all
    .filter((i) => (i.status === 'queued' || i.status === 'failed') && i.nextRetryAt <= now)
    .sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt)

  let sent = 0
  let failed = 0
  for (const item of ready) {
    item.status = 'inflight'
    await idbPut(OUTBOX_STORE, item)
    try {
      await send(item)
      await idbDelete(OUTBOX_STORE, item.id) // ack → remove
      sent++
    } catch (err) {
      item.attempts++
      item.lastError = err instanceof Error ? err.message : String(err)
      if (item.attempts >= item.maxAttempts) {
        item.status = 'dead'
      } else {
        item.status = 'failed'
        item.nextRetryAt = Date.now() + backoff(item.attempts)
      }
      await idbPut(OUTBOX_STORE, item)
      failed++
    }
  }
  return { sent, failed }
}

/** Re-queue dead-lettered items (manual operator action). */
export async function retryDead(): Promise<number> {
  if (!isOfflineStorageAvailable()) return 0
  const all = await idbGetAll<QueueItem>(OUTBOX_STORE)
  const dead = all.filter((i) => i.status === 'dead')
  for (const item of dead) {
    item.status = 'queued'
    item.attempts = 0
    item.nextRetryAt = Date.now()
    await idbPut(OUTBOX_STORE, item)
  }
  return dead.length
}

export async function listItems(): Promise<QueueItem[]> {
  if (!isOfflineStorageAvailable()) return []
  return idbGetAll<QueueItem>(OUTBOX_STORE)
}
