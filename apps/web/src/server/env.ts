import 'server-only'
import { z } from 'zod'

/**
 * Variabel lingkungan server. Divalidasi saat pertama dipakai; kalau ada yang
 * hilang, proses gagal dengan pesan jelas (GTX: env yang hilang melempar saat boot).
 * Tidak ada rahasia dengan awalan NEXT_PUBLIC_.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  KIRA_ORIGIN: z.string().url(),
  KIRA_RP_NAME: z.string().min(1).default('Kira'),
  DATABASE_URL_APP: z.string().startsWith('postgres'),
  DATABASE_URL_AUTH: z.string().startsWith('postgres'),
  KIRA_SECRET: z.string().min(32, 'KIRA_SECRET minimal 32 karakter'),
  KIRA_SETUP_TOKEN: z.string().min(12).optional(),
  KIRA_DATA_DIR: z.string().min(1),
  SMTP_URL: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  AI_PROVIDER: z.enum(['claude-code', 'openai-compatible', 'none']).default('claude-code'),
  AI_MONTHLY_JOB_LIMIT: z.coerce.number().int().min(0).default(400),
  KIRA_HIBP: z.enum(['on', 'off']).default('on'),
  KIRA_MAX_LEARNERS: z.coerce.number().int().min(1).max(50).default(10),
})

export type Env = z.infer<typeof schema>

let cached: Env | null = null

export function env(): Env {
  if (cached) return cached
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Konfigurasi server tidak lengkap. ${issues}`)
  }
  cached = parsed.data
  return cached
}

export function isProd(): boolean {
  return process.env.NODE_ENV === 'production'
}

/** Origin publik (tanpa garis miring akhir), misalnya https://kira.tailnet.ts.net */
export function origin(): string {
  return env().KIRA_ORIGIN.replace(/\/$/, '')
}

export function rpId(): string {
  return new URL(origin()).hostname
}
