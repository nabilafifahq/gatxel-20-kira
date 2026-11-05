'use client'

import { useEffect } from 'react'
import { setTutorSoundPolicy } from './sfx'
import { syncMusic } from './music'
// Pendengar ketukan pertama harus terpasang sejak layout dimuat. Kalau baru terpasang bersama layar yang memakainya, ketukan yang membuka layar itu terlewat dan kalimat pertama pembawa acara diam di iPhone.
import './shared-audio'

/**
 * Dipasang sekali di layout learner. Menerima pilihan tutor dari server, lalu menjaga musik latar tetap
 * sesuai pilihan perangkat. Audio baru boleh mulai setelah sentuhan pertama (aturan autoplay browser).
 */
export function SoundRuntime({ sfx, music }: { sfx: boolean; music: boolean }) {
  useEffect(() => {
    setTutorSoundPolicy({ sfx, music })
    syncMusic()
  }, [sfx, music])
  useEffect(() => {
    const go = () => syncMusic()
    const events = ['pointerdown', 'keydown', 'touchend'] as const
    for (const e of events) window.addEventListener(e, go, { passive: true })
    document.addEventListener('visibilitychange', go)
    return () => {
      for (const e of events) window.removeEventListener(e, go)
      document.removeEventListener('visibilitychange', go)
    }
  }, [])
  return null
}
