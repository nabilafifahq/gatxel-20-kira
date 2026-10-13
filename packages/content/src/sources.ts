import { z } from 'zod'
import { grade, subject } from './schema'

/**
 * Registri sumber soal (rencana 10.7). Satu berkas JSON di content/sources/registry.json mencatat
 * setiap bank soal yang ditemukan: nama, situs, mapel, kelas, tahun, lisensi, format, dan cara ambil.
 *
 * Aturan lisensi yang dipakai worker sebelum mengambil apa pun:
 * - Pengambilan otomatis hanya untuk lisensi terbuka (CC, domain publik, MIT, Apache) dan unduhan
 *   gratis resmi penyelenggara untuk latihan ("official-free"). Situs bajakan dan paper berbayar tidak pernah
 *   diambil; paper berbayar ditandai "manual-upload" dan tutor mengunggah PDF-nya sendiri.
 * - Hanya lisensi permisif yang boleh dijadikan JSON konten di repo (dengan atribusi). Lisensi dengan
 *   syarat tambahan (ShareAlike, NonCommercial) dan paper resmi hanya tinggal di server keluarga.
 */

export const LICENSES = [
  'cc0',
  'public-domain',
  'cc-by',
  'cc-by-sa',
  'cc-by-nc',
  'cc-by-nc-sa',
  'mit',
  'apache-2.0',
  'official-free',
  'paid',
  'restricted',
  'unknown',
] as const
export type LicenseId = (typeof LICENSES)[number]

export type LicensePolicy = {
  label: string
  /** Worker boleh mengambil otomatis. */
  autoFetch: boolean
  /** Boleh disimpan sebagai JSON konten di repo (dengan atribusi). */
  commit: boolean
  /** Wajib mencantumkan atribusi. */
  attribution: boolean
  /** Hanya untuk pemakaian nonkomersial (keluarga ini). */
  nonCommercial: boolean
}

export const LICENSE_POLICY: Record<LicenseId, LicensePolicy> = {
  cc0: { label: 'CC0', autoFetch: true, commit: true, attribution: false, nonCommercial: false },
  'public-domain': { label: 'Domain publik', autoFetch: true, commit: true, attribution: false, nonCommercial: false },
  'cc-by': { label: 'CC BY', autoFetch: true, commit: true, attribution: true, nonCommercial: false },
  'cc-by-sa': { label: 'CC BY-SA', autoFetch: true, commit: false, attribution: true, nonCommercial: false },
  'cc-by-nc': { label: 'CC BY-NC', autoFetch: true, commit: false, attribution: true, nonCommercial: true },
  'cc-by-nc-sa': { label: 'CC BY-NC-SA', autoFetch: true, commit: false, attribution: true, nonCommercial: true },
  mit: { label: 'MIT', autoFetch: true, commit: true, attribution: true, nonCommercial: false },
  'apache-2.0': { label: 'Apache 2.0', autoFetch: true, commit: true, attribution: true, nonCommercial: false },
  'official-free': { label: 'Unduhan gratis resmi untuk latihan', autoFetch: true, commit: false, attribution: true, nonCommercial: true },
  paid: { label: 'Berbayar', autoFetch: false, commit: false, attribution: false, nonCommercial: true },
  restricted: { label: 'Hak cipta terbatas', autoFetch: false, commit: false, attribution: false, nonCommercial: true },
  unknown: { label: 'Lisensi belum dicek', autoFetch: false, commit: false, attribution: false, nonCommercial: true },
}

export const IMPORTERS = ['asdiv', 'gsm8k', 'arc-easy', 'openbookqa', 'opentdb', 'bebras'] as const
export type ImporterId = (typeof IMPORTERS)[number]

export const SOURCE_FORMATS = ['pdf', 'xml', 'jsonl', 'json', 'html', 'zip', 'other'] as const

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const text = (max: number) => z.string().trim().min(1).max(max)
const httpsUrl = z.url().refine((u) => u.startsWith('https://'), 'Alamat harus https://')

export const fetchSchema = z.discriminatedUnion('kind', [
  /** Satu atau beberapa berkas teks (XML, JSONL) lewat HTTPS. */
  z.object({ kind: z.literal('http-text'), urls: z.array(httpsUrl).min(1).max(6) }).strict(),
  /** Baris dataset Hugging Face lewat datasets-server (JSON, tanpa akun). */
  z.object({ kind: z.literal('hf-rows'), dataset: z.string().regex(/^[\w.-]+\/[\w.-]+$/), config: z.string().max(40), split: z.string().max(20) }).strict(),
  /** Open Trivia DB: kategori yang aman untuk anak dan hanya tingkat mudah. */
  z.object({ kind: z.literal('opentdb-api'), categories: z.array(z.number().int().min(9).max(32)).min(1).max(8) }).strict(),
  /** Folder di <KIRA_DATA_DIR>/sources yang diisi admin (misalnya tugas Bebras yang berlisensi). */
  z.object({ kind: z.literal('local-dir'), dir: z.string().regex(/^[a-z0-9-]+$/) }).strict(),
  /** PDF gratis resmi dari penyelenggara; masuk antrean impor tutor, tidak pernah ke repo. */
  z.object({ kind: z.literal('official-pdf'), urls: z.array(httpsUrl).min(1).max(40) }).strict(),
])
export type SourceFetch = z.infer<typeof fetchSchema>

export const sourceSchema = z
  .object({
    id: slug,
    name: text(80),
    site: httpsUrl,
    subjects: z.array(subject).min(1),
    grades: z.array(grade).min(1),
    /** Rentang tahun terbit, misalnya "2021-2025" atau "semua". */
    years: text(30).default('semua'),
    license: z.enum(LICENSES),
    licenseNote: text(300).optional(),
    licenseUrl: httpsUrl.optional(),
    /** Baris atribusi yang ditampilkan di konsol dan di berkas konten. */
    attribution: text(240),
    format: z.enum(SOURCE_FORMATS),
    /** auto: worker mengambil sendiri. manual-upload: tutor mengunggah PDF. listed: dicatat saja, belum bisa diambil. */
    access: z.enum(['auto', 'manual-upload', 'listed']),
    importer: z.enum(IMPORTERS).optional(),
    fetch: fetchSchema.optional(),
    /** Id lomba di content/competitions/catalog.json bila sumber ini paper lomba. */
    competition: slug.optional(),
    /** Jumlah baris baru paling banyak diproses per sumber dalam satu pembaruan mingguan. */
    maxPerRun: z.number().int().min(1).max(500).default(60),
    notes: text(400).optional(),
  })
  .strict()
  .superRefine((s, ctx) => {
    const policy = LICENSE_POLICY[s.license]
    const issue = (message: string, path: string) => ctx.addIssue({ code: 'custom', message, path: [path] })
    if (s.access === 'auto') {
      if (!policy.autoFetch) issue(`Lisensi ${policy.label} tidak membolehkan pengambilan otomatis. Pakai access manual-upload.`, 'access')
      if (!s.fetch) issue('Sumber otomatis butuh fetch.', 'fetch')
      if (s.fetch?.kind === 'official-pdf') {
        if (s.license !== 'official-free') issue('PDF resmi hanya boleh diambil bila lisensinya official-free.', 'license')
      } else if (s.fetch && !s.importer) issue('Sumber soal otomatis butuh importer.', 'importer')
      if (s.license === 'official-free' && s.fetch && s.fetch.kind !== 'official-pdf') issue('official-free hanya untuk fetch official-pdf.', 'license')
    } else if (s.fetch) {
      issue('fetch hanya untuk sumber access auto.', 'fetch')
    }
    if (policy.attribution && s.attribution.length < 8) issue('Atribusi wajib diisi.', 'attribution')
  })
export type Source = z.infer<typeof sourceSchema>

export const registrySchema = z
  .object({ version: z.literal(1), updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), sources: z.array(sourceSchema).max(300) })
  .strict()
  .superRefine((r, ctx) => {
    const seen = new Set<string>()
    r.sources.forEach((s, i) => {
      if (seen.has(s.id)) ctx.addIssue({ code: 'custom', message: `id sumber kembar: ${s.id}`, path: ['sources', i, 'id'] })
      seen.add(s.id)
    })
  })
export type Registry = z.infer<typeof registrySchema>

export function licensePolicy(id: LicenseId): LicensePolicy {
  return LICENSE_POLICY[id]
}

/** Worker boleh mengambil sumber ini sendiri. */
export function canAutoFetch(s: Source): boolean {
  return s.access === 'auto' && s.fetch !== undefined && LICENSE_POLICY[s.license].autoFetch
}

/** Boleh disimpan sebagai JSON konten di repo (hanya lisensi permisif, bukan paper resmi). */
export function canCommitToRepo(s: Source): boolean {
  return s.fetch?.kind !== 'official-pdf' && LICENSE_POLICY[s.license].commit
}

/** Host yang boleh dihubungi worker untuk sumber ini (semua URL di fetch, plus host API tetap). */
export function allowedHosts(s: Source): string[] {
  const f = s.fetch
  if (!f) return []
  switch (f.kind) {
    case 'http-text':
    case 'official-pdf':
      return [...new Set(f.urls.map((u) => new URL(u).hostname))]
    case 'hf-rows':
      return ['datasets-server.huggingface.co']
    case 'opentdb-api':
      return ['opentdb.com']
    case 'local-dir':
      return []
  }
}

/** "GSM8K (MIT). Cobbe dkk., OpenAI." untuk konsol dan berkas konten. */
export function attributionLine(s: Pick<Source, 'name' | 'license' | 'attribution'>): string {
  return `${s.name} (${LICENSE_POLICY[s.license].label}). ${s.attribution}`
}

/** Tag soal yang menandai sumber, misalnya src-gsm8k. Hanya huruf kecil, angka, tanda hubung. */
export function sourceTag(sourceId: string): string {
  return `src-${sourceId}`.slice(0, 40)
}
