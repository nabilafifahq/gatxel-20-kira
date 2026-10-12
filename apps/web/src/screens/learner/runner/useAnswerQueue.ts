'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActionResult, AnswerPayload, AnswerResult } from '@/lib/dto'

/**
 * Antrean kirim jawaban di memori. Anak tidak pernah menunggu: jawaban masuk antrean,
 * dikirim satu per satu, dan dicoba ulang diam-diam dengan jeda yang makin panjang.
 * Saat offline antrean berhenti dan jalan lagi ketika jaringan kembali.
 * Jawaban baru untuk posisi yang sama menggantikan yang belum terkirim (mode tes).
 * Antrean persisten di IndexedDB nanti membungkus actions.saveAnswer dari luar.
 */

type Entry = {
  payload: AnswerPayload
  tries: number
  waiters: ((r: ActionResult<AnswerResult> | null) => void)[]
}

const MAX_REFUSALS = 8

export type AnswerQueue = {
  /** Masukkan jawaban. Promise selesai saat server menjawab, atau null bila jawaban dibuang. */
  enqueue: (p: AnswerPayload) => Promise<ActionResult<AnswerResult> | null>
  /** Tunggu antrean kosong, paling lama `timeoutMs`. Mengembalikan true bila kosong. */
  flush: (timeoutMs: number) => Promise<boolean>
  pending: number
  /** Kode referensi error terakhir yang membuat jawaban dibuang. */
  droppedReference: string | null
  /** Antrean baru saja kosong setelah sempat tertahan (offline atau dicoba ulang). */
  justSynced: boolean
  /** Ada jawaban yang tertahan lebih dari 2 detik atau sedang menunggu coba ulang. */
  stuck: boolean
}

export function useAnswerQueue(save: (p: AnswerPayload) => Promise<ActionResult<AnswerResult>>): AnswerQueue {
  const queue = useRef<Entry[]>([])
  const running = useRef(false)
  const timer = useRef(0)
  const saveRef = useRef(save)
  const [pending, setPending] = useState(0)
  const [droppedReference, setDropped] = useState<string | null>(null)
  const [justSynced, setJustSynced] = useState(false)
  const [stuck, setStuck] = useState(false)
  const stuckTimer = useRef(0)
  const hadPending = useRef(false)
  const drainWaiters = useRef<(() => void)[]>([])

  useEffect(() => {
    saveRef.current = save
  })

  const sync = useCallback(() => {
    const n = queue.current.length
    setPending(n)
    if (n > 0 && !stuckTimer.current) {
      stuckTimer.current = window.setTimeout(() => {
        hadPending.current = true
        setStuck(true)
      }, 2000)
    }
    if (n === 0) {
      window.clearTimeout(stuckTimer.current)
      stuckTimer.current = 0
      setStuck(false)
      if (hadPending.current) {
        hadPending.current = false
        setJustSynced(true)
        window.setTimeout(() => setJustSynced(false), 3000)
      }
      const ws = drainWaiters.current
      drainWaiters.current = []
      ws.forEach((w) => w())
    }
  }, [])

  const run = useCallback(async () => {
    if (running.current) return
    running.current = true
    try {
      while (queue.current.length > 0) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) break
        const entry = queue.current[0]
        if (!entry) break
        let result: ActionResult<AnswerResult> | null = null
        try {
          result = await saveRef.current(entry.payload)
        } catch {
          result = null
        }
        // Entri bisa sudah diganti oleh jawaban yang lebih baru selama dikirim.
        if (result && result.ok) {
          queue.current = queue.current.filter((e) => e !== entry)
          entry.waiters.forEach((w) => w(result))
          sync()
          continue
        }
        entry.tries += 1
        if (result && !result.ok && entry.tries >= MAX_REFUSALS) {
          queue.current = queue.current.filter((e) => e !== entry)
          setDropped(result.reference)
          entry.waiters.forEach((w) => w(result))
          sync()
          continue
        }
        hadPending.current = true
        setStuck(true)
        const wait = Math.min(30_000, 1000 * 2 ** Math.min(entry.tries, 5))
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => void run(), wait)
        break
      }
    } finally {
      running.current = false
    }
  }, [sync])

  useEffect(() => {
    const onOnline = () => {
      window.clearTimeout(timer.current)
      void run()
    }
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.clearTimeout(timer.current)
    }
  }, [run])

  const enqueue = useCallback(
    (payload: AnswerPayload) =>
      new Promise<ActionResult<AnswerResult> | null>((resolve) => {
        const list = queue.current
        // Ganti jawaban lama untuk posisi yang sama yang belum mulai dikirim (bukan entri pertama yang mungkin sedang dikirim).
        const idx = list.findIndex((e, i) => i > 0 && e.payload.position === payload.position && e.payload.attemptNo === payload.attemptNo)
        if (idx > 0) {
          const old = list[idx]
          if (old) {
            old.waiters.forEach((w) => w(null))
            list[idx] = { payload, tries: 0, waiters: [resolve] }
          }
        } else {
          list.push({ payload, tries: 0, waiters: [resolve] })
        }
        sync()
        void run()
      }),
    [run, sync],
  )

  const flush = useCallback(
    (timeoutMs: number) =>
      new Promise<boolean>((resolve) => {
        if (queue.current.length === 0) {
          resolve(true)
          return
        }
        window.clearTimeout(timer.current)
        void run()
        const t = window.setTimeout(() => resolve(queue.current.length === 0), timeoutMs)
        drainWaiters.current.push(() => {
          window.clearTimeout(t)
          resolve(true)
        })
      }),
    [run],
  )

  return { enqueue, flush, pending, droppedReference, justSynced, stuck }
}

export function newClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // Cadangan untuk browser lama tanpa randomUUID (bukan untuk keamanan, hanya idempotensi).
  return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16))
}
