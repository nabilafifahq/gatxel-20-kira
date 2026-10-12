'use client'

import type { ReactElement } from 'react'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
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
  const device = useDeviceWord()
  const answers = pendingCount === 1 ? '1 answer' : `${pendingCount} answers`
  const icon = state === 'offline' ? 'offline' : state === 'pending' ? 'cloud-sync' : 'cloud-check'
  const short = state === 'offline' ? 'Offline' : state === 'pending' ? `Sending ${pendingCount}` : 'Saved'
  const long =
    state === 'offline'
      ? pendingCount > 0
        ? `Offline. ${answers} saved on this ${device}.`
        : `Offline. Answers stay on this ${device}.`
      : state === 'pending'
        ? `Sending ${answers}.`
        : 'All answers are saved.'
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
