import type { Subject } from '@/lib/dto'

/**
 * Logika murni "Ganti pelajaran" orang tua: sesi mana yang kena, dan daftar pilihan per topik.
 * Tidak menyentuh database; `parent-skill-change.ts` menyiapkan data lalu memanggil fungsi di sini.
 */

export type SkillSessionState = 'ready' | 'in-progress' | 'done'

export type SkillSession = {
  id: string
  subject: Subject
  session: string
  required: boolean
  seq: number
  skillId: string | null
  state: SkillSessionState
}

const SUBJECT_NAME: Record<Subject, string> = { math: 'Math', english: 'English', science: 'Science' }
const SESSION_NAME: Record<string, string> = { latihan: 'Latihan', tes: 'Tes' }

/** "Tes Math". */
export const sessionName = (s: { session: string; subject: Subject }) => `${SESSION_NAME[s.session] ?? s.session} ${SUBJECT_NAME[s.subject]}`

/** Keadaan sesi seperti di Today anak: ada jawaban berarti sedang dikerjakan, walau status quest masih ready. */
export function sessionState(status: string, answered: number): SkillSessionState {
  if (status === 'done' || status === 'skipped') return 'done'
  return status === 'in_progress' || answered > 0 ? 'in-progress' : 'ready'
}

/** Hanya Latihan dan Tes yang berisi satu pelajaran. Paper berisi campuran beberapa topik. */
const CHANGEABLE: ReadonlySet<string> = new Set(['latihan', 'tes'])

export function hasOneSkill(session: string): boolean {
  return CHANGEABLE.has(session)
}

export type SkillChangePlan = { blocked: 'done' | 'kind' | 'no-next'; targets: [] } | { blocked: null; targets: SkillSession[] }

const planOrder = (s: SkillSession) => (s.session === 'latihan' ? 0 : 1)

/**
 * Sesi yang berganti pelajaran bila orang tua memilih sesi `clicked`.
 * - Selesai: ditolak.
 * - Belum dimulai: sesi itu, ditambah Tes mapel yang sama yang belum dimulai bila Tes itu mengikuti Latihan ini
 *   (pelajarannya sama), supaya Latihan dan Tesnya tetap satu pelajaran.
 * - Sedang dikerjakan: sesi itu tetap berjalan. Perubahan berlaku untuk sesi berikutnya yang belum dimulai di mapel
 *   yang sama: semua yang pelajarannya sama dengan sesi ini, atau bila tidak ada, satu sesi pertama.
 */
export function skillChangeTargets(clicked: SkillSession, all: readonly SkillSession[]): SkillChangePlan {
  if (!hasOneSkill(clicked.session)) return { blocked: 'kind', targets: [] }
  if (clicked.state === 'done') return { blocked: 'done', targets: [] }
  const waiting = all
    .filter((s) => s.id !== clicked.id && s.subject === clicked.subject && s.state === 'ready' && hasOneSkill(s.session))
    .sort((a, b) => planOrder(a) - planOrder(b) || Number(b.required) - Number(a.required) || a.seq - b.seq)
  if (clicked.state === 'ready') {
    const followers = clicked.session === 'latihan' ? waiting.filter((s) => s.session === 'tes' && s.skillId === clicked.skillId) : []
    return { blocked: null, targets: [clicked, ...followers] }
  }
  const same = waiting.filter((s) => s.skillId === clicked.skillId)
  const targets = same.length > 0 ? same : waiting.slice(0, 1)
  return targets.length > 0 ? { blocked: null, targets } : { blocked: 'no-next', targets: [] }
}

export type SkillChangeView = {
  canChange: boolean
  /** Pesan untuk orang tua bila sesi ini tidak bisa diganti langsung. */
  note: string | null
  /** Nama sesi yang akan berganti pelajaran, misalnya "Latihan Math dan Tes Math". */
  appliesTo: string | null
  targets: SkillSession[]
}

const IN_PROGRESS = 'Sedang dikerjakan dan tetap berjalan sampai selesai.'

/** Yang ditampilkan untuk satu sesi di halaman orang tua. `labelOf` memberi nama sesi, misalnya "Tes Math". */
export function skillChangeView(clicked: SkillSession, all: readonly SkillSession[], labelOf: (s: SkillSession) => string): SkillChangeView {
  const plan = skillChangeTargets(clicked, all)
  switch (plan.blocked) {
    case 'kind':
      return { canChange: false, note: null, appliesTo: null, targets: [] }
    case 'done':
      return { canChange: false, note: 'Sudah selesai, jadi pelajarannya tidak bisa diganti lagi.', appliesTo: null, targets: [] }
    case 'no-next':
      return { canChange: false, note: `${IN_PROGRESS} Tidak ada sesi lain di mapel ini yang belum dimulai hari ini.`, appliesTo: null, targets: [] }
    default: {
      const appliesTo = joinId(plan.targets.map(labelOf))
      return { canChange: true, note: clicked.state === 'ready' ? null : `${IN_PROGRESS} Pelajaran baru berlaku mulai ${appliesTo}.`, appliesTo, targets: plan.targets }
    }
  }
}

export type SkillOptionInput = { id: string; strand: string; order: number; title: string; titleId: string }
export type SkillTopic = { id: string; label: string; skills: { id: string; title: string; titleEn: string }[] }

/**
 * Kelompokkan pilihan per topik, urut kurikulum. Nama topik Indonesia bila ada; bila tidak ada, kelompok itu jujur
 * bernama "Topik lain". Nama pelajaran Indonesia bila ada, dengan nama English yang dilihat anak; bila nama
 * Indonesia kosong, nama English dipakai apa adanya.
 */
export function groupSkillOptions(skills: readonly SkillOptionInput[], topicName: (strand: string) => string | null): SkillTopic[] {
  const byStrand = new Map<string, SkillTopic>()
  for (const s of [...skills].sort((a, b) => a.order - b.order)) {
    let t = byStrand.get(s.strand)
    if (!t) {
      t = { id: s.strand, label: topicName(s.strand) ?? 'Topik lain', skills: [] }
      byStrand.set(s.strand, t)
    }
    t.skills.push({ id: s.id, title: s.titleId.trim() || s.title, titleEn: s.title })
  }
  return [...byStrand.values()]
}

/** "Latihan Math", "Latihan Math dan Tes Math", "A, B, dan C". */
export function joinId(parts: readonly string[]): string {
  if (parts.length <= 2) return parts.join(' dan ')
  return `${parts.slice(0, -1).join(', ')}, dan ${parts.at(-1)}`
}
