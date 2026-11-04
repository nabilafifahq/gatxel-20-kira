import 'server-only'
import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import {
  ALL_ITEMS,
  BOSSES,
  BOSS_LEVEL_QUESTIONS,
  BOSS_QUESTIONS,
  BOSS_WIN_STARS,
  CARDS,
  CARD_SETS,
  DRILL_STARS_BY_COUNT,
  HATCH_AT_STARS,
  RARITIES,
  READING_STARS_BY_COUNT,
  STORY,
  WEEK_GOAL_DAYS,
  anyItem,
  bossById,
  bossNextIn,
  bossOpenCount,
  bossPlan,
  bossPrizeCard,
  bossRef,
  bossSpotlight,
  bossWinAt,
  bossesAvailable,
  cardAvailable,
  cardById,
  cardCloseness,
  cardCount,
  cardEarned,
  cardHint,
  cardNumber,
  certificatesFor,
  chapterByN,
  chaptersOpen,
  cleanPetName,
  cleanStoryDone,
  diminishing,
  isPetKind,
  jakartaDate,
  lumiGlow,
  nextStage,
  parseBossRef,
  petStage,
  sessionStars,
  setComplete,
  treatById,
  weekStart,
  daysBetween,
  type BossDef,
  type BossSubject,
  type CardProgress,
  type CertificateDays,
  type IsoDate,
  type PetKind,
} from '@kira/core'
import { effectiveOn, type FeatureKey } from '@kira/core/features'
import { TOPICS, topicProgress, type TopicId } from '@kira/content/knowledge'
import { dictFor, type Dict } from '@/lib/i18n'
import { getT } from '@/lib/i18n/server'
import { tables } from '@kira/db'
import type { OrgContext, Tx } from '../db'
import { conflict, forbidden, invalid, notFound } from '../errors'
import { loadQuizState } from './arena-state'
import { skillsFor, subjectOfSkill } from './content'
import { learnerShell, loadLearner, skillStates, streakFor } from './learner-core'
import { autoSkill, buildQuestItems, type AttemptItem } from './learner-session'
import { featureMapFor, isFeatureOnTx } from './learner-features'
import { guardAttemptItems } from './session-guard'
import type { LearnerShell } from '@/lib/dto'
import type { AlbumDTO, BossDTO, BossResultDTO, CardMiniDTO, MedalDTO, PetDTO, ShopDTO, StarsDTO, StoryDTO, TrophyDTO, WorldHubDTO, WorldSessionGain } from '@/lib/dto-world'

const { starLedger, worldState, worldItem, worldCard, contestMedal, skillState, dayRecord, quest, learnerProfile, attempt, bookProgress } = tables

/**
 * Kira World. Semua perubahan bintang dan barang dihitung dan diperiksa di server. Bintang tidak pernah
 * berkurang karena libur; teman tidak pernah sakit atau pergi.
 */

/** Teks dalam bahasa anak untuk pesan error dan sapaan. Di luar request (tes, skrip) memakai bahasa Inggris. */
async function worldText(): Promise<Dict['world']> {
  return (await getT().catch(() => dictFor('en'))).world
}

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
  if (!Number.isInteger(price) || price <= 0) throw invalid((await worldText()).errors.badPrice)
  await lockLearner(tx, learnerId)
  const { balance } = await starTotals(tx, learnerId)
  if (balance < price) throw conflict((await worldText()).errors.needStars)
  const orgId = await orgOf(tx, learnerId)
  const rows = await tx.insert(starLedger).values({ orgId, learnerId, amount: -price, reason, source, date: jakartaDate() }).onConflictDoNothing().returning({ id: starLedger.id })
  if (rows.length === 0) throw conflict((await worldText()).errors.alreadyDone)
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
  if (!input.required || !(await isFeatureOnTx(tx, learnerId, 'kira-world'))) return { stars: 0, cards: [] }
  const s = sessionStars({ perfect: input.perfect, retry: input.retry })
  let stars = 0
  if (s.base > 0) stars += await grantStars(tx, learnerId, s.base, 'session', `session:${input.attemptId}`, input.date)
  if (s.perfect > 0) stars += await grantStars(tx, learnerId, s.perfect, 'perfect', `perfect:${input.attemptId}`, input.date)
  const cards = await syncCards(tx, learnerId)
  return { stars, cards: cards.map((c) => c.id) }
}

/** Bab Reading yang selesai: menurun per hari. */
export async function awardReadingStars(tx: Tx, learnerId: string, attemptId: string, date: IsoDate): Promise<number> {
  if (!(await isFeatureOnTx(tx, learnerId, 'kira-world'))) return 0
  const n = await countToday(tx, learnerId, 'reading', date)
  return grantStars(tx, learnerId, diminishing(READING_STARS_BY_COUNT, n), 'reading', `reading:${attemptId}`, date)
}

/** Drill (Quick Maths, Quiz Arena) yang selesai: menurun per hari. */
export async function awardDrillStars(tx: Tx, learnerId: string, roundId: string, date: IsoDate): Promise<number> {
  if (!(await isFeatureOnTx(tx, learnerId, 'kira-world'))) return 0
  const n = await countToday(tx, learnerId, 'drill', date)
  const got = await grantStars(tx, learnerId, diminishing(DRILL_STARS_BY_COUNT, n), 'drill', `drill:${roundId}`, date)
  if (got > 0) await syncCards(tx, learnerId)
  return got
}

// ---------------------------------------------------------------------------
// Keadaan dunia

type PetState = { kind: PetKind; name: string; hearts: number; hatchedOn: IsoDate; lastTreat?: { id: string; at: string } }
type Equipped = { petCostume?: string | null; petHome?: string | null; frame?: string | null }
/** `boss`: minggu yang sudah memberi bintang. `bossWins`: berapa kali tiap lawan dikalahkan. */
type Progress = { boss?: Record<string, string | null>; bossWins?: Record<string, number>; storyDone?: number[] }
export type WorldRow = { pet: PetState | null; equipped: Equipped; progress: Progress }

/** Kemenangan per lawan. Kemenangan lama, sebelum ada banyak lawan, semuanya melawan Puzzle Robot. */
function bossWinsOf(p: Progress): Record<string, number> {
  if (p.bossWins) return p.bossWins
  const old = Object.keys(p.boss ?? {}).length
  return old > 0 ? { robot: old } : {}
}

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
  const [state, learner, world, books, sessions, stars, rows] = await Promise.all([
    loadQuizState(tx, learnerId),
    loadLearner(tx, learnerId),
    loadWorld(tx, learnerId),
    tx.select({ n: sql<number>`count(*)::int` }).from(bookProgress).where(and(eq(bookProgress.learnerId, learnerId), isNotNull(bookProgress.finishedAt))),
    sessionsDone(tx, learnerId),
    starTotals(tx, learnerId),
    tx.select({ id: skillState.skillId }).from(skillState).where(and(eq(skillState.learnerId, learnerId), eq(skillState.gate, 'mastered'))),
  ])
  const quiz: CardProgress['quiz'] = {}
  for (const t of TOPICS) {
    const p = topicProgress(t.id as TopicId, state.know)
    quiz[t.id] = { known: p.known, total: p.total }
  }
  const mastered = { math: 0, english: 0, science: 0 }
  for (const r of rows) {
    const s = subjectOfSkill(r.id)
    if (s) mastered[s]++
  }
  const streak = await streakFor(tx, learner, jakartaDate())
  return {
    quiz,
    mastered,
    bossesBeaten: Object.keys(bossWinsOf(world.progress)),
    storyDone: cleanStoryDone(world.progress.storyDone),
    booksFinished: books[0]?.n ?? 0,
    bestStreak: streak.best,
    sessions,
    starsEarned: stars.earned,
  }
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
    if (owned.has(c.id) || !cardEarned(c, p)) continue
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
  const [owned, p, shell, map] = await Promise.all([ownedCardIds(tx, learnerId), cardProgress(tx, learnerId), learnerShell(tx, learner), featureMapFor(tx, learnerId)])
  const acquired = await tx.select({ id: worldCard.cardId, at: worldCard.acquiredAt }).from(worldCard).where(eq(worldCard.learnerId, learnerId))
  const at = new Map(acquired.map((a) => [a.id, a.at.getTime()]))
  const newest = Math.max(0, ...[...at.values()])
  // Kartu dari mapel atau fitur yang dimatikan orang tua tidak dihitung, supaya angka kemajuan tetap jujur.
  const inAlbum = CARDS.filter((c) => owned.has(c.id) || cardAvailable(c, (k) => effectiveOn(map, k as FeatureKey)))
  return {
    shell,
    total: inAlbum.length,
    owned: inAlbum.filter((c) => owned.has(c.id)).length,
    rarities: RARITIES.map((rarity) => {
      const all = inAlbum.filter((c) => c.rarity === rarity)
      return { rarity, owned: all.filter((c) => owned.has(c.id)).length, total: all.length }
    }),
    sets: CARD_SETS.filter((s) => inAlbum.some((c) => c.set === s.id)).map((s) => ({
      id: s.id,
      name: s.name,
      blurb: s.blurb,
      earnedBy: s.earnedBy,
      complete: setComplete(s.id, owned),
      reward: anyItem(s.reward)?.name ?? s.reward,
      rare: s.rare ?? false,
      cards: inAlbum
        .filter((c) => c.set === s.id)
        .map((c) => ({
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
          count: owned.has(c.id) ? null : cardCount(c, p),
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
    greeting: pet ? (await worldText()).pet.greeting(pet.name, away, Number(today.slice(-2))) : '',
    homes: ownedHomes,
    costumes: ownedCostumes,
  }
}

export async function choosePet(tx: Tx, learnerId: string, input: { kind: string; name: string }): Promise<void> {
  if (!isPetKind(input.kind)) throw invalid((await worldText()).errors.pickFriend)
  const name = cleanPetName(input.name)
  if (!name) throw invalid((await worldText()).errors.petName)
  await lockLearner(tx, learnerId)
  const world = await loadWorld(tx, learnerId)
  if (world.pet) throw conflict((await worldText()).errors.hasFriend)
  const { earned } = await starTotals(tx, learnerId)
  if (earned < HATCH_AT_STARS) throw forbidden((await worldText()).errors.eggNeedsStars)
  await saveWorld(tx, learnerId, { pet: { kind: input.kind, name, hearts: 0, hatchedOn: jakartaDate() } })
}

export async function treatPet(tx: Tx, learnerId: string, treatId: string, nonce: string): Promise<{ line: string; hearts: number }> {
  const treat = treatById(treatId)
  if (!treat) throw notFound((await worldText()).errors.noTreat)
  await lockLearner(tx, learnerId)
  const world = await loadWorld(tx, learnerId)
  if (!world.pet) throw forbidden((await worldText()).errors.hatchFirst)
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
  if (!item || item.price <= 0 || CARD_SETS.some((s) => s.reward === item.id)) throw notFound((await worldText()).errors.notInShop)
  await lockLearner(tx, learnerId)
  const owned = await ownedItems(tx, learnerId)
  if (owned.has(item.id)) throw conflict((await worldText()).errors.alreadyOwned)
  await spendStars(tx, learnerId, item.price, `buy:${item.id}`)
  await giveItem(tx, learnerId, item.id, 'shop')
}

/** Pakai atau lepas barang yang dimiliki. Outfit dan latar avatar ditulis ke profil, sisanya ke keadaan dunia. */
export async function equipItem(tx: Tx, learnerId: string, kind: 'petcostume' | 'pethome' | 'frame' | 'outfit' | 'backdrop', itemId: string | null): Promise<{ look: 'avatarAccessory' | 'avatarBackground'; value: string | null } | null> {
  if (itemId !== null) {
    const item = anyItem(itemId)
    if (!item || item.kind !== kind) throw notFound((await worldText()).errors.noItem)
    const owned = await ownedItems(tx, learnerId)
    if (!owned.has(itemId)) throw forbidden((await worldText()).errors.earnFirst)
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
  const [shell, g, world] = await Promise.all([learnerShell(tx, learner), goalWeeks(tx, learnerId), loadWorld(tx, learnerId)])
  const open = chaptersOpen(g.weeks)
  const done = new Set(cleanStoryDone(world.progress.storyDone))
  return {
    shell,
    title: 'Kira and the Lost Library',
    goalDays: WEEK_GOAL_DAYS,
    thisWeekDays: g.thisWeekDays,
    open,
    chapters: STORY.map((c) => ({
      n: c.n,
      title: c.title,
      isOpen: c.n <= open,
      done: done.has(c.n),
      glow: lumiGlow(c.n),
      // Halaman, sobekan surat, dan pertanyaan bab yang belum terbuka tidak dikirim ke browser.
      pages:
        c.n <= open
          ? c.pages.map((p) => ({
              text: p.text,
              scene: p.scene ?? c.scene,
              cx: p.look.cx,
              ...(p.look.cy !== undefined ? { cy: p.look.cy } : {}),
              zoom: p.look.zoom,
              lx: p.lumi.x,
              ly: p.lumi.y,
              pip: p.pip,
              kira: p.kira,
              show: p.show,
            }))
          : [],
      scrap: c.n <= open ? c.scrap : null,
      wonder: c.n <= open ? c.wonder : '',
      tease: c.tease,
    })),
  }
}

/** Tandai bab selesai dibaca. Hanya bab yang sudah terbuka. Kartu kenangan bab diberikan lewat syncCards. */
export async function finishChapter(tx: Tx, learnerId: string, n: number): Promise<{ cards: CardMiniDTO[] }> {
  await lockLearner(tx, learnerId)
  const [g, world] = await Promise.all([goalWeeks(tx, learnerId), loadWorld(tx, learnerId)])
  if (n > chaptersOpen(g.weeks) || !chapterByN(n)) throw forbidden('That chapter is not open yet.')
  const done = cleanStoryDone(world.progress.storyDone)
  if (!done.includes(n)) await saveWorld(tx, learnerId, { progress: { ...world.progress, storyDone: [...done, n] } })
  const fresh = await syncCards(tx, learnerId)
  // Kartu kenangan bab ini tampil lebih dulu bila bersamaan dengan kartu tonggak lain.
  const cards = fresh.map((c) => cardMini(c.id)).filter((c): c is CardMiniDTO => c !== null)
  return { cards: cards.sort((a, b) => Number(b.id.startsWith('st-')) - Number(a.id.startsWith('st-'))) }
}

function cardMini(id: string): CardMiniDTO | null {
  const c = CARDS.find((x) => x.id === id)
  return c ? { id: c.id, no: cardNumber(c.id), name: c.name, rarity: c.rarity, art: c.art, fact: c.fact } : null
}

// ---------------------------------------------------------------------------
// Bos

export function bossWeek(date: IsoDate = jakartaDate()): string {
  return weekStart(date)
}

/** Jumlah hari dengan semua sesi wajib selesai. Menentukan lawan yang sudah datang. */
async function studyDays(tx: Tx, learnerId: string): Promise<number> {
  const rows = await tx.select({ done: dayRecord.questsDone, req: dayRecord.questsRequired, rest: dayRecord.rest }).from(dayRecord).where(eq(dayRecord.learnerId, learnerId))
  return rows.filter((r) => r.req > 0 && r.done >= r.req && !r.rest).length
}

/** Lawan yang boleh ditawarkan ke anak ini: mapelnya menyala, urut sesuai katalog, dan tanda sudah datang. */
function bossRoster(available: readonly BossDef[], wins: Readonly<Record<string, number>>, days: number): { def: BossDef; open: boolean }[] {
  const openCount = bossOpenCount(days)
  return available.map((def, i) => ({ def, open: i < openCount || (wins[def.id] ?? 0) > 0 }))
}

export async function bossDTO(tx: Tx, learnerId: string): Promise<BossDTO> {
  const learner = await loadLearner(tx, learnerId)
  const [shell, world, owned, days, map] = await Promise.all([learnerShell(tx, learner), loadWorld(tx, learnerId), ownedCardIds(tx, learnerId), studyDays(tx, learnerId), featureMapFor(tx, learnerId)])
  const week = bossWeek()
  const wins = bossWinsOf(world.progress)
  const available = bossesAvailable((s) => effectiveOn(map, s))
  const roster = bossRoster(available, wins, days)
  return {
    shell,
    week,
    wonThisWeek: world.progress.boss?.[week] !== undefined,
    winStars: BOSS_WIN_STARS,
    bosses: roster.map(({ def, open }) => {
      const questions = BOSS_LEVEL_QUESTIONS[def.level]
      const card = cardById(def.card)
      return {
        id: def.id,
        // Lawan yang belum datang tetap misteri: nama dan sifatnya tidak dikirim ke browser.
        name: open ? def.name : 'A new challenger',
        epithet: open ? def.epithet : '',
        personality: open ? def.personality : '',
        level: def.level,
        weakness: open ? def.weakness : '',
        intro: open ? def.intro : '',
        questions,
        winAt: bossWinAt(questions),
        open,
        wins: wins[def.id] ?? 0,
        prize: open && card && !owned.has(card.id) ? { id: card.id, name: card.name, rarity: card.rarity, art: card.art } : null,
      }
    }),
    spotlight: bossSpotlight(roster.filter((r) => r.open).map((r) => r.def.id), wins, week),
    nextIn: bossNextIn(days, available.length),
    beaten: available.filter((b) => (wins[b.id] ?? 0) > 0).length,
  }
}

/**
 * Dipanggil saat attempt bos dikumpulkan. Menang bila benar sedikitnya 70 persen. Kemenangan pertama lawan ini memberi
 * kartunya, kemenangan pertama minggu ini memberi bintang. Tanpa hukuman untuk kalah.
 */
export async function finishBoss(tx: Tx, learnerId: string, attemptId: string, refId: string, correct: number, total: number = BOSS_QUESTIONS): Promise<{ won: boolean; stars: number; cardId: string | null }> {
  const ref = parseBossRef(refId)
  const week = ref.week || bossWeek()
  const def = bossById(ref.id) ?? BOSSES[0]!
  if (correct < bossWinAt(total)) return { won: false, stars: 0, cardId: null }
  await lockLearner(tx, learnerId)
  const world = await loadWorld(tx, learnerId)
  const wins = bossWinsOf(world.progress)
  const card = (wins[def.id] ?? 0) === 0 ? bossPrizeCard(def.id) : undefined
  const cardId = card && (await giveCard(tx, learnerId, card.id, `boss:${def.id}`)) ? card.id : null
  const firstThisWeek = !(world.progress.boss && week in world.progress.boss)
  const stars = firstThisWeek ? await grantStars(tx, learnerId, BOSS_WIN_STARS, 'boss', `boss:${week}`) : 0
  await saveWorld(tx, learnerId, {
    progress: {
      ...world.progress,
      boss: firstThisWeek ? { ...(world.progress.boss ?? {}), [week]: cardId } : (world.progress.boss ?? {}),
      bossWins: { ...wins, [def.id]: (wins[def.id] ?? 0) + 1 },
    },
  })
  await syncCards(tx, learnerId)
  void attemptId
  return { won: true, stars, cardId }
}

export async function bossResultDTO(tx: Tx, learnerId: string, attemptId: string): Promise<BossResultDTO> {
  const [a] = await tx.select().from(attempt).where(and(eq(attempt.id, attemptId), eq(attempt.learnerId, learnerId))).limit(1)
  if (!a || !a.refId?.startsWith('boss:')) throw notFound((await worldText()).errors.noChallenge)
  const learner = await loadLearner(tx, learnerId)
  const shell = await learnerShell(tx, learner)
  const res = (a.result ?? {}) as { boss?: { won: boolean; stars: number; cardId: string | null } }
  const card = res.boss?.cardId ? CARDS.find((c) => c.id === res.boss!.cardId) : null
  const total = (a.items as { remedialOf?: number }[]).filter((i) => i.remedialOf === undefined).length
  const def = bossById(parseBossRef(a.refId).id) ?? BOSSES[0]!
  return {
    shell,
    submitted: a.submittedAt !== null,
    correct: a.scoreRaw ?? 0,
    total,
    winAt: bossWinAt(total),
    won: res.boss?.won ?? false,
    stars: res.boss?.stars ?? 0,
    boss: { id: def.id, name: def.name, defeat: def.defeat, rematch: def.rematch },
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
    bossWins: Object.values(bossWinsOf(world.progress)).reduce((s, n) => s + n, 0),
    bossesBeaten: Object.entries(bossWinsOf(world.progress)).map(([id, wins]) => ({ id, name: bossById(id)?.name ?? id, wins })),
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
    boss: { wonThisWeek: boss.wonThisWeek, beaten: boss.beaten, total: boss.bosses.length },
  }
}

/** Ringkas untuk Today: bintang dan teman. */
export async function worldPeek(tx: Tx, learnerId: string) {
  const [stars, world, done] = await Promise.all([starTotals(tx, learnerId), loadWorld(tx, learnerId), sessionsDone(tx, learnerId)])
  const today = jakartaDate()
  const last = await tx.select({ date: starLedger.date }).from(starLedger).where(and(eq(starLedger.learnerId, learnerId), sql`${starLedger.amount} > 0`)).orderBy(desc(starLedger.date)).limit(1)
  const away = last[0] ? daysBetween(last[0].date, today) : 0
  const text = await worldText()
  return {
    stars,
    pet: world.pet ? { kind: world.pet.kind, name: world.pet.name, stage: petStage(done), costume: world.equipped.petCostume ?? null, greeting: text.pet.greeting(world.pet.name, away, Number(today.slice(-2))) } : null,
    canHatch: !world.pet && stars.earned >= HATCH_AT_STARS,
  }
}

export type { LearnerShell }

// ---------------------------------------------------------------------------
// Mulai tantangan bos: soal biasa sesuai tingkat anak lewat pembuat sesi pusat, dari rumpun kelemahan lawan. Satu pintu
// penjaga soal kembar (guardSet) sebelum attempt disimpan. Tanpa soal yang harus dinilai manusia.

export async function startBossSession(tx: Tx, ctx: OrgContext, learnerId: string, bossId: string = 'robot'): Promise<string> {
  const def = bossById(bossId)
  if (!def) throw notFound('That boss was not found.')
  const map = await featureMapFor(tx, learnerId)
  const on = (s: BossSubject) => effectiveOn(map, s)
  if (!def.subjects.some(on)) throw forbidden('That boss is resting today.')
  const week = bossWeek()
  const [world, days] = await Promise.all([loadWorld(tx, learnerId), studyDays(tx, learnerId)])
  const roster = bossRoster(bossesAvailable(on), bossWinsOf(world.progress), days)
  if (!roster.find((r) => r.def.id === def.id)?.open) throw forbidden('That boss has not arrived yet.')
  const [open] = await tx
    .select({ id: attempt.id })
    .from(attempt)
    .where(and(eq(attempt.learnerId, learnerId), sql`${attempt.refId} like ${'boss:' + week + ':' + def.id + ':%'}`, eq(attempt.status, 'in_progress')))
    .limit(1)
  if (open) return open.id
  const learner = await loadLearner(tx, learnerId)
  const states = await skillStates(tx, learnerId)
  const date = jakartaDate()
  const tries = (await tx.select({ id: attempt.id }).from(attempt).where(and(eq(attempt.learnerId, learnerId), sql`${attempt.refId} like ${'boss:' + week + ':%'}`))).length
  const questions = BOSS_LEVEL_QUESTIONS[def.level]
  const seed = `boss:${learnerId}:${week}:${def.id}:${tries}`
  const usedSkills = new Set<string>()
  const refs = new Set<string>()
  const items: AttemptItem[] = []
  const add = async (subject: BossSubject, strands: readonly string[], count: number, key: string) => {
    let picked: ReturnType<typeof autoSkill> | undefined
    const inFamily = strands.length > 0 ? skillsFor(subject, learner.grade).filter((s) => strands.includes(s.strand)) : []
    for (let k = 0; k < 8 && !picked; k++) {
      const s = autoSkill(learner, subject, states, `${seed}:${key}:${k}`)
      if (s && !usedSkills.has(s.id) && (strands.length === 0 || strands.includes(skillStrand(subject, learner.grade, s.id)))) picked = s
    }
    // Pemilih otomatis mengutamakan skill berikutnya, jadi rumpun kelemahan diambil langsung bila belum kena.
    const skillId = picked?.id ?? inFamily.find((s) => !usedSkills.has(s.id))?.id
    if (!skillId) return
    usedSkills.add(skillId)
    const built = await buildQuestItems(tx, ctx, learner, { skillId, subject, mode: 'latihan', date, seedKey: `${seed}:${key}`, length: count, style: 'easy', allowManual: false, avoid: refs })
    for (const it of built) {
      if (refs.has(it.ref) || items.length >= questions) continue
      refs.add(it.ref)
      items.push(it)
    }
  }
  for (const [i, c] of bossPlan(def, questions, on).entries()) await add(c.subject, c.strands, c.count, `${i}`)
  // Rumpun tipis di kelas ini: isi sisanya dari mapel yang sama supaya pertarungan tetap utuh.
  for (let i = 0; i < 6 && items.length < questions; i++) {
    const subject = def.subjects.filter(on)[i % def.subjects.filter(on).length]!
    await add(subject, [], Math.min(3, questions - items.length), `fill${i}`)
  }
  const guarded = await guardAttemptItems(tx, items, { seed, mode: 'latihan' })
  if (guarded.length < 5) throw invalid('This boss is still warming up. Try again soon.')
  const [row] = await tx
    .insert(attempt)
    .values({ orgId: ctx.orgId, learnerId, kind: 'test', mode: 'latihan', subject: def.subjects.find(on) ?? 'math', title: def.name, refId: bossRef(week, def.id, tries + 1), items: guarded })
    .returning({ id: attempt.id })
  return row!.id
}

function skillStrand(subject: BossSubject, grade: number, skillId: string): string {
  return skillsFor(subject, grade).find((s) => s.id === skillId)?.strand ?? ''
}
