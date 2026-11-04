import 'server-only'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { jakartaDate, newCard, reviewCard, type CardState } from '@kira/core'
import { deckOn, effectiveOn } from '@kira/core/features'
import { tables } from '@kira/db'
import { findContentDir } from '@kira/content/load'
import { loadFlashcards, type Deck, type Flashcard } from '@kira/content/flashcards'
import type { LearnerShell } from '@/lib/dto'
import { getT } from '@/lib/i18n/server'
import type { OrgContext, Tx } from '../db'
import { invalid, notFound } from '../errors'
import { featureMapFor } from './learner-features'
import { learnerShell, loadLearner, lockLearnerScope } from './learner-core'
import { PERSONAL_DECK_ID, personalDeckFor } from './personal-deck'
import type { FigureSpec } from '@kira/figures/spec'

const { flashcardState, xpEvent } = tables

/** Kartu belajar: dek dari content/flashcards, jadwal ulang FSRS per anak per kartu, dan dek pribadi dari kamus. */

const g = globalThis as unknown as { __kiraDecks?: Deck[] }
function decks(): Deck[] {
  return (g.__kiraDecks ??= loadFlashcards(findContentDir()).decks)
}

export const SESSION_CARDS = 10
const XP_PER_CARD = 1
const XP_DAILY_CAP = 20

export type CardDTO = { id: string; front: string; back: string; say: string | null; figure: FigureSpec | null }
export type DeckRow = { id: string; subject: 'math' | 'english' | 'science'; grade: number; title: string; total: number; known: number; due: number; personal: boolean }
export type CardsHubDTO = { shell: LearnerShell; mode: 'cards' | 'vocab'; grade: number; decks: DeckRow[] }
export type CardSessionDTO = {
  shell: LearnerShell
  mode: 'cards' | 'vocab'
  deck: { id: string; title: string; subject: string; backLang: 'en-GB' | 'id'; personal: boolean }
  /** Kartu sesi ini: yang jatuh tempo dulu, lalu yang baru. */
  cards: CardDTO[]
  /** Semua kartu dek, untuk pilihan jawaban Vocab drill. */
  pool: { id: string; front: string; back: string }[]
}

const toDto = (c: Flashcard): CardDTO => ({ id: c.id, front: c.front, back: c.back, say: c.say ?? null, figure: c.figure ?? null })

type Resolved = { id: string; title: string; subject: Deck['subject']; grade: number; cards: Flashcard[]; backLang: 'en-GB' | 'id'; personal: boolean }

async function resolveDeck(tx: Tx, learnerId: string, grade: number, deckId: string): Promise<Resolved> {
  if (deckId === PERSONAL_DECK_ID) {
    const features = await featureMapFor(tx, learnerId)
    const p = effectiveOn(features, 'dictionary') ? await personalDeckFor(tx, learnerId) : null
    if (!p || p.cards.length === 0) throw notFound((await getT()).reading.errors.noDeck)
    return { id: PERSONAL_DECK_ID, title: p.title, subject: 'english', grade, cards: p.cards, backLang: p.backLang, personal: true }
  }
  const d = decks().find((x) => x.id === deckId)
  if (!d || !deckOn(await featureMapFor(tx, learnerId), d)) throw notFound((await getT()).reading.errors.noDeck)
  return { id: d.id, title: d.title, subject: d.subject, grade: d.grade, cards: d.cards, backLang: 'en-GB', personal: false }
}

async function statesOf(tx: Tx, learnerId: string, deckId: string): Promise<Map<string, { card: CardState; dueAt: Date }>> {
  const rows = await tx.select().from(flashcardState).where(and(eq(flashcardState.learnerId, learnerId), eq(flashcardState.deckId, deckId)))
  return new Map(rows.map((r) => [r.cardId, { card: r.card as CardState, dueAt: r.dueAt }]))
}

export async function cardsHubDTO(tx: Tx, learnerId: string, mode: 'cards' | 'vocab'): Promise<CardsHubDTO> {
  const learner = await loadLearner(tx, learnerId)
  const features = await featureMapFor(tx, learnerId)
  if (!effectiveOn(features, mode === 'vocab' ? 'vocab' : 'flashcards')) throw notFound()
  const now = new Date()
  const all: Resolved[] = decks()
    .filter((d) => deckOn(features, d) && (mode === 'cards' || d.subject === 'english'))
    .map((d) => ({ id: d.id, title: d.title, subject: d.subject, grade: d.grade, cards: d.cards, backLang: 'en-GB' as const, personal: false }))
  if (effectiveOn(features, 'dictionary')) {
    const p = await personalDeckFor(tx, learnerId)
    if (p && p.cards.length > 0) all.unshift({ id: PERSONAL_DECK_ID, title: p.title, subject: 'english', grade: learner.grade, cards: p.cards, backLang: p.backLang, personal: true })
  }
  // Satu query untuk semua dek: ada 295 dek, jadi query per dek membuat halaman ini sangat lambat.
  const states = await tx.select({ deckId: flashcardState.deckId, cardId: flashcardState.cardId, card: flashcardState.card, dueAt: flashcardState.dueAt }).from(flashcardState).where(eq(flashcardState.learnerId, learnerId))
  const byDeck = new Map<string, Map<string, { card: CardState; dueAt: Date }>>()
  for (const r of states) {
    const m = byDeck.get(r.deckId) ?? new Map<string, { card: CardState; dueAt: Date }>()
    m.set(r.cardId, { card: r.card as CardState, dueAt: r.dueAt })
    byDeck.set(r.deckId, m)
  }
  const rows: DeckRow[] = []
  for (const d of all) {
    const st = byDeck.get(d.id) ?? new Map<string, { card: CardState; dueAt: Date }>()
    let known = 0
    let due = 0
    for (const c of d.cards) {
      const s = st.get(c.id)
      if (!s) continue
      if (s.card.state === 'review') known++
      if (s.dueAt <= now) due++
    }
    rows.push({ id: d.id, subject: d.subject, grade: d.grade, title: d.title, total: d.cards.length, known, due, personal: d.personal })
  }
  // Kelas anak lebih dulu, lalu kelas yang dekat dengan kelasnya.
  rows.sort((a, b) => Number(b.personal) - Number(a.personal) || Math.abs(a.grade - learner.grade) - Math.abs(b.grade - learner.grade) || a.subject.localeCompare(b.subject) || a.title.localeCompare(b.title))
  return { shell: await learnerShell(tx, learner), mode, grade: learner.grade, decks: rows }
}

export async function cardSessionDTO(tx: Tx, learnerId: string, deckId: string, mode: 'cards' | 'vocab'): Promise<CardSessionDTO> {
  const learner = await loadLearner(tx, learnerId)
  const features = await featureMapFor(tx, learnerId)
  if (!effectiveOn(features, mode === 'vocab' ? 'vocab' : 'flashcards')) throw notFound()
  const d = await resolveDeck(tx, learnerId, learner.grade, deckId)
  if (!deckOn(features, d)) throw notFound()
  const st = await statesOf(tx, learnerId, d.id)
  const now = new Date()
  const byDue = (a: Flashcard, b: Flashcard) => st.get(a.id)!.dueAt.getTime() - st.get(b.id)!.dueAt.getTime()
  const due = d.cards.filter((c) => st.has(c.id) && st.get(c.id)!.dueAt <= now).sort(byDue)
  const fresh = d.cards.filter((c) => !st.has(c.id))
  const later = d.cards.filter((c) => st.has(c.id) && st.get(c.id)!.dueAt > now).sort(byDue)
  const cards = [...due, ...fresh, ...later].slice(0, SESSION_CARDS).map(toDto)
  return {
    shell: await learnerShell(tx, learner),
    mode,
    deck: { id: d.id, title: d.title, subject: d.subject, backLang: d.backLang, personal: d.personal },
    cards,
    pool: d.cards.map((c) => ({ id: c.id, front: c.front, back: c.back })),
  }
}

export const finishSchema = z
  .object({
    deckId: z.string().regex(/^[a-z0-9-]{2,61}$/),
    results: z.array(z.object({ cardId: z.string().regex(/^[a-z0-9-]{1,61}$/), knew: z.boolean() }).strict()).min(1).max(SESSION_CARDS),
  })
  .strict()

/** Simpan hasil satu putaran kartu: jadwal FSRS per kartu dan sedikit XP (dibatasi per hari). Tidak menyentuh streak. */
export async function finishCards(tx: Tx, ctx: OrgContext, learnerId: string, raw: unknown): Promise<{ xp: number; knew: number; total: number }> {
  const input = finishSchema.safeParse(raw)
  if (!input.success) throw invalid((await getT()).reading.errors.badResults)
  // Batas XP harian dibaca dan ditulis di bawah kunci: dek berbeda yang dikirim serentak tidak melewati batas.
  await lockLearnerScope(tx, 'flashcards', learnerId)
  const learner = await loadLearner(tx, learnerId)
  const d = await resolveDeck(tx, learnerId, learner.grade, input.data.deckId)
  const valid = new Set(d.cards.map((c) => c.id))
  const seen = new Set<string>()
  const now = new Date()
  let knew = 0
  for (const r of input.data.results) {
    if (!valid.has(r.cardId) || seen.has(r.cardId)) throw invalid((await getT()).reading.errors.unknownCard)
    seen.add(r.cardId)
    const [row] = await tx
      .select()
      .from(flashcardState)
      .where(and(eq(flashcardState.learnerId, learnerId), eq(flashcardState.deckId, d.id), eq(flashcardState.cardId, r.cardId)))
      .limit(1)
    const base = row ? (row.card as CardState) : newCard(now)
    const next = reviewCard(base, r.knew ? 'good' : 'again', now)
    await tx
      .insert(flashcardState)
      .values({ learnerId, orgId: ctx.orgId, deckId: d.id, cardId: r.cardId, card: next, dueAt: new Date(next.due) })
      .onConflictDoUpdate({ target: [flashcardState.learnerId, flashcardState.deckId, flashcardState.cardId], set: { card: next, dueAt: new Date(next.due), updatedAt: now } })
    if (r.knew) knew++
  }
  const date = jakartaDate()
  const given = await tx.select({ amount: xpEvent.amount }).from(xpEvent).where(and(eq(xpEvent.learnerId, learnerId), eq(xpEvent.reason, 'flashcards'), eq(xpEvent.date, date)))
  const used = given.reduce((n, r) => n + r.amount, 0)
  const xp = Math.max(0, Math.min(knew * XP_PER_CARD, XP_DAILY_CAP - used))
  if (xp > 0) await tx.insert(xpEvent).values({ orgId: ctx.orgId, learnerId, amount: xp, reason: 'flashcards', ref: d.id, date })
  return { xp, knew, total: input.data.results.length }
}
