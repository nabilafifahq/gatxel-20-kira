import { z } from 'zod'

/**
 * Variabel lingkungan worker. Divalidasi sekali saat boot; kalau ada yang hilang atau salah,
 * proses berhenti dengan pesan yang menyebut nama variabelnya (GTX: env hilang melempar saat boot).
 * Nilai kosong (`SMTP_URL=`) dianggap tidak diisi.
 *
 * Token Claude boleh kosong saat boot: worker tetap mengirim email, menjalankan jadwal, dan menghapus
 * data learner. Job AI yang butuh token gagal dengan pesan yang jelas sampai token diisi.
 */
const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
    DATABASE_URL_WORKER: z.string({ error: 'wajib diisi' }).startsWith('postgres', 'harus berupa URL postgres://'),
    PGSSLROOTCERT: z.string().optional(),
    KIRA_DATA_DIR: z.string({ error: 'wajib diisi' }).min(1, 'wajib diisi'),
    KIRA_INTERNAL_URL: z.url({ error: 'harus berupa URL, misalnya http://web:3000' }).default('http://web:3000'),
    KIRA_INTERNAL_TOKEN: z.string({ error: 'wajib diisi' }).min(32, 'minimal 32 karakter'),
    /** Alamat layanan suara, mis. http://tts:8000. Kosong: tidak ada suara Qwen, layar learner memakai suara tablet. */
    TTS_URL: z.url({ error: 'harus berupa URL, misalnya http://tts:8000' }).optional(),
    SMTP_URL: z.string().regex(/^smtps?:\/\/\S+$/, 'harus diawali smtp:// atau smtps://').optional(),
    SMTP_FROM: z.string().optional(),
    AI_PROVIDER: z.enum(['claude-code', 'openai-compatible', 'none'], { error: 'pilih claude-code, openai-compatible, atau none' }).default('claude-code'),
    CLAUDE_CODE_OAUTH_TOKEN: z.string().optional(),
    CLAUDE_MODEL_AUTHOR: z.string().optional(),
    CLAUDE_MODEL_FAST: z.string().optional(),
    CLAUDE_BIN: z.string().min(1).default('claude'),
    AI_BASE_URL: z.url({ error: 'harus berupa URL, misalnya https://ai.gatxel.com/v1' }).optional(),
    AI_API_KEY: z.string().optional(),
    AI_MODEL: z.string().optional(),
  })

export type Env = z.infer<typeof schema>

export class EnvError extends Error {
  override name = 'EnvError'
}

/** Baca dan validasi env. Melempar EnvError dengan pesan Indonesia yang menyebut setiap variabel bermasalah. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const cleaned: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(source)) cleaned[k] = typeof v === 'string' && v.trim() === '' ? undefined : v
  const parsed = schema.safeParse(cleaned)
  const issues = parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join('.') || '(env)'}: ${i.message}`)
  issues.push(...conditionalIssues(cleaned))
  if (issues.length || !parsed.success) {
    throw new EnvError(`Konfigurasi worker belum lengkap. ${issues.join('; ')}. Perbaiki file .env lalu mulai ulang worker.`)
  }
  return parsed.data
}

/** Variabel yang wajib tergantung pilihan lain. Dihitung dari env mentah supaya semua masalah tampil sekaligus. */
function conditionalIssues(e: Record<string, string | undefined>): string[] {
  const out: string[] = []
  const provider = e.AI_PROVIDER ?? 'claude-code'
  if (provider === 'claude-code') {
    if (!e.CLAUDE_MODEL_AUTHOR) out.push('CLAUDE_MODEL_AUTHOR: wajib diisi untuk AI_PROVIDER=claude-code')
    if (!e.CLAUDE_MODEL_FAST) out.push('CLAUDE_MODEL_FAST: wajib diisi untuk AI_PROVIDER=claude-code')
  }
  if (provider === 'openai-compatible') {
    if (!e.AI_BASE_URL) out.push('AI_BASE_URL: wajib diisi untuk AI_PROVIDER=openai-compatible')
    if (!e.AI_MODEL) out.push('AI_MODEL: wajib diisi untuk AI_PROVIDER=openai-compatible')
  }
  if (e.SMTP_URL && !e.SMTP_FROM) out.push('SMTP_FROM: wajib diisi kalau SMTP_URL diisi, misalnya "Kira <kira@domain-anda>"')
  return out
}
