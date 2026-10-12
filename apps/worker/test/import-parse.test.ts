import { describe, expect, it } from 'vitest'
import { brokenFraction, findMarkers, parseImport, parseKeyEntries, questionStart } from '../src/handlers/import-parse'

/**
 * Contoh teks dibuat sendiri, meniru keluaran `pdftotext -layout` paket lomba (bukan soal resmi).
 * Halaman dipisah seperti form feed pdftotext: satu string per halaman.
 */

const ID_PAGES = [
  `                    OLIMPIADE MATEMATIKA CONTOH 2026
                         Kelas 2, Paket Latihan
PETUNJUK UMUM
1. Tulis nama dan nomor peserta pada lembar jawaban.
2. Kerjakan semua soal dengan pensil.

1.   Ani punya 12 kelereng. Ia memberi 5 kelereng kepada Budi.
     Berapa kelereng Ani sekarang?
     A. 5
     B. 6
     C. 7
     D. 8

2.   Hasil dari 25 + 17 adalah ....
     A. 32          B. 42          C. 43          D. 52

3.   Perhatikan gambar berikut. Ada berapa segitiga pada gambar?
     A. 3     B. 4     C. 5     D. 6
                                                   Halaman 1 dari 3
`,
  `                    OLIMPIADE MATEMATIKA CONTOH 2026
4.   Berapakah hasil dari    1   +   1   ?
                             2       4
     A. 3/4         C. 2/6
     B. 1/2         D. 2/4

5.   Ibu membeli 3 kg beras seharga Rp12.000/kg. Berapa yang dibayar Ibu?
     (A) Rp36.000   (B) Rp15.000   (C) Rp24.000   (D) Rp40.000
     Jawaban: A

6.   Bilangan genap di antara 7 dan 11 adalah ....
     a) 8 dan 10
     b) 8 dan 9
     c) 9 dan 10
     d) 7 dan 10
                                                   Halaman 2 dari 3
`,
  `                    OLIMPIADE MATEMATIKA CONTOH 2026
KUNCI JAWABAN
1. C     2. B     3. C
4. A     5. A     6. a
                                                   Halaman 3 dari 3
`,
]

const EN_PAGES = [
  `SAMPLE ENGLISH CHALLENGE, Year 4

Choose the best answer.

1) Which word is a noun?
   (A) quickly   (B) happy   (C) river   (D) sing

2) Choose the correct spelling.
   (A) recieve
   (B) receive
   (C) receeve
   (D) riceive

3) Read the table below. Which month has the most rainy days?
   (A) March   (B) April   (C) May   (D) June
`,
  `4) Fill in the blank: She ____ to school every day.
   (A) go
   (B) goes
   (C) going
   (D) gone
   (E) went

Answer Key
No.   1   2   3   4
Ans   C   B   B   B
`,
]

const SCIENCE_PAGES = [
  `LATIHAN SAINS KELAS 3                      Paket B
No. 1  Hewan yang bernapas dengan insang adalah ....
a) kucing
b) ikan
c) burung
d) kelinci
No. 2  Benda berikut yang termasuk sumber energi panas adalah
a) matahari yang bersinar
   terik di siang hari
b) bulan
c) bintang di langit malam
d) awan
                                      - 1 -
`,
  `LATIHAN SAINS KELAS 3                      Paket B
No. 3  Jelaskan mengapa tumbuhan membutuhkan cahaya matahari!
No. 4  Air yang dipanaskan akan berubah menjadi ....
a) es       b) uap air       c) batu       d) pasir
                                      - 2 -
`,
  `LATIHAN SAINS KELAS 3                      Paket B
Kunci
1 b
2 a
4 b
                                      - 3 -
`,
]

describe('parseImport: paket Matematika berbahasa Indonesia', () => {
  const r = parseImport(ID_PAGES)
  const byNo = new Map(r.items.map((i) => [i.number, i]))

  it('membaca enam soal, melewati daftar petunjuk bernomor', () => {
    expect(r.items.map((i) => i.number)).toEqual([1, 2, 3, 4, 5, 6])
    expect(r.keyFound).toBe(true)
    expect(r.keyEntries).toBe(6)
  })

  it('opsi satu per baris dan kunci huruf menjadi indeks', () => {
    const q = byNo.get(1)!
    expect(q.prompt).toBe('Ani punya 12 kelereng. Ia memberi 5 kelereng kepada Budi.\nBerapa kelereng Ani sekarang?')
    expect(q.options).toEqual(['5', '6', '7', '8'])
    expect(q.answerFromKey).toBe(2)
    expect(q.answer).toBe(2)
    expect(q.status).toBe('ok')
    expect(q.page).toBe(1)
    expect(q.approved).toBe(false)
    expect(q.orgItemId).toBeNull()
  })

  it('opsi sebaris dipisah dengan benar', () => {
    expect(byNo.get(2)!.options).toEqual(['32', '42', '43', '52'])
    expect(byNo.get(2)!.answerFromKey).toBe(1)
    expect(byNo.get(2)!.status).toBe('ok')
  })

  it('soal yang menyebut gambar perlu dicek dengan catatan halaman', () => {
    const q = byNo.get(3)!
    expect(q.status).toBe('needs-check')
    expect(q.figureNote).toBe('Soal menyebut gambar. Cek halaman 1.')
    expect(q.options).toEqual(['3', '4', '5', '6'])
  })

  it('pecahan bertumpuk ditandai broken-fraction dan opsi dua kolom diurutkan per huruf', () => {
    const q = byNo.get(4)!
    expect(q.status).toBe('broken-fraction')
    expect(q.options).toEqual(['3/4', '1/2', '2/6', '2/4'])
    expect(q.page).toBe(2)
    expect(q.answerFromKey).toBe(0)
  })

  it('sisa teks kunci di soal ditandai leftover-key-text', () => {
    const q = byNo.get(5)!
    expect(q.status).toBe('leftover-key-text')
    expect(q.options.slice(0, 3)).toEqual(['Rp36.000', 'Rp15.000', 'Rp24.000'])
    expect(q.prompt).toContain('Rp12.000/kg')
  })

  it('opsi huruf kecil dan kunci huruf kecil', () => {
    const q = byNo.get(6)!
    expect(q.options).toEqual(['8 dan 10', '8 dan 9', '9 dan 10', '7 dan 10'])
    expect(q.answerFromKey).toBe(0)
    expect(q.status).toBe('ok')
  })

  it('kepala dan kaki halaman tidak masuk ke soal', () => {
    for (const q of r.items) {
      expect(q.prompt).not.toMatch(/OLIMPIADE|Halaman/)
      for (const o of q.options) expect(o).not.toMatch(/OLIMPIADE|Halaman/)
    }
  })
})

describe('parseImport: paket English dengan kunci berbentuk tabel', () => {
  const r = parseImport(EN_PAGES)
  const byNo = new Map(r.items.map((i) => [i.number, i]))

  it('membaca empat soal dan tabel kunci', () => {
    expect(r.items.map((i) => i.number)).toEqual([1, 2, 3, 4])
    expect(r.items.map((i) => i.answerFromKey)).toEqual([2, 1, 1, 1])
  })

  it('opsi berkurung sebaris dan per baris, sampai E', () => {
    expect(byNo.get(1)!.options).toEqual(['quickly', 'happy', 'river', 'sing'])
    expect(byNo.get(2)!.options).toEqual(['recieve', 'receive', 'receeve', 'riceive'])
    expect(byNo.get(4)!.options).toEqual(['go', 'goes', 'going', 'gone', 'went'])
    expect(byNo.get(4)!.page).toBe(2)
  })

  it('soal yang menyebut table perlu dicek', () => {
    expect(byNo.get(3)!.status).toBe('needs-check')
    expect(byNo.get(3)!.figureNote).toBe('Soal menyebut gambar. Cek halaman 1.')
  })
})

describe('parseImport: format No. 1, opsi a) dan kunci "1 b"', () => {
  const r = parseImport(SCIENCE_PAGES)
  const byNo = new Map(r.items.map((i) => [i.number, i]))

  it('membaca empat soal', () => {
    expect(r.items.map((i) => i.number)).toEqual([1, 2, 3, 4])
  })

  it('opsi yang berlanjut ke baris berikutnya digabung', () => {
    expect(byNo.get(2)!.options[0]).toBe('matahari yang bersinar terik di siang hari')
    expect(byNo.get(2)!.answerFromKey).toBe(0)
  })

  it('soal uraian tanpa opsi perlu dicek, kunci kosong', () => {
    const q = byNo.get(3)!
    expect(q.options).toEqual([])
    expect(q.status).toBe('needs-check')
    expect(q.answerFromKey).toBeNull()
  })

  it('opsi huruf kecil sebaris', () => {
    expect(byNo.get(4)!.options).toEqual(['es', 'uap air', 'batu', 'pasir'])
    expect(byNo.get(4)!.answerFromKey).toBe(1)
  })

  it('kepala halaman yang berulang dan nomor halaman dibuang', () => {
    expect(byNo.get(2)!.options[3]).toBe('awan')
    expect(byNo.get(3)!.prompt).toBe('Jelaskan mengapa tumbuhan membutuhkan cahaya matahari!')
  })
})

describe('parseImport: kasus lain', () => {
  it('tanpa kunci: answer null, status tetap ok', () => {
    const r = parseImport(['1. 2 + 2 = ....\n   A. 3   B. 4   C. 5\n2. 3 + 3 = ....\n   A. 5   B. 6   C. 7\n'])
    expect(r.keyFound).toBe(false)
    expect(r.items.map((i) => i.answer)).toEqual([null, null])
    expect(r.items.map((i) => i.status)).toEqual(['ok', 'ok'])
  })

  it('kunci tanpa judul di akhir dokumen tetap terbaca', () => {
    const r = parseImport([
      '1. 5 + 1 = ....\n   A. 5   B. 6   C. 7\n2. 9 - 2 = ....\n   A. 6   B. 7   C. 8\n3. 4 x 2 = ....\n   A. 6   B. 8   C. 10\n',
      '1. B   2. B   3. B\n',
    ])
    expect(r.keyFound).toBe(true)
    expect(r.items.map((i) => i.number)).toEqual([1, 2, 3])
    expect(r.items.map((i) => i.answerFromKey)).toEqual([1, 1, 1])
  })

  it('opsi dan prompt sebaris setelah nomor soal', () => {
    const r = parseImport(['1. Berapa 10 + 5?   A. 14   B. 15   C. 16   D. 17\n'])
    expect(r.items[0]!.prompt).toBe('Berapa 10 + 5?')
    expect(r.items[0]!.options).toEqual(['14', '15', '16', '17'])
  })

  it('baris "Jawaban ..." di dalam soal tidak dianggap bagian kunci', () => {
    const r = parseImport([
      '1. Pilih jawaban yang benar. Berapa 2 + 3?\n   A. 4   B. 5   C. 6\nJawaban yang benar diberi tanda silang.\n2. Berapa 3 + 3?\n   A. 5   B. 6   C. 7\n3. Berapa 4 + 3?\n   A. 6   B. 7   C. 8\nKunci Jawaban\n1. B\n2. B\n3. B\n',
    ])
    expect(r.items.map((i) => i.number)).toEqual([1, 2, 3])
    expect(r.items.map((i) => i.answerFromKey)).toEqual([1, 1, 1])
  })

  it('kunci menunjuk opsi yang tidak ada: answer null dan perlu dicek', () => {
    const r = parseImport(['1. Berapa 1 + 1?\n   A. 1   B. 2\n2. Berapa 2 + 2?\n   A. 3   B. 4\n3. Berapa 3 + 3?\n   A. 6   B. 7\nKunci\n1. D\n2. B\n3. A\n'])
    expect(r.items[0]!.answerFromKey).toBeNull()
    expect(r.items[0]!.status).toBe('needs-check')
    expect(r.items[1]!.answerFromKey).toBe(1)
  })
})

describe('bagian kecil pengurai', () => {
  it('nomor soal', () => {
    expect(questionStart('12. Berapa?')).toEqual({ n: 12, rest: 'Berapa?' })
    expect(questionStart('3) What is 2 + 2?')).toEqual({ n: 3, rest: 'What is 2 + 2?' })
    expect(questionStart('No. 7 Hewan apa?')).toEqual({ n: 7, rest: 'Hewan apa?' })
    expect(questionStart('Soal 2: Hitung')).toEqual({ n: 2, rest: 'Hitung' })
    expect(questionStart('1.5 kg beras')).toBeNull()
    expect(questionStart('2024 adalah tahun kabisat')).toBeNull()
  })

  it('penanda opsi', () => {
    expect(findMarkers('A. 3   B. 4   C. 5', new Set(), null, false).map((m) => m.letter)).toEqual([0, 1, 2])
    expect(findMarkers('(a) satu (b) dua', new Set(), null, false).map((m) => m.letter)).toEqual([0, 1])
    expect(findMarkers('A farmer has 3 cows.', new Set(), null, true)).toEqual([])
    expect(findMarkers('Point (a) is above the line.', new Set(), null, true)).toEqual([])
  })

  it('entri kunci berbagai bentuk', () => {
    const k = parseKeyEntries(['1. B   2) c   3 D', '4 | A', '5.(E)', 'No 6 7 8', 'Jwb A B C'])
    expect([...k.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      [1, 1], [2, 2], [3, 3], [4, 0], [5, 4], [6, 0], [7, 1], [8, 2],
    ])
  })

  it('tanda pecahan rusak', () => {
    expect(brokenFraction(['Berapa 3/4 + 1/4?'], [])).toBe(false)
    expect(brokenFraction(['Kecepatan 60 km/jam, harga Rp5.000/kg'], [])).toBe(false)
    expect(brokenFraction(['Berapa 3 / + 1?'], [])).toBe(true)
    expect(brokenFraction(['Hasil dari 1 \uFFFD 2'], [])).toBe(true)
    expect(brokenFraction(['Setengah ditulis \u00C2\u00BD'], [])).toBe(true)
    expect(brokenFraction([], ['  3', '  4'])).toBe(true)
    expect(brokenFraction([], ['Hitung   1   +   2', '         3       5'])).toBe(true)
    expect(brokenFraction([], ['A. 12', 'B. 15'])).toBe(false)
  })
})

// Keluaran nyata `pdftotext -layout` (poppler) dari PDF contoh yang dibuat dengan reportlab:
// pembilang pecahan muncul satu baris di atas nomor soal 4.
const PDFTOTEXT_PAGES = [
  "                              LATIHAN OLIMPIADE CONTOH 2026\n\n\nPETUNJUK: Pilih satu jawaban yang paling tepat.\n\n1. Ani punya 12 kelereng. Ia memberi 5 kelereng kepada Budi.\n   Berapa kelereng Ani sekarang?\n\n    A. 5\n    B. 6\n    C. 7\n    D. 8\n\n2. Hasil dari 25 + 17 adalah ....\n\n    A. 32                     B. 42               C. 43        D. 52\n\n3. Perhatikan gambar di bawah. Ada berapa segitiga?\n\n    A. 3                      B. 4                C. 5         D. 6\n\n\n\n\n                                                                       Halaman 1 dari 3\n",
  "                           LATIHAN OLIMPIADE CONTOH 2026\n\n\n                                1        1\n4. Berapakah hasil dari             +        ?\n                                2        4\n\n   A. 3/4                               C. 2/6\n   B. 1/2                               D. 2/4\n\n5. Ibu membeli 3 kg beras seharga Rp12.000/kg. Berapa yang dibayar Ibu?\n\n   (A) Rp36.000           (B) Rp15.000           (C) Rp24.000             (D) Rp40.000\n\n\n\n\n                                                                                Halaman 2 dari 3\n",
  "                            LATIHAN OLIMPIADE CONTOH 2026\n\n\nKUNCI JAWABAN\n\n1. C   2. B   3. C   4. A   5. A\n\n\n\n\n                                                            Halaman 3 dari 3\n"
]

describe('parseImport: keluaran pdftotext sungguhan', () => {
  const r = parseImport(PDFTOTEXT_PAGES)
  const byNo = new Map(r.items.map((i) => [i.number, i]))

  it('lima soal, kunci terbaca', () => {
    expect(r.items.map((i) => i.number)).toEqual([1, 2, 3, 4, 5])
    expect(r.items.map((i) => i.answerFromKey)).toEqual([2, 1, 2, 0, 0])
  })

  it('pembilang di atas nomor soal ikut soal 4, bukan opsi soal 3', () => {
    expect(byNo.get(3)!.options).toEqual(['3', '4', '5', '6'])
    expect(byNo.get(4)!.status).toBe('broken-fraction')
    expect(byNo.get(4)!.options).toEqual(['3/4', '1/2', '2/6', '2/4'])
    expect(byNo.get(4)!.page).toBe(2)
  })

  it('status lain', () => {
    expect(byNo.get(1)!.status).toBe('ok')
    expect(byNo.get(3)!.status).toBe('needs-check')
    expect(byNo.get(5)!.options).toEqual(['Rp36.000', 'Rp15.000', 'Rp24.000', 'Rp40.000'])
  })
})
