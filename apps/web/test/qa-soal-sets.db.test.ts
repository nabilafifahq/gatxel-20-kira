import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { clashKeys, displaySignature, twinKey, type Item, type Skill } from '@kira/content'
import { createDb, withOrg, type Db, type OrgContext, type Tx } from '@kira/db/client'

/**
 * Banyak set soal lewat kode pemilih sungguhan, per mapel, kelas, dan mode: tidak boleh ada dua soal sama dalam satu set,
 * dan soal tertulis yang sudah dijawab tidak muncul lagi selama skill itu masih punya soal yang belum dilihat.
 * Setiap kombinasi memakai anak baru, supaya kedalaman bank terbaca per kombinasi.
 * Jumlah set per kombinasi: QA_SETS (bawaan 6 supaya cepat di CI, QA memakai 300).
 */
const ownerUrl = process.env.DATABASE_URL_OWNER
const appUrl = process.env.DATABASE_URL_APP
const ready = Boolean(ownerUrl && appUrl)
const SETS = Number(process.env.QA_SETS ?? 6)
const SUBJECTS = ['math', 'english', 'science'] as const
const GRADES = (process.env.QA_GRADES ?? '2,5').split(',').map(Number)
/** mix: satu hari penuh untuk satu anak (Latihan, Tes, paper mini), jadi ulangan antar-sesi ikut terbaca. */
const MODES = (process.env.QA_MODES ?? 'latihan,tes,paper-mini,paper-full,practice,mix').split(',') as ('latihan' | 'tes' | 'paper-mini' | 'paper-full' | 'practice' | 'mix')[]
const MIX = ['latihan', 'tes', 'paper-mini'] as const
/** Jendela ulangan isi: soal yang sama (termasuk soal generator dengan seed lain) dalam 10 set terakhir. */
const RECENT = 10

type Stat = {
  sets: number
  items: number
  shortSets: number
  emptySets: number
  clashRaw: number
  clash: number
  nearDup: number
  refDup: number
  repeatTotal: number
  repeatWithFresh: number
  firstRepeatSet: number | null
  repeatRecentContent: number
  manual: number
  samples: string[]
}
const fresh = (): Stat => ({ sets: 0, items: 0, shortSets: 0, emptySets: 0, clashRaw: 0, clash: 0, nearDup: 0, refDup: 0, repeatTotal: 0, repeatWithFresh: 0, firstRepeatSet: null, repeatRecentContent: 0, manual: 0, samples: [] })

const MANUAL = new Set(['write', 'speak', 'draw', 'photo'])

describe.skipIf(!ready)('set soal tanpa kembar dan tanpa ulangan', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 2, onnotice: () => {} }) : (null as never)
  const app = ready ? createDb(appUrl!, { name: 'qa-soal-sets', max: 4 }) : (null as never)
  const orgId = randomUUID()
  const tutorId = randomUUID()
  let db: Db
  let m: {
    session: typeof import('@/server/dal/learner-session')
    core: typeof import('@/server/dal/learner-core')
    content: typeof import('@/server/dal/content')
    paper: typeof import('@/server/dal/daily-paper')
    guard: typeof import('@/server/dal/session-guard')
  }

  beforeAll(async () => {
    db = app.db
    m = {
      session: await import('@/server/dal/learner-session'),
      core: await import('@/server/dal/learner-core'),
      content: await import('@/server/dal/content'),
      paper: await import('@/server/dal/daily-paper'),
      guard: await import('@/server/dal/session-guard'),
    }
    await owner`insert into org (id, name) values (${orgId}, ${'QA sets __GTX_SEED__'})`
    await owner`insert into auth.user_account (id, org_id, kind, role, email, name) values (${tutorId}, ${orgId}, 'adult', 'guardian', ${`qa-${orgId}@contoh.test`}, 'QA')`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values (${tutorId}, ${orgId}, 'QA', 'guardian', ${`qa-${orgId}@contoh.test`})`
  })

  afterAll(async () => {
    await owner`delete from org where id = ${orgId}`.catch(() => undefined)
    await owner.end()
  })

  async function newLearner(grade: number): Promise<string> {
    const id = randomUUID()
    await owner`insert into auth.user_account (id, org_id, kind, role, name) values (${id}, ${orgId}, 'learner', 'learner', ${`QA${grade}`})`
    await owner`insert into learner_profile (user_id, org_id, name, avatar, grade, active) values (${id}, ${orgId}, ${`QA${grade}`}, 'fox', ${grade}, true)`
    return id
  }

  async function markSeen(learnerId: string, subject: string, refs: string[], itemsOf: Map<string, Item>, daysAgo: number): Promise<void> {
    if (refs.length === 0) return
    const [a] = await owner`insert into attempt (org_id, learner_id, kind, mode, subject, title, items, status)
      values (${orgId}, ${learnerId}, 'test', 'latihan', ${subject}, 'QA', ${owner.json([])}, 'submitted') returning id`
    const rows = refs.flatMap((ref, i) => {
      const it = itemsOf.get(ref)
      if (!it) return []
      return [{ org_id: orgId, attempt_id: a!.id as string, learner_id: learnerId, position: i + 1, attempt_no: 1, item_ref: ref, skill_id: it.skill, subject, item_type: it.type, difficulty: it.difficulty, status: 'correct', client_id: randomUUID(), answered_at: new Date(Date.now() - daysAgo * 86400000) }]
    })
    if (rows.length) await owner`insert into response ${owner(rows)}`
  }

  it(
    'semua kombinasi',
    async () => {
      const all: Record<string, Stat> = {}
      const date = '2026-11-05'
      for (const grade of GRADES) {
        for (const subject of SUBJECTS) {
          const skills: Skill[] = m.content.skillsFor(subject, grade).filter((s) => s.strand !== 'Oly')
          if (skills.length === 0) continue
          for (const mode of MODES) {
            const key = `${subject}|g${grade}|${mode}`
            const st = (all[key] = fresh())
            const learnerId = await newLearner(grade)
            const ctx: OrgContext = { orgId, userId: learnerId, role: 'learner' }
            const run = <T>(fn: (tx: Tx) => Promise<T>) => withOrg(db, ctx, fn)
            const seenRefs = new Set<string>()
            const history: Set<string>[] = []
            const passageOf = (it: Item) => (it.passage ? m.content.content().passages.get(it.passage) : undefined)
            const window = mode === 'mix' ? RECENT * MIX.length : RECENT
            for (let n = 0; n < SETS; n++) {
              // Hari sungguhan bertahan di satu skill beberapa hari; mode lain berkeliling supaya semua skill tersentuh.
              const sk = skills[(mode === 'mix' ? Math.floor(n / 5) : n) % skills.length]!
              const day = new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
              const today = new Set<string>()
              for (const sub of mode === 'mix' ? MIX : [mode]) {
              const seedKey = `qa:${key}:${sub}:${n}`
              const { refs, raw, itemsOf, want } = await run(async (tx) => {
                const learner = await m.core.loadLearner(tx, learnerId)
                let list: { ref: string; difficulty: number; position: number; section?: string }[]
                let rawRefs: string[]
                let want: number
                if (sub === 'latihan') {
                  want = 10
                  list = await m.session.buildQuestItems(tx, ctx, learner, { skillId: sk.id, subject, mode: 'latihan', date: day, seedKey, style: 'easy', length: want, allowManual: false })
                  rawRefs = list.map((x) => x.ref)
                } else if (sub === 'tes') {
                  want = 10
                  list = await m.session.buildQuestItems(tx, ctx, learner, { skillId: sk.id, subject, mode: 'latihan', date: day, seedKey, style: 'test', length: want, avoid: today })
                  rawRefs = list.map((x) => x.ref)
                } else if (sub === 'practice') {
                  want = 5
                  list = await m.session.buildQuestItems(tx, ctx, learner, { skillId: sk.id, subject, mode: 'latihan', date: day, seedKey, length: want })
                  rawRefs = list.map((x) => x.ref)
                } else {
                  const kind = sub === 'paper-mini' ? 'mini' : 'full'
                  const p = await m.paper.pickDailyPaper(tx, { orgId, learnerId, grade }, subject, day, kind)
                  rawRefs = p?.itemRefs ?? []
                  want = kind === 'mini' ? 8 : rawRefs.length
                  const resolved = await m.content.resolveItems(tx, rawRefs)
                  // Sama dengan insertAttempt: paper melewati penjaga sebelum jadi attempt.
                  list = await m.guard.guardAttemptItems(tx, rawRefs.map((ref, i) => ({ ref, position: i + 1, difficulty: resolved.get(ref)?.difficulty ?? 3 })), { seed: `${seedKey}:guard`, mode: 'tes' })
                }
                const refs = list.map((x) => x.ref)
                return { refs, raw: rawRefs, itemsOf: await m.content.resolveItems(tx, [...new Set([...refs, ...rawRefs])]), want }
              })

              st.sets++
              st.items += refs.length
              if (refs.length === 0) st.emptySets++
              if (refs.length < want) st.shortSets++

              // Bentrok sebelum penjaga (hanya paper berbeda dari hasil akhir).
              const rawKeys = new Set<string>()
              for (const ref of raw) {
                const it = itemsOf.get(ref)
                if (!it) continue
                const ks = clashKeys(it, passageOf(it))
                if (ks.some((k) => rawKeys.has(k))) st.clashRaw++
                for (const k of ks) rawKeys.add(k)
              }

              const keys = new Set<string>()
              const twins = new Set<string>()
              const used = new Set<string>()
              const sigs = new Set<string>()
              for (const ref of refs) {
                if (used.has(ref)) {
                  st.refDup++
                  if (st.samples.length < 10) st.samples.push(`ref kembar set ${n}: ${ref}`)
                }
                used.add(ref)
                const it = itemsOf.get(ref)
                if (!it) {
                  if (st.samples.length < 10) st.samples.push(`ref tidak terbaca: ${ref}`)
                  continue
                }
                if (MANUAL.has(it.type)) st.manual++
                const ks = clashKeys(it, passageOf(it))
                if (ks.some((k) => keys.has(k))) {
                  st.clash++
                  if (st.samples.length < 10) st.samples.push(`kembar set ${n}: ${ref} ${it.prompt.slice(0, 60)}`)
                }
                for (const k of ks) keys.add(k)
                const tw = twinKey(it)
                if (twins.has(tw)) {
                  st.nearDup++
                  if (st.samples.length < 10) st.samples.push(`hampir kembar set ${n}: ${ref} ${it.prompt.slice(0, 60)}`)
                }
                twins.add(tw)
                if (!ref.startsWith('gen:') && seenRefs.has(ref)) {
                  st.repeatTotal++
                  if (st.firstRepeatSet === null) st.firstRepeatSet = n
                  const pool = (m.content.content().itemsBySkill.get(it.skill) ?? []).filter((x) => !MANUAL.has(x.type) && !seenRefs.has(x.id) && !used.has(x.id))
                  if (pool.length > 0) {
                    st.repeatWithFresh++
                    if (st.samples.length < 10) st.samples.push(`ulang padahal masih ada ${pool.length} soal baru, set ${n}: ${ref}`)
                  }
                }
                const sig = displaySignature(it, passageOf(it))
                sigs.add(sig)
                if (history.slice(-window).some((h) => h.has(sig))) {
                  st.repeatRecentContent++
                  if (st.samples.length < 10) st.samples.push(`isi sama dalam ${window} set terakhir, set ${n}: ${ref} ${it.prompt.slice(0, 60)}`)
                }
              }
              history.push(sigs)
              for (const ref of refs) {
                today.add(ref)
                if (!ref.startsWith('gen:')) seenRefs.add(ref)
              }
              await markSeen(learnerId, subject, refs, itemsOf, SETS - n)
              }
            }
            console.log(key, JSON.stringify({ ...st, samples: st.samples.slice(0, 3) }))
            if (process.env.QA_SETS_OUT) writeFileSync(process.env.QA_SETS_OUT, JSON.stringify(all, null, 1))
          }
        }
      }
      const sum = (f: (s: Stat) => number) => Object.values(all).reduce((a, s) => a + f(s), 0)
      expect(sum((s) => s.clash), 'dua soal sama dalam satu set').toBe(0)
      expect(sum((s) => s.refDup), 'ref sama dua kali dalam satu set').toBe(0)
    },
    5 * 60 * 60 * 1000,
  )
})
