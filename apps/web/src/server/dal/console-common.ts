import 'server-only'
import { addDays, formatDateId, jakartaDate, weekStart, type IsoDate } from '@kira/core/time'
import type { Subject } from '@/lib/dto'
import { content } from './content'

/** Bantuan bersama untuk DAL konsol dan halaman orang tua. Teks dalam bahasa Indonesia. */

export const SUBJECT_ID_LABEL: Record<Subject, string> = { math: 'Math', english: 'English', science: 'Science' }
export const SUBJECT_ORDER: Subject[] = ['math', 'english', 'science']

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function parts(d: IsoDate): [number, number, number] {
  return d.split('-').map(Number) as [number, number, number]
}

/** "12 sampai 18 Oktober 2026", "28 September sampai 4 Oktober 2026", lintas tahun ditulis lengkap. */
export function weekLabelId(monday: IsoDate): string {
  const sunday = addDays(monday, 6)
  const [y1, m1, d1] = parts(monday)
  const [y2, m2] = parts(sunday)
  if (y1 !== y2) return `${formatDateId(monday)} sampai ${formatDateId(sunday)}`
  if (m1 !== m2) return `${d1} ${MONTHS[m1 - 1]} sampai ${formatDateId(sunday)}`
  return `${d1} sampai ${formatDateId(sunday)}`
}

/** "12 Okt" */
export function shortDateId(d: IsoDate): string {
  const [, m, day] = parts(d)
  return `${day} ${MONTHS_SHORT[m - 1]}`
}

export function thisWeekStart(today: IsoDate = jakartaDate()): IsoDate {
  return weekStart(today)
}

/** Persen dibulatkan, atau null bila belum ada data. */
export function accuracyPct(correct: number, total: number): number | null {
  return total > 0 ? Math.round((100 * correct) / total) : null
}

export type SkillOption = { id: string; subject: Subject; grade: number; title: string; titleId: string; strand: string; order: number }

/** Semua skill di konten repo, urut mapel, grade, lalu urutan kurikulum. */
export function skillOptions(filter: { subject?: Subject | null; grade?: number | null } = {}): SkillOption[] {
  const out: SkillOption[] = []
  for (const s of content().skills.values()) {
    if (filter.subject && s.subject !== filter.subject) continue
    if (filter.grade && s.grade !== filter.grade) continue
    out.push({ id: s.id, subject: s.subject, grade: s.grade, title: s.title, titleId: s.titleId, strand: s.strand, order: s.order })
  }
  return out.sort((a, b) => SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject) || a.grade - b.grade || a.order - b.order)
}

export function skillTitle(skillId: string | null | undefined): string {
  if (!skillId) return 'Skill'
  return content().skills.get(skillId)?.title ?? skillId
}

/** "Math Grade 2" */
export function subjectGradeLabel(subject: Subject, grade: number): string {
  return `${SUBJECT_ID_LABEL[subject]} Grade ${grade}`
}

/** Teks jumlah hari: "hari ini", "besok", "5 hari lagi". */
export function daysLeftLabel(n: number): string {
  if (n <= 0) return 'hari ini'
  if (n === 1) return 'besok'
  return `${n} hari lagi`
}
