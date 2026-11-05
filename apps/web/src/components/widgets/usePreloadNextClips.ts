'use client'

import { useEffect } from 'react'
import type { ClientItem } from '@kira/content/present'
import { preloadClips } from '@/components/learner/tts-client'
import { speakableClipParts, speakableStyle } from './speakable-parts'

/**
 * Pramuat klip soal berikutnya. Klip soal yang sedang tampil dipramuat tombol bacanya, jadi yang diambil hanya soal ini dan
 * soal sesudahnya, bukan seluruh sesi. Klip yang sudah diambil disimpan service worker, jadi yang sudah dibuka tetap ada saat offline.
 */
export function usePreloadNextClips(next: ClientItem | undefined): void {
  const ref = next?.ref
  useEffect(() => {
    if (!next || next.lang !== 'en-GB') return
    void preloadClips(speakableClipParts(next), speakableStyle(next))
    // Hanya saat soal berikutnya berganti.
  }, [ref])
}
