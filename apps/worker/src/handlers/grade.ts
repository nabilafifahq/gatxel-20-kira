import { and, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { tables, withOrg, type AiGradeSuggestion } from '@kira/db'
import { AI_NOT_CONFIGURED } from '../ai'
import { O } from '../ai/item-schema'
import { AI_TIMEOUT_MS, type AiImage } from '../ai/types'
import { JobError } from '../errors'
import { stripImageMetadata } from '../images'
import { readStored } from '../media'
import { aiHandler, completeAiJobTx, loadAiJob, markAiRunning } from './ai-job'
import { gradePrompt, gradeSystemPrompt } from './prompts'

/**
 * Job ai.grade: saran nilai rubrik untuk jawaban write atau draw (teks dan/atau foto).
 * Hasilnya `response.ai_suggestion` yang ditinjau tutor; tidak pernah langsung menjadi nilai.
 * Prompt tidak memuat nama anak: nama di jawaban diganti [name] dan foto dikirim tanpa EXIF.
 * Audio (speak) tidak dikirim ke AI, dinilai tutor.
 */

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const gradeItemSchema = z.looseObject({
  type: z.string(),
  prompt: z.string().min(1),
  explanation: z.string().optional(),
  rubric: z.object({ criteria: z.array(z.object({ label: z.string().min(1), points: z.number().int().min(1).max(10) })).min(1).max(10) }),
  minWords: z.number().optional(),
  maxWords: z.number().optional(),
  planning: z.array(z.string()).optional(),
  model: z.string().optional(),
  background: z.string().optional(),
})
type GradeItem = z.infer<typeof gradeItemSchema>

export const GRADE_SCHEMA = O({
  scores: { type: 'array', items: { type: 'integer' }, description: 'One whole-number score per rubric criterion, in order.' },
  feedback: { type: 'string', description: 'At most 2 short sentences for the child, en-GB.' },
  confidence: { type: 'string', enum: ['rendah', 'sedang', 'tinggi'] },
})

const modelGrade = z.object({ scores: z.array(z.number().int()), feedback: z.string(), confidence: z.enum(['rendah', 'sedang', 'tinggi']) })

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Ganti nama learner (utuh dan per kata, minimal 3 huruf) dengan [name] sebelum teks dikirim ke AI. */
export function redactName(text: string, name: string): string {
  const full = name.trim()
  const parts = [...new Set([full, ...full.split(/\s+/)])].filter((p) => p.length >= 3).sort((a, b) => b.length - a.length)
  let out = text
  for (const p of parts) out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(p)}(?![\\p{L}\\p{N}])`, 'giu'), '[name]')
  return out
}

/** Umpan balik untuk anak: tanpa em dash atau en dash, paling banyak 2 kalimat, paling panjang 300 karakter. */
export function cleanFeedback(raw: string): string {
  let s = raw.replace(/\s*[\u2014\u2013]\s*/g, ', ').replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim()
  const sentences = s.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? [s]
  s = sentences.slice(0, 2).join(' ').replace(/\s+/g, ' ').trim()
  if (s.length > 300) {
    const cut = s.slice(0, 300)
    s = `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 200)).replace(/[,;:]$/, '')}.`
  }
  return s
}

export function validateGrade(json: unknown, criteria: { points: number }[], now: Date): AiGradeSuggestion {
  const parsed = modelGrade.safeParse(json)
  if (!parsed.success) throw new JobError('Saran nilai dari AI tidak lengkap.', { retryable: true })
  const { scores, confidence } = parsed.data
  if (scores.length !== criteria.length) throw new JobError('Jumlah skor dari AI tidak sama dengan jumlah kriteria rubrik.', { retryable: true })
  if (scores.some((s, i) => s < 0 || s > criteria[i]!.points)) throw new JobError('Skor dari AI di luar batas poin rubrik.', { retryable: true })
  const feedback = cleanFeedback(parsed.data.feedback)
  if (!feedback) throw new JobError('Umpan balik dari AI kosong.', { retryable: true })
  return { scores, feedback, confidence, createdAt: now.toISOString() }
}

function itemForGrade(item: GradeItem): Record<string, unknown> {
  const out: Record<string, unknown> = { type: item.type, prompt: item.prompt, rubric: item.rubric }
  for (const k of ['explanation', 'minWords', 'maxWords', 'planning', 'model', 'background'] as const) if (item[k] !== undefined) out[k] = item[k]
  return out
}

export const gradeHandler = aiHandler(async (h) => {
  const aj = await loadAiJob(h, 'grade')
  if (aj.status === 'done') return { skipped: 'ai_job sudah selesai' }
  if (!h.ai.ready) throw new JobError(h.ai.notReadyReason ?? AI_NOT_CONFIGURED, { retryable: false })
  const input = aj.input
  const itemParsed = gradeItemSchema.safeParse(input.item)
  if (!itemParsed.success) throw new JobError('Soal ini tidak punya rubrik, jadi tidak bisa dinilai AI.', { retryable: false })
  const item = itemParsed.data
  if (item.type === 'speak') throw new JobError('Jawaban lisan dinilai tutor, tidak lewat AI.', { retryable: false })

  const ctx = await withOrg(h.db, h.org, async (tx) => {
    const [resp] = await tx
      .select({ id: tables.response.id, learnerId: tables.response.learnerId })
      .from(tables.response)
      .where(eq(tables.response.id, input.responseId))
      .limit(1)
    if (!resp) return null
    const [learner] = await tx.select({ name: tables.learnerProfile.name }).from(tables.learnerProfile).where(eq(tables.learnerProfile.userId, resp.learnerId)).limit(1)
    const consents = await tx
      .select({ purpose: tables.consentEvent.purpose, granted: tables.consentEvent.granted })
      .from(tables.consentEvent)
      .where(and(eq(tables.consentEvent.learnerId, resp.learnerId), inArray(tables.consentEvent.purpose, ['ai-drafts', 'photo'])))
      .orderBy(desc(tables.consentEvent.createdAt))
    const media = input.mediaId
      ? ((
          await tx
            .select({ path: tables.media.path, mime: tables.media.mime, learnerId: tables.media.learnerId, deletedAt: tables.media.deletedAt })
            .from(tables.media)
            .where(eq(tables.media.id, input.mediaId))
            .limit(1)
        )[0] ?? null)
      : null
    return { resp, learnerName: learner?.name ?? '', consents, media }
  })
  if (!ctx) throw new JobError('Jawaban yang mau dinilai tidak ditemukan.', { retryable: false })

  // Persetujuan terbaru per tujuan (append-only, baris terbaru menang).
  const latest = new Map<string, boolean>()
  for (const c of ctx.consents) if (!latest.has(c.purpose)) latest.set(c.purpose, c.granted)
  if (latest.get('ai-drafts') !== true) {
    throw new JobError('Orang tua belum menyetujui bantuan AI untuk anak ini. Nilai jawaban ini secara manual.', { retryable: false })
  }

  const images: AiImage[] = []
  if (input.mediaId) {
    if (!ctx.media || ctx.media.deletedAt) throw new JobError('Foto jawaban tidak ditemukan.', { retryable: false })
    if (ctx.media.learnerId && ctx.media.learnerId !== ctx.resp.learnerId) throw new JobError('Foto jawaban bukan milik learner ini.', { retryable: false })
    if (latest.get('photo') !== true) throw new JobError('Orang tua belum menyetujui foto jawaban. Nilai jawaban ini secara manual.', { retryable: false })
    if (!IMAGE_MIMES.has(ctx.media.mime)) throw new JobError('Hanya foto atau gambar yang bisa dinilai AI.', { retryable: false })
    let raw: Buffer
    try {
      raw = await readStored(h.env.KIRA_DATA_DIR, ctx.media.path)
    } catch {
      throw new JobError('Berkas foto jawaban tidak ada di server.', { retryable: false })
    }
    const clean = stripImageMetadata(raw, ctx.media.mime)
    if (!clean) throw new JobError('Foto jawaban rusak dan tidak bisa dibaca.', { retryable: false })
    if (clean.length > MAX_IMAGE_BYTES) throw new JobError('Foto lebih besar dari 5 MB, jadi tidak bisa dinilai AI. Nilai manual atau unggah foto yang lebih kecil.', { retryable: false })
    images.push({ mime: ctx.media.mime, base64: clean.toString('base64') })
  }
  const answerText = input.answerText ? redactName(input.answerText, ctx.learnerName) : null
  if (!answerText?.trim() && images.length === 0) throw new JobError('Jawaban kosong, tidak ada yang bisa dinilai.', { retryable: false })

  await markAiRunning(h, aj.id)
  const out = await h.ai.run({
    system: gradeSystemPrompt(input.skill.grade),
    prompt: gradePrompt({ item: itemForGrade(item), answerText, hasImage: images.length > 0 }),
    ...(images.length ? { images } : {}),
    jsonSchema: GRADE_SCHEMA,
    tier: 'fast',
    timeoutMs: AI_TIMEOUT_MS,
    signal: h.signal,
  })
  const suggestion = validateGrade(out.json, item.rubric.criteria, h.now())
  await withOrg(h.db, h.org, async (tx) => {
    await tx.update(tables.response).set({ aiSuggestion: suggestion }).where(eq(tables.response.id, input.responseId))
    await completeAiJobTx(tx, aj.id, { output: { scores: suggestion.scores, confidence: suggestion.confidence }, provider: h.ai.name, model: out.model, durationMs: out.durationMs, usage: out.usage }, h.now())
  })
  return { graded: true, confidence: suggestion.confidence }
})
