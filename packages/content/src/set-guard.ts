import { createRng } from '@kira/core/rng'
import { generateItem, GENERATORS, genRef } from './math'
import type { Level } from './math'
import { clashKeys, twinKey } from './signature'
import type { Item, Passage, Skill } from './schema'

/**
 * Penjaga satu set soal: dua soal dalam satu set tidak boleh sama. Semua pembuat sesi (Latihan, Tes, Kertas, ulangan,
 * review, Fix-it, simulasi, paket lomba, English Skills, peta, set tutor, console-paper, ronde arena) melewati `guardSet`.
 *
 * Soal yang sama menurut tanda tampilan (atau operan Math yang sama) diganti: seed baru di tingkat yang sama, tingkat
 * tetangga, soal tertulis skill yang sama, lalu skill saudara (kelas, mapel, dan strand yang sama). Bila tidak ada
 * pengganti, soal dibuang dan set menjadi lebih pendek. Soal hampir kembar (kerangka dan jawaban sama) juga dihindari
 * selama bank masih punya pilihan, tetapi tidak pernah membuat set lebih pendek.
 */

export type GuardIndex = {
  items: ReadonlyMap<string, Item>
  itemsBySkill: ReadonlyMap<string, readonly Item[]>
  skills: ReadonlyMap<string, Skill>
  skillsByKey: ReadonlyMap<string, readonly Skill[]>
  passages: ReadonlyMap<string, Passage>
}

export type GuardOptions<T extends { ref: string; difficulty: number }> = {
  index: GuardIndex
  /** Soal yang sudah dimuat (misalnya soal org dari database). Ref lain dicari di paket konten dan generator. */
  items?: ReadonlyMap<string, Item>
  /** Benih deterministik untuk memilih pengganti. */
  seed: string
  mode?: string
  /** Soal yang sudah pernah dijawab learner: dipakai sebagai pengganti hanya bila tidak ada pilihan lain. */
  avoid?: ReadonlySet<string>
  /** Ref lain yang sudah ada di set (misalnya soal pemanasan yang dibuat terpisah). */
  already?: readonly string[]
  /** Bangun entri pengganti dari entri yang diganti. Bawaan: salin entri dengan ref dan kesulitan baru. */
  make?: (ref: string, difficulty: number, from: T) => T
  maxTries?: number
}

export type GuardResult<T> = { entries: T[]; replaced: number; dropped: number; twinsKept: number }

const MANUAL = new Set(['write', 'speak', 'draw', 'photo'])

function lookup(ref: string, o: { index: GuardIndex; items?: ReadonlyMap<string, Item> }): Item | undefined {
  const hit = o.items?.get(ref) ?? o.index.items.get(ref)
  if (hit) return hit
  if (!ref.startsWith('gen:')) return undefined
  try {
    return generateItem(ref)
  } catch {
    return undefined
  }
}

export function guardSet<T extends { ref: string; difficulty: number }>(entries: readonly T[], opt: GuardOptions<T>): GuardResult<T> {
  const used = new Set<string>()
  const twins = new Set<string>()
  const refs = new Set<string>()
  const keysOf = (item: Item): string[] => clashKeys(item, item.passage ? opt.index.passages.get(item.passage) : undefined)
  const take = (ref: string, item: Item | undefined) => {
    refs.add(ref)
    if (!item) return
    for (const k of keysOf(item)) used.add(k)
    twins.add(twinKey(item))
  }
  for (const r of opt.already ?? []) take(r, lookup(r, opt))
  const make = opt.make ?? ((ref, difficulty, from) => ({ ...from, ref, difficulty }))
  const maxTries = opt.maxTries ?? 400
  const out: T[] = []
  let replaced = 0
  let dropped = 0
  let twinsKept = 0

  const clash = (ref: string, item: Item | undefined): 'hard' | 'soft' | null => {
    if (refs.has(ref)) return 'hard'
    if (!item) return null
    if (keysOf(item).some((k) => used.has(k))) return 'hard'
    return twins.has(twinKey(item)) ? 'soft' : null
  }

  /** Kandidat pengganti, urut dari yang paling dekat dengan soal asal. */
  function* candidates(from: Item | undefined, ref: string, difficulty: number): Generator<string> {
    const rng = createRng(`${opt.seed}:${ref}:${out.length}`)
    const skillId = from?.skill ?? ref.split(':')[1] ?? ''
    const own = new Set<string>()
    const wantManual = from ? MANUAL.has(from.type) : false
    const writtenOf = (id: string): string[] => {
      const list = (opt.index.itemsBySkill.get(id) ?? []).filter((it) => (wantManual || !MANUAL.has(it.type)) && (!opt.mode || !it.modes || it.modes.includes(opt.mode as never)))
      const fresh = list.filter((it) => !opt.avoid?.has(it.id))
      const pick = (arr: readonly Item[]) => arr.map((it) => ({ it, r: rng.next() })).sort((a, b) => Math.abs(a.it.difficulty - difficulty) - Math.abs(b.it.difficulty - difficulty) || a.r - b.r).map((x) => x.it.id)
      return [...pick(fresh), ...pick(list.filter((it) => opt.avoid?.has(it.id)))]
    }
    const genOf = function* (id: string): Generator<string> {
      const g = GENERATORS.get(id)
      if (!g) return
      const levels = [...g.levels].sort((a, b) => Math.abs(a - difficulty) - Math.abs(b - difficulty))
      for (const lv of levels.slice(0, 3)) for (let n = 0; n < 25; n++) yield genRef(id, lv as Level, rng.int(0, 2 ** 31 - 1).toString(36))
    }
    const fromSkill = function* (id: string): Generator<string> {
      if (own.has(id)) return
      own.add(id)
      yield* genOf(id)
      yield* writtenOf(id)
    }
    yield* fromSkill(skillId)
    const sk = opt.index.skills.get(skillId)
    if (!sk) return
    const sibs = (opt.index.skillsByKey.get(`${sk.subject}:${sk.grade}`) ?? []).filter((s) => s.id !== skillId)
    sibs.sort((a, b) => Number(b.strand === sk.strand) - Number(a.strand === sk.strand) || Math.abs(a.order - sk.order) - Math.abs(b.order - sk.order))
    for (const s of sibs) yield* fromSkill(s.id)
  }

  for (const e of entries) {
    const item = lookup(e.ref, opt)
    const c = clash(e.ref, item)
    if (!c) {
      take(e.ref, item)
      out.push(e)
      continue
    }
    let chosen: { ref: string; item: Item | undefined } | null = null
    let softOk: { ref: string; item: Item | undefined } | null = null
    let tries = 0
    for (const cand of candidates(item, e.ref, e.difficulty)) {
      if (++tries > maxTries) break
      const ci = lookup(cand, opt)
      if (!ci) continue
      const cc = clash(cand, ci)
      if (!cc) {
        chosen = { ref: cand, item: ci }
        break
      }
      if (cc === 'soft' && !softOk) softOk = { ref: cand, item: ci }
    }
    if (!chosen && c === 'soft') {
      // Hanya hampir kembar dan tidak ada pengganti bersih: pertahankan soal asal.
      twinsKept++
      take(e.ref, item)
      out.push(e)
      continue
    }
    chosen ??= softOk
    if (!chosen) {
      dropped++
      continue
    }
    replaced++
    take(chosen.ref, chosen.item)
    out.push(make(chosen.ref, chosen.item?.difficulty ?? e.difficulty, e))
  }
  return { entries: out, replaced, dropped, twinsKept }
}
