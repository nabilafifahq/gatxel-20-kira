'use client'

import type { ReactElement } from 'react'
import { Button } from '@/components/ui/Button'
import { playSfx, useSfxMuted } from './sfx'

/**
 * Tombol suara di halaman Me. Pilihan disimpan per perangkat, jadi tablet dan HP punya
 * pilihan sendiri. Saat dinyalakan, satu ketukan kecil diputar sebagai contoh.
 */
export function SoundToggle({ className }: { className?: string }): ReactElement {
  const [muted, setMuted] = useSfxMuted()
  return (
    <Button
      variant="secondary"
      size="M"
      icon={muted ? 'speaker-off' : 'speaker'}
      aria-pressed={!muted}
      aria-label={muted ? 'Sound effects are off. Turn them on.' : 'Sound effects are on. Turn them off.'}
      className={className}
      onClick={() => {
        setMuted(!muted)
        if (muted) playSfx('tap')
      }}
    >
      {muted ? 'Sound off' : 'Sound on'}
    </Button>
  )
}
