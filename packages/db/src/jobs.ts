/**
 * Kontrak antrean job antara web (menulis job) dan worker (menjalankan job).
 * Web menulis baris `job` lalu `pg_notify('kira_job', id)`. Worker mengambil job lewat
 * `kira_claim_jobs(kinds, limit)` dan menjalankannya di `withOrg(db, { role: 'worker' })`.
 *
 * Job AI selalu membawa id baris `ai_job`; input lengkap ada di `ai_job.input` (lihat AiJobInput).
 * Prompt AI tidak boleh memuat nama, email, atau data identitas anak.
 */

export const JOB_KINDS = [
  'ai.items',
  'ai.variants',
  'ai.hints',
  'ai.translate',
  'ai.rubric',
  'ai.grade',
  'ai.import',
  'ai.test',
  'learner.delete',
] as const
export type JobKind = (typeof JOB_KINDS)[number]

export const AI_JOB_KINDS = JOB_KINDS.filter((k) => k.startsWith('ai.'))

export type AiJobPayload = { aiJobId: string }
/** Dijadwalkan dengan run_after = tanggal hapus. Worker memeriksa permintaan belum dibatalkan. */
export type LearnerDeletePayload = { learnerId: string; deletionRequestId: string }

export type JobPayload<K extends JobKind> = K extends 'learner.delete' ? LearnerDeletePayload : AiJobPayload

/** Ringkasan skill yang dikirim ke AI (tanpa data learner). */
export type AiSkillBrief = {
  id: string
  subject: 'math' | 'english' | 'science'
  grade: number
  title: string
  canDo: string
  strand: string
}

export type AiDraftKind = 'items' | 'variants' | 'hints' | 'translate' | 'rubric'

/**
 * Isi `ai_job.input` per jenis. `item` dan `examples` adalah JSON soal sesuai `itemSchema`
 * di packages/content/src/schema.ts. Web yang menyiapkan isi ini dari konten repo atau org_item.
 */
export type AiJobInput =
  | { kind: 'items'; skill: AiSkillBrief; count: number; difficulty: number; instructions: string; examples: unknown[] }
  | { kind: 'variants'; skill: AiSkillBrief; count: number; difficulty: number; instructions: string; itemRef: string; item: unknown }
  | { kind: 'hints'; skill: AiSkillBrief; instructions: string; itemRef: string; item: unknown }
  | { kind: 'translate'; skill: AiSkillBrief; instructions: string; itemRef: string; item: unknown; to: 'id' | 'en-GB' }
  | { kind: 'rubric'; skill: AiSkillBrief; instructions: string; itemRef: string; item: unknown }
  | {
      kind: 'grade'
      responseId: string
      skill: AiSkillBrief
      item: unknown
      answerText: string | null
      /** Hanya gambar (foto atau gambar tangan) yang dikirim ke AI. Audio dinilai tutor. */
      mediaId: string | null
    }
  | { kind: 'import'; batchId: string; mediaId: string; subject: 'math' | 'english' | 'science'; grade: number; title: string }
  | { kind: 'test' }

/**
 * Isi `ai_draft.body`: satu soal lengkap sesuai `itemSchema` dengan `id: "draft"` dan
 * `source: "ai-draft"`. Web memberi id `org:<uuid>` saat tutor menyetujui.
 * `ai_draft.problems` berisi temuan pemeriksaan otomatis dalam bahasa Indonesia.
 * `ai_draft.compare_ref` diisi ref soal asal untuk variants, hints, translate, dan rubric.
 */
export type AiDraftBody = Record<string, unknown>

/** Ditulis worker ke `response.ai_suggestion` untuk job ai.grade. */
export type AiGradeSuggestion = {
  scores: number[]
  feedback: string
  confidence: 'rendah' | 'sedang' | 'tinggi'
  createdAt: string
}

/** Ditulis worker ke `job.result` untuk job ai.test. */
export type AiTestResult = { ok: boolean; detail: string; provider: string; model: string | null }

/** Satu soal hasil baca PDF impor, disimpan di `import_batch.items`. */
export type ImportStoredItem = {
  number: number
  prompt: string
  options: string[]
  /** Indeks opsi benar menurut tutor (awal: sama dengan kunci bila terbaca). */
  answer: number | null
  /** Indeks opsi benar menurut halaman kunci di PDF. */
  answerFromKey: number | null
  figureNote: string | null
  /** Nomor halaman (mulai 1) tempat soal ditemukan. */
  page: number | null
  status: 'ok' | 'key-mismatch' | 'leftover-key-text' | 'broken-fraction' | 'needs-check'
  approved: boolean
  orgItemId: string | null
  /** Jawaban AI (indeks opsi mulai 0) dari pemeriksaan kunci; null bila AI ragu. */
  aiAnswer?: number | null
  /**
   * Hasil pemeriksaan kunci oleh AI. agree: kunci PDF sama dengan jawaban AI. disagree: berbeda.
   * ai-only: PDF tanpa kunci, AI mengerjakan dua kali dengan hasil sama (kunci usulan di `answer`, tutor tetap mengecek).
   * skipped: AI belum siap, gagal, atau ragu.
   */
  keyCheck?: 'agree' | 'disagree' | 'ai-only' | 'skipped'
  /** Gambar soal hasil potong dari halaman PDF (media org jenis figure), dipasang ke soal saat disetujui. */
  figure?: { mediaId: string; width: number; height: number; alt: string } | null
}

/**
 * Endpoint internal web yang dipanggil worker (Authorization: Bearer KIRA_INTERNAL_TOKEN).
 * POST /api/internal/weekly-report  body { orgId, learnerId, weekStart }  → { ok, queued }
 */
export type WeeklyReportRequest = { orgId: string; learnerId: string; weekStart: string }
