import 'server-only'
import QRCode from 'qrcode'
import { and, eq, isNull } from 'drizzle-orm'
import { tables } from '@kira/db'
import { answerText, type ClientItem, type Item } from '@kira/content'
import type { PaperDTO, PrintLjkDTO, PrintPaperDTO } from '@/lib/dto'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import { inOrg } from '../db'
import { notFound } from '../errors'
import { presentForConsole } from './console-bank'
import { SUBJECT_ID_LABEL } from './console-common'
import { sheetLayout } from './console-ljk'
import { preset as presetById, resolveItems } from './content'

/**
 * C01 dan C02: paper A4, kunci jawaban, dan LJK. Teks kertas untuk anak dalam en-GB.
 * Opsi pilihan ganda dicetak dalam urutan asli (huruf sama dengan kunci dan LJK); kartu urutkan,
 * jodohkan, dan kelompokkan diacak dengan seed id paper, sama dengan yang dipakai penilaian LJK.
 */

const { paper, attempt, learnerProfile } = tables

type Q = PrintPaperDTO['sections'][number]['items'][number]

/** Petunjuk singkat di atas soal, paling banyak 12 kata per kalimat untuk kelas 1-2. */
export function paperInstructions(mode: PaperDTO['mode'], minutes: number, opts: { working: boolean }): string[] {
  const out = [mode === 'latihan' ? `Take about ${minutes} minutes.` : `You have ${minutes} minutes.`, 'Read each question twice.']
  if (opts.working) out.push('Show your working in the box.')
  out.push(mode === 'kertas' ? 'Mark your answers on the answer sheet.' : 'Write your answers on this paper.')
  return out
}

/**
 * Mode Kertas: bagian A (pilihan ganda, bulatan di LJK) dan bagian B (isian di LJK), mengikuti
 * nomor awal isian LJK. Mode lain satu bagian tanpa judul. Nomor soal tidak pernah diubah.
 */
export function paperSections(items: Q[], mode: PaperDTO['mode'], shortAnswerFrom: number | null): PrintPaperDTO['sections'] {
  if (mode !== 'kertas' || shortAnswerFrom === null || shortAnswerFrom <= 1) return [{ title: '', items }]
  return [
    { title: 'Part A: choose one answer', items: items.filter((q) => q.number < shortAnswerFrom) },
    { title: 'Part B: write the answer', items: items.filter((q) => q.number >= shortAnswerFrom) },
  ].filter((s) => s.items.length > 0)
}

function removedItem(ref: string): ClientItem {
  return { ref, type: 'mcq', skill: '', difficulty: 1, prompt: 'This question has been removed. Go on to the next one.', lang: 'en-GB', expectedSeconds: 0 }
}

export async function printPaperDTO(actor: Actor, paperId: string, opts: { withKey: boolean; learner: string | null; date: string | null }): Promise<PrintPaperDTO> {
  return inOrg(orgCtx(actor), async (tx) => {
    const [p] = await tx
      .select({ id: paper.id, code: paper.code, title: paper.title, subject: paper.subject, grade: paper.grade, minutes: paper.minutes, mode: paper.mode, itemRefs: paper.itemRefs })
      .from(paper)
      .where(and(eq(paper.id, paperId), isNull(paper.deletedAt)))
      .limit(1)
    if (!p) throw notFound('Paper tidak ditemukan.')
    const resolved = await resolveItems(tx, p.itemRefs)
    const items: Q[] = p.itemRefs.map((ref, i) => {
      const item: Item | undefined = resolved.get(ref)
      if (!item) return { number: i + 1, item: removedItem(ref), ...(opts.withKey ? { answerText: 'Removed', explanation: '' } : {}) }
      // Kertas learner tidak membawa kunci; kunci hanya di versi tutor.
      const shown = presentForConsole(item, { ref, seed: p.id, withKey: false })
      return { number: i + 1, item: shown, ...(opts.withKey ? { answerText: answerText(item), explanation: item.explanation } : {}) }
    })
    let learnerName: string | null = null
    if (opts.learner) {
      const [l] = await tx
        .select({ name: learnerProfile.name })
        .from(learnerProfile)
        .where(and(eq(learnerProfile.userId, opts.learner), isNull(learnerProfile.deletedAt)))
        .limit(1)
      learnerName = l?.name ?? null
    }
    const { shortAnswerFrom } = sheetLayout(
      p.itemRefs.map((ref) => ({ ref })),
      resolved,
    )
    const working = p.subject === 'math' && items.some((q) => ['numeric', 'clock', 'numberline', 'fraction'].includes(q.item.type))
    return {
      code: p.code,
      title: p.title,
      subject: p.subject,
      subjectLabel: SUBJECT_ID_LABEL[p.subject],
      grade: p.grade,
      minutes: p.minutes,
      instructions: paperInstructions(p.mode, p.minutes, { working }),
      learnerName,
      date: opts.date,
      sections: paperSections(items, p.mode, shortAnswerFrom),
      withKey: opts.withKey,
    }
  })
}

export async function printLjkDTO(actor: Actor, attemptId: string): Promise<PrintLjkDTO> {
  const sheet = await inOrg(orgCtx(actor), async (tx) => {
    const [a] = await tx
      .select({ id: attempt.id, code: attempt.code, title: attempt.title, items: attempt.items, refId: attempt.refId })
      .from(attempt)
      .where(and(eq(attempt.id, attemptId), eq(attempt.kind, 'paper'), eq(attempt.mode, 'kertas')))
      .limit(1)
    if (!a) throw notFound('Lembar jawaban tidak ditemukan.')
    const items = a.items as { ref: string }[]
    const resolved = await resolveItems(tx, items.map((i) => i.ref))
    let presetId: string | null = null
    if (a.refId) {
      const [p] = await tx.select({ presetId: paper.presetId }).from(paper).where(eq(paper.id, a.refId)).limit(1)
      presetId = p?.presetId ?? null
    }
    const layout = sheetLayout(items, resolved, presetId ? presetById(presetId) : null)
    return { code: a.code ?? a.id.slice(0, 8).toUpperCase(), title: a.title, questionCount: items.length, ...layout }
  })
  // QR hanya berisi kode lembar; nama learner tidak tercetak di LJK.
  const qrDataUrl = await QRCode.toDataURL(`KIRA:${sheet.code}`, { margin: 1, width: 240, errorCorrectionLevel: 'M' })
  return { ...sheet, qrDataUrl }
}
