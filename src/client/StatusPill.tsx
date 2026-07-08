import type { SyncStatus } from './useSync'

const LABELS: Record<SyncStatus, string> = {
  connecting: 'connecting',
  synced: 'synced',
  saving: 'saving',
  offline: 'offline, retrying',
  'file-missing': 'file missing on disk',
  conflict: 'merge conflict, check history',
}

export function StatusPill({ status }: { status: SyncStatus }) {
  return (
    <span className={`status-pill status-${status}`} title={LABELS[status]}>
      <span className="status-dot" />
      {LABELS[status]}
    </span>
  )
}
