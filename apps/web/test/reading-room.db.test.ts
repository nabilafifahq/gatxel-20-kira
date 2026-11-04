import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Ruang Baca di Postgres sungguhan: kuis bab dipilih server tanpa kunci jawaban, kuis ulang memberi soal yang
 * belum pernah muncul lebih dulu, XP hanya sekali per bab di jalur Belajar, buku selesai sekali, tempat berhenti
 * dan menit membaca tersimpan, dan keluarga lain tidak bisa menyentuh kuis ini (RLS).
 */

const ownerUrl = process.env.DATABASE_URL_OWNER
const appUrl = process.env.DATABASE_URL_APP
const ready = Boolean(ownerUrl && appUrl)

describe.skipIf(!ready)('ruang baca', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 2, onnotice: () => {} }) : (null as never)
  const orgId = randomUUID()
  const otherOrg = randomUUID()
  const learnerId = randomUUID()
  const otherLearner = randomUUID()
  let room: typeof import('@/server/dal/reading-room')
  let dbm: typeof import('@/server/db')
  let end: () => Promise<void>

  const ctx = { orgId, userId: learnerId, role: 'learner' as const }
  const otherCtx = { orgId: otherOrg, userId: otherLearner, role: 'learner' as const }
  const BOOK = 'g1-dewi-red-kite'

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = appUrl!
    process.env.DATABASE_URL_AUTH = appUrl!
    process.env.KIRA_SECRET = 'uji-ruang-baca-rahasia-minimal-32-karakter-ok'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    room = await import('@/server/dal/reading-room')
    dbm = await import('@/server/db')
    end = () => (dbm.appDb() as unknown as { $client: { end(): Promise<void> } }).$client.end()
    for (const [o, l, name] of [
      [orgId, learnerId, 'Anak baca'],
      [otherOrg, otherLearner, 'Anak lain'],
    ] as const) {
      await owner`insert into org (id, name) values (${o}, 'Uji ruang baca __GTX_SEED__')`
      await owner`insert into learner_profile (user_id, org_id, name, grade, active, screen_limit_min, rest_weekdays, started_on)
        values (${l}, ${o}, ${name}, 1, true, 120, '{}', current_date)`
    }
  })

  afterAll(async () => {
    await owner`delete from org where id in (${orgId}, ${otherOrg})`
    await Promise.all([owner.end(), end()])
  })

  const book = () => room.bookById(BOOK)!
  const rightAnswers = (chapterId: string, ids: string[]) => {
    const ch = book().chapters.find((c) => c.id === chapterId)!
    return ids.map((id) => ({ questionId: id, choice: ch.questions.find((q) => q.id === id)!.answer }))
  }

  it('kuis bab: lima soal dipilih server, tanpa kunci jawaban', async () => {
    const quiz = await dbm.inOrg(ctx, (tx) => room.startChapterQuiz(tx, ctx, learnerId, BOOK, 'c1'))
    expect(quiz.questions).toHaveLength(5)
    expect(new Set(quiz.questions.map((q) => q.id)).size).toBe(5)
    for (const q of quiz.questions) expect(Object.keys(q).sort()).toEqual(['id', 'options', 'prompt'])
    // Kuis yang belum dikumpulkan dilanjutkan, bukan dibuat ulang.
    const again = await dbm.inOrg(ctx, (tx) => room.startChapterQuiz(tx, ctx, learnerId, BOOK, 'c1'))
    expect(again.quizId).toBe(quiz.quizId)
  })

  it('XP pertama: benar semua memberi 2 per soal ditambah bonus, jalur Belajar', async () => {
    const [open] = await owner`select id, question_ids from book_quiz where learner_id = ${learnerId} and submitted_at is null`
    const res = await dbm.inOrg(ctx, (tx) => room.submitChapterQuiz(tx, ctx, learnerId, open!.id as string, rightAnswers('c1', open!.question_ids as string[])))
    expect(res.correct).toBe(5)
    expect(res.xp).toBe(13)
    expect(res.bookFinished).toBe(false)
    const rows = await owner`select amount, track, reason from xp_event where learner_id = ${learnerId} and reason = 'reading-quiz'`
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ amount: 13, track: 'belajar' })
    await expect(dbm.inOrg(ctx, (tx) => room.submitChapterQuiz(tx, ctx, learnerId, open!.id as string, []))).rejects.toThrow()
  })

  it('kuis ulang: soal yang belum pernah muncul diutamakan, dan tidak ada XP baru', async () => {
    const [first] = await owner`select question_ids from book_quiz where learner_id = ${learnerId} and chapter_id = 'c1'`
    const total = book().chapters[0]!.questions.map((q) => q.id)
    const unseen = total.filter((id) => !(first!.question_ids as string[]).includes(id))
    const quiz = await dbm.inOrg(ctx, (tx) => room.startChapterQuiz(tx, ctx, learnerId, BOOK, 'c1'))
    const ids = quiz.questions.map((q) => q.id)
    for (const id of unseen) expect(ids).toContain(id)
    const res = await dbm.inOrg(ctx, (tx) => room.submitChapterQuiz(tx, ctx, learnerId, quiz.quizId, [{ questionId: ids[0]!, choice: 0 }]))
    expect(res.xp).toBe(0)
    expect(res.total).toBe(5)
    const rows = await owner`select count(*)::int as n from xp_event where learner_id = ${learnerId} and reason = 'reading-quiz'`
    expect(rows[0]!.n).toBe(1)
    const [ch] = await owner`select quiz_count, best_correct from book_chapter where learner_id = ${learnerId} and chapter_id = 'c1'`
    expect(ch!.quiz_count).toBe(2)
    expect(ch!.best_correct).toBe(5)
  })

  it('jawaban di luar kuis atau di luar pilihan ditolak', async () => {
    const quiz = await dbm.inOrg(ctx, (tx) => room.startChapterQuiz(tx, ctx, learnerId, BOOK, 'c2'))
    await expect(dbm.inOrg(ctx, (tx) => room.submitChapterQuiz(tx, ctx, learnerId, quiz.quizId, [{ questionId: 'q9', choice: 0 }]))).rejects.toThrow()
    await expect(dbm.inOrg(ctx, (tx) => room.submitChapterQuiz(tx, ctx, learnerId, quiz.quizId, [{ questionId: quiz.questions[0]!.id, choice: 3 }]))).rejects.toThrow()
  })

  it('keluarga lain tidak bisa mengumpulkan kuis ini (RLS)', async () => {
    const [open] = await owner`select id from book_quiz where learner_id = ${learnerId} and submitted_at is null limit 1`
    await expect(dbm.inOrg(otherCtx, (tx) => room.submitChapterQuiz(tx, otherCtx, otherLearner, open!.id as string, []))).rejects.toThrow()
    const seen = await dbm.inOrg(otherCtx, (tx) => tx.execute(`select count(*)::int as n from book_quiz` as never))
    expect(JSON.stringify(seen)).toContain('0')
  })

  it('buku selesai sekali setelah semua bab, dengan bonus XP sekali', async () => {
    const res = await dbm.inOrg(ctx, (tx) => room.markChapterRead(tx, ctx, learnerId, BOOK, 'c2'))
    expect(res.bookFinished).toBe(false)
    const last = await dbm.inOrg(ctx, (tx) => room.markChapterRead(tx, ctx, learnerId, BOOK, 'c3'))
    expect(last.bookFinished).toBe(true)
    await dbm.inOrg(ctx, (tx) => room.markChapterRead(tx, ctx, learnerId, BOOK, 'c3'))
    const rows = await owner`select amount from xp_event where learner_id = ${learnerId} and reason = 'reading-book'`
    expect(rows).toHaveLength(1)
    expect(rows[0]!.amount).toBe(10)
    const summary = await dbm.inOrg(ctx, (tx) => room.readingSummary(tx, learnerId))
    expect(summary.booksFinished).toBe(1)
    const lib = await dbm.inOrg(ctx, (tx) => room.readingLibraryDTO(tx, learnerId))
    expect(lib.books.find((b) => b.id === BOOK)?.status).toBe('finished')
  })

  it('tempat berhenti tersimpan dan menjadi titik lanjut pembaca', async () => {
    const other = 'g1-seeds-grow'
    await dbm.inOrg(ctx, (tx) => room.saveProgress(tx, ctx, learnerId, { bookId: other, chapterId: 'c2', sentenceIdx: 3 }))
    const reader = await dbm.inOrg(ctx, (tx) => room.readerDTO(tx, learnerId, other, 'c2'))
    expect(reader.startSentence).toBe(3)
    expect(reader.pages.flatMap((p) => p.sentences)).toHaveLength(reader.sentenceCount)
    const other1 = await dbm.inOrg(ctx, (tx) => room.readerDTO(tx, learnerId, other, 'c1'))
    expect(other1.startSentence).toBe(0)
    const lib = await dbm.inOrg(ctx, (tx) => room.readingLibraryDTO(tx, learnerId))
    expect(lib.continueBook?.id).toBe(other)
    await expect(dbm.inOrg(ctx, (tx) => room.saveProgress(tx, ctx, learnerId, { bookId: 'g9-tidak-ada', chapterId: 'c1', sentenceIdx: 0 }))).rejects.toThrow()
  })

  it('menit membaca: panggilan beruntun dalam 20 detik dihitung sekali', async () => {
    await dbm.inOrg(ctx, (tx) => room.logReadingSeconds(tx, ctx, learnerId, 30))
    await dbm.inOrg(ctx, (tx) => room.logReadingSeconds(tx, ctx, learnerId, 30))
    const [row] = await owner`select seconds from reading_day where learner_id = ${learnerId}`
    expect(row!.seconds).toBe(30)
    await owner`update reading_day set last_at = now() - interval '40 seconds' where learner_id = ${learnerId}`
    await dbm.inOrg(ctx, (tx) => room.logReadingSeconds(tx, ctx, learnerId, 30))
    const [row2] = await owner`select seconds from reading_day where learner_id = ${learnerId}`
    expect(row2!.seconds).toBe(60)
    const summary = await dbm.inOrg(ctx, (tx) => room.readingSummary(tx, learnerId))
    expect(summary.minutesWeek).toBe(1)
  })
})
