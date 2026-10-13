import 'server-only'
import { and, desc, eq, inArray, isNotNull, like, sql } from 'drizzle-orm'
import { z } from 'zod'
import { tables, type ImportStoredItem } from '@kira/db'
import { itemSchema, type Item, type Skill } from '@kira/content'
import { semanticProblems } from '@kira/content/load'
import type { ImportDTO, ImportItemDTO, Subject } from '@/lib/dto'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import { auditTx } from '../audit'
import type { OrgContext, Tx } from '../db'
import { inOrg } from '../db'
import { conflict, invalid, notFound } from '../errors'
import { deleteStored, limitFor, readStored, sniff, storeFile } from '../media'
import { cropPngFraction, PngError, type CropRect } from '../png-crop'
import { shellIn } from './console-shell'
import { enqueueAiJobTx, schemaIssues } from './console-studio'
import { competitions, presets, skillsFor } from './content'
import { normalizeSection, syncLibraryEntryTx, type BatchMeta } from './paper-library'

/**
 * T12 Impor paket resmi. Tutor mengunggah PDF paket milik keluarga; worker membaca soal dan tabel kunci
 * (job ai.import) ke `import_batch.items`. Setiap soal dicek tutor, lalu disetujui menjadi `org_item`
 * bersumber imported. Paket ESMO masuk koleksi `esmo:<mapel>:<n>` supaya muncul di layar ESMO learner.
 */

const { importBatch, media, orgItem } = tables

type ImportStatus = ImportStoredItem['status']
type Lang = 'id' | 'en-GB'

// ---------------------------------------------------------------------------
// Logika murni (diuji di test/import.test.ts)

// Sama dengan pengurai worker (apps/worker/src/handlers/import-parse.ts).
const KEY_TEXT = /\b(kunci\s*(?:jawaban|:)|jawaban\s*[:=]|jwb\s*[:=]|answer\s*[:=]|ans\s*[:=])/i
// eslint-disable-next-line no-control-regex -- karakter kontrol memang yang dicari di teks PDF
const MANGLED = /[\uFFFD\uE000-\uF8FF\u0001-\u0008\u000e-\u001f]|\u00C2[\u00BC-\u00BE]/
const SPLIT_FRACTION = /^\s*\d+\s+\d+\s*$/

/**
 * Status soal setelah diedit tutor. Edit menyelesaikan sisa teks kunci, pecahan rusak, dan kunci yang
 * tidak cocok (tutor memilih kunci sendiri) bila teksnya sudah bersih. Perlu dicek tetap sampai disetujui.
 */
export function statusAfterEdit(prev: ImportStatus, item: { prompt: string; options: string[]; answer: number | null }): ImportStatus {
  if (prev === 'needs-check') return 'needs-check'
  if (item.answer === null || item.answer >= item.options.length || item.options.length < 2 || item.options.some((o) => !o.trim()) || !item.prompt.trim()) return 'needs-check'
  const texts = [item.prompt, ...item.options]
  if (texts.some((t) => KEY_TEXT.test(t))) return 'leftover-key-text'
  if (texts.some((t) => MANGLED.test(t)) || item.options.some((o) => SPLIT_FRACTION.test(o))) return 'broken-fraction'
  return 'ok'
}

/** "Level 1" menjadi "level-1"; tag soal hanya huruf kecil, angka, dan tanda hubung. */
export function normalizeTag(label: string): string {
  return label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
}

/** Label dari isian tutor ("ESMO, Level 1"), paling banyak 10. */
export function parseLabels(raw: string): string[] {
  const out: string[] = []
  for (const part of raw.split(',')) {
    const t = part.replace(/\s+/g, ' ').trim().slice(0, 40)
    if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t)
  }
  return out.slice(0, 10)
}

export type CatalogEntry = { id: string; tags: string[]; langBySubject: Partial<Record<Subject, Lang>>; lang: Lang[] }

/** Lomba yang disebut di label atau nama berkas, misalnya ESMO atau KMNR. */
export function detectCompetition(labels: readonly string[], title: string, catalog: readonly CatalogEntry[]): CatalogEntry | null {
  const tokens = new Set(labels.map(normalizeTag).filter(Boolean))
  const words = `-${[...labels, title.replace(/\.pdf$/i, '')].map(normalizeTag).join('-')}-`
  for (const c of catalog) {
    if (tokens.has(c.id) || c.tags.some((t) => tokens.has(t))) return c
    if (words.includes(`-${c.id}-`) || c.tags.some((t) => words.includes(`-${t}-`))) return c
  }
  return null
}

const ID_WORDS = new Set(['yang', 'dan', 'adalah', 'berapa', 'dari', 'di', 'ke', 'ini', 'itu', 'untuk', 'dengan', 'tidak', 'pada', 'jika', 'maka', 'manakah', 'berikut', 'apakah', 'memiliki', 'banyak', 'jumlah', 'setiap', 'sama', 'hasil'])
const EN_WORDS = new Set(['the', 'is', 'are', 'what', 'which', 'how', 'many', 'of', 'and', 'to', 'in', 'has', 'have', 'there', 'each', 'does', 'following', 'number', 'total', 'than'])

/** Bahasa soal: English untuk mapel English, bahasa preset lomba bila ada, selain itu dari kata yang paling sering. */
export function detectLang(subject: Subject, competitionLang: Lang | null, texts: readonly string[]): Lang {
  if (subject === 'english') return 'en-GB'
  if (competitionLang) return competitionLang
  let id = 0
  let en = 0
  for (const t of texts) {
    for (const w of t.toLowerCase().split(/[^a-z]+/)) {
      if (ID_WORDS.has(w)) id++
      else if (EN_WORDS.has(w)) en++
    }
  }
  return id > en ? 'id' : 'en-GB'
}

export function competitionLang(c: CatalogEntry | null, subject: Subject): Lang | null {
  if (!c) return null
  return c.langBySubject[subject] ?? (c.lang.length === 1 ? c.lang[0]! : null)
}

/**
 * Skill untuk soal impor: skill grade itu yang paling khusus untuk lomba yang terdeteksi (misalnya m2.oly-esmo),
 * lalu skill olimpiade bila paketnya paket lomba, lalu skill pertama di urutan kurikulum.
 */
export function pickImportSkill(skills: readonly Skill[], competitionId: string | null): string | null {
  const ordered = [...skills].sort((a, b) => a.order - b.order)
  if (competitionId) {
    const listed = ordered.filter((s) => s.competitions.includes(competitionId)).sort((a, b) => a.competitions.length - b.competitions.length || a.order - b.order)
    if (listed[0]) return listed[0].id
    const oly = ordered.find((s) => s.strand === 'Oly')
    if (oly) return oly.id
  }
  return ordered[0]?.id ?? null
}

/** Tag soal impor: lomba, keep-order (opsi tidak diacak supaya sama dengan kertas), id untuk soal berbahasa Indonesia, lalu label tutor. */
export function importTags(labels: readonly string[], competition: CatalogEntry | null, lang: Lang): string[] {
  const required = [...(competition?.tags ?? []), 'keep-order']
  if (lang === 'id' && !required.includes('esmo')) required.push('id')
  const out = [...new Set(required)]
  for (const l of labels.map(normalizeTag)) if (l && !out.includes(l) && out.length < 10) out.push(l)
  return out.slice(0, 10)
}

export function nextPackNumber(collections: readonly string[], subject: string): number {
  let max = 0
  for (const c of collections) {
    const m = /^esmo:([a-z]+):(\d+)$/.exec(c)
    if (m && m[1] === subject) max = Math.max(max, Number(m[2]))
  }
  return max + 1
}

/** Rapikan teks PDF: tanda pisah di antara angka menjadi tanda minus, tanda pisah lain menjadi koma, spasi berlebih dibuang. */
export function cleanImportedText(s: string): string {
  return s
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*[\u2013\u2014]\s*/, '')
        .replace(/(\d)\s*[\u2013\u2014]\s*(?=\d)/g, '$1 - ')
        .replace(/\s*[\u2013\u2014]\s*/g, ', ')
        .replace(/[ \t]+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .join('\n')
}

const HINTS: Record<Lang, [string, string, string]> = {
  id: ['Baca soalnya sekali lagi pelan-pelan.', 'Coret dulu pilihan yang pasti salah.', 'Periksa lagi hitungan atau alasanmu sebelum memilih.'],
  'en-GB': ['Read the question again slowly.', 'Cross out the options you know are wrong.', 'Check your working before you choose.'],
}
const EXPLANATION: Record<Lang, string> = {
  id: 'Soal ini dari paket latihan resmi. Cocokkan jawabanmu dengan kunci di paket itu bersama tutor.',
  'en-GB': 'This question comes from an official practice pack. Check your answer with your tutor using the key in the pack.',
}

/** Soal pilihan ganda dari hasil impor, divalidasi dengan itemSchema dan pemeriksaan konten yang sama dengan content:check. */
export function buildImportedItem(
  s: Pick<ImportStoredItem, 'prompt' | 'options' | 'answer'> & { figure?: ImportStoredItem['figure'] },
  ctx: { skillId: string; lang: Lang; tags: string[] },
): { ok: true; item: Item } | { ok: false; message: string } {
  if (s.answer === null) return { ok: false, message: 'belum punya kunci' }
  const prompt = cleanImportedText(s.prompt)
  const options = s.options.map(cleanImportedText)
  if ([prompt, ...options].some((t) => KEY_TEXT.test(t))) return { ok: false, message: 'teksnya masih memuat kunci jawaban' }
  const parsed = itemSchema.safeParse({
    id: 'import',
    type: 'mcq',
    skill: ctx.skillId,
    difficulty: 3,
    prompt,
    lang: ctx.lang,
    options: options.map((text) => ({ text })),
    answer: s.answer,
    hints: HINTS[ctx.lang],
    explanation: EXPLANATION[ctx.lang],
    tags: ctx.tags,
    source: 'imported',
    ...(s.figure ? { figure: { kind: 'clip', mediaId: s.figure.mediaId, width: s.figure.width, height: s.figure.height, alt: s.figure.alt } } : {}),
  })
  if (!parsed.success) return { ok: false, message: schemaIssues(parsed.error, 2) }
  const problems = semanticProblems(parsed.data)
  if (problems.length > 0) return { ok: false, message: problems.slice(0, 2).join('; ') }
  return { ok: true, item: parsed.data }
}

function catalog(): CatalogEntry[] {
  return competitions().map((c) => {
    const ps = presets().filter((p) => p.competition === c.id)
    const tags = [...new Set(ps.flatMap((p) => p.itemTags).map(normalizeTag).filter(Boolean))]
    return {
      id: c.id,
      tags: tags.length > 0 ? tags : [c.id],
      langBySubject: Object.fromEntries(ps.map((p) => [p.subject, p.lang])) as Partial<Record<Subject, Lang>>,
      lang: c.lang,
    }
  })
}

// ---------------------------------------------------------------------------
// Data paket

const storedItem = z.object({
  number: z.number().int(),
  prompt: z.string(),
  options: z.array(z.string()),
  answer: z.number().int().nullable(),
  answerFromKey: z.number().int().nullable(),
  figureNote: z.string().nullable().optional(),
  page: z.number().int().nullable().optional(),
  status: z.enum(['ok', 'key-mismatch', 'leftover-key-text', 'broken-fraction', 'needs-check']),
  approved: z.boolean(),
  orgItemId: z.string().nullable().optional(),
  aiAnswer: z.number().int().nullable().optional(),
  keyCheck: z.enum(['agree', 'disagree', 'ai-only', 'skipped']).nullish(),
  figure: z.object({ mediaId: z.string().uuid(), width: z.number().int(), height: z.number().int(), alt: z.string() }).nullable().optional(),
})
type Stored = z.infer<typeof storedItem>

function storedItems(raw: unknown): (Stored | null)[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => {
    const p = storedItem.safeParse(x)
    return p.success ? p.data : null
  })
}

const mediaUrl = (id: string) => `/api/media/${id}`

export async function importDTO(actor: Actor, paket: string | null): Promise<ImportDTO> {
  const ctx = orgCtx(actor)
  return inOrg(ctx, async (tx) => {
    const { shell } = await shellIn(tx, actor, null)
    const rows = await tx
      .select({
        id: importBatch.id,
        title: importBatch.title,
        status: importBatch.status,
        error: importBatch.error,
        createdAt: importBatch.createdAt,
        itemCount: sql<number>`case when jsonb_typeof(${importBatch.items}) = 'array' then jsonb_array_length(${importBatch.items}) else 0 end`,
        approved: sql<number>`case when jsonb_typeof(${importBatch.items}) = 'array' then (select count(*)::int from jsonb_array_elements(${importBatch.items}) as e(v) where (e.v->>'approved') = 'true') else 0 end`,
      })
      .from(importBatch)
      .orderBy(desc(importBatch.createdAt))
      .limit(100)
    let selected: ImportDTO['selected'] = null
    if (paket) {
      const [b] = await tx
        .select({ id: importBatch.id, title: importBatch.title, subject: importBatch.subject, grade: importBatch.grade, tags: importBatch.tags, pages: importBatch.pages, items: importBatch.items, status: importBatch.status, competition: importBatch.competition, year: importBatch.year, section: importBatch.section, originalMinutes: importBatch.originalMinutes, source: importBatch.source })
        .from(importBatch)
        .where(eq(importBatch.id, paket))
        .limit(1)
      // Paket gagal dibaca tidak punya soal; daftar paket sudah menjelaskan langkah berikutnya.
      if (b && b.status !== 'failed') {
        const items: ImportItemDTO[] = []
        storedItems(b.items).forEach((it, index) => {
          if (!it) return
          const pageId = it.page ? b.pages[it.page - 1] : undefined
          items.push({
            index,
            number: it.number,
            prompt: it.prompt,
            options: it.options,
            answer: it.answer,
            answerFromKey: it.answerFromKey,
            figureNote: it.figureNote ?? null,
            pageImage: pageId ? mediaUrl(pageId) : null,
            // Soal tanpa kunci tidak bisa lolos: tampil di Perlu dicek supaya tutor memilih kuncinya.
            status: it.status === 'ok' && it.answer === null && !it.approved ? 'needs-check' : it.status,
            approved: it.approved,
            keyCheck: it.keyCheck ?? null,
            aiAnswer: it.aiAnswer ?? null,
            figure: it.figure ? { url: mediaUrl(it.figure.mediaId), width: it.figure.width, height: it.figure.height, alt: it.figure.alt } : null,
          })
        })
        selected = {
          id: b.id,
          title: b.title,
          subject: b.subject,
          grade: b.grade,
          tags: b.tags,
          pages: b.pages.map(mediaUrl),
          items,
          meta: { competition: b.competition, year: b.year, section: b.section, originalMinutes: b.originalMinutes, source: b.source },
        }
      }
    }
    return {
      shell,
      batches: rows.map((r) => ({ id: r.id, title: r.title, status: r.status, createdAt: r.createdAt.toISOString(), itemCount: Number(r.itemCount), approved: Number(r.approved), error: r.status === 'failed' ? (r.error ?? null) : null })),
      selected,
      competitions: competitions().map((c) => ({ id: c.id, name: c.name })),
    }
  })
}

// ---------------------------------------------------------------------------
// Unggah, edit, setujui

export type UploadInput = { buf: Buffer; title: string; subject: Subject; grade: number; labels: string[]; meta?: Partial<BatchMeta> }

export async function createImportBatch(actor: Actor, input: UploadInput): Promise<string> {
  const max = limitFor('pdf')
  if (input.buf.length > max) throw invalid(`Ukuran file lebih dari ${Math.round(max / 1024 / 1024)} MB. Pisahkan PDF per bagian, lalu unggah satu per satu.`, { file: 'File terlalu besar.' })
  const type = sniff(input.buf)
  if (!type || type.mime !== 'application/pdf') throw invalid('Berkas ini bukan PDF. Simpan atau ekspor paketnya sebagai PDF, lalu unggah lagi.', { file: 'Berkas bukan PDF.' })
  const ctx = orgCtx(actor)
  const stored = await storeFile(actor.orgId, input.buf, 'pdf')
  try {
    return await inOrg(ctx, async (tx) => {
      const [m] = await tx
        .insert(media)
        .values({ orgId: actor.orgId, learnerId: null, kind: 'pdf', path: stored.path, mime: 'application/pdf', size: input.buf.length, sha256: stored.sha256, createdBy: actor.userId })
        .returning({ id: media.id })
      const [b] = await tx
        .insert(importBatch)
        .values({
          orgId: actor.orgId,
          title: input.title,
          subject: input.subject,
          grade: input.grade,
          tags: input.labels,
          mediaId: m!.id,
          status: 'uploaded',
          createdBy: actor.userId,
          competition: input.meta?.competition ?? null,
          year: input.meta?.year ?? null,
          section: input.meta?.section?.trim() ? normalizeSection(input.meta.section) : null,
          originalMinutes: input.meta?.originalMinutes ?? null,
          source: input.meta?.source ?? null,
        })
        .returning({ id: importBatch.id })
      await enqueueAiJobTx(tx, ctx, { kind: 'import', batchId: b!.id, mediaId: m!.id, subject: input.subject, grade: input.grade, title: input.title })
      await auditTx(tx, ctx, 'import.uploaded', b!.id, { size: input.buf.length, subject: input.subject, grade: input.grade })
      return b!.id
    })
  } catch (e) {
    await deleteStored(stored.path).catch(() => undefined)
    throw e
  }
}

async function lockBatch(tx: Tx, batchId: string) {
  const [b] = await tx
    .select({ id: importBatch.id, title: importBatch.title, subject: importBatch.subject, grade: importBatch.grade, tags: importBatch.tags, status: importBatch.status, items: importBatch.items, createdBy: importBatch.createdBy, competition: importBatch.competition, year: importBatch.year, section: importBatch.section, originalMinutes: importBatch.originalMinutes, source: importBatch.source })
    .from(importBatch)
    .where(eq(importBatch.id, batchId))
    .limit(1)
    .for('update')
  if (!b) throw notFound('Paket impor tidak ditemukan. Muat ulang halaman impor.')
  if (b.status === 'done') throw conflict('Semua soal paket ini sudah disetujui. Ubah soalnya lewat Bank soal.')
  if (b.status !== 'review') throw conflict('Paket ini belum selesai dibaca. Tunggu sampai statusnya Perlu dicek, lalu muat ulang halaman.')
  return b
}

export type ItemEdit = { batchId: string; index: number; prompt: string; options: string[]; answer: number | null }

export async function updateImportItemTx(tx: Tx, ctx: OrgContext, input: ItemEdit): Promise<void> {
  const b = await lockBatch(tx, input.batchId)
  const raw = Array.isArray(b.items) ? [...(b.items as unknown[])] : []
  const it = storedItems(raw)[input.index]
  if (!it) throw notFound('Soal itu tidak ada di paket ini. Muat ulang halaman impor.')
  if (it.approved) throw conflict(`Soal ${it.number} sudah disetujui dan masuk Bank soal. Ubah soalnya lewat Bank soal.`)
  if (input.answer !== null && input.answer >= input.options.length) {
    throw invalid(`Kunci harus salah satu opsi A sampai ${'ABCDE'[input.options.length - 1]}.`, { answer: 'Pilih kunci dari opsi yang ada.' })
  }
  raw[input.index] = { ...(raw[input.index] as object), prompt: input.prompt, options: input.options, answer: input.answer, status: statusAfterEdit(it.status, input) }
  await tx.update(importBatch).set({ items: raw, updatedAt: new Date() }).where(eq(importBatch.id, b.id))
  await auditTx(tx, ctx, 'import.item.updated', b.id, { index: input.index })
}

export async function approveImportItemsTx(tx: Tx, ctx: OrgContext, input: { batchId: string; indexes: number[] }): Promise<{ created: number }> {
  const b = await lockBatch(tx, input.batchId)
  const raw = Array.isArray(b.items) ? [...(b.items as unknown[])] : []
  const items = storedItems(raw)
  const indexes = [...new Set(input.indexes)].sort((x, y) => x - y)
  for (const i of indexes) if (!items[i]) throw notFound('Ada soal yang tidak ditemukan di paket ini. Muat ulang halaman impor.')
  const pending = indexes.filter((i) => !items[i]!.approved)
  if (pending.length === 0) return { created: 0 }

  // Lomba dari isian tutor lebih dipercaya daripada tebakan dari label dan nama berkas.
  const competition = (b.competition ? catalog().find((c) => c.id === b.competition) : null) ?? detectCompetition(b.tags, b.title, catalog())
  const lang = detectLang(b.subject, competitionLang(competition, b.subject), items.map((x) => x?.prompt ?? ''))
  const skillId = pickImportSkill(skillsFor(b.subject, b.grade), competition?.id ?? null)
  if (!skillId) throw invalid(`Belum ada skill ${b.subject} Grade ${b.grade} di konten. Ubah grade paket lewat unggah ulang.`)
  const tags = importTags(b.tags, competition, lang)

  const built = pending.map((i) => ({ i, r: buildImportedItem(items[i]!, { skillId, lang, tags }) }))
  const failed = built.filter((x) => !x.r.ok)
  if (failed.length > 0) {
    const numbers = failed.map((x) => items[x.i]!.number)
    const first = failed[0]!.r as { ok: false; message: string }
    throw invalid(`Soal ${numbers.slice(0, 5).join(', ')}${numbers.length > 5 ? ' dan lainnya' : ''} belum bisa disetujui: ${first.message}. Perbaiki lewat Edit soal, lalu setujui lagi.`)
  }

  // Paket ESMO: satu koleksi per paket, nomor paket berikutnya untuk mapel itu.
  let collection: string | null = null
  if (competition?.id === 'esmo' && (b.subject === 'math' || b.subject === 'english')) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`kira-esmo:${ctx.orgId}`}))`)
    const earlier = items.map((x) => x?.orgItemId).filter((x): x is string => Boolean(x))
    if (earlier.length > 0) {
      const [row] = await tx.select({ c: orgItem.collection }).from(orgItem).where(and(inArray(orgItem.id, earlier), isNotNull(orgItem.collection))).limit(1)
      collection = row?.c ?? null
    }
    if (!collection) {
      const rows = await tx.selectDistinct({ c: orgItem.collection }).from(orgItem).where(like(orgItem.collection, `esmo:${b.subject}:%`))
      collection = `esmo:${b.subject}:${nextPackNumber(rows.map((r) => r.c ?? ''), b.subject)}`
    }
  }

  const now = new Date()
  for (const { i, r } of built) {
    if (!r.ok) continue
    const { id: _id, ...body } = r.item
    void _id
    const [row] = await tx
      .insert(orgItem)
      .values({
        orgId: ctx.orgId,
        skillId,
        subject: b.subject,
        grade: b.grade,
        body,
        source: 'imported',
        tags: r.item.tags,
        collection,
        position: collection ? i + 1 : null,
        createdBy: b.createdBy,
        approvedBy: ctx.userId,
        approvedAt: now,
      })
      .returning({ id: orgItem.id })
    raw[i] = { ...(raw[i] as object), approved: true, orgItemId: row!.id }
  }
  const allDone = storedItems(raw).every((x) => x?.approved)
  await tx.update(importBatch).set({ items: raw, updatedAt: now, ...(allDone ? { status: 'done' as const } : {}) }).where(eq(importBatch.id, b.id))
  await syncLibraryEntryTx(tx, ctx, { id: b.id, subject: b.subject, grade: b.grade, createdBy: b.createdBy, meta: metaOf(b), refs: libraryRefs(storedItems(raw)), name: b.title })
  await auditTx(tx, ctx, 'import.items.approved', b.id, { count: built.length, collection })
  return { created: built.length }
}

function metaOf(b: { competition: string | null; year: number | null; section: string | null; originalMinutes: number | null; source: string | null }): BatchMeta {
  return { competition: b.competition, year: b.year, section: b.section, originalMinutes: b.originalMinutes, source: b.source }
}

/** Ref org soal yang sudah disetujui, urut nomor soal, untuk pustaka paper. */
export function libraryRefs(items: readonly (Stored | null)[]): string[] {
  return items
    .filter((x): x is Stored => Boolean(x?.approved && x.orgItemId))
    .sort((a, b) => a.number - b.number)
    .map((x) => `org:${x.orgItemId}`)
}

// ---------------------------------------------------------------------------
// Data paper, gambar soal

export type MetaEdit = { batchId: string } & BatchMeta

export async function updateImportMetaTx(tx: Tx, ctx: OrgContext, input: MetaEdit): Promise<void> {
  const [b] = await tx
    .select({ id: importBatch.id, title: importBatch.title, subject: importBatch.subject, grade: importBatch.grade, createdBy: importBatch.createdBy, items: importBatch.items })
    .from(importBatch)
    .where(eq(importBatch.id, input.batchId))
    .limit(1)
    .for('update')
  if (!b) throw notFound('Paket impor tidak ditemukan. Muat ulang halaman impor.')
  if (input.competition && !competitions().some((c) => c.id === input.competition)) throw invalid('Lomba itu tidak ada di katalog. Pilih dari daftar.', { competition: 'Pilih lomba dari daftar.' })
  const meta: BatchMeta = { competition: input.competition, year: input.year, section: input.section?.trim() ? normalizeSection(input.section) : null, originalMinutes: input.originalMinutes, source: input.source }
  await tx.update(importBatch).set({ ...meta, updatedAt: new Date() }).where(eq(importBatch.id, b.id))
  await syncLibraryEntryTx(tx, ctx, { id: b.id, subject: b.subject, grade: b.grade, createdBy: b.createdBy, meta, refs: libraryRefs(storedItems(b.items)), name: b.title })
  await auditTx(tx, ctx, 'import.meta.updated', b.id, { competition: meta.competition, year: meta.year, section: meta.section })
}

export type FigureInput = { batchId: string; index: number; page: number; rect: CropRect; alt: string }

/**
 * Potong gambar dari halaman PDF (kotak pecahan 0 sampai 1) dan pasang ke satu soal. Hasilnya disimpan sebagai
 * media org jenis figure; soal yang disetujui kemudian memuat figur jenis clip. Gambar lama soal itu dihapus.
 */
export async function attachFigureTx(tx: Tx, ctx: OrgContext, input: FigureInput): Promise<{ url: string }> {
  const b = await lockBatch(tx, input.batchId)
  const raw = Array.isArray(b.items) ? [...(b.items as unknown[])] : []
  const it = storedItems(raw)[input.index]
  if (!it) throw notFound('Soal itu tidak ada di paket ini. Muat ulang halaman impor.')
  if (it.approved) throw conflict(`Soal ${it.number} sudah disetujui dan masuk Bank soal. Gambar tidak bisa diubah dari sini.`)
  const [batchRow] = await tx.select({ pages: importBatch.pages }).from(importBatch).where(eq(importBatch.id, b.id)).limit(1)
  const pageId = batchRow?.pages[input.page - 1]
  if (!pageId) throw notFound('Halaman itu tidak ada di paket ini. Muat ulang halaman impor.')
  const [pageMedia] = await tx.select({ path: media.path }).from(media).where(and(eq(media.id, pageId), eq(media.kind, 'page'))).limit(1)
  if (!pageMedia) throw notFound('Gambar halaman tidak ditemukan di server. Unggah ulang PDF-nya.')
  let cropped: ReturnType<typeof cropPngFraction>
  try {
    cropped = cropPngFraction(await readStored(pageMedia.path), input.rect)
  } catch (e) {
    if (e instanceof PngError) throw invalid(e.message, { rect: e.message })
    throw e
  }
  const stored = await storeFile(ctx.orgId, cropped.png, 'png')
  try {
    const [row] = await tx
      .insert(media)
      .values({ orgId: ctx.orgId, learnerId: null, kind: 'figure', path: stored.path, mime: 'image/png', size: cropped.png.length, sha256: stored.sha256, createdBy: ctx.userId })
      .returning({ id: media.id })
    const old = it.figure
    raw[input.index] = { ...(raw[input.index] as object), figure: { mediaId: row!.id, width: cropped.width, height: cropped.height, alt: input.alt } }
    await tx.update(importBatch).set({ items: raw, updatedAt: new Date() }).where(eq(importBatch.id, b.id))
    if (old) await dropFigureMedia(tx, old.mediaId)
    await auditTx(tx, ctx, 'import.figure.attached', b.id, { index: input.index, page: input.page })
    return { url: mediaUrl(row!.id) }
  } catch (e) {
    await deleteStored(stored.path).catch(() => undefined)
    throw e
  }
}

export async function removeFigureTx(tx: Tx, ctx: OrgContext, input: { batchId: string; index: number }): Promise<void> {
  const b = await lockBatch(tx, input.batchId)
  const raw = Array.isArray(b.items) ? [...(b.items as unknown[])] : []
  const it = storedItems(raw)[input.index]
  if (!it) throw notFound('Soal itu tidak ada di paket ini. Muat ulang halaman impor.')
  if (it.approved) throw conflict(`Soal ${it.number} sudah disetujui dan masuk Bank soal. Gambar tidak bisa diubah dari sini.`)
  if (!it.figure) return
  raw[input.index] = { ...(raw[input.index] as object), figure: null }
  await tx.update(importBatch).set({ items: raw, updatedAt: new Date() }).where(eq(importBatch.id, b.id))
  await dropFigureMedia(tx, it.figure.mediaId)
  await auditTx(tx, ctx, 'import.figure.removed', b.id, { index: input.index })
}

async function dropFigureMedia(tx: Tx, mediaId: string): Promise<void> {
  const [m] = await tx.select({ path: media.path }).from(media).where(and(eq(media.id, mediaId), eq(media.kind, 'figure'))).limit(1)
  if (!m) return
  await tx.delete(media).where(eq(media.id, mediaId))
  await deleteStored(m.path).catch(() => undefined)
}
