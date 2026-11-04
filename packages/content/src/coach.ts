import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { SUBJECTS, type Subject } from './schema'

/**
 * Pustaka kegiatan Pelatih Orang Tua: satu kegiatan rumah 10 menit dengan benda sehari-hari, untuk orang tua.
 * Berkas content/coach/<mapel>.json. Teks berbahasa Indonesia yang hangat; kalimat latihan English boleh muncul
 * di mapel English. Kegiatan terhubung ke skill lewat strand (kode kerangka seperti Nc, Ww, Cc) dan rentang kelas.
 */

const text = (max: number) => z.string().min(3).max(max)

export const coachActivitySchema = z
  .object({
    id: z.string().regex(/^[mes]-[a-z]{1,3}-[a-z]$/),
    strands: z.array(z.string().min(1).max(4)).min(1).max(4),
    gradeMin: z.number().int().min(1).max(6),
    gradeMax: z.number().int().min(1).max(6),
    title: text(60),
    materials: z.array(text(120)).min(1).max(5),
    steps: z.array(text(300)).min(3).max(5),
    ask: text(160),
    easier: text(160),
  })
  .strict()
  .refine((a) => a.gradeMin <= a.gradeMax, 'gradeMin harus tidak lebih besar dari gradeMax')

export type CoachActivity = z.infer<typeof coachActivitySchema> & { subject: Subject }

const fileSchema = z.array(coachActivitySchema).min(1)

export function loadCoachActivities(contentDir: string): { activities: CoachActivity[]; errors: string[] } {
  const activities: CoachActivity[] = []
  const errors: string[] = []
  for (const subject of SUBJECTS) {
    const rel = `coach/${subject}.json`
    const file = join(contentDir, rel)
    if (!existsSync(file)) {
      errors.push(`${rel}: berkas tidak ada`)
      continue
    }
    let raw: unknown
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'))
    } catch (e) {
      errors.push(`${rel}: JSON tidak valid (${(e as Error).message})`)
      continue
    }
    const parsed = fileSchema.safeParse(raw)
    if (!parsed.success) {
      errors.push(`${rel}: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`)
      continue
    }
    for (const a of parsed.data) {
      if (a.id[0] !== subject[0]) errors.push(`${rel}: ${a.id} tidak sesuai mapel ${subject}`)
      activities.push({ ...a, subject })
    }
  }
  const seen = new Set<string>()
  for (const a of activities) {
    if (seen.has(a.id)) errors.push(`id ganda: ${a.id}`)
    seen.add(a.id)
  }
  return { activities, errors }
}

/** Strand dari id skill tidak tersimpan di id, jadi pemanggil memberi strand dan kelas skill. */
export type ActivityQuery = { subject: Subject; strand: string; grade: number }

/**
 * Pilih kegiatan paling cocok. Skor: strand sama (4), kelas dalam rentang (3, atau selisih kecil makin rendah),
 * kegiatan umum (strand Oly) sebagai cadangan. `avoid` berisi id yang baru dipakai supaya minggu berikutnya berganti.
 */
export function pickActivity(all: readonly CoachActivity[], q: ActivityQuery, avoid: ReadonlySet<string> = new Set(), nth = 0): CoachActivity | null {
  const score = (a: CoachActivity): number => {
    if (a.subject !== q.subject) return -1
    const strand = a.strands.includes(q.strand) ? 4 : a.strands.includes('Oly') ? 1 : 0
    if (strand === 0) return -1
    const gap = q.grade < a.gradeMin ? a.gradeMin - q.grade : q.grade > a.gradeMax ? q.grade - a.gradeMax : 0
    const grade = Math.max(0, 3 - gap)
    return strand + grade - (avoid.has(a.id) ? 2 : 0)
  }
  const ranked = all
    .map((a) => ({ a, s: score(a) }))
    .filter((x) => x.s >= 0)
    .sort((x, y) => y.s - x.s || x.a.id.localeCompare(y.a.id))
  if (ranked.length === 0) return null
  const top = ranked.filter((x) => x.s === ranked[0]!.s)
  return top[nth % top.length]!.a
}

/** Penjelasan sehari-hari untuk orang tua, per strand: apa yang dipelajari anak dan mengapa itu berguna. */
export const STRAND_PLAIN: Record<string, string> = {
  Nc: 'Anak belajar membilang, melompat hitung, dan mengenali pola angka. Ini dasar untuk semua hitungan.',
  Ni: 'Anak belajar menjumlah, mengurang, mengalikan, dan membagi. Ini hitungan sehari-hari seperti belanja dan berbagi.',
  Nm: 'Anak belajar memakai uang: mengenali nilai, menjumlah harga, dan menghitung kembalian.',
  Np: 'Anak belajar nilai tempat, yaitu mengapa angka 305 berbeda dari 350, serta mengurutkan dan membulatkan angka.',
  Nf: 'Anak belajar pecahan, desimal, persen, dan perbandingan. Ini muncul saat membagi kue, membaca diskon, dan mengukur.',
  Gt: 'Anak belajar membaca jam, kalender, dan menghitung berapa lama sesuatu berlangsung.',
  Gg: 'Anak belajar mengenali bangun, mengukur panjang dan luas, serta memahami bentuk benda di sekitarnya.',
  Gp: 'Anak belajar posisi, arah, dan perpindahan, misalnya membaca peta dan mencerminkan bentuk.',
  Ss: 'Anak belajar mengumpulkan data, membaca tabel, dan membuat diagram untuk menjawab pertanyaan.',
  Sp: 'Anak belajar tentang kemungkinan, yaitu seberapa mungkin sesuatu terjadi.',
  Oly: 'Anak melatih nalar dan cara berpikir untuk soal-soal yang menantang.',
  Rw: 'Anak belajar bunyi huruf dan susunan kata supaya bisa membaca kata baru dengan lancar.',
  Rv: 'Anak belajar arti kata baru saat membaca, sehingga bacaannya makin dipahami.',
  Rg: 'Anak belajar memahami tata bahasa dan tanda baca saat membaca.',
  Rs: 'Anak belajar bagaimana sebuah teks tersusun: awal, tengah, akhir, dan bagian-bagiannya.',
  Ri: 'Anak belajar memahami isi bacaan, menemukan jawaban di teks, dan menebak yang tidak tertulis.',
  Ra: 'Anak belajar menikmati dan menanggapi cerita, puisi, dan bacaan lain.',
  Ww: 'Anak belajar mengeja kata dengan benar dalam English.',
  Wv: 'Anak belajar memilih kata yang tepat supaya tulisannya lebih hidup.',
  Wg: 'Anak belajar menyusun kalimat English yang benar, dengan kata kerja dan tanda baca yang tepat.',
  Ws: 'Anak belajar menyusun paragraf dan tulisan yang rapi dan runtut.',
  Wc: 'Anak belajar menulis sendiri, dari kalimat sederhana sampai cerita.',
  Wp: 'Anak belajar menyajikan tulisan dengan rapi dan mudah dibaca.',
  SL: 'Anak belajar menyimak dan berbicara dalam English, termasuk bertanya dan menjawab.',
  Bs: 'Anak belajar bagian tubuh makhluk hidup dan tumbuhan, serta apa fungsi tiap bagiannya.',
  Bp: 'Anak belajar proses kehidupan: tumbuh, makan, bernapas, dan berkembang biak.',
  Be: 'Anak belajar bagaimana makhluk hidup saling bergantung di lingkungannya.',
  Cm: 'Anak belajar dari bahan apa benda dibuat dan bagaimana bahan tersusun.',
  Cp: 'Anak belajar sifat bahan, misalnya keras, lentur, menyerap air, atau terapung.',
  Cc: 'Anak belajar bagaimana bahan berubah, misalnya meleleh, larut, atau membeku.',
  Pf: 'Anak belajar tentang gaya, gerak, dan energi, misalnya dorongan, tarikan, dan gesekan.',
  Pe: 'Anak belajar tentang listrik dan magnet dengan cara yang aman.',
  Pl: 'Anak belajar tentang cahaya, bayangan, dan bunyi.',
  ESp: 'Anak belajar tentang planet Bumi: batuan, tanah, dan permukaannya.',
  ESc: 'Anak belajar siklus alam, misalnya siklus air dan cuaca.',
  ESs: 'Anak belajar posisi Bumi di antariksa, termasuk siang, malam, dan matahari.',
  TWS: 'Anak belajar berpikir seperti ilmuwan: bertanya, mencoba, mencatat, dan menyimpulkan.',
}
