import 'server-only'
import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm'
import {
  ALL_ITEMS,
  BOSS_QUESTIONS,
  BOSS_WIN_AT,
  bossWinAt,
  BOSS_WIN_STARS,
  CARDS,
  CARD_SETS,
  DRILL_STARS_BY_COUNT,
  HATCH_AT_STARS,
  READING_STARS_BY_COUNT,
  STORY,
  WEEK_GOAL_DAYS,
  anyItem,
  cardCloseness,
  cardEarned,
  cardHint,
  cardNumber,
  certificatesFor,
  chaptersOpen,
  cleanPetName,
  diminishing,
  isPetKind,
  jakartaDate,
  nextBossCard,
  nextStage,
  petGreeting,
  petStage,
  sessionStars,
  setComplete,
  treatById,
  weekStart,
  daysBetween,
  type CardProgress,
  type CertificateDays,
  type IsoDate,
  type PetKind,
} from '@kira/core'
import { TOPICS, topicProgress, type TopicId } from '@kira/content/knowledge'
import { tables } from '@kira/db'
import type { OrgContext, Tx } from '../db'
import { conflict, forbidden, invalid, notFound } from '../errors'
import { loadQuizState } from './arena-state'
import { subjectOfSkill } from './content'
import { learnerShell, loadLearner, skillStates, streakFor } from './learner-core'
import { autoSkill, buildQuestItems, type AttemptItem } from './learner-session'
import { isFeatureOn } from './learner-features'
import type { LearnerShell } from '@/lib/dto'
import type { AlbumDTO, BossDTO, MedalDTO, PetDTO, ShopDTO, StarsDTO, StoryDTO, TrophyDTO, WorldHubDTO, WorldSessionGain } from '@/lib/dto-world'

const { starLedger, worldState, worldItem, worldCard, contestMedal, skillState, dayRecord, quest, learnerProfile, attempt } = tables

/**
 * Kira World. Semua perubahan bintang dan barang dihitung dan diperiksa di server. Bintang tidak pernah
 * berkurang karena libur; teman tidak pernah sakit atau pergi.
 */

// ---------------------------------------------------------------------------
// Dompet bintang

async function orgOf(tx: Tx, learnerId: string): Promise<string> {
  const [row] = await tx.select({ orgId: learnerProfile.orgId }).from(learnerProfile).where(eq(learnerProfile.userId, learnerId)).limit(1)
  if (!row) throw notFound('Learner tidak ditemukan.')
  return row.orgId
}

/**
 * Tambah bintang. Sekali per sumber (idempotent): memanggil lagi dengan `source` yang sama tidak menambah.
 * Mengembalikan jumlah yang benar-benar ditambahkan (0 bila sumber sudah pernah dihitung).
 */
export async function grantStars(tx: Tx, learnerId: string, amount: number, reason: string, source: string = reason, date: IsoDate = jakartaDate()): Promise<number> {
  if (!Number.isInteger(amount) || amount <= 0) return 0
  const orgId = await orgOf(tx, learnerId)
  const rows = await tx.insert(starLedger).values({ orgId, learnerId, amount, reason, source, date }).onConflictDoNothing().returning({ id: starLedger.id })
  return rows.length > 0 ? amount : 0
}

export async function starTotals(tx: Tx, learnerId: string): Promise<StarsDTO> {
  const [r] = await tx
    .select({
      balance: sql<number>`coalesce(sum(${starLedger.amount}), 0)::int`,
      earned: sql<number>`coalesce(sum(${starLedger.amount}) filter (where ${starLedger.amount} > 0), 0)::int`,
    })
    .from(starLedger)
    .where(eq(starLedger.learnerId, learnerId))
  return { balance: r?.balance ?? 0, earned: r?.earned ?? 0 }
}

/** Kunci per anak supaya dua pembelian bersamaan tidak membuat saldo negatif. */
async function lockLearner(tx: Tx, learnerId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'world:' + learnerId}))`)
}

/** Pakai bintang. Saldo diperiksa di server di bawah kunci. Sumber unik membuat panggilan ganda tidak memotong dua kali. */
export async function spendStars(tx: Tx, learnerId: string, price: number, source: string, reason = 'spend'): Promise<void> {
  if (!Number.isInteger(price) || price <= 0) throw invalid('That price is not valid.')
  await lockLearner(tx, learnerId)
  const { balance } = await starTotals(tx, learnerId)
  if (balance < price) throw conflict('You need more stars for that.')
  const orgId = await orgOf(tx, learnerId)
  const rows = await tx.insert(starLedger).values({ orgId, learnerId, amount: -price, reason, source, date: jakartaDate() }).onConflictDoNothing().returning({ id: starLedger.id })
  if (rows.length === 0) throw conflict('That was already done.')
}

async function countToday(tx: Tx, learnerId: string, reason: string, date: IsoDate): Promise<number> {
  const [r] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(starLedger)
    .where(and(eq(starLedger.learnerId, learnerId), eq(starLedger.reason, reason), eq(starLedger.date, date), sql`${starLedger.amount} > 0`))
  return r?.n ?? 0
}

/** Bintang untuk sesi wajib yang selesai. Dipanggil dari penyelesaian sesi. */
export async function awardSessionStars(tx: Tx, learnerId: string, input: { attemptId: string; required: boolean; perfect: boolean; retry: boolean; date: IsoDate }): Promise<WorldSessionGain> {
  if (!input.required) return { stars: 0, cards: [] }
  const s = sessionStars({ perfect: input.perfect, retry: input.retry })
  let stars = 0
  if (s.base > 0) stars += await grantStars(tx, learnerId, s.base, 'session', `session:${input.attemptId}`, input.date)
  if (s.perfect > 0) stars += await grantStars(tx, learnerId, s.perfect, 'perfect', `perfect:${input.attemptId}`, input.date)
  const cards = await syncCards(tx, learnerId)
  return { stars, cards: cards.map((c) => c.id) }
}

/** Bab Reading yang selesai: menurun per hari. */
export async function awardReadingStars(tx: Tx, learnerId: string, attemptId: string, date: IsoDate): Promise<number> {
  const n = await countToday(tx, learnerId, 'reading', date)
  return grantStars(tx, learnerId, diminishing(READING_STARS_BY_COUNT, n), 'reading', `reading:${attemptId}`, date)
}

/** Drill (Quick Maths, Quiz Arena) yang selesai: menurun per hari. */
export async function awardDrillStars(tx: Tx, learnerId: string, roundId: string, date: IsoDate): Promise<number> {
  const n = await countToday(tx, learnerId, 'drill', date)
  const got = await grantStars(tx, learnerId, diminishing(DRILL_STARS_BY_COUNT, n), 'drill', `drill:${roundId}`, date)
  if (got > 0) await syncCards(tx, learnerId)
  return got
}

// ---------------------------------------------------------------------------
// Keadaan dunia

type PetState = { kind: PetKind; name: string; hearts: number; hatchedOn: IsoDate; lastTreat?: { id: string; at: string } }
type Equipped = { petCostume?: string | null; petHome?: string | null; frame?: string | null }
type Progress = { boss?: Record<string, string | null>; storySeen?: number }
export type WorldRow = { pet: PetState | null; equipped: Equipped; progress: Progress }

async function loadWorld(tx: Tx, learnerId: string): Promise<WorldRow> {
  const [row] = await tx.select().from(worldState).where(eq(worldState.learnerId, learnerId)).limit(1)
  if (!row) return { pet: null, equipped: {}, progress: {} }
  return { pet: (row.pet as PetState | null) ?? null, equipped: (row.equipped as Equipped) ?? {}, progress: (row.progress as Progress) ?? {} }
}

async function saveWorld(tx: Tx, learnerId: string, patch: Partial<{ pet: PetState | null; equipped: Equipped; progress: Progress }>): Promise<void> {
  const orgId = await orgOf(tx, learnerId)
  const cur = await loadWorld(tx, learnerId)
  const next = { pet: patch.pet !== undefined ? patch.pet : cur.pet, equipped: patch.equipped ?? cur.equipped, progress: patch.progress ?? cur.progress }
  await tx
    .insert(worldState)
    .values({ learnerId, orgId, pet: next.pet, equipped: next.equipped, progress: next.progress })
    .onConflictDoUpdate({ target: worldState.learnerId, set: { pet: next.pet, equipped: next.equipped, progress: next.progress, updatedAt: new Date() } })
}

async function ownedItems(tx: Tx, learnerId: string): Promise<Set<string>> {
  const rows = await tx.select({ id: worldItem.itemId }).from(worldItem).where(eq(worldItem.learnerId, learnerId))
  const set = new Set(rows.map((r) => r.id))
  set.add('home-meadow')
  return set
}

async function giveItem(tx: Tx, learnerId: string, itemId: string, source: string): Promise<boolean> {
  const orgId = await orgOf(tx, learnerId)
  const rows = await tx.insert(worldItem).values({ learnerId, orgId, itemId, source }).onConflictDoNothing().returning({ id: worldItem.itemId })
  return rows.length > 0
}

async function sessionsDone(tx: Tx, learnerId: string): Promise<number> {
  const [r] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(quest)
    .where(and(eq(quest.learnerId, learnerId), eq(quest.status, 'done'), eq(quest.kind, 'daily')))
  return r?.n ?? 0
}

// ---------------------------------------------------------------------------
// Kartu

async function cardProgress(tx: Tx, learnerId: string): Promise<CardProgress> {
  const state = await loadQuizState(tx, learnerId)
  const quiz: CardProgress['quiz'] = {}
  for (const t of TOPICS) {
    const p = topicProgress(t.id as TopicId, state.know)
    quiz[t.id] = { known: p.known, total: p.total }
  }
  const rows = await tx.select({ id: skillState.skillId }).from(skillState).where(and(eq(skillState.learnerId, learnerId), eq(skillState.gate, 'mastered')))
  const masteredScience = rows.filter((r) => subjectOfSkill(r.id) === 'science').length
  return { quiz, masteredScience }
}

async function ownedCardIds(tx: Tx, learnerId: string): Promise<Set<string>> {
  const rows = await tx.select({ id: worldCard.cardId }).from(worldCard).where(eq(worldCard.learnerId, learnerId))
  return new Set(rows.map((r) => r.id))
}

async function giveCard(tx: Tx, learnerId: string, cardId: string, source: string): Promise<boolean> {
  const orgId = await orgOf(tx, learnerId)
  const rows = await tx.insert(worldCard).values({ learnerId, orgId, cardId, source }).onConflictDoNothing().returning({ id: worldCard.cardId })
  return rows.length > 0
}

/** Beri kartu yang sudah memenuhi syarat dan hadiah set yang selesai. Mengembalikan kartu baru. */
export async function syncCards(tx: Tx, learnerId: string): Promise<{ id: string }[]> {
  const p = await cardProgress(tx, learnerId)
  const owned = await ownedCardIds(tx, learnerId)
  const fresh: { id: string }[] = []
  for (const c of CARDS) {
    if (owned.has(c.id) || c.req.kind === 'boss' || !cardEarned(c, p)) continue
    if (await giveCard(tx, learnerId, c.id, 'skill')) {
      fresh.push({ id: c.id })
      owned.add(c.id)
    }
  }
  for (const s of CARD_SETS) if (setComplete(s.id, owned)) await giveItem(tx, learnerId, s.reward, `set:${s.id}`)
  return fresh
}

export async function albumDTO(tx: Tx, learnerId: string): Promise<AlbumDTO> {
  const learner = await loadLearner(tx, learnerId)
  await syncCards(tx, learnerId)
  const [owned, p, shell] = await Promise.all([ownedCardIds(tx, learnerId), cardProgress(tx, learnerId), learnerShell(tx, learner)])
  const acquired = await tx.select({ id: worldCard.cardId, at: worldCard.acquiredAt }).from(worldCard).where(eq(worldCard.learnerId, learnerId))
  const at = new Map(acquired.map((a) => [a.id, a.at.getTime()]))
  const newest = Math.max(0, ...[...at.values()])
  return {
    shell,
    total: CARDS.length,
    owned: owned.size,
    sets: CARD_SETS.map((s) => ({
      id: s.id,
      name: s.name,
      blurb: s.blurb,
      earnedBy: s.earnedBy,
      complete: setComplete(s.id, owned),
      reward: anyItem(s.reward)?.name ?? s.reward,
      cards: CARDS.filter((c) => c.set === s.id).map((c) => ({
        id: c.id,
        no: cardNumber(c.id),
        name: c.name,
        rarity: c.rarity,
        art: c.art,
        set: s.id,
        tone: s.tone,
        owned: owned.has(c.id),
        fact: owned.has(c.id) ? c.fact : null,
        hint: cardHint(c),
        progress: owned.has(c.id) ? 1 : cardCloseness(c, p),
        isNew: owned.has(c.id) && at.get(c.id) === newest && Date.now() - newest < 3 * 24 * 3600 * 1000,
      })),
    })),
  }
}

// ---------------------------------------------------------------------------
// Teman

export async function petDTO(tx: Tx, learnerId: string): Promise<PetDTO> {
  const learner = await loadLearner(tx, learnerId)
  const [shell, stars, world, done, owned] = await Promise.all([learnerShell(tx, learner), starTotals(tx, learnerId), loadWorld(tx, learnerId), sessionsDone(tx, learnerId), ownedItems(tx, learnerId)])
  const today = jakartaDate()
  const pet = world.pet
  const stage = petStage(done)
  const next = nextStage(done)
  const ownedHomes = [{ id: 'home-meadow', name: 'Meadow nook' }, ...ALL_ITEMS.filter((i) => i.kind === 'pethome' && owned.has(i.id)).map((i) => ({ id: i.id, name: i.name }))]
  const ownedCostumes = ALL_ITEMS.filter((i) => i.kind === 'petcostume' && owned.has(i.id)).map((i) => ({ id: i.id, name: i.name }))
  const last = await tx.select({ date: starLedger.date }).from(starLedger).where(and(eq(starLedger.learnerId, learnerId), sql`${starLedger.amount} > 0`)).orderBy(desc(starLedger.date)).limit(1)
  const away = last[0] ? daysBetween(last[0].date, today) : 0
  return {
    shell,
    stars,
    state: pet ? 'hatched' : stars.earned >= HATCH_AT_STARS ? 'ready' : 'egg',
    hatchAt: HATCH_AT_STARS,
    pet: pet ? { kind: pet.kind, name: pet.name, hearts: pet.hearts, stage, costume: world.equipped.petCostume ?? null, home: world.equipped.petHome ?? 'home-meadow' } : null,
    next: next ? { stage: next.stage, left: next.left } : null,
    greeting: pet ? petGreeting(pet.name, away, Number(today.slice(-2))) : '',
    homes: ownedHomes,
    costumes: ownedCostumes,
  }
}

export async function choosePet(tx: Tx, learnerId: string, input: { kind: string; name: string }): Promise<void> {
  if (!isPetKind(input.kind)) throw invalid('Pick one of the six friends.')
  const name = cleanPetName(input.name)
  if (!name) throw invalid('Use 1 to 12 letters or numbers for the name.')
  await lockLearner(tx, learnerId)
  const world = await loadWorld(tx, learnerId)
  if (world.pet) throw conflict('You already have a friend.')
  const { earned } = await starTotals(tx, learnerId)
  if (earned < HATCH_AT_STARS) throw forbidden('The egg needs a few more stars.')
  await saveWorld(tx, learnerId, { pet: { kind: input.kind, name, hearts: 0, hatchedOn: jakartaDate() } })
}

export async function treatPet(tx: Tx, learnerId: string, treatId: string, nonce: string): Promise<{ line: string; hearts: number }> {
  const treat = treatById(treatId)
  if (!treat) throw notFound('That treat does not exist.')
  await lockLearner(tx, learnerId)
  const world = await loadWorld(tx, learnerId)
  if (!world.pet) throw forbidden('Hatch your friend first.')
  await spendStars(tx, learnerId, treat.price, `treat:${treat.id}:${nonce}`)
  const pet = { ...world.pet, hearts: world.pet.hearts + 1 }
  await saveWorld(tx, learnerId, { pet })
  return { line: treat.line, hearts: pet.hearts }
}

// ---------------------------------------------------------------------------
// Toko dan pilihan pakai

export async function shopDTO(tx: Tx, learnerId: string): Promise<ShopDTO> {
  const learner = await loadLearner(tx, learnerId)
  const [shell, stars, owned, world] = await Promise.all([learnerShell(tx, learner), starTotals(tx, learnerId), ownedItems(tx, learnerId), loadWorld(tx, learnerId)])
  const items = ALL_ITEMS.filter((i) => !CARD_SETS.some((s) => s.reward === i.id)).map((i) => ({
    id: i.id,
    kind: i.kind,
    name: i.name,
    price: i.price,
    owned: owned.has(i.id),
    equipped: equippedIn(i.kind, i.id, world.equipped, learner),
  }))
  const earnedItems = ALL_ITEMS.filter((i) => CARD_SETS.some((s) => s.reward === i.id) && owned.has(i.id)).map((i) => ({ id: i.id, kind: i.kind, name: i.name, price: 0, owned: true, equipped: equippedIn(i.kind, i.id, world.equipped, learner) }))
  return { shell, stars, items: [...items, ...earnedItems], petHatched: !!world.pet, petKind: world.pet?.kind ?? null }
}

function equippedIn(kind: string, id: string, eq_: Equipped, learner: { avatarAccessory: string | null; avatarBackground: string | null }): boolean {
  if (kind === 'petcostume') return eq_.petCostume === id
  if (kind === 'pethome') return (eq_.petHome ?? 'home-meadow') === id
  if (kind === 'frame') return eq_.frame === id
  if (kind === 'outfit') return learner.avatarAccessory === id
  if (kind === 'backdrop') return learner.avatarBackground === id
  return false
}

export async function buyItem(tx: Tx, learnerId: string, itemId: string): Promise<void> {
  const item = ALL_ITEMS.find((i) => i.id === itemId)
  if (!item || item.price <= 0 || CARD_SETS.some((s) => s.reward === item.id)) throw notFound('That item is not in the shop.')
  await lockLearner(tx, learnerId)
  const owned = await ownedItems(tx, learnerId)
  if (owned.has(item.id)) throw conflict('You already have that.')
  await spendStars(tx, learnerId, item.price, `buy:${item.id}`)
  await giveItem(tx, learnerId, item.id, 'shop')
}

/** Pakai atau lepas barang yang dimiliki. Outfit dan latar avatar ditulis ke profil, sisanya ke keadaan dunia. */
export async function equipItem(tx: Tx, learnerId: string, kind: 'petcostume' | 'pethome' | 'frame' | 'outfit' | 'backdrop', itemId: string | null): Promise<{ look: 'avatarAccessory' | 'avatarBackground'; value: string | null } | null> {
  if (itemId !== null) {
    const item = anyItem(itemId)
    if (!item || item.kind !== kind) throw notFound('That item does not exist.')
    const owned = await ownedItems(tx, learnerId)
    if (!owned.has(itemId)) throw forbidden('Earn or buy that first.')
  }
  // Pakaian dan latar avatar ditulis ke profil oleh pemanggil (peran sistem), seperti peti hadiah.
  if (kind === 'outfit') return { look: 'avatarAccessory', value: itemId }
  if (kind === 'backdrop') return { look: 'avatarBackground', value: itemId }
  const world = await loadWorld(tx, learnerId)
  const eqp: Equipped = { ...world.equipped }
  if (kind === 'petcostume') eqp.petCostume = itemId
  else if (kind === 'pethome') eqp.petHome = itemId
  else eqp.frame = itemId
  await saveWorld(tx, learnerId, { equipped: eqp })
  return null
}

export async function applyLook(tx: Tx, learnerId: string, look: 'avatarAccessory' | 'avatarBackground', value: string | null): Promise<void> {
  await tx.update(learnerProfile).set({ [look]: value, updatedAt: new Date() }).where(eq(learnerProfile.userId, learnerId))
}

// ---------------------------------------------------------------------------
// Cerita mingguan

async function goalWeeks(tx: Tx, learnerId: string): Promise<{ weeks: number; thisWeekDays: number }> {
  const rows = await tx.select({ date: dayRecord.date, done: dayRecord.questsDone, req: dayRecord.questsRequired, rest: dayRecord.rest }).from(dayRecord).where(eq(dayRecord.learnerId, learnerId))
  const byWeek = new Map<string, number>()
  for (const r of rows) if (r.req > 0 && r.done >= r.req && !r.rest) byWeek.set(weekStart(r.date), (byWeek.get(weekStart(r.date)) ?? 0) + 1)
  const thisWeek = weekStart(jakartaDate())
  let weeks = 0
  for (const n of byWeek.values()) if (n >= WEEK_GOAL_DAYS) weeks++
  return { weeks, thisWeekDays: byWeek.get(thisWeek) ?? 0 }
}

export async function storyDTO(tx: Tx, learnerId: string): Promise<StoryDTO> {
  const learner = await loadLearner(tx, learnerId)
  const [shell, g] = await Promise.all([learnerShell(tx, learner), goalWeeks(tx, learnerId)])
  const open = chaptersOpen(g.weeks)
  return {
    shell,
    title: 'Kira and the Lost Library',
    goalDays: WEEK_GOAL_DAYS,
    thisWeekDays: g.thisWeekDays,
    open,
    chapters: STORY.map((c) => ({
      n: c.n,
      title: c.title,
      scene: c.scene,
      isOpen: c.n <= open,
      pages: c.n <= open ? c.pages.map((p) => ({ text: p.text, cx: p.look.cx, zoom: p.look.zoom, lx: p.lumi.x, ly: p.lumi.y })) : [],
      tease: c.tease,
    })),
  }
}

// ---------------------------------------------------------------------------
// Bos

export function bossWeek(date: IsoDate = jakartaDate()): string {
  return weekStart(date)
}

export async function bossDTO(tx: Tx, learnerId: string): Promise<BossDTO> {
  const learner = await loadLearner(tx, learnerId)
  const [shell, world, owned] = await Promise.all([learnerShell(tx, learner), loadWorld(tx, learnerId), ownedCardIds(tx, learnerId)])
  const week = bossWeek()
  const won = world.progress.boss?.[week] !== undefined
  const next = nextBossCard(owned)
  const tries = await tx
    .select({ id: attempt.id })
    .from(attempt)
    .where(and(eq(attempt.learnerId, learnerId), sql`${attempt.refId} like ${'boss:' + week + '%'}`, gte(attempt.createdAt, new Date(Date.now() - 8 * 24 * 3600 * 1000))))
  return {
    shell,
    week,
    wonThisWeek: won,
    tries: tries.length,
    questions: BOSS_QUESTIONS,
    winAt: BOSS_WIN_AT,
    winStars: BOSS_WIN_STARS,
    prize: won ? null : next ? { id: next.id, name: next.name, rarity: next.rarity, art: next.art } : null,
  }
}

/** Dipanggil saat attempt bos dikumpulkan. Menang bila benar sedikitnya BOSS_WIN_AT. Tanpa hukuman untuk kalah. */
export async function finishBoss(tx: Tx, learnerId: string, attemptId: string, refId: string, correct: number, total: number = BOSS_QUESTIONS): Promise<{ won: boolean; stars: number; cardId: string | null }> {
  const week = refId.split(':')[1] ?? bossWeek()
  const won = correct >= bossWinAt(total)
  if (!won) return { won: false, stars: 0, cardId: null }
  await lockLearner(tx, learnerId)
  const world = await loadWorld(tx, learnerId)
  if (world.progress.boss && week in world.progress.boss) return { won: true, stars: 0, cardId: null }
  const owned = await ownedCardIds(tx, learnerId)
  const card = nextBossCard(owned)
  const stars = await grantStars(tx, learnerId, BOSS_WIN_STARS, 'boss', `boss:${week}`)
  if (card) await giveCard(tx, learnerId, card.id, `boss:${week}`)
  await saveWorld(tx, learnerId, { progress: { ...world.progress, boss: { ...(world.progress.boss ?? {}), [week]: card?.id ?? null } } })
  const syncOwned = await ownedCardIds(tx, learnerId)
  for (const s of CARD_SETS) if (setComplete(s.id, syncOwned)) await giveItem(tx, learnerId, s.reward, `set:${s.id}`)
  void attemptId
  return { won: true, stars, cardId: card?.id ?? null }
}

export async function bossResultDTO(tx: Tx, learnerId: string, attemptId: string) {
  const [a] = await tx.select().from(attempt).where(and(eq(attempt.id, attemptId), eq(attempt.learnerId, learnerId))).limit(1)
  if (!a || !a.refId?.startsWith('boss:')) throw notFound('That challenge was not found.')
  const learner = await loadLearner(tx, learnerId)
  const shell = await learnerShell(tx, learner)
  const res = (a.result ?? {}) as { boss?: { won: boolean; stars: number; cardId: string | null } }
  const card = res.boss?.cardId ? CARDS.find((c) => c.id === res.boss!.cardId) : null
  const total = (a.items as unknown[]).length
  return {
    shell,
    submitted: a.submittedAt !== null,
    correct: a.scoreRaw ?? 0,
    total,
    winAt: bossWinAt(total),
    won: res.boss?.won ?? false,
    stars: res.boss?.stars ?? 0,
    card: card ? { id: card.id, no: cardNumber(card.id), name: card.name, rarity: card.rarity, art: card.art, fact: card.fact } : null,
  }
}

// ---------------------------------------------------------------------------
// Ruang piala

export async function trophyDTO(tx: Tx, learnerId: string): Promise<TrophyDTO> {
  const learner = await loadLearner(tx, learnerId)
  const today = jakartaDate()
  const [shell, streak, owned, medals, badges, world] = await Promise.all([
    learnerShell(tx, learner),
    streakFor(tx, learner, today),
    ownedCardIds(tx, learnerId),
    medalsOf(tx, learnerId),
    tx.select({ id: tables.badgeAward.badgeId }).from(tables.badgeAward).where(eq(tables.badgeAward.learnerId, learnerId)),
    loadWorld(tx, learnerId),
  ])
  const certs = certificatesFor(streak.best)
  return {
    shell,
    badgeCount: badges.length,
    bestStreak: streak.best,
    currentStreak: streak.current,
    milestones: ([7, 30, 100] as CertificateDays[]).map((d) => ({ days: d, reached: streak.best >= d, certificate: certs.includes(d) })),
    bossWins: Object.keys(world.progress.boss ?? {}).length,
    setsComplete: CARD_SETS.filter((s) => setComplete(s.id, owned)).map((s) => ({ id: s.id, name: s.name })),
    medals,
    learnerName: learner.name,
  }
}

export async function medalsOf(tx: Tx, learnerId: string): Promise<MedalDTO[]> {
  const rows = await tx.select().from(contestMedal).where(and(eq(contestMedal.learnerId, learnerId), isNull(contestMedal.removedAt))).orderBy(desc(contestMedal.earnedOn))
  return rows.map((r) => ({ id: r.id, title: r.title, medal: r.medal, earnedOn: r.earnedOn }))
}

export async function addMedal(tx: Tx, learnerId: string, input: { title: string; medal: MedalDTO['medal']; earnedOn: string }): Promise<void> {
  const orgId = await orgOf(tx, learnerId)
  await tx.insert(contestMedal).values({ orgId, learnerId, title: input.title, medal: input.medal, earnedOn: input.earnedOn })
}

export async function removeMedal(tx: Tx, learnerId: string, medalId: string): Promise<void> {
  const rows = await tx.update(contestMedal).set({ removedAt: new Date() }).where(and(eq(contestMedal.id, medalId), eq(contestMedal.learnerId, learnerId), isNull(contestMedal.removedAt))).returning({ id: contestMedal.id })
  if (rows.length === 0) throw notFound('Medali tidak ditemukan.')
}

/** Data sertifikat milestone. Gagal bila streak terbaik belum mencapai hari itu. */
export async function certificateData(tx: Tx, learnerId: string, days: number): Promise<{ name: string; days: number; date: IsoDate }> {
  if (![7, 30, 100].includes(days)) throw notFound('Sertifikat tidak ditemukan.')
  const learner = await loadLearner(tx, learnerId)
  const today = jakartaDate()
  const streak = await streakFor(tx, learner, today)
  if (streak.best < days) throw forbidden('Anak belum mencapai tonggak ini.')
  return { name: learner.name, days, date: today }
}

// ---------------------------------------------------------------------------
// Beranda dunia dan Today

export async function worldHubDTO(tx: Tx, learnerId: string): Promise<WorldHubDTO> {
  const learner = await loadLearner(tx, learnerId)
  const [shell, stars, owned, story, boss, pet] = await Promise.all([learnerShell(tx, learner), starTotals(tx, learnerId), ownedCardIds(tx, learnerId), storyDTO(tx, learnerId), bossDTO(tx, learnerId), petDTO(tx, learnerId)])
  return {
    shell,
    stars,
    pet: pet.pet ? { ...pet.pet, greeting: pet.greeting } : null,
    petState: pet.state,
    hatchAt: pet.hatchAt,
    cards: { owned: owned.size, total: CARDS.length },
    story: { open: story.open, total: STORY.length },
    boss: { wonThisWeek: boss.wonThisWeek },
  }
}

/** Ringkas untuk Today: bintang dan teman. */
export async function worldPeek(tx: Tx, learnerId: string) {
  const [stars, world, done] = await Promise.all([starTotals(tx, learnerId), loadWorld(tx, learnerId), sessionsDone(tx, learnerId)])
  const today = jakartaDate()
  const last = await tx.select({ date: starLedger.date }).from(starLedger).where(and(eq(starLedger.learnerId, learnerId), sql`${starLedger.amount} > 0`)).orderBy(desc(starLedger.date)).limit(1)
  const away = last[0] ? daysBetween(last[0].date, today) : 0
  return {
    stars,
    pet: world.pet ? { kind: world.pet.kind, name: world.pet.name, stage: petStage(done), costume: world.equipped.petCostume ?? null, greeting: petGreeting(world.pet.name, away, Number(today.slice(-2))) } : null,
    canHatch: !world.pet && stars.earned >= HATCH_AT_STARS,
  }
}

export type { LearnerShell }

// ---------------------------------------------------------------------------
// Mulai tantangan bos: 10 soal campuran sesuai tingkat anak lewat pembuat sesi pusat, tanpa duplikat.

export async function startBossSession(tx: Tx, ctx: OrgContext, learnerId: string): Promise<string> {
  const week = bossWeek()
  const [open] = await tx
    .select({ id: attempt.id })
    .from(attempt)
    .where(and(eq(attempt.learnerId, learnerId), sql`${attempt.refId} like ${'boss:' + week + '%'}`, eq(attempt.status, 'in_progress')))
    .limit(1)
  if (open) return open.id
  const learner = await loadLearner(tx, learnerId)
  const states = await skillStates(tx, learnerId)
  const date = jakartaDate()
  const tries = (await tx.select({ id: attempt.id }).from(attempt).where(and(eq(attempt.learnerId, learnerId), sql`${attempt.refId} like ${'boss:' + week + '%'}`))).length
  const plan: { subject: 'math' | 'english' | 'science'; count: number }[] = [
    { subject: 'math', count: 3 },
    { subject: 'english', count: 3 },
    { subject: 'science', count: 2 },
    { subject: 'math', count: 2 },
  ]
  const usedSkills = new Set<string>()
  let bossSubject: 'math' | 'english' | 'science' | null = null
  const refs = new Set<string>()
  const items: AttemptItem[] = []
  for (const [i, p] of plan.entries()) {
    if (!(await isFeatureOn(learnerId, p.subject))) continue
    let picked: ReturnType<typeof autoSkill> | undefined
    for (let k = 0; k < 6 && !picked; k++) {
      const s = autoSkill(learner, p.subject, states, `${learnerId}:${week}:${tries}:${p.subject}:${i}:${k}`)
      if (s && !usedSkills.has(s.id)) picked = s
    }
    if (!picked) continue
    usedSkills.add(picked.id)
    // Attempt dicatat pada mapel pertama yang menyala, jadi laporan tidak menyebut Math saat Math dimatikan.
    bossSubject ??= p.subject
    const built = await buildQuestItems(tx, ctx, learner, { skillId: picked.id, subject: p.subject, mode: 'latihan', date, seedKey: `boss:${learnerId}:${week}:${tries}:${i}`, length: p.count, style: 'easy', avoid: refs })
    for (const it of built) {
      if (refs.has(it.ref) || items.length >= BOSS_QUESTIONS) continue
      refs.add(it.ref)
      items.push(it)
    }
  }
  if (items.length < 5) throw invalid('The robot is still warming up. Try again soon.')
  const final = items.map((it, i) => ({ ...it, position: i + 1 }))
  const [row] = await tx
    .insert(attempt)
    .values({ orgId: ctx.orgId, learnerId, kind: 'test', mode: 'latihan', subject: bossSubject ?? 'math', title: 'Puzzle Robot', refId: `boss:${week}:${tries + 1}`, items: final })
    .returning({ id: attempt.id })
  return row!.id
}
