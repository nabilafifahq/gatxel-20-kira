import { itemSchema, type Item, type Subject } from '@kira/content/schema'
import { tables, withOrg, type AiDraftKind } from '@kira/db'
import { AI_NOT_CONFIGURED } from '../ai'
import {
  HINTS_SCHEMA,
  RUBRIC_SCHEMA,
  MANUAL_ITEM_TYPES,
  isAiItemType,
  itemForPrompt,
  itemJsonSchema,
  itemsEnvelopeSchema,
  normaliseAiItem,
  type AiItemType,
} from '../ai/item-schema'
import { AI_TIMEOUT_MS } from '../ai/types'
import { JobError } from '../errors'
import { aiHandler, completeAiJobTx, loadAiJob, markAiRunning, type AiInputOf } from './ai-job'
import { checkDraft } from './draft-checks'
import { authoringSystemPrompt, hintsPrompt, itemsPrompt, rubricPrompt, translatePrompt, variantsPrompt } from './prompts'
import type { Handler, HandlerCtx } from './types'

/**
 * Job ai.items, ai.variants, ai.hints, ai.translate, ai.rubric. Hasilnya baris `ai_draft`
 * (status pending) yang baru dipakai setelah tutor menyetujui. Draf yang punya masalah tetap
 * disimpan bersama daftar masalahnya; jawaban model yang tidak terbaca sama sekali dicatat di
 * `ai_job.output` dan tidak disimpan sebagai draf.
 */

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v)

const DEFAULT_TYPES: Record<Subject, AiItemType[]> = {
  math: ['mcq', 'numeric'],
  english: ['mcq', 'text', 'multi', 'order', 'match', 'sort'],
  science: ['mcq', 'multi', 'sort', 'match'],
}

type Draft = { body: Obj; problems: string[] }
type Built = { drafts: Draft[]; invalid: string[] }

function sourceItem(raw: unknown): Item {
  const parsed = itemSchema.safeParse(raw)
  if (!parsed.success) throw new JobError('Soal asal tidak lolos skema soal. Perbaiki soal asal dulu, lalu minta draf lagi.', { retryable: false })
  return parsed.data
}

function asDraftBody(item: Item, patch: Obj): Obj {
  return { ...(item as unknown as Obj), ...patch, id: 'draft', source: 'ai-draft' }
}

function itemsFrom(json: unknown): unknown[] {
  if (isObj(json) && Array.isArray(json.items)) return json.items
  if (Array.isArray(json)) return json
  return []
}

/** Bandingkan struktur jawaban terjemahan dengan soal asal. */
export function structureProblems(source: Item, t: Obj): string[] {
  if (t.type !== source.type) return ['Jenis soal berubah dari soal asal.']
  const p: string[] = []
  const len = (v: unknown) => (Array.isArray(v) ? v.length : -1)
  switch (source.type) {
    case 'mcq':
      if (t.answer !== source.answer || len(t.options) !== source.options.length) p.push('Posisi jawaban benar berubah dari soal asal.')
      break
    case 'multi': {
      const a = Array.isArray(t.answers) ? [...(t.answers as number[])].sort() : []
      if (JSON.stringify(a) !== JSON.stringify([...source.answers].sort()) || len(t.options) !== source.options.length) p.push('Posisi jawaban benar berubah dari soal asal.')
      break
    }
    case 'numeric':
      if (t.answer !== source.answer) p.push('Angka jawaban berubah dari soal asal.')
      break
    case 'text':
      if (len(t.blanks) !== source.blanks.length) p.push('Jumlah titik kosong berubah dari soal asal.')
      break
    case 'order':
      if (len(t.items) !== source.items.length) p.push('Jumlah kartu berubah dari soal asal.')
      break
    case 'match':
      if (len(t.pairs) !== source.pairs.length) p.push('Jumlah pasangan berubah dari soal asal.')
      break
    case 'sort': {
      const groupsOf = Array.isArray(t.items) ? (t.items as Obj[]).map((i) => i?.group) : []
      if (len(t.groups) !== source.groups.length || JSON.stringify(groupsOf) !== JSON.stringify(source.items.map((i) => i.group))) p.push('Pengelompokan berubah dari soal asal.')
      break
    }
    default:
      break
  }
  return p
}

type Plan = { system: string; prompt: string; schema: Record<string, unknown>; build: (json: unknown) => Built; compareRef: string | null }

function plan(input: AiInputOf<'items' | 'variants' | 'hints' | 'translate' | 'rubric'>): Plan {
  const system = authoringSystemPrompt(input.skill)
  const skill = input.skill.id
  switch (input.kind) {
    case 'items': {
      const examples = input.examples.filter(isObj)
      const exampleTypes = [...new Set(examples.map((e) => e.type).filter(isAiItemType))]
      const types = exampleTypes.length ? exampleTypes : DEFAULT_TYPES[input.skill.subject]
      const idCount = examples.filter((e) => e.lang === 'id').length
      const lang: 'en-GB' | 'id' = examples.length > 0 && idCount * 2 > examples.length ? 'id' : 'en-GB'
      return {
        system,
        schema: itemsEnvelopeSchema(types),
        prompt: itemsPrompt({ skill: input.skill, count: input.count, difficulty: input.difficulty, instructions: input.instructions, examples: examples.slice(0, 6).map(itemForPrompt), types, lang }),
        compareRef: null,
        build: (json) => collectItems(itemsFrom(json).slice(0, input.count), { skill, lang, allowed: types }),
      }
    }
    case 'variants': {
      const source = sourceItem(input.item)
      if (!isAiItemType(source.type)) throw new JobError(`Jenis soal ${source.type} belum didukung untuk varian AI.`, { retryable: false })
      const type = source.type
      return {
        system,
        schema: itemsEnvelopeSchema([type]),
        prompt: variantsPrompt({ skill: input.skill, count: input.count, difficulty: input.difficulty, instructions: input.instructions, source: itemForPrompt(source), type, lang: source.lang }),
        compareRef: input.itemRef,
        build: (json) => collectItems(itemsFrom(json).slice(0, input.count), { skill, lang: source.lang, allowed: [type], source: source as unknown as Obj }),
      }
    }
    case 'hints': {
      const source = sourceItem(input.item)
      return {
        system,
        schema: HINTS_SCHEMA,
        prompt: hintsPrompt({ skill: input.skill, instructions: input.instructions, source: itemForPrompt(source) }),
        compareRef: input.itemRef,
        build: (json) => {
          const hints = isObj(json) && Array.isArray(json.hints) ? json.hints.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean) : null
          if (!hints || hints.length === 0) return { drafts: [], invalid: ['jawaban AI tidak berisi hint'] }
          const c = checkDraft(asDraftBody(source, { hints }), { hasFigure: Boolean(source.figure) })
          return { drafts: [{ body: c.body, problems: c.problems }], invalid: [] }
        },
      }
    }
    case 'translate': {
      const source = sourceItem(input.item)
      if (!isAiItemType(source.type)) throw new JobError(`Jenis soal ${source.type} belum didukung untuk terjemahan AI.`, { retryable: false })
      return {
        system,
        schema: itemJsonSchema([source.type]),
        prompt: translatePrompt({ skill: input.skill, instructions: input.instructions, source: itemForPrompt(source), to: input.to }),
        compareRef: input.itemRef,
        build: (json) => {
          const n = normaliseAiItem(json, { skill, lang: input.to })
          if (!n.candidate) return { drafts: [], invalid: [n.reason] }
          const t: Obj = { ...n.candidate, lang: input.to }
          if (source.figure) t.figure = source.figure
          if (input.to === 'id') {
            const tags = Array.isArray(t.tags) ? (t.tags as string[]) : []
            if (!tags.includes('id') && !tags.includes('esmo')) t.tags = [...tags, 'id'].slice(0, 10)
          }
          const c = checkDraft(t, { hasFigure: Boolean(source.figure) })
          const extra = structureProblems(source, c.body)
          if (source.passage) extra.push('Soal asal memakai bacaan. Bacaan tidak ikut diterjemahkan, jadi draf ini belum menyertakannya.')
          if (source.solution) extra.push('Langkah pembahasan soal asal tidak ikut diterjemahkan.')
          return { drafts: [{ body: c.body, problems: [...new Set([...c.problems, ...extra])].slice(0, 20) }], invalid: [] }
        },
      }
    }
    case 'rubric': {
      const source = sourceItem(input.item)
      if (!MANUAL_ITEM_TYPES.includes(source.type)) throw new JobError('Rubrik hanya untuk soal write, speak, atau draw.', { retryable: false })
      return {
        system,
        schema: RUBRIC_SCHEMA,
        prompt: rubricPrompt({ skill: input.skill, instructions: input.instructions, source: itemForPrompt(source) }),
        compareRef: input.itemRef,
        build: (json) => {
          const criteria = isObj(json) && Array.isArray(json.criteria)
            ? json.criteria.filter(isObj).map((k) => ({ label: typeof k.label === 'string' ? k.label.trim() : '', points: k.points }))
            : null
          if (!criteria || criteria.length === 0) return { drafts: [], invalid: ['jawaban AI tidak berisi kriteria rubrik'] }
          const c = checkDraft(asDraftBody(source, { rubric: { criteria } }), { hasFigure: Boolean(source.figure) })
          return { drafts: [{ body: c.body, problems: c.problems }], invalid: [] }
        },
      }
    }
  }
}

function collectItems(raws: unknown[], ctx: { skill: string; lang: 'en-GB' | 'id'; allowed: readonly AiItemType[]; source?: Obj }): Built {
  const drafts: Draft[] = []
  const invalid: string[] = []
  for (const raw of raws) {
    const n = normaliseAiItem(raw, { skill: ctx.skill, lang: ctx.lang })
    if (!n.candidate) {
      invalid.push(n.reason)
      continue
    }
    const c = checkDraft(n.candidate, { source: ctx.source ?? null, siblings: drafts.map((d) => d.body) })
    const problems = [...c.problems]
    if (!ctx.allowed.includes(n.candidate.type as AiItemType)) problems.unshift(`Jenis soal ${String(n.candidate.type)} tidak diminta.`)
    drafts.push({ body: c.body, problems })
  }
  return { drafts, invalid }
}

export function summary(drafts: Draft[], invalid: number): string {
  const withProblems = drafts.filter((d) => d.problems.length > 0).length
  const parts = [`${drafts.length} draf dibuat`]
  if (withProblems) parts.push(`${withProblems} perlu dicek`)
  if (invalid) parts.push(`${invalid} jawaban AI tidak terbaca dan dilewati`)
  return `${parts.join(', ')}.`
}

export function draftHandler(kind: AiDraftKind): Handler {
  return aiHandler(async (h: HandlerCtx) => {
    const aj = await loadAiJob(h, kind)
    if (aj.status === 'done') return { skipped: 'ai_job sudah selesai' }
    if (!h.ai.ready) throw new JobError(h.ai.notReadyReason ?? AI_NOT_CONFIGURED, { retryable: false })
    const p = plan(aj.input)
    await markAiRunning(h, aj.id)
    const out = await h.ai.run({ system: p.system, prompt: p.prompt, jsonSchema: p.schema, tier: 'author', timeoutMs: AI_TIMEOUT_MS, signal: h.signal })
    const built = p.build(out.json)
    if (built.drafts.length === 0) {
      h.log.warn('jawaban AI tidak menghasilkan draf', { invalid: built.invalid.length, reasons: built.invalid.slice(0, 5) })
      throw new JobError('AI tidak menghasilkan draf yang bisa dibaca.', { retryable: true })
    }
    const output = {
      summary: summary(built.drafts, built.invalid.length),
      drafts: built.drafts.length,
      withProblems: built.drafts.filter((d) => d.problems.length > 0).length,
      invalid: built.invalid.length,
      invalidReasons: built.invalid.slice(0, 5),
    }
    await withOrg(h.db, h.org, async (tx) => {
      await tx.insert(tables.aiDraft).values(
        built.drafts.map((d) => ({ orgId: h.org.orgId, jobId: aj.id, kind, status: 'pending' as const, body: d.body, problems: d.problems, compareRef: p.compareRef })),
      )
      await completeAiJobTx(tx, aj.id, { output, provider: h.ai.name, model: out.model, durationMs: out.durationMs, usage: out.usage }, h.now())
    })
    return { drafts: output.drafts, invalid: output.invalid }
  })
}
