import 'server-only'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { jakartaDate, scoreWithPreset } from '@kira/core'
import { tables } from '@kira/db'
import { checkAnswer, keyOf, normaliseText, parseNumber, type CheckStatus, type ClientItem, type Item, type Preset } from '@kira/content'
import type { LjkDTO } from '@/lib/dto'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import { auditTx } from '../audit'
import type { OrgContext, Tx } from '../db'
import { inOrg } from '../db'
import { conflict, invalid, notFound } from '../errors'
import { presentForConsole } from './console-bank'
import { shellIn } from './console-shell'
import { preset as presetById, resolveItems, skill } from './content'
import { effectiveRules } from './learner-competition'
import { applyOutcome, awardBadges, grantXp, loadLearner } from './learner-core'

/**
 * T06 Input LJK: lembar jawaban kertas (attempt `paper`, mode `kertas`) diisi tutor, lalu dinilai di server.
 * Nomor sebelum `shortAnswerFrom` memakai bulatan A sampai D atau E; nomor sesudahnya kotak isian.
 * Opsi pilihan ganda dicetak dalam urutan asli, jadi huruf A sama dengan opsi indeks 0.
 */

const { attempt, response, learnerProfile, paper } = tables

type AttemptItem = { ref: string; section: string; position: number; difficulty: number }

export const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const

/** "A" sampai "E" (huruf besar atau kecil) menjadi indeks opsi 0 sampai 4. */
export function letterIndex(v: string): number | null {
  const t = v.trim().toUpperCase()
  const i = (LETTERS as readonly string[]).indexOf(t)
  return i >= 0 ? i : null
}

export function indexLetter(i: number): string | null {
  return LETTERS[i] ?? null
}

/** Lima bulatan bila preset lomba memakai lima pilihan atau ada soal pilihan ganda dengan lima opsi. */
export function optionCountFor(items: readonly Item[], preset?: Preset | null): 4 | 5 {
  if (preset?.rules.optionCount === 5) return 5
  return items.some((i) => i.type === 'mcq' && i.options.length >= 5) ? 5 : 4
}

/** Nomor pertama yang bukan pilihan ganda; dari nomor itu LJK memakai kotak isian. */
export function shortAnswerFromFor(items: readonly Item[]): number | null {
  const i = items.findIndex((it) => it.type !== 'mcq')
  return i < 0 ? null : i + 1
}

function lettersIn(raw: string): number[] {
  return [...raw.toUpperCase().replace(/[^A-Z]/g, '')].map((ch) => ch.charCodeAt(0) - 65)
}

function numbersIn(raw: string, n: number): number[] {
  const t = raw.trim()
  if (/^\d+$/.test(t) && t.length === n && n <= 9) return [...t].map(Number)
  return (t.match(/\d+/g) ?? []).map(Number)
}

/**
 * Isian tutor dari LJK menjadi bentuk jawaban yang sama dengan jawaban tablet, supaya `checkAnswer`
 * dipakai apa adanya. `shown` adalah soal seperti tercetak (urutan kartu urutkan, jodohkan, dan
 * kelompokkan mengikuti seed paper). Isian asli disimpan di `ljk` untuk ditampilkan lagi.
 */
export function ljkAnswer(item: Item, shown: ClientItem, raw: string): Record<string, unknown> {
  const v = raw.trim()
  const ljk = { ljk: v }
  switch (item.type) {
    case 'mcq': {
      let choice = letterIndex(v)
      if (choice === null) {
        const t = normaliseText(v, false)
        choice = item.options.findIndex((o) => o.text !== undefined && normaliseText(o.text, false) === t)
      }
      return { choice, ...ljk }
    }
    case 'multi': {
      const choices = [...new Set(lettersIn(v))].sort((a, b) => a - b)
      return { choices: choices.length ? choices : [-1], ...ljk }
    }
    case 'numeric': {
      // "12 cm" atau "12 apples": satuan di belakang angka diabaikan. Jawaban berupa kata tetap salah.
      const stripped = v.replace(/[\p{L}\s]+$/u, '')
      const value = parseNumber(v) === null && parseNumber(stripped) !== null ? stripped : v
      return { value, ...ljk }
    }
    case 'text': {
      const texts = item.blanks.length === 1 ? [v] : v.split(/[,;/]/).map((s) => s.trim())
      return { texts, ...ljk }
    }
    case 'numberline':
      return { position: parseNumber(v), ...ljk }
    case 'clock': {
      const m = /^(\d{1,2})\s*[:.\s]\s*(\d{1,2})$/.exec(v)
      return m ? { h: Number(m[1]), m: Number(m[2]), ...ljk } : { h: -1, m: -1, ...ljk }
    }
    case 'fraction': {
      const f = /^(\d+)\s*\/\s*(\d+)$/.exec(v)
      let shaded = -1
      if (f) {
        const a = Number(f[1])
        const b = Number(f[2])
        if (b > 0 && (a * item.parts) % b === 0) shaded = (a * item.parts) / b
      } else if (/^\d+$/.test(v)) shaded = Number(v)
      return { shaded, ...ljk }
    }
    case 'order': {
      // Angka urutan yang ditulis di kotak setiap kartu, dari atas ke bawah seperti tercetak.
      const n = item.items.length
      const nums = numbersIn(v, n)
      const order: number[] = Array.from({ length: n }, () => -1)
      ;(shown.orderItems ?? []).forEach((card, k) => {
        const pos = nums[k]
        if (pos !== undefined && pos >= 1 && pos <= n && order[pos - 1] === -1) order[pos - 1] = card.i
      })
      return { order, ...ljk }
    }
    case 'match': {
      // Huruf pasangan untuk nomor kiri 1, 2, 3; huruf merujuk daftar kanan seperti tercetak.
      const letters = lettersIn(v)
      const right = shown.matchRight ?? []
      const pairs = item.pairs.map((_, i) => {
        const d = letters[i]
        return d !== undefined && d < right.length ? right[d]!.i : -1
      })
      return { pairs, ...ljk }
    }
    case 'sort': {
      // Huruf kelompok untuk setiap kartu, dari atas ke bawah seperti tercetak.
      const letters = lettersIn(v)
      const groups: number[] = Array.from({ length: item.items.length }, () => -1)
      ;(shown.sortItems ?? []).forEach((card, k) => {
        const g = letters[k]
        if (g !== undefined && g < item.groups.length) groups[card.i] = g
      })
      return { groups, ...ljk }
    }
    case 'write':
    case 'speak':
    case 'draw':
    case 'photo':
      return { text: v, ...ljk }
    default:
      // Jenis soal layar saja (tidak masuk kertas): isian disimpan apa adanya dan dinilai salah.
      return { value: v, ...ljk }
  }
}

/** Jawaban tersimpan kembali menjadi isian LJK. */
export function storedToLjk(answer: unknown): string | null {
  if (!answer || typeof answer !== 'object') return null
  const a = answer as Record<string, unknown>
  if (typeof a.ljk === 'string' && a.ljk !== '') return a.ljk
  if (typeof a.choice === 'number') return indexLetter(a.choice)
  if (typeof a.value === 'string' && a.value !== '') return a.value
  return null
}

export type SheetScore = { raw: number; max: number; scaled: number | null; correct: number; wrong: number; blank: number; pending: number; label: string }

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10).replace('.', ',')
}

/** Nilai lembar: benar dari jumlah soal, atau aturan preset lomba bila paper memakai preset. */
export function scoreSheet(statuses: readonly CheckStatus[], preset?: Preset | null): SheetScore {
  const count = (s: CheckStatus) => statuses.filter((x) => x === s).length
  const correct = count('correct')
  const wrong = count('wrong')
  const blank = count('blank')
  const pending = count('pending')
  let raw = correct
  let max = statuses.length
  let scaled: number | null = null
  if (preset) {
    const s = scoreWithPreset(
      effectiveRules(preset, statuses.length),
      statuses.map((st, i) => ({ position: i + 1, status: st === 'correct' ? 'correct' : st === 'wrong' ? 'wrong' : 'blank' })),
    )
    raw = s.raw
    max = s.max
    scaled = s.scaled
  }
  let label = `${fmt(raw)} dari ${fmt(max)}`
  if (scaled !== null && preset?.rules.scaleTo) label += ` (skor ${fmt(scaled)} dari ${fmt(preset.rules.scaleTo)})`
  if (pending > 0) label += `, ${pending} soal menunggu nilai tutor`
  return { raw, max, scaled, correct, wrong, blank, pending, label }
}

// ---------------------------------------------------------------------------
// Data

type SheetRow = { id: string; code: string | null; title: string; learnerId: string; learnerName: string; items: AttemptItem[]; refId: string | null; subject: string; result: unknown }

async function paperPresets(tx: Tx, paperIds: string[]): Promise<Map<string, Preset>> {
  const out = new Map<string, Preset>()
  const ids = [...new Set(paperIds)]
  if (!ids.length) return out
  // Paper yang sudah dihapus tetap dibaca: lembarnya masih bisa dinilai.
  const rows = await tx.select({ id: paper.id, presetId: paper.presetId }).from(paper).where(inArray(paper.id, ids))
  for (const r of rows) {
    const p = r.presetId ? presetById(r.presetId) : undefined
    if (p) out.set(r.id, p)
  }
  return out
}

/** Bentuk LJK satu lembar: jumlah bulatan dan nomor awal isian. Soal yang tidak ditemukan dianggap isian. */
export function sheetLayout(items: readonly { ref: string }[], resolved: Map<string, Item>, preset?: Preset | null): { optionCount: 4 | 5; shortAnswerFrom: number | null } {
  const list = items.map((it) => resolved.get(it.ref))
  const firstShort = list.findIndex((x) => !x || x.type !== 'mcq')
  return { optionCount: optionCountFor(list.filter((x): x is Item => Boolean(x)), preset), shortAnswerFrom: firstShort < 0 ? null : firstShort + 1 }
}

export async function ljkDTO(actor: Actor, p: { learner: string | null; lembar: string | null }): Promise<LjkDTO> {
  return inOrg(orgCtx(actor), async (tx) => {
    const { shell } = await shellIn(tx, actor, p.learner)
    const rows = (await tx
      .select({
        id: attempt.id,
        code: attempt.code,
        title: attempt.title,
        learnerId: attempt.learnerId,
        learnerName: learnerProfile.name,
        items: attempt.items,
        refId: attempt.refId,
        subject: attempt.subject,
        result: attempt.result,
      })
      .from(attempt)
      .innerJoin(learnerProfile, eq(learnerProfile.userId, attempt.learnerId))
      .where(and(eq(attempt.kind, 'paper'), eq(attempt.mode, 'kertas'), eq(attempt.status, 'in_progress')))
      .orderBy(desc(attempt.startedAt))) as SheetRow[]
    const resolved = await resolveItems(tx, [...new Set(rows.flatMap((r) => r.items.map((i) => i.ref)))])
    const presets = await paperPresets(tx, rows.map((r) => r.refId).filter((x): x is string => Boolean(x)))
    const ids = rows.map((r) => r.id)
    const entered = ids.length
      ? await tx
          .select({ attemptId: response.attemptId, n: sql<number>`count(*) filter (where ${response.answer} is not null)::int` })
          .from(response)
          .where(and(inArray(response.attemptId, ids), eq(response.attemptNo, 1)))
          .groupBy(response.attemptId)
      : []
    const sheets: LjkDTO['sheets'] = rows.map((r) => ({
      attemptId: r.id,
      code: r.code ?? r.id.slice(0, 8).toUpperCase(),
      title: r.title,
      learnerName: r.learnerName,
      questionCount: r.items.length,
      ...sheetLayout(r.items, resolved, r.refId ? presets.get(r.refId) : null),
      entered: entered.find((e) => e.attemptId === r.id)?.n ?? 0,
    }))
    // Tanpa ?lembar= lembar pertama langsung terbuka; lembar yang sudah dinilai tidak dibuka lagi.
    const pick = p.lembar ? sheets.find((s) => s.attemptId === p.lembar) : sheets[0]
    let selected: LjkDTO['selected'] = null
    if (pick) {
      const saved = await tx
        .select({ position: response.position, answer: response.answer })
        .from(response)
        .where(and(eq(response.attemptId, pick.attemptId), eq(response.attemptNo, 1)))
      const answers: (string | null)[] = Array.from({ length: pick.questionCount }, () => null)
      for (const s of saved) if (s.position >= 1 && s.position <= answers.length) answers[s.position - 1] = storedToLjk(s.answer)
      const { entered: _e, ...rest } = pick
      selected = { ...rest, answers }
    }
    return { shell, sheets, selected }
  })
}

/** Simpan isian LJK (draf) atau simpan lalu nilai. Mengembalikan teks nilai, misalnya "27 dari 40". */
export async function saveLjk(tx: Tx, ctx: OrgContext, input: { attemptId: string; answers: (string | null)[]; submit: boolean }): Promise<{ score: string }> {
  const [a] = await tx
    .select({ id: attempt.id, learnerId: attempt.learnerId, items: attempt.items, refId: attempt.refId, subject: attempt.subject, status: attempt.status, result: attempt.result, code: attempt.code })
    .from(attempt)
    .where(and(eq(attempt.id, input.attemptId), eq(attempt.kind, 'paper'), eq(attempt.mode, 'kertas')))
    .limit(1)
    .for('update')
  if (!a) throw notFound('Lembar ini tidak ditemukan. Muat ulang halaman Input LJK.')
  if (a.status !== 'in_progress') throw conflict(`Lembar ${a.code ?? ''} sudah dinilai. Nilainya ada di riwayat attempt; muat ulang halaman untuk lembar lain.`)
  const items = a.items as AttemptItem[]
  if (input.answers.length !== items.length) {
    throw invalid(`Jumlah jawaban (${input.answers.length}) tidak sama dengan jumlah soal di lembar ini (${items.length}). Muat ulang halaman lalu isi lagi.`)
  }
  const resolved = await resolveItems(tx, items.map((i) => i.ref))
  const lost = items.filter((i) => !resolved.has(i.ref)).map((i) => i.position)
  if (lost.length) throw invalid(`Soal nomor ${lost.join(', ')} tidak ada lagi di bank soal, jadi lembar ini belum bisa dinilai. Kirim kode referensi ini ke pengelola Kira.`)
  const preset = a.refId ? (await paperPresets(tx, [a.refId])).get(a.refId) : undefined
  const { optionCount, shortAnswerFrom } = sheetLayout(items, resolved, preset)

  const fieldErrors: Record<string, string> = {}
  input.answers.forEach((v, i) => {
    if (v === null) return
    const pos = i + 1
    const isShort = shortAnswerFrom !== null && pos >= shortAnswerFrom
    if (!isShort) {
      const idx = letterIndex(v)
      if (idx === null || idx >= optionCount) fieldErrors[`answers.${i}`] = `Nomor ${pos}: pilih huruf A sampai ${LETTERS[optionCount - 1]}.`
    } else if (v.trim() === '' || v.length > 40) fieldErrors[`answers.${i}`] = `Nomor ${pos}: isian 1 sampai 40 huruf.`
  })
  const firstError = Object.values(fieldErrors)[0]
  if (firstError) throw invalid(`${firstError} Perbaiki lalu simpan lagi.`, fieldErrors)

  // Urutan kartu dan opsi sama dengan kertas tercetak (seed paper, lihat print.ts).
  const seed = a.refId ?? a.id
  const now = new Date()
  const graded = items.map((it, i) => {
    const item = resolved.get(it.ref)!
    const raw = input.answers[i]?.trim() || null
    const answer = raw === null ? null : ljkAnswer(item, presentForConsole(item, { ref: it.ref, seed, withKey: false }), raw)
    return { it, item, raw, answer, check: checkAnswer(keyOf(item), answer) }
  })

  const rows = graded
    .filter((g) => input.submit || g.raw !== null)
    .map((g) => ({
      orgId: ctx.orgId,
      attemptId: a.id,
      learnerId: a.learnerId,
      position: g.it.position,
      attemptNo: 1,
      itemRef: g.it.ref,
      skillId: g.item.skill,
      subject: a.subject,
      itemType: g.item.type,
      difficulty: g.item.difficulty,
      answer: g.answer,
      status: g.check.status,
      score: g.check.score,
      maxScore: 1,
      clientId: `ljk:${a.id}:${g.it.position}`,
      answeredAt: now,
    }))
  if (rows.length) {
    await tx
      .insert(response)
      .values(rows)
      .onConflictDoUpdate({
        target: [response.attemptId, response.position, response.attemptNo],
        set: {
          answer: sql`excluded.answer`,
          status: sql`excluded.status`,
          score: sql`excluded.score`,
          itemRef: sql`excluded.item_ref`,
          skillId: sql`excluded.skill_id`,
          itemType: sql`excluded.item_type`,
          difficulty: sql`excluded.difficulty`,
          clientId: sql`excluded.client_id`,
          answeredAt: sql`excluded.answered_at`,
        },
      })
  }
  if (!input.submit) {
    const cleared = graded.filter((g) => g.raw === null).map((g) => g.it.position)
    if (cleared.length) await tx.delete(response).where(and(eq(response.attemptId, a.id), eq(response.attemptNo, 1), inArray(response.position, cleared)))
    return { score: '' }
  }

  // Nilai: mesin belajar (theta, gerbang, Buku Koreksi) diperbarui untuk setiap jawaban yang bisa dinilai otomatis.
  const learner = await loadLearner(tx, a.learnerId)
  const date = jakartaDate()
  let xp = 0
  for (const g of graded) {
    if (g.check.status !== 'correct' && g.check.status !== 'wrong') continue
    const gained = await applyOutcome(tx, ctx, { learner, item: g.item, ref: g.it.ref, correct: g.check.status === 'correct', hintsUsed: 0, attemptNo: 1, timeMs: 0, mode: 'kertas', date, attemptId: a.id })
    if (gained > 0) await tx.update(response).set({ xp: gained }).where(and(eq(response.attemptId, a.id), eq(response.position, g.it.position), eq(response.attemptNo, 1)))
    xp += gained
  }
  await grantXp(tx, ctx, a.learnerId, 20, 'paper-done', a.id, date)
  xp += 20
  const newBadges = await awardBadges(tx, ctx, learner, date)

  const score = scoreSheet(graded.map((g) => g.check.status), preset)
  const byTopic = new Map<string, { label: string; right: number; total: number }>()
  for (const g of graded) {
    const label = skill(g.item.skill)?.title ?? g.item.skill
    const t = byTopic.get(label) ?? { label, right: 0, total: 0 }
    t.total++
    if (g.check.status === 'correct') t.right++
    byTopic.set(label, t)
  }
  const prev = (a.result ?? {}) as Record<string, unknown>
  await tx
    .update(attempt)
    .set({
      status: score.pending > 0 ? 'needs_grading' : 'graded',
      submittedAt: now,
      scoreRaw: score.raw,
      scoreMax: score.max,
      scoreScaled: score.scaled,
      xp,
      result: {
        ...(typeof prev.planDate === 'string' ? { planDate: prev.planDate } : {}),
        source: 'ljk',
        perfect: graded.length > 0 && score.correct === graded.length,
        olympiad: graded.some((g) => g.item.tags.includes('olympiad')),
        byTopic: [...byTopic.values()],
        timeUsedSec: 0,
        pending: score.pending,
        newBadges,
      },
    })
    .where(eq(attempt.id, a.id))
  await auditTx(tx, ctx, 'ljk.graded', a.id, { questions: graded.length, scoreRaw: score.raw, scoreMax: score.max, pending: score.pending })
  return { score: score.label }
}
