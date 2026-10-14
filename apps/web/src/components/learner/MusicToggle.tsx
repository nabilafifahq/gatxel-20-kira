'use client'

import type { ReactElement } from 'react'
import { Button } from '@/components/ui/Button'
import { useMusicOn } from './music'
import { playSfx, useTutorSoundPolicy } from './sfx'

/**
 * Tombol Music di halaman Me. Bawaan mati; pilihan disimpan per perangkat. Bila tutor mematikan musik atau
 * suara, tombol dinonaktifkan dan menjelaskan alasannya lewat teks.
 */
export function MusicToggle({ className }: { className?: string }): ReactElement {
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
          ? 'Music is turned off by your tutor.'
          : on
            ? 'Music is on. Turn it off.'
            : 'Music is off. Turn it on.'
      }
      className={className}
      onClick={() => {
        setOn(!on)
        if (!on) playSfx('tap')
      }}
    >
      {blocked ? 'Music off by tutor' : on ? 'Music on' : 'Music off'}
    </Button>
  )
}
