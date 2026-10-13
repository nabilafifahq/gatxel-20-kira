import { z } from 'zod'
import type { Candidate } from '../types'
import { clean, needsPicture, unsafeForKids } from './common'

/**
 * Tugas Bebras (berpikir komputasional) yang diletakkan admin di <KIRA_DATA_DIR>/sources/bebras, satu tugas per
 * berkas JSON. Tidak ada unduhan massal yang stabil, jadi Kira hanya membaca berkas yang sudah ada. Setiap tugas
 * wajib menulis lisensinya sendiri (CC BY atau CC BY-SA); tugas tanpa lisensi ditolak.
 *
 * Contoh berkas:
 * { "id": "2023-IN-01", "title": "Beaver bridges", "grade": 3, "license": "CC BY-SA 4.0", "year": 2023,
 *   "body": "Which bridge ...?", "options": ["A", "B", "C"], "answer": 1 }
 */

const taskSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9._-]{2,40}$/),
    title: z.string().trim().min(1).max(80),
    grade: z.number().int().min(1).max(6),
    license: z.string().trim().min(3).max(60),
    year: z.number().int().min(2000).max(2035).optional(),
    body: z.string().trim().min(10).max(500),
    options: z.array(z.string().trim().min(1).max(100)).min(3).max(5),
    /** Indeks opsi benar (mulai 0). */
    answer: z.number().int().min(0).max(4),
  })
  .strict()

const LICENSE_OK = /^CC[ -]BY(?:[ -]SA)?(?:[ -]\d\.\d)?$/i

export type BebrasResult = { ok: true; candidate: Candidate } | { ok: false; reason: string }

export function parseBebrasTask(json: string): BebrasResult {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, reason: 'JSON tidak valid' }
  }
  const parsed = taskSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, reason: `Bentuk tugas salah: ${parsed.error.issues[0]?.path.join('.') || 'tugas'}` }
  const t = parsed.data
  if (!LICENSE_OK.test(t.license)) return { ok: false, reason: `Lisensi "${t.license}" tidak diterima; hanya CC BY atau CC BY-SA` }
  if (t.answer >= t.options.length) return { ok: false, reason: 'Kunci di luar opsi' }
  const prompt = clean(`${t.title}. ${t.body}`)
  const options = t.options.map(clean)
  if (unsafeForKids(prompt, ...options) || needsPicture(prompt)) return { ok: false, reason: 'Tugas bergantung pada gambar atau tidak cocok untuk anak SD' }
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return { ok: false, reason: 'Opsi kembar' }
  return {
    ok: true,
    candidate: {
      externalId: `bebras-${t.id}`,
      subject: 'math',
      grade: t.grade,
      type: 'mcq',
      prompt,
      options,
      answer: t.answer,
      topicHint: 'computational thinking',
      difficulty: Math.min(5, Math.max(2, t.grade)),
    },
  }
}
