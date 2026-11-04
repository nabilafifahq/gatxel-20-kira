'use client'

import type { ReactElement } from 'react'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n/client'
import { useMusicOn } from './music'
import { playSfx, useTutorSoundPolicy } from './sfx'

/**
 * Tombol Music di halaman Me. Bawaan mati; pilihan disimpan per perangkat. Bila tutor mematikan musik atau
 * suara, tombol dinonaktifkan dan menjelaskan alasannya lewat teks.
 */
export function MusicToggle({ className }: { className?: string }): ReactElement {
  const t = useT()
  const [on, setOn] = useMusicOn()
  const policy = useTutorSoundPolicy()
  const blocked = !policy.music
  const active = on && !blocked
  return (
    <Button
      variant="secondary"
      size="M"
      icon="music"
      aria-pressed={active}
      disabled={blocked}
      aria-label={
        blocked
          ? t.shell.sound.musicBlockedLabel
          : on
            ? t.shell.sound.musicOnLabel
            : t.shell.sound.musicOffLabel
      }
      className={className}
      onClick={() => {
        setOn(!on)
        if (!on) playSfx('tap')
      }}
    >
      {blocked ? t.shell.sound.musicBlocked : on ? t.shell.sound.musicOn : t.shell.sound.musicOff}
    </Button>
  )
}
