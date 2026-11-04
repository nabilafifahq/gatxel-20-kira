'use client'

import type { DictFile } from '@kira/core/dictionary'
import { DICTIONARY_URL } from './dictionary-file'

/**
 * Kamus di perangkat anak. Dimuat malas sekali per halaman dari berkas statis berhash (/dict/en-id.<hash>.json),
 * disimpan oleh cache browser dan service worker (cache dulu), jadi ketukan berikutnya dan halaman offline tidak
 * memanggil server. Tidak pernah melempar: gagal berarti kata tidak bisa diketuk.
 */

let loading: Promise<DictFile | null> | null = null
let loaded: DictFile | null = null

export function dictionaryIfLoaded(): DictFile | null {
  return loaded
}

export function loadDictionaryOnce(): Promise<DictFile | null> {
  if (loaded) return Promise.resolve(loaded)
  loading ??= fetch(DICTIONARY_URL, { credentials: 'same-origin' })
    .then((r) => (r.ok ? (r.json() as Promise<DictFile>) : null))
    .then((d) => {
      if (d && d.v === 1 && d.entries) {
        loaded = d
        return d
      }
      loading = null
      return null
    })
    .catch(() => {
      loading = null
      return null
    })
  return loading
}
