import 'server-only'
import { and, asc, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { addDays, jakartaDate } from '@kira/core/time'
import { tables } from '@kira/db'
import { itemSchema, SKILL_ID, skillSubject, type Item } from '@kira/content'
import { semanticProblems } from '@kira/content/load'
import { GENERATORS } from '@kira/content/math'
import { accountActive, findMcpToken } from '../auth/admin'
import { auditTx } from '../audit'
import type { OrgContext, Tx } from '../db'
import { inOrg } from '../db'
import { accuracyPct, skillOptions, SUBJECT_ORDER, thisWeekStart } from './console-common'
import { content, passage, resolveItems, skill } from './content'
import { argIssues, TOOL_INPUTS, toolError, toolJson, type McpAuth, type ToolName, type ToolResult } from './mcp'

/**
 * Tool MCP Kira. Semua query lewat inOrg dengan konteks tutor pemilik token, jadi RLS membatasi ke org token itu.
 * Tidak ada tool yang mengembalikan nama, email, teks jawaban, foto, atau rekaman learner.
 */

const { learnerProfile, memberProfile, skillState, response, orgItem, aiJob, aiDraft } = tables

type Ctx = OrgContext

async function learnerList(tx: Tx): Promise<{ id: string; grade: number; active: boolean; label: string }[]> {
  const rows = await tx
    .select({ id: learnerProfile.userId, grade: learnerProfile.grade, active: learnerProfile.active })
    .from(learnerProfile)
    .where(isNull(learnerProfile.deletedAt))
    .orderBy(asc(learnerProfile.createdAt), asc(learnerProfile.userId))
  return rows.map((r, i) => ({ ...r, label: `Learner ${i + 1}` }))
}

/** "Learner 2", "learner_2", "2", atau id learner. */
export function findLearner<T extends { id: string; label: string }>(list: readonly T[], query: string): T | undefined {
  const q = query.trim()
  const m = /^(?:learner[\s_-]*)?(\d{1,3})$/i.exec(q)
  if (m) return list[Number(m[1]) - 1]
  return list.find((l) => l.id === q.toLowerCase())
}

async function listLearners(ctx: Ctx): Promise<ToolResult> {
  const list = await inOrg(ctx, learnerList)
  return toolJson({ learners: list.map((l) => ({ label: l.label, id: l.id, grade: l.grade, active: l.active })) })
}

async function learnerProgress(ctx: Ctx, args: z.infer<(typeof TOOL_INPUTS)['learner_progress']>): Promise<ToolResult> {
  return inOrg(ctx, async (tx) => {
    const list = await learnerList(tx)
    const l = findLearner(list, args.learner)
    if (!l) return toolError(`No learner matches "${args.learner.slice(0, 60)}". Call list_learners to see the labels.`)
    const states = await tx
      .select({ skillId: skillState.skillId, stars: skillState.stars, gate: skillState.gate, n: skillState.nAnswers, recent: skillState.recent, last: skillState.lastPracticed })
      .from(skillState)
      .where(eq(skillState.learnerId, l.id))
    const sortKey = (id: string) => {
      const meta = skill(id)
      return [SUBJECT_ORDER.indexOf(meta?.subject ?? skillSubject(id)), meta?.grade ?? Number(id[1]), meta?.order ?? 999] as const
    }
    const skills = [...states]
      .sort((a, b) => {
        const [s1, g1, o1] = sortKey(a.skillId)
        const [s2, g2, o2] = sortKey(b.skillId)
        return s1 - s2 || g1 - g2 || o1 - o2
      })
      .map((s) => {
        const meta = skill(s.skillId)
        const recent = s.recent.slice(-10)
        return {
          skillId: s.skillId,
          title: meta?.title ?? s.skillId,
          subject: meta?.subject ?? skillSubject(s.skillId),
          grade: meta?.grade ?? Number(s.skillId[1]),
          stars: s.stars,
          gate: s.gate,
          answers: s.n,
          recentAccuracyPct: recent.length > 0 ? accuracyPct(recent.filter((x) => x > 0).length, recent.length) : null,
          lastPractised: s.last,
        }
      })
    const monday = thisWeekStart(jakartaDate())
    const weeks = [21, 14, 7, 0].map((d) => addDays(monday, -d))
    const rows = await tx
      .select({
        subject: response.subject,
        week: sql<string>`to_char(date_trunc('week', ${response.answeredAt} at time zone 'Asia/Jakarta'), 'YYYY-MM-DD')`,
        total: sql<number>`count(*)::int`,
        correct: sql<number>`count(*) filter (where ${response.status} = 'correct')::int`,
      })
      .from(response)
      .where(and(eq(response.learnerId, l.id), eq(response.attemptNo, 1), inArray(response.status, ['correct', 'wrong']), gte(response.answeredAt, new Date(`${weeks[0]}T00:00:00+07:00`))))
      .groupBy(response.subject, sql`2`)
    const weeklyAccuracy = weeks.map((w) => ({
      weekStart: w,
      subjects: Object.fromEntries(
        SUBJECT_ORDER.map((subject) => {
          const r = rows.find((x) => x.subject === subject && x.week === w)
          return [subject, { answers: r?.total ?? 0, accuracyPct: r ? accuracyPct(r.correct, r.total) : null }]
        }),
      ),
    }))
    return toolJson({ learner: l.label, grade: l.grade, active: l.active, skills, weeklyAccuracy })
  })
}

async function listSkills(_ctx: Ctx, args: z.infer<(typeof TOOL_INPUTS)['list_skills']>): Promise<ToolResult> {
  const skills = skillOptions({ subject: args.subject ?? null, grade: args.grade ?? null }).map((s) => ({
    id: s.id,
    subject: s.subject,
    grade: s.grade,
    strand: s.strand,
    title: s.title,
    canDo: skill(s.id)?.canDo ?? '',
    generator: GENERATORS.has(s.id),
  }))
  return toolJson({ count: skills.length, skills })
}

async function getItem(ctx: Ctx, args: z.infer<(typeof TOOL_INPUTS)['get_item']>): Promise<ToolResult> {
  return inOrg(ctx, async (tx) => {
    const item = (await resolveItems(tx, [args.ref])).get(args.ref)
    if (!item) return toolError(`Item ${args.ref.slice(0, 120)} was not found. Use search_items to find refs.`)
    const p = passage(item.passage)
    return toolJson({ ref: args.ref, item, ...(p ? { passage: { id: p.id, title: p.title, text: p.text } } : {}) })
  })
}

type SearchRow = { ref: string; skill: string; type: string; difficulty: number; lang: string; source: string; prompt: string }

function searchRow(ref: string, item: Item): SearchRow {
  const flat = item.prompt.replace(/\s+/g, ' ').trim()
  return { ref, skill: item.skill, type: item.type, difficulty: item.difficulty, lang: item.lang, source: item.source, prompt: flat.length > 140 ? `${flat.slice(0, 139)}…` : flat }
}

async function searchItems(ctx: Ctx, args: z.infer<(typeof TOOL_INPUTS)['search_items']>): Promise<ToolResult> {
  if (!args.skillId && !args.text) return toolError('Give skillId, text, or both.')
  const q = args.text?.toLowerCase()
  const out: SearchRow[] = []
  for (const item of content().items.values()) {
    if (args.skillId && item.skill !== args.skillId) continue
    if (q && !item.prompt.toLowerCase().includes(q)) continue
    out.push(searchRow(item.id, item))
  }
  const orgRows = await inOrg(ctx, (tx) =>
    tx
      .select({ id: orgItem.id, body: orgItem.body })
      .from(orgItem)
      .where(
        and(
          isNull(orgItem.retiredAt),
          args.skillId ? eq(orgItem.skillId, args.skillId) : undefined,
          args.text ? sql`${orgItem.body}->>'prompt' ilike ${`%${args.text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`}` : undefined,
        ),
      )
      .orderBy(desc(orgItem.createdAt))
      .limit(200),
  )
  for (const r of orgRows) {
    const parsed = itemSchema.safeParse({ ...(r.body as object), id: `org:${r.id}` })
    if (parsed.success) out.push(searchRow(`org:${r.id}`, parsed.data))
  }
  out.sort((a, b) => a.skill.localeCompare(b.skill) || a.ref.localeCompare(b.ref))
  const limit = args.limit ?? 20
  const gen = args.skillId ? GENERATORS.get(args.skillId) : undefined
  return toolJson({
    total: out.length,
    items: out.slice(0, limit),
    ...(gen ? { generator: { levels: [...gen.levels], refPattern: `gen:${args.skillId}:<level>:<seed>`, note: 'Generated items work with get_item, for example with seed a1.' } } : {}),
  })
}

async function createDraftItems(ctx: Ctx, args: z.infer<(typeof TOOL_INPUTS)['create_draft_items']>): Promise<ToolResult> {
  if (!SKILL_ID.test(args.skillId) || !skill(args.skillId)) return toolError(`Unknown skill ${args.skillId.slice(0, 80)}. Call list_skills for valid ids.`)
  const errors: string[] = []
  const items: Item[] = []
  args.items.forEach((raw, i) => {
    const parsed = itemSchema.safeParse({ ...raw, id: 'draft', source: 'ai-draft', skill: args.skillId })
    if (parsed.success) items.push(parsed.data)
    else errors.push(`items[${i}]: ${argIssues(parsed.error)}`)
  })
  if (errors.length > 0) return toolError(`No drafts were saved. Fix these items and call create_draft_items again.\n${errors.join('\n')}`)
  const checked = items.map((item) => ({ item, problems: semanticProblems(item).slice(0, 20) }))
  const withProblems = checked.filter((c) => c.problems.length > 0).length
  await inOrg(ctx, async (tx) => {
    const now = new Date()
    const [job] = await tx
      .insert(aiJob)
      .values({
        orgId: ctx.orgId,
        kind: 'mcp',
        status: 'done',
        input: { kind: 'mcp', skillId: args.skillId, count: items.length },
        output: { drafts: items.length, withProblems },
        provider: 'mcp',
        createdBy: ctx.userId,
        startedAt: now,
        finishedAt: now,
      })
      .returning({ id: aiJob.id })
    await tx.insert(aiDraft).values(checked.map((c) => ({ orgId: ctx.orgId, jobId: job!.id, kind: 'items', status: 'pending' as const, body: c.item, problems: c.problems })))
    await auditTx(tx, ctx, 'mcp.drafts.created', job!.id, { skillId: args.skillId, count: items.length })
  })
  return toolJson({
    saved: items.length,
    drafts: checked.map((c, index) => ({ index, problems: c.problems })),
    message: 'The drafts are waiting in Studio AI. A tutor reviews and approves each one before learners see it.',
  })
}

type Impl = (ctx: Ctx, args: never) => Promise<ToolResult>

const IMPLS: Record<ToolName, Impl> = {
  list_learners: listLearners,
  learner_progress: learnerProgress,
  list_skills: listSkills,
  get_item: getItem,
  search_items: searchItems,
  create_draft_items: createDraftItems,
}

/**
 * Token MCP dari header Authorization. Pemilik token harus akun tutor yang masih aktif dan belum dikeluarkan
 * dari keluarga; selain itu null (endpoint menjawab 401 tanpa alasan).
 */
export async function authenticateMcpToken(token: string | null): Promise<McpAuth | null> {
  if (!token) return null
  const t = await findMcpToken(token)
  if (!t) return null
  const account = await accountActive(t.orgId, t.userId)
  if (!account || account.role !== 'tutor') return null
  const [member] = await inOrg({ orgId: t.orgId, userId: t.userId, role: 'tutor' }, (tx) =>
    tx.select({ removedAt: memberProfile.removedAt }).from(memberProfile).where(eq(memberProfile.userId, t.userId)).limit(1),
  )
  if (member?.removedAt) return null
  return { tokenId: t.id, orgId: t.orgId, userId: t.userId }
}

/** Jalankan tool atas nama tutor pemilik token. Argumen divalidasi Zod; argumen salah menjadi hasil isError. */
export async function callKiraTool(auth: McpAuth, name: ToolName, args: unknown): Promise<ToolResult> {
  const parsed = TOOL_INPUTS[name].safeParse(args)
  if (!parsed.success) return toolError(`Invalid arguments for ${name}: ${argIssues(parsed.error)}`)
  const ctx: Ctx = { orgId: auth.orgId, userId: auth.userId, role: 'tutor' }
  const impl = IMPLS[name] as (ctx: Ctx, args: unknown) => Promise<ToolResult>
  return impl(ctx, parsed.data)
}
