import type { ContentIndex } from '@kira/content/load'
import type { Skill } from '@kira/content/schema'
import type { AiJobInput } from '@kira/db'

/**
 * Skill yang bank soalnya tipis (rencana 10.8, langkah 5). Skill dengan generator Math tidak dihitung karena
 * soalnya tak terbatas. Draf diminta lewat job ai.items biasa, jadi hasilnya masuk antrean Studio AI untuk disetujui tutor.
 */

export const THIN_ITEMS = 20
export const DRAFTS_PER_ORG = 8
export const DRAFT_COUNT = 5

export type ThinSkill = { skill: Skill; bank: number }

/** Skill di grade yang dipakai learner aktif, diurutkan dari yang paling tipis, paling banyak `limit`. */
export function thinSkills(content: ContentIndex, grades: readonly number[], orgCounts: ReadonlyMap<string, number>, skip: ReadonlySet<string>, limit: number): ThinSkill[] {
  const out: ThinSkill[] = []
  for (const g of new Set(grades)) {
    for (const subject of ['math', 'english', 'science'] as const) {
      for (const skill of content.skillsByKey.get(`${subject}:${g}`) ?? []) {
        if (skill.generator || skip.has(skill.id)) continue
        const bank = (content.itemsBySkill.get(skill.id)?.length ?? 0) + (orgCounts.get(skill.id) ?? 0)
        if (bank < THIN_ITEMS) out.push({ skill, bank })
      }
    }
  }
  return out.sort((a, b) => a.bank - b.bank || a.skill.order - b.skill.order || a.skill.id.localeCompare(b.skill.id)).slice(0, Math.max(0, limit))
}

/** Permintaan draf untuk satu skill. Prompt hanya memuat skill dan contoh soal, tidak ada data anak. */
export function draftRequest(content: ContentIndex, skill: Skill): Extract<AiJobInput, { kind: 'items' }> {
  const examples = [...(content.itemsBySkill.get(skill.id) ?? [])].sort((a, b) => Math.abs(a.difficulty - 3) - Math.abs(b.difficulty - 3) || a.id.localeCompare(b.id)).slice(0, 3)
  return {
    kind: 'items',
    skill: { id: skill.id, subject: skill.subject, grade: skill.grade, title: skill.title, canDo: skill.canDo, strand: skill.strand },
    count: DRAFT_COUNT,
    difficulty: 3,
    instructions: `Write contest-style questions in the manner of the Kangaroo or Olympiad papers for Grade ${skill.grade}: short, clear, one correct answer, and solved by reasoning rather than recall. Vary the context and keep the numbers small.`,
    examples,
  }
}
