import { Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'
import { useConnection } from '../lib/offline/useConnection'

/**
 * Compact connectivity + offline-queue pill for the TopBar.
 *
 * online   → green cloud, optional "syncing N" while the outbox drains
 * degraded → amber (navigator online but the server probe is failing)
 * offline  → red cloud-off; shows how many writes are buffered locally
 *
 * Clicking it forces an immediate sync attempt.
 */
export function SyncStatusIndicator() {
  const { state, pending, syncNow } = useConnection()

  const cfg = {
    online:   { icon: Cloud,    label: 'Online',  cls: 'text-emerald-600 dark:text-emerald-400' },
    degraded: { icon: AlertTriangle, label: 'Reconnecting', cls: 'text-amber-600 dark:text-amber-400' },
    offline:  { icon: CloudOff, label: 'Offline', cls: 'text-red-500' },
  }[state]
  const Icon = cfg.icon

  return (
    <button
      onClick={() => void syncNow()}
      title={
        state === 'offline'
          ? `Offline — ${pending} change${pending === 1 ? '' : 's'} saved locally, will sync when reconnected`
          : pending > 0
          ? `${pending} change${pending === 1 ? '' : 's'} pending — click to sync now`
          : 'All changes synced — click to sync now'
      }
      className={clsx(
        'flex items-center gap-1.5 px-2.5 h-8 rounded-full text-[11px] font-bold transition-colors',
        'hover:bg-[#f4f4f4] dark:hover:bg-[#222]',
        cfg.cls,
      )}
    >
      <Icon size={14} className={clsx(state === 'degraded' && 'animate-pulse')} />
      <span className="hidden min-[668px]:inline">{cfg.label}</span>
      {pending > 0 && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#111] dark:bg-white text-white dark:text-[#111] text-[10px] font-black">
          {state !== 'offline' && <RefreshCw size={9} className="animate-spin" />}
          {pending}
        </span>
      )}
    </button>
  )
}
