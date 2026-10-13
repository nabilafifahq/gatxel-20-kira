import 'server-only'
import { MINI_PAPER_COUNT, MINI_PAPER_MINUTES, createRng, pointsByPosition } from '@kira/core'
import { GENERATORS, genRef, newSeed } from '@kira/content/math'
import { skillGrade, type Item } from '@kira/content'
import type { Subject } from '@/lib/dto'
import { content, skillsFor } from './content'
import { paperPresetFor, paperRules } from './daily-paper-scoring'

/**
 * Pemilih Paper harian. Versi sederhana: soal olimpiade dan soal bertag lomba dari konten repo, disusun
 * mengikuti bagian dan poin preset lomba yang bergiliran tiap hari (paper mini 8 soal dalam 15 menit,
 * paper penuh mengikuti jumlah soal dan waktu preset). Paper ini latihan gaya lomba buatan Kira, bukan
 * paper asli. Versi pustaka paper (fase 4) menggantikan berkas ini dengan tanda tangan yang sama.
 *
 * Hasil sama untuk panggilan yang sama (learner, mapel, tanggal, jenis), jadi aman dipanggil ulang.
 * Soal privat org tidak dipakai di sini karena fungsi ini tidak memegang transaksi.
 */
export async function pickDailyPaper(
  ctx: { orgId: string; learnerId: string; grade: number },
  subject: Subject,
  date: string,
  kind: 'mini' | 'full',
): Promise<{ title: string; minutes: number; itemRefs: string[]; source: string } | null> {
  const p = paperPresetFor(subject, ctx.grade, date)
  const n = kind === 'mini' ? MINI_PAPER_COUNT : (p?.rules.questionCount ?? 20)
  const minutes = kind === 'mini' ? MINI_PAPER_MINUTES : (p?.rules.timeLimitMin ?? 45)
  const rules = p ? paperRules(p, kind, n, minutes) : null
  const rng = createRng(`${ctx.learnerId}:${date}:${subject}:${kind}`)

  const letter = subject[0]!
  const wantId = p?.lang === 'id'
  const pool: Item[] = [...content().items.values()].filter((i) => {
    if (i.skill[0] !== letter) return false
    if (i.type === 'write' || i.type === 'speak' || i.type === 'draw') return false
    const g = skillGrade(i.skill)
    if (g > ctx.grade || g < ctx.grade - 1) return false
    // Soal berbahasa Indonesia hanya untuk preset yang memang berbahasa Indonesia (ESMO Math, KMNR).
    if (i.lang === 'id' && !(wantId && p?.itemTags.some((t) => i.tags.includes(t)))) return false
    return true
  })
  if (pool.length === 0) return null

  const tagged = new Set(pool.filter((i) => p?.itemTags.some((t) => i.tags.includes(t))).map((i) => i.id))
  const olympiad = new Set(pool.filter((i) => i.tags.includes('olympiad')).map((i) => i.id))
  const used = new Set<string>()
  const refs: string[] = []
  const take = (filter: (i: Item) => boolean, from: Item[]): boolean => {
    const c = rng.shuffle(from.filter((i) => !used.has(i.id) && filter(i)))[0]
    if (!c) return false
    used.add(c.id)
    refs.push(c.id)
    return true
  }

  const points = rules ? pointsByPosition(rules) : null
  const targetDifficulty = (pos: number) => {
    const pts = points?.get(pos) ?? 3
    return pts >= 5 ? 5 : pts >= 4 ? 4 : pts >= 3 ? 3 : 2
  }
  const grades = (i: Item) => skillGrade(i.skill)
  for (let pos = 1; pos <= n; pos++) {
    const pts = points?.get(pos)
    const d = targetDifficulty(pos)
    const onGrade = pool.filter((i) => grades(i) === ctx.grade)
    const done =
      (pts !== undefined && take((i) => i.points === pts, pool.filter((i) => tagged.has(i.id)))) ||
      take((i) => i.difficulty === d, pool.filter((i) => tagged.has(i.id))) ||
      take((i) => i.difficulty === d, pool.filter((i) => olympiad.has(i.id) && grades(i) === ctx.grade)) ||
      take((i) => i.difficulty === d, onGrade) ||
      take(() => true, pool.filter((i) => tagged.has(i.id) || olympiad.has(i.id))) ||
      take(() => true, onGrade) ||
      take(() => true, pool)
    if (done) continue
    // Cadangan terakhir untuk Math: generator skill grade learner pada tingkat yang sesuai.
    const gens = skillsFor(subject, ctx.grade).filter((s) => GENERATORS.get(s.id)?.levels.includes(d as 1 | 2 | 3 | 4 | 5))
    if (gens.length === 0) break
    refs.push(genRef(rng.pick(gens).id, d as 1 | 2 | 3 | 4 | 5, newSeed(rng)))
  }
  if (refs.length < Math.min(n, 4)) return null

  const label = p ? p.title.replace(/\s+practice$/i, '') : subject
  return {
    title: kind === 'mini' ? `${label} mini paper` : `${label} full paper`,
    minutes,
    itemRefs: refs,
    source: p ? `kira-style:${p.id}` : 'kira-style',
  }
}
