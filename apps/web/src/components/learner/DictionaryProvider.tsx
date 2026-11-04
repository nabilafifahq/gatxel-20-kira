'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactElement, type ReactNode } from 'react'
import { removeWordAction, saveWordAction } from '@/server/actions/vocab'

/**
 * Saklar Kamus Ketuk untuk semua layar learner. Layout memasang provider ini dengan nilai dari saklar fitur
 * `dictionary`. Tanpa provider (layar publik, konsol) TapWords menampilkan teks biasa.
 */

type Ctx = {
  enabled: boolean
  saved: ReadonlySet<string>
  /** Simpan kata; mengembalikan bentuk dasar yang tersimpan, atau null bila gagal. */
  save: (word: string) => Promise<string | null>
  remove: (word: string) => Promise<boolean>
}

const DictionaryContext = createContext<Ctx>({ enabled: false, saved: new Set(), save: async () => null, remove: async () => false })

export function useDictionaryContext(): Ctx {
  return useContext(DictionaryContext)
}

export function DictionaryProvider({ enabled, initialSaved, children }: { enabled: boolean; initialSaved: string[]; children: ReactNode }): ReactElement {
  const [saved, setSaved] = useState<ReadonlySet<string>>(() => new Set(initialSaved))
  const save = useCallback(async (word: string) => {
    const r = await saveWordAction({ word })
    if (!r.ok) return null
    setSaved((s) => new Set(s).add(r.data.word))
    return r.data.word
  }, [])
  const remove = useCallback(async (word: string) => {
    const r = await removeWordAction({ word })
    if (r.ok) setSaved((s) => new Set([...s].filter((w) => w !== word)))
    return r.ok
  }, [])
  const value = useMemo(() => ({ enabled, saved, save, remove }), [enabled, saved, save, remove])
  return <DictionaryContext.Provider value={value}>{children}</DictionaryContext.Provider>
}
