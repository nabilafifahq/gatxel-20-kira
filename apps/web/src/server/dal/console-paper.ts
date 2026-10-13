import 'server-only'
import { randomBytes } from 'node:crypto'
import { and, asc, desc, eq, gte, inArray, isNull, like, sql } from 'drizzle-orm'
import { addDays, createRng, formatDateId, jakartaDate, weekStart, type IsoDate, type Rng } from '@kira/core'
import { tables } from '@kira/db'
import { ITEM_ID, type Item } from '@kira/content'
import { genRef, newSeed, parseGenRef, type Level } from '@kira/content/math'
import type { PaperBuilderDTO, PaperDTO, Subject } from '@/lib/dto'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import { auditTx } from '../audit'
import type { OrgContext, Tx } from '../db'
import { inOrg } from '../db'
import { conflict, invalid, notFound } from '../errors'
import type { SearchParams } from '../params'
import { spEnum, spInt, spString, spUuid } from '../params'
import { bankData, genCandidate, previewGenRef, presentForConsole, withStats, type BankData } from './console-bank'
import { SUBJECT_ID_LABEL } from './console-common'
import { shellIn } from './console-shell'
import { ORG_REF, poolForSkill, presets, promptPreview, resolveItems, skill, skillsFor, type PoolCandidate } from './content'
import { isRestDay } from './learner-core'

/**
 * T04 Penyusun paper: kolam soal per mapel dan grade, isi otomatis, simpan, masukkan ke rencana, hapus.
 * Paper disimpan di tabel `paper` (kode unik per org). Mode Kertas juga membuat attempt `paper`
 * yang lembar jawabannya (LJK) dicetak dan diisi tutor di Input LJK.
 */

const { paper, planWeek, planSlot, attempt, response, learnerProfile } = tables

export type PoolItem = PaperBuilderDTO['items'][number]
type PaperRow = Pick<typeof paper.$inferSelect, 'id' | 'code' | 'title' | 'subject' | 'grade' | 'minutes' | 'mode' | 'presetId' | 'itemRefs' | 'createdAt'>

export const PAPER_MAX_ITEMS = 60
const SUBJECTS: readonly Subject[] = ['math', 'english', 'science']

const paperCols = {
  id: paper.id,
  code: paper.code,
  title: paper.title,
  subject: paper.subject,
  grade: paper.grade,
  minutes: paper.minutes,
  mode: paper.mode,
  presetId: paper.presetId,
  itemRefs: paper.itemRefs,
  createdAt: paper.createdAt,
}

export function toPaperDTO(r: PaperRow): PaperDTO {
  return {
    id: r.id,
    title: r.title,
    subject: r.subject,
    grade: r.grade,
    minutes: r.minutes,
    mode: r.mode,
    presetId: r.presetId,
    itemRefs: r.itemRefs,
    createdAt: jakartaDate(r.createdAt),
    code: r.code,
  }
}

/** Paper yang belum dihapus, atau null. */
export async function loadPaper(tx: Tx, id: string): Promise<PaperRow | null> {
  const rows = await tx.select(paperCols).from(paper).where(and(eq(paper.id, id), isNull(paper.deletedAt))).limit(1)
  return rows[0] ?? null
}

/** Ref yang boleh masuk paper: soal repo, instans generator lengkap dengan seed, atau soal org. */
export function isPaperRef(ref: string): boolean {
  return ITEM_ID.test(ref) || parseGenRef(ref) !== null || ORG_REF.test(ref)
}

// ---------------------------------------------------------------------------
// Kode paper dan lembar: P-YYMM-NN dan L-YYMM-NN, nomor urut per bulan per org

export function codePrefix(letter: 'P' | 'L', date: IsoDate): string {
  return `${letter}-${date.slice(2, 4)}${date.slice(5, 7)}-`
}

/** Nomor berikutnya setelah kode dengan awalan yang sama, dua digit minimal. */
export function nextCode(prefix: string, existing: readonly string[]): string {
  let max = 0
  for (const c of existing) {
    if (!c.startsWith(prefix)) continue
    const n = Number(c.slice(prefix.length))
    if (Number.isInteger(n) && n > max) max = n
  }
  return `${prefix}${String(max + 1).padStart(2, '0')}`
}

function bump(code: string, prefix: string): string {
  return `${prefix}${String(Number(code.slice(prefix.length)) + 1).padStart(2, '0')}`
}

/** Sisipkan baris dengan kode unik; kode bentrok (tab lain menyimpan bersamaan) dicoba dengan nomor berikutnya. */
async function insertWithCode<T>(prefix: string, existing: string[], insert: (code: string) => Promise<T | undefined>): Promise<T> {
  let code = nextCode(prefix, existing)
  for (let i = 0; i < 20; i++) {
    const row = await insert(code)
    if (row) return row
    code = bump(code, prefix)
  }
  throw conflict('Kode baru belum bisa dibuat karena bentrok terus. Coba simpan lagi sebentar lagi.')
}

// ---------------------------------------------------------------------------
// Kolam soal untuk penyusun

export function poolItemFor(bank: BankData, ref: string, item: Item): PoolItem {
  const cand = genCandidate(ref)
  const entry = bank.byRef.get(cand ?? ref)
  const base = entry?.row ?? {
    ref,
    subject: item.skill[0] === 'm' ? 'math' : item.skill[0] === 'e' ? 'english' : 'science',
    grade: Number(item.skill[1]),
    skillId: item.skill,
    skillTitle: skill(item.skill)?.title ?? item.skill,
    type: item.type,
    difficulty: item.difficulty,
    promptPreview: '',
    source: cand ? 'generator' : item.source,
    tags: item.tags,
  }
  const row = withStats({ ...base, ref, type: item.type, difficulty: item.difficulty, promptPreview: promptPreview(item), tags: item.tags }, cand ?? ref, bank.stats)
  return { ...row, preview: presentForConsole(item, { ref, seed: 'pool', withKey: false }) }
}

/** Semua soal satu mapel dan grade. Generator tampil sebagai instans ber-seed tetap (sama dengan pratinjau bank). */
function poolFor(bank: BankData, subject: Subject, grade: number): PoolItem[] {
  return bank.entries.filter((e) => e.row.subject === subject && e.row.grade === grade).map((e) => poolItemFor(bank, e.item.id, e.item))
}

export type PaperBuilderParams = { learner: string | null; paper: string | null; subject: Subject | null; grade: number | null; add: string | null }

export function paperParams(sp: SearchParams): PaperBuilderParams {
  return {
    learner: spUuid(sp, 'learner'),
    paper: spUuid(sp, 'paper'),
    subject: spEnum(sp, 'mapel', SUBJECTS),
    grade: spInt(sp, 'grade', 1, 6),
    add: spString(sp, 'tambah', 120),
  }
}

/** Ref dari Tambah ke paper di bank: kandidat generator diganti instans pratinjaunya. */
export function addRefFrom(raw: string): string | null {
  const m = /^gen:([mes][1-6]\.[a-z0-9-]+):([1-5])$/.exec(raw)
  if (m) return previewGenRef(m[1]!, Number(m[2]))
  return isPaperRef(raw) ? raw : null
}

export async function paperBuilderDTO(actor: Actor, p: PaperBuilderParams): Promise<PaperBuilderDTO> {
  return inOrg(orgCtx(actor), async (tx) => {
    const { shell, learner } = await shellIn(tx, actor, p.learner)
    const current = p.paper ? await loadPaper(tx, p.paper) : null
    const saved = await tx.select(paperCols).from(paper).where(isNull(paper.deletedAt)).orderBy(desc(paper.createdAt)).limit(100)
    const bank = await bankData(tx)

    let draftRefs: string[] | undefined
    let addItem: Item | undefined
    if (!current && p.add) {
      const ref = addRefFrom(p.add)
      addItem = ref ? (await resolveItems(tx, [ref])).get(ref) : undefined
      if (ref && addItem) draftRefs = [ref]
    }
    const addEntry = addItem ? bank.byRef.get(genCandidate(addItem.id) ?? addItem.id) : undefined
    const subject: Subject = p.subject ?? current?.subject ?? addEntry?.row.subject ?? 'math'
    const grade = p.grade ?? current?.grade ?? addEntry?.row.grade ?? learner?.grade ?? 2

    const items = poolFor(bank, subject, grade)
    // Soal paper yang tidak ada di kolam ini (mapel atau grade lain, instans generator lain) tetap dikirim
    // supaya daftar Isi paper bisa menampilkannya.
    const have = new Set(items.map((i) => i.ref))
    const extra = [...(current?.itemRefs ?? []), ...(draftRefs ?? [])].filter((r) => !have.has(r))
    if (extra.length) {
      const resolved = await resolveItems(tx, extra)
      for (const ref of extra) {
        const item = resolved.get(ref)
        if (item && !have.has(ref)) {
          items.push(poolItemFor(bank, ref, item))
          have.add(ref)
        }
      }
    }
    return {
      shell,
      paper: current ? toPaperDTO(current) : null,
      items,
      presets: presets().map((x) => ({ id: x.id, title: `${x.title}: ${x.rules.questionCount} soal, ${x.rules.timeLimitMin} menit` })),
      papers: saved.map(toPaperDTO),
      ...(draftRefs ? { draftRefs } : {}),
    }
  })
}

// ---------------------------------------------------------------------------
// Isi otomatis

export type SkillPool = { skillId: string; candidates: PoolCandidate[] }

/** Ubah kandidat generator tanpa seed menjadi ref lengkap dengan seed baru (sama seperti quest harian). */
export function materialise(ref: string, rng: Rng): string {
  const m = /^gen:([mes][1-6]\.[a-z0-9-]+):([1-5])$/.exec(ref)
  return m ? genRef(m[1]!, Number(m[2]) as Level, newSeed(rng)) : ref
}

/**
 * Pilih `count` soal dari kolam beberapa skill: bergiliran per skill supaya tersebar, tanpa ref kembar,
 * generator boleh dipakai berulang dengan seed baru. Hasil diurutkan dari kesulitan terendah.
 */
export function pickPaperItems(pools: readonly SkillPool[], count: number, difficulty: readonly [number, number], rng: Rng): { ref: string; difficulty: number; skillId: string }[] {
  const [lo, hi] = difficulty
  const state = rng
    .shuffle(pools)
    .map((p) => ({ skillId: p.skillId, left: p.candidates.filter((c) => c.difficulty >= lo && c.difficulty <= hi) }))
    .filter((p) => p.left.length > 0)
  const used = new Set<string>()
  const out: { ref: string; difficulty: number; skillId: string }[] = []
  let progress = true
  while (out.length < count && progress) {
    progress = false
    for (const p of state) {
      if (out.length >= count) break
      for (let tries = 0; p.left.length > 0 && tries < 20; tries++) {
        const c = rng.pick(p.left)
        if (!c.unlimited) p.left.splice(p.left.indexOf(c), 1)
        const ref = c.unlimited ? materialise(c.ref, rng) : c.ref
        if (used.has(ref)) continue
        used.add(ref)
        out.push({ ref, difficulty: c.difficulty, skillId: p.skillId })
        progress = true
        break
      }
    }
  }
  return out.sort((a, b) => a.difficulty - b.difficulty)
}

export async function generatePaper(
  tx: Tx,
  ctx: OrgContext,
  input: { subject: Subject; grade: number; skillIds: string[]; count: number; difficulty: [number, number] },
): Promise<{ itemRefs: string[]; items: PoolItem[] }> {
  const [lo, hi] = input.difficulty
  if (lo > hi) throw invalid(`Kesulitan terendah (${lo}) lebih besar dari tertinggi (${hi}). Tukar keduanya.`)
  const all = skillsFor(input.subject, input.grade).map((s) => s.id)
  const unknown = input.skillIds.filter((id) => !skill(id))
  if (unknown.length) throw invalid(`Skill ${unknown.slice(0, 3).join(', ')} tidak dikenal. Muat ulang halaman lalu pilih skill lagi.`)
  const skillIds = input.skillIds.length ? [...new Set(input.skillIds)] : all
  const pools: SkillPool[] = []
  for (const id of skillIds) pools.push({ skillId: id, candidates: await poolForSkill(tx, ctx.orgId, id, { allowManual: false, paperOnly: true }) })
  const rng = createRng(`${ctx.userId}:${Date.now()}:${randomBytes(6).toString('hex')}`)
  const picked = pickPaperItems(pools, input.count, [lo, hi], rng)
  const where = `${SUBJECT_ID_LABEL[input.subject]} Grade ${input.grade}`
  if (picked.length === 0) {
    throw invalid(
      `Tidak ada soal ${where} dengan kesulitan ${lo} sampai ${hi}${input.skillIds.length ? ' di skill yang dipilih' : ''}. Longgarkan kesulitan atau pilih skill lain.`,
    )
  }
  const refs = picked.map((p) => p.ref)
  const resolved = await resolveItems(tx, refs)
  const bank = await bankData(tx)
  const ok = refs.filter((r) => resolved.has(r))
  return { itemRefs: ok, items: ok.map((r) => poolItemFor(bank, r, resolved.get(r)!)) }
}

// ---------------------------------------------------------------------------
// Simpan

export type SavePaperInput = { paperId?: string; title: string; subject: Subject; grade: number; minutes: number; mode: PaperDTO['mode']; itemRefs: string[] }

export async function savePaper(tx: Tx, ctx: OrgContext, input: SavePaperInput): Promise<{ paperId: string; code: string; created: boolean }> {
  const dup = input.itemRefs.find((r, i) => input.itemRefs.indexOf(r) !== i)
  if (dup) throw invalid(`Soal ${dup} ada dua kali di paper. Hapus salah satunya lalu simpan lagi.`)
  const resolved = await resolveItems(tx, input.itemRefs)
  const missing = input.itemRefs.filter((r) => !resolved.has(r))
  if (missing.length) {
    throw invalid(`${missing.length === 1 ? 'Soal' : `${missing.length} soal`} ${missing.slice(0, 3).join(', ')} tidak ada lagi di bank soal. Hapus dari paper lalu simpan lagi.`)
  }
  const values = { title: input.title, subject: input.subject, grade: input.grade, minutes: input.minutes, mode: input.mode, itemRefs: input.itemRefs }

  if (input.paperId) {
    const rows = await tx
      .update(paper)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(paper.id, input.paperId), isNull(paper.deletedAt)))
      .returning({ id: paper.id, code: paper.code })
    if (!rows[0]) throw notFound('Paper ini tidak ditemukan, mungkin sudah dihapus. Muat ulang halaman lalu simpan sebagai paper baru.')
    const synced = await syncOpenSheets(tx, rows[0].id, input.title, input.itemRefs, resolved)
    await auditTx(tx, ctx, 'paper.updated', rows[0].id, { items: input.itemRefs.length, mode: input.mode, sheetsSynced: synced })
    return { paperId: rows[0].id, code: rows[0].code, created: false }
  }

  const prefix = codePrefix('P', jakartaDate())
  const existing = (await tx.select({ code: paper.code }).from(paper).where(like(paper.code, `${prefix}%`))).map((r) => r.code)
  const row = await insertWithCode(prefix, existing, async (code) => {
    const rows = await tx
      .insert(paper)
      .values({ orgId: ctx.orgId, code, ...values, createdBy: ctx.userId })
      .onConflictDoNothing()
      .returning({ id: paper.id, code: paper.code })
    return rows[0]
  })
  await auditTx(tx, ctx, 'paper.created', row.id, { items: input.itemRefs.length, mode: input.mode })
  return { paperId: row.id, code: row.code, created: true }
}

function attemptItems(refs: readonly string[], resolved: Map<string, Item>) {
  return refs.map((ref, i) => ({ ref, section: 'core' as const, position: i + 1, difficulty: resolved.get(ref)?.difficulty ?? 3 }))
}

/**
 * Lembar Kertas yang masih kosong ikut memakai isi paper terbaru, supaya paper yang dicetak ulang
 * dan LJK-nya tetap sama nomornya. Lembar yang sudah ada jawabannya tidak diubah.
 */
async function syncOpenSheets(tx: Tx, paperId: string, title: string, refs: string[], resolved: Map<string, Item>): Promise<number> {
  const open = await tx
    .select({ id: attempt.id, n: sql<number>`(select count(*) from ${response} where ${response.attemptId} = ${attempt.id})::int` })
    .from(attempt)
    .where(and(eq(attempt.kind, 'paper'), eq(attempt.mode, 'kertas'), eq(attempt.status, 'in_progress'), eq(attempt.refId, paperId)))
  const empty = open.filter((a) => a.n === 0).map((a) => a.id)
  if (empty.length) await tx.update(attempt).set({ title, items: attemptItems(refs, resolved) }).where(inArray(attempt.id, empty))
  return empty.length
}

// ---------------------------------------------------------------------------
// Masukkan ke rencana

/** Skill terbanyak di paper, supaya slot rencana tetap punya skill untuk ditampilkan. */
export function dominantSkill(skills: readonly string[]): string | null {
  const count = new Map<string, number>()
  for (const s of skills) count.set(s, (count.get(s) ?? 0) + 1)
  let best: string | null = null
  for (const [s, n] of count) if (best === null || n > count.get(best)!) best = s
  return best
}

export async function assignPaper(
  tx: Tx,
  ctx: OrgContext,
  input: { paperId: string; learnerId: string; date: IsoDate },
): Promise<{ mode: PaperDTO['mode']; learnerName: string; attemptId: string | null; weekStatus: 'draft' | 'published' }> {
  const p = await loadPaper(tx, input.paperId)
  if (!p) throw notFound('Paper ini tidak ditemukan, mungkin sudah dihapus. Muat ulang halaman penyusun paper.')
  const [learner] = await tx
    .select()
    .from(learnerProfile)
    .where(and(eq(learnerProfile.userId, input.learnerId), isNull(learnerProfile.deletedAt)))
    .limit(1)
  if (!learner) throw notFound('Learner tidak ditemukan. Muat ulang halaman lalu pilih learner lagi.')
  const today = jakartaDate()
  if (input.date < today) throw invalid(`Tanggal ${formatDateId(input.date)} sudah lewat. Pilih hari ini atau tanggal sesudahnya.`, { date: 'Tanggal sudah lewat.' })
  if (input.date > addDays(today, 366)) throw invalid('Tanggal terlalu jauh. Pilih tanggal dalam satu tahun ke depan.', { date: 'Tanggal terlalu jauh.' })
  if (await isRestDay(tx, learner, input.date)) {
    throw invalid(`${formatDateId(input.date, true)} adalah hari libur ${learner.name}. Pilih tanggal lain, atau ubah hari libur di Rencana.`, { date: 'Hari libur.' })
  }

  const monday = weekStart(input.date)
  await tx.insert(planWeek).values({ orgId: ctx.orgId, learnerId: learner.userId, weekStart: monday, status: 'draft', createdBy: ctx.userId }).onConflictDoNothing()
  const [week] = await tx
    .select({ id: planWeek.id, status: planWeek.status })
    .from(planWeek)
    .where(and(eq(planWeek.learnerId, learner.userId), eq(planWeek.weekStart, monday)))
    .limit(1)
  if (!week) throw notFound('Rencana minggu itu tidak bisa dibuat. Muat ulang halaman lalu coba lagi.')

  const resolved = await resolveItems(tx, p.itemRefs)
  // Satu slot quest per mapel per hari: slot lama mapel ini diganti paper.
  const old = await tx
    .select({ id: planSlot.id, paperId: planSlot.paperId, mode: planSlot.mode })
    .from(planSlot)
    .where(and(eq(planSlot.learnerId, learner.userId), eq(planSlot.date, input.date), eq(planSlot.subject, p.subject), eq(planSlot.kind, 'quest')))
  if (old.length) await tx.delete(planSlot).where(inArray(planSlot.id, old.map((o) => o.id)))
  for (const o of old) {
    if (o.mode === 'kertas' && o.paperId && o.paperId !== p.id) await dropEmptySheets(tx, learner.userId, o.paperId, input.date)
  }
  await tx.insert(planSlot).values({
    orgId: ctx.orgId,
    planWeekId: week.id,
    learnerId: learner.userId,
    date: input.date,
    subject: p.subject,
    kind: 'quest',
    skillId: dominantSkill(p.itemRefs.map((r) => resolved.get(r)?.skill).filter((s): s is string => Boolean(s))),
    paperId: p.id,
    mode: p.mode,
    questionCount: p.itemRefs.length,
  })
  await tx.update(planWeek).set({ updatedAt: new Date() }).where(eq(planWeek.id, week.id))

  let attemptId: string | null = null
  if (p.mode === 'kertas') attemptId = await ensureSheet(tx, ctx, p, learner.userId, input.date, resolved)
  await auditTx(tx, ctx, 'paper.assigned', p.id, { learnerId: learner.userId, date: input.date, mode: p.mode, ...(attemptId ? { attemptId } : {}) })
  return { mode: p.mode, learnerName: learner.name, attemptId, weekStatus: week.status }
}

/** Lembar Kertas untuk paper, learner, dan tanggal ini. Lembar yang sudah ada dipakai lagi supaya LJK yang sudah dicetak tetap berlaku. */
async function ensureSheet(tx: Tx, ctx: OrgContext, p: PaperRow, learnerId: string, date: IsoDate, resolved: Map<string, Item>): Promise<string> {
  const [open] = await tx
    .select({ id: attempt.id })
    .from(attempt)
    .where(
      and(
        eq(attempt.learnerId, learnerId),
        eq(attempt.kind, 'paper'),
        eq(attempt.mode, 'kertas'),
        eq(attempt.status, 'in_progress'),
        eq(attempt.refId, p.id),
        sql`${attempt.result}->>'planDate' = ${date}`,
      ),
    )
    .limit(1)
  if (open) return open.id
  const prefix = codePrefix('L', jakartaDate())
  const existing = (await tx.select({ code: attempt.code }).from(attempt).where(like(attempt.code, `${prefix}%`))).map((r) => r.code ?? '')
  const row = await insertWithCode(prefix, existing, async (code) => {
    const rows = await tx
      .insert(attempt)
      .values({
        orgId: ctx.orgId,
        learnerId,
        kind: 'paper',
        refId: p.id,
        mode: 'kertas',
        subject: p.subject,
        title: p.title,
        items: attemptItems(p.itemRefs, resolved),
        status: 'in_progress',
        code,
        // Tanggal rencana, untuk mengenali lembar ini bila slotnya diganti.
        result: { planDate: date },
      })
      .onConflictDoNothing()
      .returning({ id: attempt.id })
    return rows[0]
  })
  return row.id
}

/** Lembar Kertas yang belum diisi untuk slot yang diganti dihapus supaya tidak menunggu di Input LJK. */
async function dropEmptySheets(tx: Tx, learnerId: string, paperId: string, date: IsoDate): Promise<void> {
  const rows = await tx
    .select({ id: attempt.id, n: sql<number>`(select count(*) from ${response} where ${response.attemptId} = ${attempt.id})::int` })
    .from(attempt)
    .where(
      and(
        eq(attempt.learnerId, learnerId),
        eq(attempt.kind, 'paper'),
        eq(attempt.mode, 'kertas'),
        eq(attempt.status, 'in_progress'),
        eq(attempt.refId, paperId),
        sql`${attempt.result}->>'planDate' = ${date}`,
      ),
    )
  const empty = rows.filter((r) => r.n === 0).map((r) => r.id)
  if (empty.length) await tx.delete(attempt).where(inArray(attempt.id, empty))
}

// ---------------------------------------------------------------------------
// Hapus

export async function deletePaper(tx: Tx, ctx: OrgContext, paperId: string): Promise<void> {
  const p = await loadPaper(tx, paperId)
  if (!p) throw notFound('Paper ini sudah tidak ada. Muat ulang halaman penyusun paper.')
  const today = jakartaDate()
  const slots = await tx
    .select({ date: planSlot.date, status: planWeek.status, name: learnerProfile.name })
    .from(planSlot)
    .innerJoin(planWeek, eq(planWeek.id, planSlot.planWeekId))
    .innerJoin(learnerProfile, eq(learnerProfile.userId, planSlot.learnerId))
    .where(and(eq(planSlot.paperId, paperId), gte(planSlot.date, today)))
    .orderBy(asc(planSlot.date))
  // Rencana yang sudah terbit dipakai learner; draf ikut ditahan supaya tidak terbit dengan paper yang sudah dihapus.
  const first = slots.find((s) => s.status === 'published') ?? slots[0]
  if (first) {
    const more = slots.length > 1 ? ` dan ${slots.length - 1} slot lain` : ''
    throw conflict(
      `Paper ini masih ada di rencana ${first.name}, ${formatDateId(first.date, true)}${first.status === 'draft' ? ' (draf)' : ''}${more}. Ganti atau hapus slot itu di Rencana dulu, lalu hapus paper.`,
    )
  }
  await tx.update(paper).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(paper.id, paperId))
  await auditTx(tx, ctx, 'paper.deleted', paperId, { code: p.code })
}
