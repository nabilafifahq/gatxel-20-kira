import { eq, and, isNull } from 'drizzle-orm'
import postgres from 'postgres'
import { jakartaDate, weekStart } from '@kira/core/time'
import { findContentDir, loadContent, type ContentIndex } from '@kira/content/load'
import { loadRegistry } from '@kira/content/extras'
import type { Item } from '@kira/content/schema'
import { attributionLine, canAutoFetch, type Registry, type Source } from '@kira/content/sources'
import { tables, withOrg, type Db } from '@kira/db'
import type { AiProvider } from '../ai/types'
import { reviewKeys, SOLVE_BATCH, type ReviewInput } from '../ai/solve'
import { listOrgIds, workerCtx } from '../db'
import type { Env } from '../env'
import { isAbortError } from '../errors'
import type { Logger } from '../log'
import { buildItem, promptHash } from './build-item'
import { collectSource, readCursor, type CollectDeps } from './collect'
import { importPdfSource } from './pdf'
import { mapCandidate } from './map'
import {
  enqueueItemsDraft,
  enqueueTts,
  finishRun,
  knownHashes,
  loadState,
  orgCountsBySkill,
  orgPrompts,
  publishRecord,
  queueRecord,
  recentlyRequestedSkills,
  recordUnmapped,
  saveState,
  startRun,
  ttsAvailable,
  type RecordInput,
} from './store'
import { DRAFTS_PER_ORG, draftRequest, thinSkills } from './thin'
import type { Candidate, Mapping } from './types'

/**
 * Pembaruan mingguan sumber soal (rencana 10.8), dijalankan jadwal "weekly-sourcing" setiap Minggu dini hari:
 * 1. ambil soal baru dari registri (hanya sumber otomatis dan lisensi yang membolehkan), 2. buang yang dobel,
 * 3. petakan ke skill dan kelas, 4. cek kunci dengan AI, 5. minta draf untuk skill yang banknya tipis,
 * 6. antrekan suara TTS untuk soal English baru.
 *
 * Aturan rencana 10.7 dan aturan repo nomor 12: soal masuk Bank soal otomatis hanya bila kunci dari sumber dan jawaban AI sama.
 * Yang kuncinya beda atau tidak terkonfirmasi masuk antrean Studio AI. Jumlah panggilan AI per minggu dibatasi
 * AI_WEEKLY_CONTENT_JOBS supaya kuota Claude Max tidak habis.
 */

export type SourcingDeps = {
  db: Db
  client: postgres.Sql
  env: Env
  log: Logger
  ai?: AiProvider | undefined
  fetchImpl?: typeof fetch | undefined
  sleep?: ((ms: number, signal: AbortSignal) => Promise<void>) | undefined
  now?: (() => Date) | undefined
  /** Untuk tes dan penjalanan manual: hanya org ini yang diproses (bawaan semua org). */
  onlyOrgIds?: string[] | undefined
  /** Untuk tes: indeks konten dan registri yang sudah dimuat. */
  loaded?: { content: ContentIndex; registry: Registry } | undefined
}

export const PER_SKILL_CAP = 8
const UNMAPPED_CAP = 20
const REQUEST_COOLDOWN_DAYS = 14

const sleepAbortable = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => (clearTimeout(t), resolve()), { once: true })
  })

type Budget = { left: number; used: number }
export type OrgResult = { orgId: string; published: number; queued: number; unmapped: number; duplicates: number; rejected: number; pdfs: number; drafts: number; aiCalls: number; notes: string[] }

type Prepared = { candidate: Candidate; mapping: Mapping; item: Item; hash: string }

/** Pilih soal dari skill yang paling tipis lebih dulu, paling banyak PER_SKILL_CAP per skill. */
export function chooseForSource(prepared: readonly Prepared[], max: number, bank: (skillId: string) => number): Prepared[] {
  const sorted = [...prepared].sort((a, b) => bank(a.mapping.skillId) - bank(b.mapping.skillId) || a.candidate.externalId.localeCompare(b.candidate.externalId))
  const perSkill = new Map<string, number>()
  const out: Prepared[] = []
  for (const p of sorted) {
    if (out.length >= max) break
    const n = perSkill.get(p.mapping.skillId) ?? 0
    if (n >= PER_SKILL_CAP) continue
    out.push(p)
    perSkill.set(p.mapping.skillId, n + 1)
  }
  return out
}

const label = (c: Candidate, v: number | null): string => (v === null ? 'tidak yakin' : c.type === 'mcq' ? ('ABCDEFGH'[v] ?? String(v)) : String(v))

export function problemsFor(source: Source, c: Candidate, verdict: 'disagree' | 'unverified', aiAnswer: number | null): string[] {
  const credit = `Sumber: ${attributionLine(source)}`
  return verdict === 'disagree'
    ? [`Kunci dari ${source.name} adalah ${label(c, c.answer)}, tetapi AI menjawab ${label(c, aiAnswer)}. Hitung sendiri sebelum menyetujui.`, credit]
    : [`AI tidak yakin dengan jawabannya, jadi kunci dari ${source.name} (${label(c, c.answer)}) belum terkonfirmasi. Periksa sendiri sebelum menyetujui.`, credit]
}

export async function runWeeklySourcing(deps: SourcingDeps, slotAt: Date, signal: AbortSignal): Promise<string> {
  const ai = deps.ai
  if (!ai || !ai.ready) {
    return `dilewati: ${ai?.notReadyReason ?? 'AI belum siap'}. Kunci jawaban tidak bisa diperiksa tanpa AI, jadi tidak ada soal yang diambil`
  }
  let loaded = deps.loaded
  if (!loaded) {
    try {
      const dir = findContentDir()
      const registry = loadRegistry(dir).registry
      if (!registry) return 'dilewati: registri sumber content/sources/registry.json tidak terbaca'
      loaded = { content: loadContent(dir).index, registry }
    } catch (e) {
      return `dilewati: folder konten tidak ditemukan (${e instanceof Error ? e.message : 'set KIRA_CONTENT_DIR'})`
    }
  }
  const budget: Budget = { left: deps.env.AI_WEEKLY_CONTENT_JOBS, used: 0 }
  const week = weekStart(jakartaDate(slotAt))
  const results: OrgResult[] = []
  for (const orgId of deps.onlyOrgIds ?? (await listOrgIds(deps.client))) {
    if (signal.aborted) break
    results.push(await runOrg(deps, ai, loaded, budget, week, signal, orgId))
  }
  return summarise(results, budget, deps.env.AI_WEEKLY_CONTENT_JOBS)
}

export function summarise(results: readonly OrgResult[], budget: Budget, cap: number): string {
  const sum = (k: 'published' | 'queued' | 'pdfs' | 'drafts' | 'duplicates') => results.reduce((a, r) => a + r[k], 0)
  const notes = results.flatMap((r) => r.notes).slice(0, 3)
  return `selesai: ${sum('published')} soal masuk bank, ${sum('queued')} masuk antrean Studio AI, ${sum('pdfs')} PDF masuk Impor, ${sum('drafts')} permintaan draf, ${sum('duplicates')} dobel dibuang, AI ${budget.used} dari ${cap}${notes.length ? `. ${notes.join('; ')}` : ''}`
}

async function runOrg(deps: SourcingDeps, ai: AiProvider, loaded: NonNullable<SourcingDeps['loaded']>, budget: Budget, week: string, signal: AbortSignal, orgId: string): Promise<OrgResult> {
  const org = workerCtx(orgId, null)
  const now = deps.now ?? (() => new Date())
  const { content, registry } = loaded
  const jobId = await withOrg(deps.db, org, (tx) => startRun(tx, orgId, week, now()))
  const res: OrgResult = { orgId, published: 0, queued: 0, unmapped: 0, duplicates: 0, rejected: 0, pdfs: 0, drafts: 0, aiCalls: 0, notes: [] }
  const englishRefs: string[] = []
  let error: string | null = null
  try {
    const known = await withOrg(deps.db, org, async (tx) => ({ hashes: await knownHashes(tx), prompts: await orgPrompts(tx), counts: await orgCountsBySkill(tx) }))
    const seen = new Set<string>(known.hashes)
    for (const p of known.prompts) seen.add(promptHash(p))
    for (const item of content.items.values()) seen.add(promptHash(item.prompt))
    const added = new Map<string, number>()
    const collectDeps: CollectDeps = { dataDir: deps.env.KIRA_DATA_DIR, log: deps.log, signal, ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}), sleep: deps.sleep ?? sleepAbortable }

    for (const source of registry.sources) {
      if (signal.aborted || budget.left <= 0) break
      if (!canAutoFetch(source)) continue
      const state = await withOrg(deps.db, org, (tx) => loadState(tx, source.id))
      if (!state.enabled) continue
      try {
        if (source.fetch?.kind === 'official-pdf') {
          const out = await importPdfSource({ db: deps.db, dataDir: deps.env.KIRA_DATA_DIR, orgId, now: now(), signal, maxFiles: source.maxPerRun, budgetCalls: budget.left, ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}) }, source)
          budget.left -= out.aiCalls
          budget.used += out.aiCalls
          res.aiCalls += out.aiCalls
          res.pdfs += out.imported
          res.notes.push(...out.notes.slice(0, 1))
          await withOrg(deps.db, org, (tx) => saveState(tx, orgId, source.id, 0, `${out.imported} PDF diimpor, ${out.skipped} dobel, ${out.failed} gagal`, now()))
          continue
        }
        const collected = await collectSource(source, readCursor(state.cursor), collectDeps)
        const prepared: Prepared[] = []
        const unmapped: RecordInput[] = []
        for (const cand of collected.candidates) {
          const hash = promptHash(cand.prompt)
          if (seen.has(hash)) {
            res.duplicates++
            continue
          }
          const mapping = mapCandidate(cand, (s, g) => content.skillsByKey.get(`${s}:${g}`) ?? [])
          if (!mapping) {
            if (cand.topicHint === 'General Knowledge' && unmapped.length < UNMAPPED_CAP) {
              seen.add(hash)
              unmapped.push({ sourceId: source.id, candidate: cand, mapping: null, item: null, hash, license: source.license, attribution: attributionLine(source), keyOrigin: 'source', verify: 'unverified' })
            } else res.rejected++
            continue
          }
          const built = buildItem(cand, mapping, source.id)
          if (!built.ok) {
            res.rejected++
            continue
          }
          seen.add(hash)
          prepared.push({ candidate: cand, mapping, item: built.item, hash })
        }
        const bank = (id: string) => (content.itemsBySkill.get(id)?.length ?? 0) + (known.counts.get(id) ?? 0) + (added.get(id) ?? 0)
        const chosen = chooseForSource(prepared, source.maxPerRun, bank)

        // Batas AI: setiap kelompok mapel memakai ceil(n / SOLVE_BATCH) panggilan.
        const bySubject = new Map<string, Prepared[]>()
        for (const p of chosen) bySubject.set(p.candidate.subject, [...(bySubject.get(p.candidate.subject) ?? []), p])
        const reviewed: { p: Prepared; verdict: 'agree' | 'disagree' | 'unverified'; aiAnswer: number | null }[] = []
        let skippedForBudget = 0
        for (const [subject, group] of bySubject) {
          const affordable = Math.max(0, Math.min(group.length, budget.left * SOLVE_BATCH))
          skippedForBudget += group.length - affordable
          const part = group.slice(0, affordable)
          if (part.length === 0) continue
          const inputs: ReviewInput[] = part.map((p, i) => ({ id: i, prompt: p.candidate.prompt, ...(p.candidate.type === 'mcq' && p.candidate.options ? { options: p.candidate.options } : {}), sourceKey: p.candidate.answer }))
          const r = await reviewKeys(ai, inputs, { subject, grade: '1 to 6', signal })
          budget.left -= r.calls
          budget.used += r.calls
          res.aiCalls += r.calls
          part.forEach((p, i) => {
            const v = r.reviews.get(i)
            reviewed.push({ p, verdict: v?.verdict === 'agree' ? 'agree' : v?.verdict === 'disagree' ? 'disagree' : 'unverified', aiAnswer: v?.aiAnswer ?? null })
          })
        }
        if (skippedForBudget > 0) res.notes.push(`${source.id}: ${skippedForBudget} soal menunggu minggu depan (batas AI)`)

        const at = now()
        let published = 0
        let queued = 0
        await withOrg(deps.db, org, async (tx) => {
          for (const x of reviewed) {
            const rec: RecordInput = { sourceId: source.id, candidate: x.p.candidate, mapping: x.p.mapping, item: x.p.item, hash: x.p.hash, license: source.license, attribution: attributionLine(source), keyOrigin: 'source', verify: x.verdict }
            if (x.verdict === 'agree') {
              const id = await publishRecord(tx, orgId, rec, at)
              if (id) {
                published++
                added.set(x.p.mapping.skillId, (added.get(x.p.mapping.skillId) ?? 0) + 1)
                if (x.p.candidate.subject === 'english') englishRefs.push(`org:${id}`)
              }
            } else if (await queueRecord(tx, orgId, jobId, rec, problemsFor(source, x.p.candidate, x.verdict, x.aiAnswer), at)) queued++
          }
          for (const u of unmapped) if (await recordUnmapped(tx, orgId, u, at)) res.unmapped++
          // Penanda lanjut maju hanya bila semua soal terpilih sudah diperiksa; kalau tidak, jendela yang sama dibaca lagi.
          const cursor = skippedForBudget > 0 ? readCursor(state.cursor) : collected.nextCursor
          await saveState(tx, orgId, source.id, cursor, `${published} masuk bank, ${queued} antre Studio (${collected.note})`, at)
        })
        res.published += published
        res.queued += queued
      } catch (e) {
        if (isAbortError(e)) throw e
        const message = e instanceof Error ? e.message : 'gagal'
        deps.log.warn('sumber soal dilewati', { source: source.id, error: message })
        res.notes.push(`${source.id}: ${message}`.slice(0, 120))
        await withOrg(deps.db, org, (tx) => saveState(tx, orgId, source.id, readCursor(state.cursor), `gagal: ${message}`, now())).catch(() => undefined)
      }
    }

    // Draf baru untuk skill yang banknya tipis, memakai sisa jatah AI.
    if (!signal.aborted && budget.left > 0) {
      const since = new Date(now().getTime() - REQUEST_COOLDOWN_DAYS * 24 * 60 * 60 * 1000)
      await withOrg(deps.db, org, async (tx) => {
        const grades = (await tx.select({ grade: tables.learnerProfile.grade }).from(tables.learnerProfile).where(and(eq(tables.learnerProfile.active, true), isNull(tables.learnerProfile.deletedAt)))).map((r) => r.grade)
        const counts = await orgCountsBySkill(tx)
        const skip = await recentlyRequestedSkills(tx, since)
        for (const t of thinSkills(content, grades, counts, skip, Math.min(DRAFTS_PER_ORG, budget.left))) {
          await enqueueItemsDraft(tx, orgId, draftRequest(content, t.skill))
          budget.left--
          budget.used++
          res.aiCalls++
          res.drafts++
        }
      })
    }

    if (englishRefs.length > 0) {
      if (ttsAvailable()) await withOrg(deps.db, org, (tx) => enqueueTts(tx, orgId, englishRefs))
      else deps.log.info('suara soal English baru menunggu job tts.batch', { refs: englishRefs.length })
    }
  } catch (e) {
    if (isAbortError(e)) error = 'dibatalkan saat worker berhenti'
    else {
      error = e instanceof Error ? e.message : 'gagal'
      deps.log.error('pembaruan sumber soal gagal', { orgId, error: e })
    }
  } finally {
    await withOrg(deps.db, org, (tx) =>
      finishRun(tx, jobId, { published: res.published, queued: res.queued, unmapped: res.unmapped, duplicates: res.duplicates, rejected: res.rejected, pdfs: res.pdfs, drafts: res.drafts, aiCalls: res.aiCalls, notes: res.notes }, ai.name, ai.model, now(), error),
    ).catch((e) => deps.log.error('catatan pembaruan sumber soal gagal ditulis', { error: e }))
  }
  return res
}
