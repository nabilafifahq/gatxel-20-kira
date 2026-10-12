'use client'

import { openDB, type IDBPDatabase } from 'idb'
import type { AnswerPayload } from '@/lib/dto'

/**
 * Kotak keluar di perangkat (IndexedDB). Jawaban yang gagal terkirim karena jaringan
 * disimpan di sini dan dikirim ulang lewat /api/sync saat jaringan kembali.
 * Jawaban tidak pernah hilang walau tab ditutup.
 */
type Stored = { clientId: string; payload: AnswerPayload; savedAt: number }
type StoredSubmit = { attemptId: string; clientId: string; savedAt: number }

let dbp: Promise<IDBPDatabase> | null = null

function db(): Promise<IDBPDatabase> {
  dbp ??= openDB('kira-offline', 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains('answers')) d.createObjectStore('answers', { keyPath: 'clientId' })
      if (!d.objectStoreNames.contains('submits')) d.createObjectStore('submits', { keyPath: 'attemptId' })
    },
  })
  return dbp
}

export async function queueAnswer(payload: AnswerPayload): Promise<void> {
  await (await db()).put('answers', { clientId: payload.clientId, payload, savedAt: Date.now() } satisfies Stored)
}

export async function queueSubmit(attemptId: string, clientId: string): Promise<void> {
  await (await db()).put('submits', { attemptId, clientId, savedAt: Date.now() } satisfies StoredSubmit)
}

export async function pendingCount(): Promise<number> {
  try {
    const d = await db()
    return (await d.count('answers')) + (await d.count('submits'))
  } catch {
    return 0
  }
}

/** Jawaban tersimpan untuk satu attempt (dipakai saat halaman dibuka ulang dari cache offline). */
export async function localAnswers(attemptId: string): Promise<AnswerPayload[]> {
  try {
    const all = (await (await db()).getAll('answers')) as Stored[]
    return all.filter((s) => s.payload.attemptId === attemptId).map((s) => s.payload)
  } catch {
    return []
  }
}

let flushing = false

/** Kirim semua isi kotak keluar. Mengembalikan jumlah yang masih tertunda. */
export async function flushOutbox(): Promise<number> {
  if (flushing || (typeof navigator !== 'undefined' && !navigator.onLine)) return pendingCount()
  flushing = true
  try {
    const d = await db()
    const answers = ((await d.getAll('answers')) as Stored[]).sort((a, b) => a.savedAt - b.savedAt)
    const submits = (await d.getAll('submits')) as StoredSubmit[]
    if (answers.length === 0 && submits.length === 0) return 0
    for (let i = 0; i < answers.length; i += 50) {
      const batch = answers.slice(i, i + 50)
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: batch.map((b) => b.payload), submits: [] }),
        credentials: 'same-origin',
      })
      if (!res.ok) break
      const body = (await res.json()) as { answers: { clientId: string; ok: boolean; retry: boolean }[] }
      for (const r of body.answers) if (r.ok || !r.retry) await d.delete('answers', r.clientId)
    }
    const left = await d.count('answers')
    if (left === 0 && submits.length > 0) {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: [], submits: submits.map((s) => ({ attemptId: s.attemptId, clientId: s.clientId })) }),
        credentials: 'same-origin',
      })
      if (res.ok) {
        const body = (await res.json()) as { submits: { attemptId: string; ok: boolean; retry: boolean }[] }
        for (const r of body.submits) if (r.ok || !r.retry) await d.delete('submits', r.attemptId)
      }
    }
    return pendingCount()
  } catch {
    return pendingCount()
  } finally {
    flushing = false
  }
}

/** Error jaringan (fetch gagal) dibedakan dari penolakan server. */
export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const msg = e instanceof Error ? e.message : String(e)
  return /fetch|network|Failed to|Load failed|NetworkError|ECONN|timeout/i.test(msg)
}
