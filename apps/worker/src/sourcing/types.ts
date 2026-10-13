/**
 * Bentuk antara pengambil soal otomatis (rencana 10.7). Setiap importer dataset mengubah baris mentah
 * menjadi Candidate; pemeta menambah skill dan kelas Kira; pembangun soal membuat JSON soal lengkap.
 */

export type Subject = 'math' | 'english' | 'science'

export type Candidate = {
  /** Id soal di sumbernya, untuk pelacakan. */
  externalId: string
  subject: Subject
  /** Kelas menurut sumber, atau null bila sumber tidak memberi tahu. */
  grade: number | null
  type: 'mcq' | 'numeric'
  prompt: string
  /** Pilihan ganda: teks opsi. */
  options?: string[]
  /** mcq: indeks opsi benar. numeric: nilai jawaban. Ini kunci dari sumber. */
  answer: number
  unit?: string
  allowDecimal?: boolean
  /** Langkah penyelesaian dari sumber (dipakai sebagai solution soal), bila ada. */
  steps?: string[]
  /** Penjelasan jawaban dari sumber, bila ada. */
  explanation?: string
  /** Petunjuk topik dari sumber (jenis soal, kategori) untuk pemetaan ke skill. */
  topicHint?: string
  /** 1 sampai 5. */
  difficulty: number
  /** Skill sudah pasti (misalnya Bebras ke skill olimpiade), melewati pemetaan kata kunci. */
  skillHint?: string
}

/** Hasil satu pembacaan sumber: baris mentah sejajar urutan sumber (null = disaring), dan jumlah baris mentah. */
export type ParsedRows = { rows: (Candidate | null)[]; rawCount: number }

export type Mapping = { skillId: string; grade: number }
