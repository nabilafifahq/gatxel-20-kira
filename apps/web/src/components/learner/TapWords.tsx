'use client'

import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { DICT_CLIP_STYLE, DICT_POS_LABEL, lookupWord, normaliseWord, splitWords, type DictFile, type WordHit } from '@kira/core/dictionary'
import { Button, IconButton } from '@/components/ui/Button'
import { UiIcon } from '@/components/ui/icons'
import { useT } from '@/lib/i18n/client'
import { useDictionaryContext } from './DictionaryProvider'
import { dictionaryIfLoaded, loadDictionaryOnce } from './dictionary-store'
import { ReadAloudButton } from './ReadAloudButton'
import { playSfx } from './sfx'

/**
 * Kamus Ketuk: teks dengan kata yang bisa diketuk. Ketukan membuka popover kecil (kata, arti Indonesia, arti English
 * sederhana, jenis kata, tombol suara, dan Save). Kamus dimuat malas dari berkas statis, jadi popover terbuka
 * seketika dan tidak ada panggilan server kecuali Save.
 *
 * Pemakai mematikannya (enabled={false}) di Tes berwaktu, Paper, Simulasi, dan untuk soal kosakata, karena arti
 * kata bisa memberi jawaban. Tanpa DictionaryProvider (saklar fitur mati) atau sebelum kamus selesai dimuat,
 * komponen hanya menampilkan teks biasa, sama dengan hasil render server.
 */

const WIDTH = 296
const WORD_STYLE: CSSProperties = { font: 'inherit', color: 'inherit', letterSpacing: 'inherit' }

/**
 * Tombol kata boleh dipisah baris dari teks di sebelahnya, jadi titik bisa jatuh sendirian di awal baris.
 * Tanda baca yang menempel pada kata ikut dirender bersama tombolnya.
 */
function glue<P extends { text: string; word: boolean; hit: unknown; pre: string; post: string }>(pieces: P[]): P[] {
  const out = pieces.map((p) => ({ ...p }))
  out.forEach((p, i) => {
    if (!p.hit) return
    const next = out[i + 1]
    const after = next && !next.word ? /^[^\s\p{L}\p{N}]+/u.exec(next.text) : null
    if (next && after) {
      p.post = after[0]
      next.text = next.text.slice(after[0].length)
    }
    const prev = out[i - 1]
    const before = prev && !prev.word ? /[^\s\p{L}\p{N}]+$/u.exec(prev.text) : null
    if (prev && before) {
      p.pre = before[0]
      prev.text = prev.text.slice(0, -before[0].length)
    }
  })
  return out
}

type Open = { hit: WordHit; surface: string; left: number; top?: number; bottom?: number; opener: HTMLElement }

function placeFor(el: HTMLElement): Pick<Open, 'left' | 'top' | 'bottom'> {
  const r = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const left = Math.max(12, Math.min(r.left + r.width / 2 - WIDTH / 2, vw - WIDTH - 12))
  const below = vh - r.bottom
  return below >= 230 || below >= r.top ? { left, top: r.bottom + 8 } : { left, bottom: vh - r.top + 8 }
}

export function TapWords({ text, enabled = true, className }: { text: string; enabled?: boolean; className?: string }): ReactElement {
  const ctx = useDictionaryContext()
  const active = enabled && ctx.enabled
  const [dict, setDict] = useState<DictFile | null>(null)
  const [open, setOpen] = useState<Open | null>(null)

  useEffect(() => {
    if (!active) return
    const have = dictionaryIfLoaded()
    if (have) {
      setDict(have)
      return
    }
    let cancelled = false
    const start = () => void loadDictionaryOnce().then((d) => !cancelled && d && setDict(d))
    const id = window.setTimeout(start, 120)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [active])

  const pieces = useMemo(() => {
    if (!active || !dict) return null
    return glue(splitWords(text).map((p) => ({ ...p, hit: p.word ? lookupWord(dict, p.text) : null, pre: '', post: '' })))
  }, [active, dict, text])

  const close = useCallback(() => {
    setOpen((o) => {
      o?.opener.focus({ preventScroll: true })
      return null
    })
  }, [])

  if (!pieces) return <span className={className}>{text}</span>

  return (
    <span className={className}>
      {pieces.map((p, i) =>
        p.hit ? (
          <span key={i} className="whitespace-nowrap">
          {p.pre}
          <button
            type="button"
            style={WORD_STYLE}
            aria-haspopup="dialog"
            aria-expanded={open?.opener.dataset.i === String(i)}
            data-i={i}
            className="-mx-px m-0 cursor-pointer rounded-sm border-0 bg-transparent px-px py-0 underline decoration-border decoration-dotted decoration-2 underline-offset-4 hover:bg-english-50 focus-visible:bg-english-50 active:bg-english-50"
            onClick={(e) => {
              const el = e.currentTarget
              const hit = p.hit
              if (hit) setOpen({ hit, surface: normaliseWord(p.text), opener: el, ...placeFor(el) })
            }}
          >
            {p.text}
          </button>
          {p.post}
          </span>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
      {open ? <WordPopover open={open} onClose={close} /> : null}
    </span>
  )
}

function WordPopover({ open, onClose }: { open: Open; onClose: () => void }): ReactElement | null {
  const t = useT()
  const ctx = useDictionaryContext()
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [fitTop, setFitTop] = useState<number | null>(null)
  const { hit } = open
  const saved = ctx.saved.has(hit.lemma)

  // Tinggi kartu baru diketahui setelah tampil: kartu yang melewati tepi layar digeser sampai utuh terlihat.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vh = window.innerHeight
    if (r.bottom > vh - 8 || r.top < 8) setFitTop(Math.max(8, vh - 8 - r.height))
  }, [])

  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || open.opener.contains(t)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onMove = (e: Event) => {
      if (e.target instanceof Node && ref.current?.contains(e.target)) return
      onClose()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, { capture: true, passive: true })
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [onClose, open.opener])

  if (typeof document === 'undefined') return null
  const posLabel = hit.entry.p ? (DICT_POS_LABEL[hit.entry.p] ?? null) : null
  const pos = posLabel ? t.reading.dictionary.pos(posLabel) : null
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      style={{ position: 'fixed', left: open.left, top: fitTop ?? open.top, bottom: fitTop === null ? open.bottom : undefined, width: WIDTH, maxHeight: 'calc(100svh - 16px)', overflowY: 'auto' }}
      className="z-50 flex flex-col gap-2 rounded-card border-2 border-fg bg-surface p-4 text-fg outline-none"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} lang="en-GB" className="m-0 font-reading text-h3 font-bold">
            {open.surface}
          </h2>
          {open.surface !== hit.lemma || pos ? (
            <p className="m-0 text-body text-fg-muted">
              {open.surface !== hit.lemma ? (
                <>
                  {t.reading.dictionary.from} <span lang="en-GB">{hit.lemma}</span>
                </>
              ) : null}
              {open.surface !== hit.lemma && pos ? ', ' : null}
              {pos}
            </p>
          ) : null}
        </div>
        <IconButton icon="close" label={t.common.close} size="M" variant="quiet" onClick={onClose} />
      </div>
      <p lang="id" className="m-0 text-body-lg font-bold">
        {hit.entry.i.join(', ')}
      </p>
      <p lang="en-GB" className="m-0 text-body text-fg-muted">
        {hit.entry.e}
      </p>
      <div className="flex items-center gap-2">
        <ReadAloudButton text={open.surface} style={DICT_CLIP_STYLE} lang="en-GB" compact showNote={false} />
        {saved ? (
          <span className="inline-flex h-14 items-center gap-2 text-body-lg font-bold">
            <UiIcon name="check" size={22} />
            {t.reading.dictionary.saved}
          </span>
        ) : (
          <Button
            variant="secondary"
            size="L"
            icon="book"
            loading={busy}
            onClick={async () => {
              setBusy(true)
              setFailed(false)
              const w = await ctx.save(hit.lemma)
              setBusy(false)
              if (w) playSfx('tap')
              else setFailed(true)
            }}
          >
            {t.common.save}
          </Button>
        )}
      </div>
      {failed ? (
        <p role="status" className="m-0 text-body text-danger">
          {t.reading.dictionary.saveFailed}
        </p>
      ) : null}
    </div>,
    document.body,
  )
}
