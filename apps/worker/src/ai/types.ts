/**
 * Antarmuka provider AI. Prompt tidak pernah memuat nama, email, atau data identitas anak.
 * `tier` memilih model: author untuk menulis soal, fast untuk menilai dan tes koneksi.
 */

export type AiTier = 'author' | 'fast'

export type AiImage = { mime: string; base64: string }

export type AiRunInput = {
  system: string
  prompt: string
  images?: AiImage[]
  /** JSON Schema keluaran. Hanya kata kunci yang didukung mode strict: type, properties, required, additionalProperties false, items, enum, const, anyOf, description. */
  jsonSchema: Record<string, unknown>
  timeoutMs: number
  tier?: AiTier
  signal?: AbortSignal
}

export type AiRunOutput = { json: unknown; usage?: unknown; model: string; durationMs: number }

export type AiProviderName = 'claude-code' | 'openai-compatible' | 'none'

export interface AiProvider {
  readonly name: AiProviderName
  /** Model untuk menulis soal (tier author). */
  readonly model: string | null
  /** Siap dipakai menurut konfigurasi (belum tentu tersambung). */
  readonly ready: boolean
  /** Alasan belum siap, dalam bahasa Indonesia. */
  readonly notReadyReason: string | null
  /** Label untuk pesan ke tutor, misalnya "Claude". */
  readonly label: string
  modelFor(tier: AiTier): string | null
  run(input: AiRunInput): Promise<AiRunOutput>
  /** Keterangan singkat versi atau alamat untuk job ai.test. */
  describe(): Promise<string | null>
}

export const AI_TIMEOUT_MS = 5 * 60 * 1000
