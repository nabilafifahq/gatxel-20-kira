'use client'

import type { ReactElement } from 'react'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { useT } from '@/lib/i18n/client'
import { useDeviceWord } from './hooks'

/**
 * Status jaringan di runner (papan RunnerOffline). Pill di bar atas tablet, banner di HP.
 * offline: tanpa jaringan, jawaban tetap di perangkat. pending: jawaban sedang dikirim.
 * synced: semua jawaban sudah tersimpan di server.
 */

export type SyncState = 'offline' | 'pending' | 'synced'

export function OfflineBanner({
  state,
  pendingCount = 0,
  variant = 'pill',
  className,
}: {
  state: SyncState
  pendingCount?: number
  variant?: 'pill' | 'banner'
  className?: string
}): ReactElement {
  const t = useT()
  const device = t.shell.device[useDeviceWord()]
  const answers = t.shell.offline.answers(pendingCount)
  const icon = state === 'offline' ? 'offline' : state === 'pending' ? 'cloud-sync' : 'cloud-check'
  const short = state === 'offline' ? t.shell.offline.short : state === 'pending' ? t.shell.offline.sendingShort(pendingCount) : t.shell.offline.savedShort
  const long =
    state === 'offline'
      ? pendingCount > 0
        ? t.shell.offline.savedOnDevice(answers, device)
        : t.shell.offline.stayOnDevice(device)
      : state === 'pending'
        ? t.shell.offline.sending(answers)
        : t.shell.offline.allSaved
  if (variant === 'pill') {
    return (
      <span
        role="status"
        className={cx(
          'inline-flex h-10 flex-none items-center gap-1.5 rounded-pill border-2 bg-surface px-3 text-body font-bold whitespace-nowrap',
          state === 'synced' ? 'border-success' : 'border-fg-muted',
          className,
        )}
      >
        <UiIcon name={icon} size={20} className={state === 'synced' ? 'text-success' : 'text-fg'} />
        {short}
        <span className="visually-hidden">. {long}</span>
      </span>
    )
  }
  return (
    <div
      role="status"
      className={cx(
        'flex items-center gap-2 rounded-control border-2 bg-surface px-3 py-2 text-body font-semibold',
        state === 'synced' ? 'border-success' : 'border-fg-muted',
        className,
      )}
    >
      <UiIcon name={icon} size={20} className={state === 'synced' ? 'text-success' : 'text-fg'} />
      {long}
    </div>
  )
}
