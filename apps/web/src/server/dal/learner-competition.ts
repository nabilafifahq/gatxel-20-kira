import 'server-only'
import { and, asc, desc, eq, gte, isNull, like } from 'drizzle-orm'
import { createRng, daysBetween, formatDateEn, jakartaDate, type PresetRules } from '@kira/core'
import { olympiadOn } from '@kira/core/features'
import { tables } from '@kira/db'
import { GENERATORS, genRef, newSeed } from '@kira/content/math'
import { isPaperType, type Item, type Preset } from '@kira/content'
import type { CompetitionIntroDTO, CompetitionPickDTO, EsmoDTO, EsmoPack } from '@/lib/dto'
import { dictFor, htmlLang } from '@/lib/i18n'
import type { OrgContext, Tx } from '../db'
import { invalid, notFound } from '../errors'
import { content, preset, presets, skillsFor } from './content'
import { guardAttemptItems } from './session-guard'
import { requestDict, requestLang } from './arena-session'
import { learnerShell, loadLearner, type LearnerRow } from './learner-core'
import { featureMapFor } from './learner-features'

const { attempt, orgItem, competitionEvent } = tables

/** Preset yang dipakai untuk menilai attempt lomba atau paket ESMO. */
export function presetForAttempt(a: { kind: string; refId: string | null; subject: string }): Preset | undefined {
  if (a.kind === 'simulation' || a.kind === 'esmo-mock') return a.refId ? preset(a.refId) : undefined
  if (a.kind === 'esmo-pack') return preset(`esmo-practice-${a.subject}-2026`)
  return undefined
}

/** Kalau soal lebih sedikit dari aturan, aturan satu bagian berpoin sama diskalakan ke jumlah soal. */
export function effectiveRules(p: Preset, n: number): PresetRules {
  const r = p.rules
  if (n >= r.questionCount) return r
  if (r.sections.length === 1) return { ...r, questionCount: n, sections: [{ ...r.sections[0]!, from: 1, to: n }] }
  return r
}

function eligible(p: Preset, learner: LearnerRow): boolean {
  return p.grades.includes(learner.grade) || p.grades.some((g) => Math.abs(g - learner.grade) <= 1)
}

export async function competitionPickDTO(tx: Tx, learnerId: string): Promise<CompetitionPickDTO> {
  const t = await requestDict()
  const copy = t.arena.competition
  const learner = await loadLearner(tx, learnerId)
  const features = await featureMapFor(tx, learnerId)
  const list = presets().filter((p) => !p.id.startsWith('esmo-practice') && eligible(p, learner) && olympiadOn(features, p.subject))
  const last = await tx
    .select({ refId: attempt.refId, scaled: attempt.scoreScaled, raw: attempt.scoreRaw, max: attempt.scoreMax, at: attempt.submittedAt })
    .from(attempt)
    .where(and(eq(attempt.learnerId, learnerId), eq(attempt.kind, 'simulation')))
    .orderBy(desc(attempt.submittedAt))
  return {
    shell: await learnerShell(tx, learner),
    presets: list.map((p) => {
      const l = last.find((x) => x.refId === p.id && x.at)
      return {
        presetId: p.id,
        title: p.title,
        subjectLine: copy.subjectLine(t.common.subject[p.subject], p.lang),
        formatLines: [copy.format(p.rules.questionCount, p.rules.timeLimitMin), ...(p.rules.sections.length > 1 ? [copy.parts(p.rules.sections.length, p.rules.sections.map((s) => s.points).join(', '))] : [])],
        verified: p.verified,
        lastTry: l ? (l.scaled !== null ? copy.lastScaled(Math.round(l.scaled)) : copy.lastRaw(Math.round(l.raw ?? 0), Math.round(l.max ?? 0))) : null,
        href: `/competitions/${p.id}`,
      }
    }),
  }
}

export async function competitionIntroDTO(tx: Tx, learnerId: string, presetId: string): Promise<CompetitionIntroDTO> {
  const t = await requestDict()
  const learner = await loadLearner(tx, learnerId)
  const p = preset(presetId)
  if (!p || !olympiadOn(await featureMapFor(tx, learnerId), p.subject)) throw notFound()
  return {
    shell: await learnerShell(tx, learner),
    presetId: p.id,
    title: p.title,
    sub: t.arena.competition.sub(t.common.subject[p.subject], p.rules.questionCount, p.rules.timeLimitMin),
    verified: p.verified,
    rules: p.howItWorks,
    tip: p.tip ?? null,
    questionCount: p.rules.questionCount,
    timeLimitSec: p.rules.timeLimitMin * 60,
    optionCount: p.rules.optionCount,
    startLabel: t.arena.competition.startLabel,
  }
}

/** Pilih soal untuk simulasi: soal bertag lomba, diurutkan per bagian poin, lalu diisi soal olimpiade atau generator. */
export async function pickSimulationItems(tx: Tx, learner: LearnerRow, p: Preset, seedKey: string): Promise<{ ref: string; difficulty: number }[]> {
  const rng = createRng(seedKey)
  const grades = new Set([learner.grade, ...p.grades])
  const all = [...content().items.values()].filter((i) => i.skill[0] === p.subject[0] && grades.has(Number(i.skill[1])) && isPaperType(i.type))
  const tagged = all.filter((i) => i.tags.some((t) => p.itemTags.includes(t)))
  const orgRows = await tx.select({ id: orgItem.id, body: orgItem.body, tags: orgItem.tags }).from(orgItem).where(isNull(orgItem.retiredAt))
  const orgTagged = orgRows.filter((r) => r.tags.some((t) => p.itemTags.includes(t))).map((r) => ({ ref: `org:${r.id}`, difficulty: (r.body as Item).difficulty ?? 3, points: (r.body as Item).points }))
  const pool = [...tagged.map((i) => ({ ref: i.id, difficulty: i.difficulty, points: i.points })), ...orgTagged]
  const used = new Set<string>()
  const out: { ref: string; difficulty: number }[] = []
  const take = (filter: (c: { difficulty: number; points?: number }) => boolean) => {
    const candidates = rng.shuffle(pool.filter((c) => !used.has(c.ref) && filter(c)))
    const c = candidates[0]
    if (c) {
      used.add(c.ref)
      out.push({ ref: c.ref, difficulty: c.difficulty })
      return true
    }
    return false
  }
  const olympiad = rng.shuffle(all.filter((i) => i.tags.includes('olympiad') && !used.has(i.id)))
  for (const s of p.rules.sections) {
    const targetDiff = s.points >= 5 ? 5 : s.points >= 4 ? 4 : s.points >= 3 ? 3 : 2
    for (let pos = s.from; pos <= s.to; pos++) {
      if (take((c) => c.points === s.points)) continue
      if (take((c) => c.difficulty === targetDiff)) continue
      if (take(() => true)) continue
      const o = olympiad.find((i) => !used.has(i.id))
      if (o) {
        used.add(o.id)
        out.push({ ref: o.id, difficulty: o.difficulty })
        continue
      }
      // Cadangan: generator skill grade learner pada tingkat yang sesuai.
      const gens = skillsFor(p.subject, learner.grade).filter((sk) => GENERATORS.get(sk.id)?.levels.includes(targetDiff as 1 | 2 | 3 | 4 | 5))
      if (gens.length) out.push({ ref: genRef(rng.pick(gens).id, targetDiff as 1 | 2 | 3 | 4 | 5, newSeed(rng)), difficulty: targetDiff })
    }
  }
  return out
}

export async function startSimulation(tx: Tx, ctx: OrgContext, learnerId: string, presetId: string): Promise<string> {
  const learner = await loadLearner(tx, learnerId)
  const p = preset(presetId)
  if (!p || !olympiadOn(await featureMapFor(tx, learnerId), p.subject)) throw notFound()
  const open = await tx
    .select({ id: attempt.id })
    .from(attempt)
    .where(and(eq(attempt.learnerId, learnerId), eq(attempt.kind, 'simulation'), eq(attempt.refId, presetId), eq(attempt.status, 'in_progress')))
    .limit(1)
  if (open[0]) return open[0].id
  const picked = await pickSimulationItems(tx, learner, p, `${learnerId}:${presetId}:${Date.now()}`)
  if (picked.length === 0) throw invalid((await requestDict()).arena.errors.noSimQuestions)
  const simItems = await guardAttemptItems(tx, picked.map((x, i) => ({ ref: x.ref, section: 'core' as const, position: i + 1, difficulty: x.difficulty })), { seed: `${learnerId}:${presetId}:sim`, mode: 'simulasi' })
  const [row] = await tx
    .insert(attempt)
    .values({
      orgId: ctx.orgId,
      learnerId,
      kind: 'simulation',
      refId: p.id,
      mode: 'simulasi',
      subject: p.subject,
      title: p.title,
      items: simItems,
      timeLimitS: p.rules.timeLimitMin * 60,
    })
    .returning({ id: attempt.id })
  return row!.id
}

type Pack = { id: string; subject: 'math' | 'english'; num: number; refs: string[] }

/** Paket ESMO: paket resmi hasil impor (koleksi esmo:<mapel>:<n>) atau paket latihan dari soal bergaya ESMO. */
export async function esmoPacks(tx: Tx, learner: LearnerRow): Promise<Pack[]> {
  const packs: Pack[] = []
  const rows = await tx
    .select({ id: orgItem.id, collection: orgItem.collection, position: orgItem.position })
    .from(orgItem)
    .where(and(like(orgItem.collection, 'esmo:%'), isNull(orgItem.retiredAt)))
    .orderBy(asc(orgItem.collection), asc(orgItem.position))
  const byColl = new Map<string, string[]>()
  for (const r of rows) byColl.set(r.collection!, [...(byColl.get(r.collection!) ?? []), `org:${r.id}`])
  for (const [coll, refs] of byColl) {
    const [, subject, num] = coll.split(':')
    if ((subject === 'math' || subject === 'english') && num) packs.push({ id: coll, subject, num: Number(num), refs })
  }
  for (const subject of ['math', 'english'] as const) {
    if (packs.some((p) => p.subject === subject)) continue
    const items = [...content().items.values()]
      .filter((i) => i.tags.includes('esmo') && i.skill[0] === subject[0] && Number(i.skill[1]) <= Math.max(2, learner.grade) && i.type === 'mcq')
      .sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id))
    const rng = createRng(`esmo:${subject}`)
    const shuffled = rng.shuffle(items)
    for (let i = 0; i * 10 < shuffled.length && i < 10; i++) {
      const chunk = shuffled.slice(i * 10, i * 10 + 10)
      if (chunk.length < 5) break
      packs.push({ id: `builtin:${subject}:${i + 1}`, subject, num: i + 1, refs: chunk.map((c) => c.id) })
    }
  }
  return packs
}

export async function esmoDTO(tx: Tx, learnerId: string): Promise<EsmoDTO> {
  const lang = await requestLang()
  const t = dictFor(lang).arena.esmo
  const learner = await loadLearner(tx, learnerId)
  const today = jakartaDate()
  const features = await featureMapFor(tx, learnerId)
  const packs = await esmoPacks(tx, learner)
  const atts = await tx
    .select({ id: attempt.id, refId: attempt.refId, status: attempt.status, scaled: attempt.scoreScaled, kind: attempt.kind })
    .from(attempt)
    .where(and(eq(attempt.learnerId, learnerId), eq(attempt.kind, 'esmo-pack')))
    .orderBy(desc(attempt.startedAt))
  const final = await tx
    .select({ name: competitionEvent.name, date: competitionEvent.date, estimate: competitionEvent.dateIsEstimate })
    .from(competitionEvent)
    .where(and(eq(competitionEvent.competitionId, 'esmo'), gte(competitionEvent.date, today)))
    .orderBy(asc(competitionEvent.date))
    .limit(1)
  const column = (subject: 'math' | 'english'): EsmoDTO['columns'][number] => {
    const list = packs.filter((p) => p.subject === subject)
    const mapped: EsmoPack[] = list.map((p) => {
      const a = atts.find((x) => x.refId === p.id)
      const status: EsmoPack['status'] = !a ? 'new' : a.status === 'in_progress' ? 'in-progress' : 'done'
      return { id: p.id, num: p.num, status, score: a && a.status !== 'in_progress' && a.scaled !== null ? Math.round(a.scaled / 10) : null, href: a && a.status === 'in_progress' ? `/run/${a.id}` : a ? `/results/${a.id}` : `/esmo/pack/${encodeURIComponent(p.id)}` }
    })
    const done = mapped.filter((m) => m.status === 'done').length
    const mock = preset(`esmo-${subject}-2026`)
    return {
      subject,
      name: subject === 'math' ? 'ESMO Math' : 'ESMO English',
      langNote: subject === 'math' ? t.langMath : t.langEnglish,
      doneLine: t.doneLine(done, mapped.length),
      packs: mapped,
      mockMeta: mock ? t.mockMeta(mock.rules.questionCount, mock.rules.timeLimitMin) : t.mockDefault,
      mockHref: `/esmo/mock/${subject}`,
    }
  }
  const f = final[0]
  return {
    shell: await learnerShell(tx, learner, today),
    finalName: f?.name ?? t.finalName,
    finalDate: f?.date && !f.estimate ? (lang === 'en' ? formatDateEn(f.date, true) : new Intl.DateTimeFormat(htmlLang(lang), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${f.date}T00:00:00Z`))) : null,
    daysToGo: f?.date && !f.estimate ? daysBetween(today, f.date) : null,
    columns: (['math', 'english'] as const).filter((s) => olympiadOn(features, s)).map(column),
  }
}

export async function startEsmoPack(tx: Tx, ctx: OrgContext, learnerId: string, packId: string): Promise<string> {
  const learner = await loadLearner(tx, learnerId)
  const pack = (await esmoPacks(tx, learner)).find((p) => p.id === packId)
  if (!pack || !olympiadOn(await featureMapFor(tx, learnerId), pack.subject)) throw notFound()
  const open = await tx
    .select({ id: attempt.id })
    .from(attempt)
    .where(and(eq(attempt.learnerId, learnerId), eq(attempt.kind, 'esmo-pack'), eq(attempt.refId, packId), eq(attempt.status, 'in_progress')))
    .limit(1)
  if (open[0]) return open[0].id
  const p = preset(`esmo-practice-${pack.subject}-2026`)
  const packItems = await guardAttemptItems(tx, pack.refs.map((ref, i) => ({ ref, section: 'core' as const, position: i + 1, difficulty: 3 })), { seed: `${learnerId}:${packId}`, mode: 'tes' })
  const [row] = await tx
    .insert(attempt)
    .values({
      orgId: ctx.orgId,
      learnerId,
      kind: 'esmo-pack',
      refId: pack.id,
      mode: 'tes',
      subject: pack.subject,
      title: (await requestDict()).arena.esmo.packTitle(pack.subject === 'math' ? 'ESMO Math' : 'ESMO English', pack.num),
      items: packItems,
      timeLimitS: (p?.rules.timeLimitMin ?? (pack.subject === 'math' ? 13 : 10)) * 60,
    })
    .returning({ id: attempt.id })
  return row!.id
}

export async function startEsmoMock(tx: Tx, ctx: OrgContext, learnerId: string, subject: 'math' | 'english'): Promise<string> {
  const learner = await loadLearner(tx, learnerId)
  const p = preset(`esmo-${subject}-2026`)
  if (!p || !olympiadOn(await featureMapFor(tx, learnerId), subject)) throw notFound()
  const packs = (await esmoPacks(tx, learner)).filter((x) => x.subject === subject)
  const rng = createRng(`${learnerId}:esmo-mock:${Date.now()}`)
  const refs = rng.shuffle(packs.flatMap((x) => x.refs)).slice(0, p.rules.questionCount)
  if (refs.length === 0) throw invalid((await requestDict()).arena.errors.noEsmoQuestions)
  const mockItems = await guardAttemptItems(tx, refs.map((ref, i) => ({ ref, section: 'core' as const, position: i + 1, difficulty: 3 })), { seed: `${learnerId}:esmo-mock:${subject}`, mode: 'simulasi' })
  const [row] = await tx
    .insert(attempt)
    .values({
      orgId: ctx.orgId,
      learnerId,
      kind: 'esmo-mock',
      refId: p.id,
      mode: 'simulasi',
      subject,
      title: (await requestDict()).arena.esmo.mockTitle(subject === 'math' ? 'ESMO Math' : 'ESMO English'),
      items: mockItems,
      timeLimitS: p.rules.timeLimitMin * 60,
    })
    .returning({ id: attempt.id })
  return row!.id
}
