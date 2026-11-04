import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { jakartaDate } from '@kira/core'

/**
 * Tes regresi uji tembus internal 5 November 2026, di Postgres sungguhan dengan transaksi paralel:
 * kuis baca dikumpulkan serentak, batas XP harian (ejaan, kartu, pelajaran), batas lembar kerja, kunci bos tidak dikirim,
 * sesi kosong tanpa hadiah, saklar fitur di server, dan batas percobaan masuk di bawah permintaan serentak.
 * Butuh DATABASE_URL_OWNER, DATABASE_URL_APP, DATABASE_URL_AUTH dan migrasi sudah dijalankan.
 */

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'cf-connecting-ip': '203.0.113.7' }),
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
}))

const ownerUrl = process.env.DATABASE_URL_OWNER
const appUrl = process.env.DATABASE_URL_APP
const authUrl = process.env.DATABASE_URL_AUTH
const ready = Boolean(ownerUrl && appUrl && authUrl)
const PARALLEL = 12

describe.skipIf(!ready)('uji tembus: balapan dan logika bisnis', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 4, onnotice: () => {} }) : (null as never)
  const orgId = randomUUID()
  const guardianId = randomUUID()
  const kid = randomUUID()
  const today = jakartaDate()
  const ctx = { orgId, userId: kid, role: 'learner' as const }
  const tutorCtx = { orgId, userId: guardianId, role: 'tutor' as const }
  const parentActor = () => ({ sessionId: randomUUID(), userId: guardianId, orgId, kind: 'adult' as const, role: 'guardian' as const, name: 'Ibu', email: null, deviceId: null, createdAt: new Date() })
  let dbm: typeof import('@/server/db')
  let room: typeof import('@/server/dal/reading-room')
  let english: typeof import('@/server/dal/english-skills')
  let cards: typeof import('@/server/dal/flashcards')
  let explore: typeof import('@/server/dal/learner-explore')
  let worksheet: typeof import('@/server/dal/worksheet')
  let world: typeof import('@/server/dal/kira-world')
  let runner: typeof import('@/server/dal/learner-runner')
  let remedial: typeof import('@/server/dal/remedial')
  let session: typeof import('@/server/dal/learner-session')
  let core: typeof import('@/server/dal/learner-core')
  let feats: typeof import('@/server/dal/learner-features')
  let competition: typeof import('@/server/dal/learner-competition')
  let accounts: typeof import('@/server/auth/accounts')
  let end: () => Promise<void>

  const inKid = <T>(fn: (tx: import('@/server/db').Tx) => Promise<T>) => dbm.inOrg(ctx, fn)
  const xpOf = async (reason: string) => (await owner`select coalesce(sum(amount),0)::int as n, count(*)::int as c from xp_event where learner_id = ${kid} and reason = ${reason}`)[0] as { n: number; c: number }
  const settled = async <T>(n: number, fn: (i: number) => Promise<T>) => Promise.allSettled(Array.from({ length: n }, (_, i) => fn(i)))
  const okCount = (rs: PromiseSettledResult<unknown>[]) => rs.filter((r) => r.status === 'fulfilled').length

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = appUrl!
    process.env.DATABASE_URL_AUTH = authUrl!
    process.env.KIRA_SECRET = 'uji-tembus-rahasia-minimal-32-karakter-ok'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    delete process.env.KIRA_VALKEY_URL
    dbm = await import('@/server/db')
    room = await import('@/server/dal/reading-room')
    english = await import('@/server/dal/english-skills')
    cards = await import('@/server/dal/flashcards')
    explore = await import('@/server/dal/learner-explore')
    worksheet = await import('@/server/dal/worksheet')
    world = await import('@/server/dal/kira-world')
    runner = await import('@/server/dal/learner-runner')
    remedial = await import('@/server/dal/remedial')
    session = await import('@/server/dal/learner-session')
    core = await import('@/server/dal/learner-core')
    feats = await import('@/server/dal/learner-features')
    competition = await import('@/server/dal/learner-competition')
    accounts = await import('@/server/auth/accounts')
    end = () => (dbm.appDb() as unknown as { $client: { end(): Promise<void> } }).$client.end()
    await owner`insert into org (id, name) values (${orgId}, 'Uji tembus __GTX_SEED__')`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values (${guardianId}, ${orgId}, 'Ibu', 'guardian', ${`${guardianId}@example.test`})`
    await owner`insert into auth.user_account (id, org_id, kind, role, email, name) values (${kid}, ${orgId}, 'learner', 'learner', null, 'Anak tembus')`
    await owner`insert into learner_profile (user_id, org_id, name, grade, active, screen_limit_min, rest_weekdays, started_on) values (${kid}, ${orgId}, 'Anak tembus', 2, true, 120, '{}', ${today})`
    await owner`insert into guardian_link (org_id, guardian_id, learner_id) values (${orgId}, ${guardianId}, ${kid})`
  })

  afterAll(async () => {
    await owner`delete from org where id = ${orgId}`
    await owner`delete from auth.user_account where org_id = ${orgId}`
    await Promise.all([owner.end(), end()])
  })

  it('kuis baca dikumpulkan serentak: satu berhasil, XP sekali', async () => {
    const book = 'g2-oli-sock-robot'
    const quiz = await inKid((tx) => room.startChapterQuiz(tx, ctx, kid, book, 'c1'))
    const answers = quiz.questions.map((q) => ({ questionId: q.id, choice: 0 }))
    const rs = await settled(PARALLEL, () => inKid((tx) => room.submitChapterQuiz(tx, ctx, kid, quiz.quizId, answers)))
    expect(okCount(rs)).toBe(1)
    const [chapter] = await owner`select quiz_count from book_chapter where learner_id = ${kid} and book_id = ${book} and chapter_id = 'c1'`
    expect(chapter!.quiz_count).toBe(1)
    expect((await xpOf('reading-quiz')).c).toBeLessThanOrEqual(1)
  })

  it('kuis baca dimulai serentak: tetap satu kuis terbuka', async () => {
    const rs = await Promise.all(Array.from({ length: PARALLEL }, () => inKid((tx) => room.startChapterQuiz(tx, ctx, kid, 'g2-oli-sock-robot', 'c2'))))
    expect(new Set(rs.map((r) => r.quizId)).size).toBe(1)
  })

  it('putaran ejaan serentak tidak melewati batas XP harian', async () => {
    const round = await inKid((tx) => english.spellingRound(tx, kid))
    const answers = round.words.map((w) => ({ id: w.id, typed: w.word, tries: 1 as const }))
    await settled(PARALLEL, () => inKid((tx) => english.finishSpellingRound(tx, ctx, kid, answers)))
    expect((await xpOf('spelling-bee')).n).toBeLessThanOrEqual(40)
  })

  it('kartu dari dek berbeda serentak tidak melewati batas XP harian', async () => {
    const decks = ['m2-adding-subtracting', 'm2-doubles-and-halves', 'm2-flat-shapes-symmetry']
    const load = (deck: string) => inKid((tx) => cards.cardSessionDTO(tx, kid, deck, 'cards'))
    const sessions = await Promise.all(decks.map(load))
    await settled(PARALLEL, (i) => {
      const s = sessions[i % sessions.length]!
      return inKid((tx) => cards.finishCards(tx, ctx, kid, { deckId: s.deck.id, results: s.cards.map((c) => ({ cardId: c.id, knew: true })) }))
    })
    expect((await xpOf('flashcards')).n).toBeLessThanOrEqual(20)
  }, 120_000)

  it('XP pelajaran dengan skor dari klien dibatasi per hari', async () => {
    const all = ['m3.place-value', 'm3.compare-order', 'm3.round-10-100', 'm3.sequences', 'm4.place-value', 'm5.place-value', 'm2.numbers-to-100', 'm2.sequences', 'm2.arrays', 'm2.addition', 'm2.times-tables', 'm2.shapes-2d', 'm2.shapes-3d']
    await settled(all.length, (i) => inKid((tx) => explore.completeLesson(tx, ctx, kid, all[i]!, 10, 10)))
    const xp = await xpOf('lesson')
    expect(xp.n).toBeGreaterThan(0)
    expect(xp.n).toBeLessThanOrEqual(explore.LESSON_XP_DAILY_CAP)
  }, 120_000)

  it('lembar kerja serentak tidak melewati batas harian keluarga', async () => {
    await settled(14, () => worksheet.createWorksheet(parentActor(), { learnerId: kid, skillId: 'm2.numbers-to-100', length: 'short' }))
    const [r] = await owner`select count(*)::int as n from worksheet where org_id = ${orgId} and day = ${today}`
    expect(r!.n).toBeLessThanOrEqual(10)
  })

  it('tantangan bos: kunci, pembahasan, dan solusi tidak dikirim sebelum dikumpulkan', async () => {
    const id = await inKid((tx) => world.startBossSession(tx, ctx, kid))
    const dto = await inKid((tx) => runner.runnerDTO(tx, kid, id, { markOpened: true }))
    expect('items' in dto).toBe(true)
    if (!('items' in dto)) return
    expect(dto.boss).toBe(true)
    expect(dto.items.length).toBeGreaterThan(0)
    for (const item of dto.items) {
      expect(item.key).toBeUndefined()
      expect(item.reveal).toBeUndefined()
    }
    const payload = JSON.stringify(dto.items)
    expect(payload).not.toContain('"explanation"')
    expect(payload).not.toContain('"whyWrong"')
    // Tetap dinilai server: status benar atau salah kembali lewat simpan jawaban.
    const first = dto.items.find((i) => i.type === 'mcq') ?? dto.items[0]!
    const answer = first.type === 'mcq' ? { choice: 0 } : null
    const saved = await inKid((tx) => runner.saveAnswer(tx, ctx, kid, { attemptId: id, position: first.position, answer: answer as never, hintsUsed: 0, attemptNo: 1, timeMs: 1000, flagged: false, clientId: randomUUID(), answeredAt: new Date().toISOString() }))
    expect(saved.status).not.toBe('answered')
    await expect(inKid((tx) => remedial.walkthroughFor(tx, kid, id, first.position))).rejects.toMatchObject({ code: 'invalid' })
    await expect(inKid((tx) => remedial.remedialLesson(tx, kid, id, first.position))).rejects.toMatchObject({ code: 'invalid' })
  })

  it('bos dimenangkan lewat attempt paralel: bintang dan kartu sekali', async () => {
    const before = await inKid((tx) => world.starTotals(tx, kid))
    await settled(PARALLEL, () => inKid((tx) => world.finishBoss(tx, kid, randomUUID(), `boss:${world.bossWeek()}:1`, 10, 10)))
    const after = await inKid((tx) => world.starTotals(tx, kid))
    expect(after.balance - before.balance).toBe(10)
    const [c] = await owner`select count(*)::int as n from world_card where learner_id = ${kid} and source like 'boss:%'`
    expect(c!.n).toBe(1)
  })

  it('sesi harian yang dikumpulkan kosong selesai, tetapi tanpa XP selesai dan tanpa bintang', async () => {
    await inKid(async (tx) => session.ensureTodayQuests(tx, ctx, await core.loadLearner(tx, kid), today))
    const [q] = await owner`select attempt_id, id from quest where learner_id = ${kid} and date = ${today} and kind = 'daily' and session = 'latihan' limit 1`
    const before = await inKid((tx) => world.starTotals(tx, kid))
    await inKid((tx) => runner.submitAttempt(tx, ctx, kid, q!.attempt_id as string))
    const after = await inKid((tx) => world.starTotals(tx, kid))
    expect(after.balance).toBe(before.balance)
    const [row] = await owner`select status from quest where id = ${q!.id}`
    expect(row!.status).toBe('done')
    const [xp] = await owner`select count(*)::int as n from xp_event where learner_id = ${kid} and reason = 'quest' and ref = ${q!.attempt_id as string}`
    expect(xp!.n).toBe(0)
  }, 120_000)

  it('saklar mati: mulai sesi langsung ditolak di server', async () => {
    await dbm.inOrg(tutorCtx, (tx) => feats.saveFeatureMap(tx, orgId, kid, { 'english-skills': false, math: false, 'olympiad-math': false, 'olympiad-english': false }))
    const refused = { code: 'forbidden' }
    await expect(inKid((tx) => english.startEnglishSession(tx, ctx, kid, 'listening'))).rejects.toMatchObject(refused)
    await expect(inKid((tx) => explore.startPractice(tx, ctx, kid, 'm2.numbers-to-100'))).rejects.toMatchObject({ code: 'not-found' })
    await expect(inKid((tx) => explore.completeLesson(tx, ctx, kid, 'm2.numbers-to-100', 1, 1))).rejects.toMatchObject(refused)
    await expect(inKid((tx) => competition.startEsmoMock(tx, ctx, kid, 'math'))).rejects.toMatchObject({ code: 'not-found' })
    await dbm.inOrg(tutorCtx, (tx) => feats.saveFeatureMap(tx, orgId, kid, {}))
  }, 120_000)

  describe('soal dengar dan eja di mode tanpa umpan balik', () => {
    const LISTEN = 'e1.digraphs.014'
    const SPELL = 'e1.digraphs.016'
    const tesAttempt = async (refs: string[]) => {
      const [a] = await owner`insert into attempt (org_id, learner_id, kind, mode, subject, title, items, time_limit_s) values (${orgId}, ${kid}, 'test', 'tes', 'english', 'Tes dengar', ${owner.json(refs.map((ref, i) => ({ ref, section: 'core', position: i + 1, difficulty: 2 })))}, 600) returning id`
      return a!.id as string
    }
    const clipFiles = async (refs: string[]) => {
      const content = await import('@/server/dal/content')
      const ttsDal = await import('@/server/dal/tts')
      const items = await inKid((tx) => content.resolveItems(tx, refs))
      const dir = join(process.env.KIRA_DATA_DIR!, 'tts')
      await mkdir(dir, { recursive: true })
      const files: string[] = []
      const keys = new Map<string, string[]>()
      for (const ref of refs) {
        const spoken = await ttsDal.spokenClipRefs(items.get(ref)!, orgId)
        keys.set(ref, spoken!.keys)
        for (const k of spoken!.keys) files.push(join(dir, `${k}.mp3`))
      }
      return { files, keys, items, write: () => Promise.all(files.map((f) => writeFile(f, 'klip uji'))), remove: () => Promise.all(files.map((f) => rm(f, { force: true }))) }
    }

    it('hanya kunci klip yang dikirim, kata tidak; jawaban tetap dinilai server', async () => {
      const { labelPerm } = await import('@/server/labels')
      const { labelCount } = await import('@kira/content')
      const clips = await clipFiles([LISTEN, SPELL])
      await clips.write()
      try {
        const id = await tesAttempt([LISTEN, SPELL])
        const dto = await inKid((tx) => runner.runnerDTO(tx, kid, id, { markOpened: true }))
        expect('items' in dto).toBe(true)
        if (!('items' in dto)) return
        const [listen, spell] = dto.items
        expect(listen!.listenText).toBeUndefined()
        expect(spell!.listenText).toBeUndefined()
        expect(listen!.listenClips).toEqual(clips.keys.get(LISTEN))
        expect(spell!.listenClips).toEqual(clips.keys.get(SPELL))
        expect(listen!.listenMissing).toBeUndefined()
        const body = JSON.stringify(dto.items)
        for (const word of ['chop', 'The ship sails', '"ship', 'ship.']) expect(body, word).not.toContain(word)
        const item = clips.items.get(LISTEN) as { answer: number }
        const label = labelPerm(id, LISTEN, labelCount(clips.items.get(LISTEN)!))![item.answer]
        const save = (position: number, answer: unknown) => inKid((tx) => runner.saveAnswer(tx, ctx, kid, { attemptId: id, position, answer: answer as never, hintsUsed: 0, attemptNo: 1, timeMs: 1000, flagged: false, clientId: randomUUID(), answeredAt: new Date().toISOString() }))
        expect((await save(1, { choice: label })).status).toBe('answered')
        expect((await save(2, { value: 'ship' })).status).toBe('answered')
        await inKid((tx) => runner.submitAttempt(tx, ctx, kid, id))
        const [row] = await owner`select status, score_raw from attempt where id = ${id}`
        expect(row!.status).toBe('submitted')
        expect(row!.score_raw).toBe(2)
      } finally {
        await clips.remove()
      }
    }, 120_000)

    it('klip belum ada: kata tetap tidak dikirim, layar diberi tanda', async () => {
      const clips = await clipFiles([LISTEN, SPELL])
      await clips.remove()
      const id = await tesAttempt([LISTEN, SPELL])
      const dto = await inKid((tx) => runner.runnerDTO(tx, kid, id, { markOpened: true }))
      if (!('items' in dto)) throw new Error('runner kosong')
      for (const item of dto.items) {
        expect(item.listenMissing).toBe(true)
        expect(item.listenText).toBeUndefined()
        expect(item.listenClips).toBeUndefined()
      }
      expect(JSON.stringify(dto.items)).not.toContain('The ship sails')
    }, 60_000)

    it('pembuat sesi membuang soal dengar tanpa klip dari tes, dan membiarkannya di latihan', async () => {
      const guard = await import('@/server/dal/session-guard')
      const clips = await clipFiles([LISTEN, SPELL])
      await clips.remove()
      const entries = [LISTEN, SPELL, 'e1.digraphs.001'].map((ref, i) => ({ ref, difficulty: 2, position: i + 1 }))
      const tes = await inKid((tx) => guard.dropUnplayableAudio(tx, entries))
      expect(tes.map((e) => e.ref)).toEqual(['e1.digraphs.001'])
      expect(tes[0]!.position).toBe(1)
      const guarded = await inKid((tx) => guard.guardAttemptItems(tx, entries, { seed: 'uji', mode: 'tes' }))
      expect(guarded.some((e) => e.ref === LISTEN || e.ref === SPELL)).toBe(false)
      const latihan = await inKid((tx) => guard.guardAttemptItems(tx, entries, { seed: 'uji', mode: 'latihan' }))
      expect(latihan.length).toBeGreaterThan(1)
      await clips.write()
      try {
        const ada = await inKid((tx) => guard.dropUnplayableAudio(tx, entries))
        expect(ada).toHaveLength(3)
      } finally {
        await clips.remove()
      }
    }, 60_000)
  })

  it('masuk serentak: paling banyak 20 percobaan sampai ke pemeriksaan password', async () => {
    const email = `tembus-${randomUUID()}@example.test`
    const rs = await settled(30, (i) => accounts.loginWithPassword(email, `salah-${i}-kalimat-panjang`))
    const codes = rs.map((r) => (r.status === 'rejected' ? (r.reason as { code?: string }).code : 'ok'))
    expect(codes).not.toContain('ok')
    expect(codes.filter((c) => c === 'invalid').length).toBeLessThanOrEqual(20)
    expect(codes.filter((c) => c === 'locked').length).toBeGreaterThanOrEqual(10)
  }, 120_000)
})
