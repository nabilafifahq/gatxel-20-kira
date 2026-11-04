import { GATE_MIN_ANSWERS } from '@kira/core'
import type { Subject } from '@/lib/dto'

/**
 * Logika murni Pelatih Orang Tua: memilih 3 skill yang paling perlu latihan dari data nyata, satu kekuatan untuk
 * dipuji, dan kalimat pujian untuk orang tua. Tidak ada AI dan tidak ada angka karangan: skill hanya dihitung bila
 * anak sudah menjawab cukup soal (GATE_MIN_ANSWERS, sama dengan syarat bintang di mesin belajar).
 */

export const MIN_ANSWERS = GATE_MIN_ANSWERS
export const MAX_WEAK = 3
/** Di atas angka ini skill dianggap sudah kuat; Pelatih tetap menyebut yang relatif paling lemah, tetapi jujur. */
export const SOLID_ACCURACY = 0.8

export type SkillSnapshot = {
  skillId: string
  subject: Subject
  grade: number
  strand: string
  title: string
  stars: number
  gate: 'new' | 'reteach' | 'review' | 'mastered'
  answers: number
  /** Rata-rata skor jawaban terakhir (0 sampai 1), null bila belum ada. */
  accuracy: number | null
}

export type DataState = 'empty' | 'thin' | 'ok'

export function qualified(snaps: readonly SkillSnapshot[]): SkillSnapshot[] {
  return snaps.filter((s) => s.answers >= MIN_ANSWERS && s.accuracy !== null && s.strand !== 'Oly')
}

function weakness(s: SkillSnapshot): number {
  // Makin kecil makin lemah. Skill yang sedang diulang (1 bintang) diutamakan sedikit.
  return (s.accuracy ?? 1) - (s.gate === 'reteach' ? 0.15 : 0)
}

/** Sampai 3 skill paling lemah, paling banyak 2 per mapel supaya minggu itu seimbang; sisa slot diisi bila perlu. */
export function selectWeak(snaps: readonly SkillSnapshot[], max = MAX_WEAK): SkillSnapshot[] {
  const pool = qualified(snaps)
    .filter((s) => s.gate !== 'mastered')
    .sort((a, b) => weakness(a) - weakness(b) || a.skillId.localeCompare(b.skillId))
  const picked: SkillSnapshot[] = []
  const perSubject = new Map<Subject, number>()
  for (const s of pool) {
    if (picked.length >= max) break
    if ((perSubject.get(s.subject) ?? 0) >= 2) continue
    picked.push(s)
    perSubject.set(s.subject, (perSubject.get(s.subject) ?? 0) + 1)
  }
  for (const s of pool) {
    if (picked.length >= max) break
    if (!picked.includes(s)) picked.push(s)
  }
  return picked
}

/** Satu kekuatan: skill dengan ketepatan tertinggi (minimal 2 bintang), yang bukan salah satu skill lemah. */
export function selectStrength(snaps: readonly SkillSnapshot[], exclude: readonly SkillSnapshot[]): SkillSnapshot | null {
  const skip = new Set(exclude.map((s) => s.skillId))
  const pool = qualified(snaps)
    .filter((s) => !skip.has(s.skillId) && s.stars >= 2)
    .sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0) || b.answers - a.answers || a.skillId.localeCompare(b.skillId))
  return pool[0] ?? null
}

export function dataState(snaps: readonly SkillSnapshot[]): DataState {
  const n = qualified(snaps).length
  if (n === 0) return 'empty'
  return n < MAX_WEAK ? 'thin' : 'ok'
}

export function dataNote(state: DataState, qualifiedCount: number): string {
  if (state === 'empty') {
    return `Belum cukup data. Kira baru menunjuk skill yang perlu dilatih setelah anak menjawab sedikitnya ${MIN_ANSWERS} soal di satu skill. Sambil menunggu, ada satu kegiatan ringan di bawah.`
  }
  if (state === 'thin') {
    return `Baru ${qualifiedCount} skill yang punya cukup data (sedikitnya ${MIN_ANSWERS} jawaban). Itu sebabnya daftar ini lebih pendek dari 3. Setelah anak belajar beberapa hari lagi, daftarnya akan lengkap.`
  }
  return ''
}

const PRAISE: ((name: string, title: string) => string)[] = [
  (name, title) => `${name}, aku perhatikan kamu makin teliti waktu belajar ${title}. Aku senang kamu tidak menyerah.`,
  (name, title) => `${name}, kerja kerasmu di ${title} kelihatan sekali. Terima kasih sudah mau berlatih terus.`,
  (name, title) => `Tadi aku lihat kamu berpikir pelan-pelan di ${title}, ${name}. Itu cara belajar yang bagus.`,
]

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

/** Kalimat pujian untuk orang tua: memuji usaha dan cara, bukan kepintaran. Berganti tiap minggu. */
export function praiseSentence(name: string, strength: Pick<SkillSnapshot, 'title'> | null, seed: string, studiedThisWeek: boolean): string {
  if (strength) return PRAISE[hash(seed) % PRAISE.length]!(name, strength.title)
  if (studiedThisWeek) return `${name}, terima kasih sudah mau belajar minggu ini. Aku senang kita punya waktu belajar bersama.`
  return `${name}, kapan pun kamu siap, aku temani belajar sebentar ya. Mulai dari yang paling kamu suka.`
}

/** Penjelasan kecil di kartu skill, selalu dengan angka nyata. */
export function accuracyLine(s: Pick<SkillSnapshot, 'accuracy' | 'answers'>): string {
  const pct = Math.round((s.accuracy ?? 0) * 100)
  const window = Math.min(s.answers, 20)
  return `Sekitar ${pct}% benar di ${window} soal terakhir.`
}

export function isSolid(s: Pick<SkillSnapshot, 'accuracy'>): boolean {
  return (s.accuracy ?? 0) >= SOLID_ACCURACY
}
