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
  /** Rahasia bersama web dan worker untuk /api/internal/*. Tanpa nilai ini endpoint internal menolak semua permintaan. */
  KIRA_INTERNAL_TOKEN: z.string().min(32, 'KIRA_INTERNAL_TOKEN minimal 32 karakter').optional(),
  /** Endpoint MCP di /api/mcp untuk Claude (Claude Code atau Claude Desktop) dengan token dari konsol. */
  KIRA_MCP: z.enum(['on', 'off']).default('on'),
  /** Folder cadangan yang dipasang read-only ke container web (berisi status.json dari layanan backup). */
  KIRA_BACKUP_DIR: z.string().optional(),
  /** Nama folder cadangan yang ditampilkan di konsol, misalnya D:\\Kira\\backups. */
  KIRA_BACKUP_LABEL: z.string().max(200).optional(),
})

export type Env = z.infer<typeof schema>

let cached: Env | null = null

export function env(): Env {
  if (cached) return cached
  // Nilai kosong (misalnya SMTP_URL= di .env atau KIRA_SETUP_TOKEN: "" dari Docker Compose) dianggap tidak diisi.
  const cleaned: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(process.env)) cleaned[k] = typeof v === 'string' && v.trim() === '' ? undefined : v
  const parsed = schema.safeParse(cleaned)
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
