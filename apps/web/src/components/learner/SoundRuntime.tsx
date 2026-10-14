'use client'

import { useEffect } from 'react'
import { setTutorSoundPolicy } from './sfx'
import { syncMusic } from './music'

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
