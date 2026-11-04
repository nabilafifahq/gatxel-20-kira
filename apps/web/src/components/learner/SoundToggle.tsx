'use client'

import type { ReactElement } from 'react'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n/client'
import { playSfx, useSfxMuted } from './sfx'

/**
 * Tombol suara di halaman Me. Pilihan disimpan per perangkat, jadi tablet dan HP punya
 * pilihan sendiri. Saat dinyalakan, satu ketukan kecil diputar sebagai contoh.
 */
export function SoundToggle({ className }: { className?: string }): ReactElement {
  const t = useT()
  const [muted, setMuted] = useSfxMuted()
  return (
    <Button
      variant="secondary"
      size="M"
      icon={muted ? 'speaker-off' : 'speaker'}
      aria-pressed={!muted}
      aria-label={muted ? t.shell.sound.sfxOffLabel : t.shell.sound.sfxOnLabel}
      className={className}
      onClick={() => {
        setMuted(!muted)
        if (muted) playSfx('tap')
      }}
    >
      {muted ? t.shell.sound.sfxOff : t.shell.sound.sfxOn}
    </Button>
  )
}
