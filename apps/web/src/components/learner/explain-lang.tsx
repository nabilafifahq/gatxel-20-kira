'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactElement, type ReactNode } from 'react'
import { UiIcon } from '@/components/ui/icons'
import { cx } from '@/components/ui/cx'
import { useT } from '@/lib/i18n/client'
import { preloadClips } from './tts-client'

/**
 * Bahasa penjelasan per anak: bahasa Inggris dulu dengan satu ketukan ke bahasa Indonesia, kecuali orang tua memilih Indonesia
 * lebih dulu. Pilihan anak diingat per anak di perangkat ini. Bila orang tua mengubah setelannya, pilihan lama tidak berlaku lagi.
 * Soal dan jawaban tidak pernah ikut berganti bahasa: yang berganti hanya penjelasan yang memang sudah tampil.
 */

type Ctx = { learnerId: string; idFirst: boolean }
const ExplainCtx = createContext<Ctx | null>(null)

export function ExplainLangProvider({ learnerId, idFirst, children }: { learnerId: string; idFirst: boolean; children: ReactNode }): ReactElement {
  const value = useMemo(() => ({ learnerId, idFirst }), [learnerId, idFirst])
  return <ExplainCtx.Provider value={value}>{children}</ExplainCtx.Provider>
}

const EVENT = 'kira:explain-lang'
const keyOf = (learnerId: string) => `kira.explain-lang.${learnerId}`

/** Nilai yang tersimpan berlaku hanya untuk setelan orang tua saat disimpan. Baca aman: penyimpanan boleh tidak tersedia. */
export function readExplainChoice(raw: string | null, idFirst: boolean): boolean {
  if (!raw) return idFirst
  try {
    const v = JSON.parse(raw) as { on?: unknown; base?: unknown }
    return v.base === idFirst && typeof v.on === 'boolean' ? v.on : idFirst
  } catch {
    return idFirst
  }
}

export function useExplainLang(): { on: boolean; toggle: () => void } {
  const ctx = useContext(ExplainCtx)
  const learnerId = ctx?.learnerId ?? null
  const idFirst = ctx?.idFirst ?? false
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener(EVENT, cb)
    window.addEventListener('storage', cb)
    return () => {
      window.removeEventListener(EVENT, cb)
      window.removeEventListener('storage', cb)
    }
  }, [])
  const on = useSyncExternalStore(
    subscribe,
    () => {
      if (!learnerId) return false
      try {
        return readExplainChoice(localStorage.getItem(keyOf(learnerId)), idFirst)
      } catch {
        return memoryChoice.get(learnerId) ?? idFirst
      }
    },
    () => idFirst,
  )
  const toggle = useCallback(() => {
    if (!learnerId) return
    const next = !on
    memoryChoice.set(learnerId, next)
    try {
      localStorage.setItem(keyOf(learnerId), JSON.stringify({ on: next, base: idFirst }))
    } catch {
      // tanpa penyimpanan: pilihan berlaku sampai halaman ditutup
    }
    window.dispatchEvent(new Event(EVENT))
  }, [learnerId, idFirst, on])
  return { on, toggle }
}

const memoryChoice = new Map<string, boolean>()

/**
 * Tombol Terjemahkan. Hanya tampil bila ada terjemahan untuk teks di layar (`available`). Di luar penyedia per anak
 * (pratinjau konsol) tombolnya juga tidak tampil.
 */
export function TranslateToggle({ available, className }: { available: boolean; className?: string }): ReactElement | null {
  const { on, toggle } = useExplainLang()
  const ctx = useContext(ExplainCtx)
  const label = useT().lessons.lesson.translate
  if (!available || !ctx) return null
  return (
    <button
      type="button"
      aria-pressed={on}
      data-testid="translate-toggle"
      onClick={toggle}
      className={cx(
        'inline-flex h-12 flex-none cursor-pointer items-center gap-2 rounded-control border-2 px-3.5 text-body font-bold text-fg',
        on ? 'border-fg bg-surface' : 'border-border bg-bg',
        className,
      )}
    >
      <UiIcon name="globe" size={20} />
      {label}
    </button>
  )
}

/** Semua klip Indonesia untuk teks ini sudah ada. Tanpa klip tombol suaranya tersembunyi, tidak ada suara pengganti. */
export function useIdClipsReady(texts: readonly string[]): boolean {
  const key = JSON.stringify(texts)
  const [ready, setReady] = useState<{ key: string; ok: boolean } | null>(null)
  useEffect(() => {
    if (texts.length === 0) return
    let live = true
    void preloadClips(texts, 'indonesian').then((r) => {
      if (live) setReady({ key, ok: r === 'ready' })
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key mewakili isi texts
  }, [key])
  return texts.length > 0 && ready?.key === key && ready.ok
}
