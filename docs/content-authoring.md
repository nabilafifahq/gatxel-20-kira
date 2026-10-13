# Panduan menulis konten Kira

Dokumen ini dipakai oleh siapa pun (manusia atau agen) yang menulis skill, soal, pelajaran, bacaan, atau generator Math. Validasi selalu dengan:

```
pnpm content:check                                   # harus bersih (exit 0)
pnpm content:check --warnings                        # lihat cakupan yang masih kurang
pnpm content:check --scope=english/g2,e2.            # hanya tampilkan masalah di bagian ini
```

Skema resmi: `packages/content/src/schema.ts` (soal, skill, pelajaran, bacaan, lomba) dan `packages/figures/src/spec.ts` (figur dan daftar ikon). Kalau dokumen ini berbeda dengan skema, skema yang benar.

## 1. Letak file dan id

| Jenis | Path | Id |
|---|---|---|
| Skill | `content/skills/<subject>/g<grade>.json` (boleh juga `g<grade>-<nama>.json`) | `<huruf><grade>.<slug>`, huruf `m` Math, `e` English, `s` Science. Contoh `e2.past-tense-ed` |
| Soal | `content/items/<subject>/g<grade>/<slug>.json` | `<skill>.<NNN>`, contoh `e2.past-tense-ed.001` |
| Pelajaran | `content/lessons/<subject>/g<grade>/<slug>.json` | satu per skill; soal cek memakai `<skill>.9NN` |
| Bacaan | `content/passages/<subject>/g<grade>/<slug>.json` | `<huruf><grade>.p.<slug>`, contoh `e2.p.lost-kite` |
| Generator Math | `packages/content/src/math/g<grade>.ts` | satu generator per skill ber-`generator: true` |

`slug` huruf kecil, angka, dan tanda hubung. Nama file soal sama dengan slug skill: soal skill `e2.past-tense-ed` ada di `content/items/english/g2/past-tense-ed.json`.

## 2. Skill

```json
[
  {
    "id": "e2.past-tense-ed",
    "subject": "english",
    "grade": 2,
    "strand": "Wg",
    "title": "Past tense with -ed",
    "titleId": "Kata kerja lampau dengan -ed",
    "canDo": "I can add -ed to a verb to talk about the past.",
    "order": 40,
    "prerequisites": ["e2.verbs"],
    "term": 1,
    "competitions": ["iklc"],
    "generator": false
  }
]
```

- `strand` memakai kode strand Cambridge Primary: Math `Nc Ni Nm Np Nf Gt Gg Gp Ss Sp` plus `Oly` untuk nalar olimpiade; English `Rw Rv Rg Rs Ri Ra Ww Wv Wg Ws Wc Wp SL`; Science `Bs Bp Be Cm Cp Cc Pf Pe Pl ESp ESc ESs TWS`.
- Kode skill adalah kode Kira sendiri. Jangan menulis kode resmi Cambridge (misalnya 2Nc.01) di mana pun.
- `order` menentukan urutan di peta belajar (kelipatan 10 supaya mudah disisipi). `prerequisites` hanya skill yang benar-benar dibutuhkan, boleh dari grade sebelumnya.
- `title` en-GB paling banyak 60 karakter, sentence case. `titleId` Bahasa Indonesia untuk konsol tutor. `canDo` kalimat "I can ..." untuk anak.
- `competitions`: id lomba yang relevan (`ikmc`, `iklc`, `iksc`, `esmo`, `sasmo`, `kmnr`, `ksnr`, `seamo`, `hkimo`, `timo`, `imso`, `osn-sd`, `cambridge-checkpoint`).

## 3. Soal

Satu file per skill:

```json
{ "skill": "e2.past-tense-ed", "items": [ { ... }, { ... } ] }
```

Field umum setiap soal:

| Field | Wajib | Isi |
|---|---|---|
| `id` | ya | `<skill>.NNN`, urut dari 001 |
| `skill` | ya | sama dengan skill file |
| `type` | ya | salah satu tipe di bawah |
| `difficulty` | ya | 1 sampai 5 (lihat kalibrasi) |
| `prompt` | ya | teks soal en-GB. Titik kosong ditulis `___` |
| `hints` | ya | tepat 3 untuk tipe otomatis: (1) dorongan, (2) strategi, (3) langkah pertama. Tidak pernah membocorkan jawaban akhir |
| `explanation` | ya | 1 sampai 3 kalimat mengapa jawabannya benar |
| `figure` | tidak | FigureSpec (bagian 5) |
| `passage` | tidak | id bacaan untuk soal pemahaman |
| `tip` | tidak | satu kalimat kebiasaan baik |
| `solution` | tidak | 2 sampai 8 langkah `{ "say", "show"?, "figure"? }` untuk SolutionPlayer |
| `tags` | tidak | huruf kecil bertanda hubung: `word-problem`, `olympiad`, `ikmc`, `esmo`, `sasmo`, `kmnr`, `reading`, `checkpoint`, `keep-order` |
| `expectedSeconds` | tidak | perkiraan waktu wajar |
| `lang` | tidak | default `en-GB`. `id` hanya untuk soal bergaya ESMO dan wajib bertag `esmo` atau `id` |
| `terms` | tidak | untuk soal berbahasa Indonesia: `[{ "term": "lompatan", "en": "jump" }]` |

### Tipe soal

**mcq**, satu jawaban. 3 opsi untuk Grade 1, 4 opsi untuk Grade 2 ke atas, 5 opsi hanya untuk gaya IKMC. Setiap pengecoh punya `why` (alasan singkat mengapa belum tepat, ditulis ramah untuk anak).

```json
{
  "id": "e2.past-tense-ed.001", "skill": "e2.past-tense-ed", "type": "mcq", "difficulty": 2,
  "prompt": "Yesterday Ben ___ his bike to the park.",
  "options": [
    { "text": "rides", "why": "Rides is for now. Yesterday is in the past." },
    { "text": "rided", "why": "Ride does not take -ed. It changes to rode." },
    { "text": "rode" },
    { "text": "riding", "why": "Riding needs a helper word like was." }
  ],
  "answer": 2,
  "hints": ["Look for the word that tells you when.", "Yesterday means the past.", "Say it aloud: Yesterday Ben rides? Yesterday Ben rode?"],
  "explanation": "Yesterday tells us it is in the past. Ride is an irregular verb, so the past is rode."
}
```

Posisi jawaban benar harus bervariasi (jangan selalu A). Opsi tidak boleh kembar.

**multi**, beberapa jawaban: `options` 3 sampai 6, `answers` daftar indeks. Prompt menyebut "Choose all ..." atau "Choose 2 ...".

**numeric**, jawaban angka diketik di keypad: `"answer": 20`, opsional `"unit": "cm"`, `"tolerance": 0`, `"acceptAlt": [..]`, `"allowDecimal": true` untuk desimal, `"allowNegative": true` untuk negatif.

**text**, jawaban kata pendek diketik: `"blanks": [{ "answers": ["jumped"] }]`. Kalau prompt punya beberapa `___`, jumlah blanks harus sama. Masukkan semua jawaban yang wajar (`["grey", "gray"]`). Huruf besar kecil diabaikan kecuali `"caseSensitive": true`.

**order**, urutkan kartu: `"items"` 3 sampai 8 dalam urutan BENAR (aplikasi yang mengacak).

**match**, jodohkan: `"pairs": [["cat", "kitten"], ["dog", "puppy"]]` 2 sampai 6 pasangan, kiri dan kanan unik.

**sort**, kelompokkan: `"groups": ["Living", "Never alive"]`, `"items": [{ "text": "tree", "group": 0 }]`. Setiap grup minimal satu kartu.

**numberline**: `"min": 0, "max": 20, "step": 1, "answer": 13`, anak mengetuk posisi.

**clock**: `"answer": { "h": 3, "m": 30 }`, `"stepMinutes": 30`, anak memutar jarum. Jam ditulis 12 jam di prompt ("half past 3").

**fraction**: `"shape": "bar"|"circle"|"square"`, `"parts": 8`, `"answer": { "num": 3, "den": 4 }`, anak mengarsir bagian. `num * parts` harus habis dibagi `den`.

**write**, menulis bebas dinilai tutor: `"rubric": { "criteria": [{ "label": "Uses capital letters and full stops", "points": 2 }] }`, opsional `minWords`, `maxWords`, `planning` (pertanyaan bantu), `model` (contoh jawaban untuk tutor). `hints` boleh 0 sampai 3.

**speak**, rekam suara dinilai tutor: `rubric`, opsional `readText` (teks yang dibaca keras), `maxSeconds` (default 60).

**draw**, menggambar dinilai tutor: `rubric`, `background` `blank|grid|lines|dots`.

### Tipe soal baru (semuanya model ketuk)

Jenis di bagian ini punya aturan tambahan yang diperiksa `pnpm content:check`. Id soal tidak harus urut tanpa celah, tetapi unik per skill.

**story**, cerita bertahap: `prompt` adalah cerita (2 sampai 5 kalimat) dan `parts` berisi 2 sampai 4 pertanyaan berjenis `mcq` (`options`, `answer`), `numeric` (`answer`, opsional `unit`) atau `text` (`answers`). Soal benar bila semua pertanyaan benar.

**listen**, dengar lalu jawab: `listenText` dibacakan suara perangkat dan TIDAK PERNAH ditampilkan. Prompt tidak boleh memuat `listenText` ("Listen. Which animal did you hear?"). Pilihan seperti mcq (`options`, `answer`), boleh gambar, kata, atau angka.

**tiles**, susun kata: `"answer": "I like red apples."` dipecah per spasi menjadi kartu (3 sampai 9 kata), `"distractors"` kartu pengecoh satu kata yang tidak ada di kalimat. `"alternatives"` untuk kalimat lain yang memakai kartu yang sama persis. Tulis huruf besar dan tanda baca persis seperti kartu yang harus tampil.

**spell**, eja: `"word": "said"`, `"sentence"` kalimat contoh yang dibacakan setelah kata, `"alsoAccept"` untuk ejaan lain yang sah. Prompt tidak boleh memuat kata itu.

**cloze**, pilih kata di celah: prompt memuat satu `___` per celah, `"gaps": [{ "options": ["walks", "walk"], "answer": 0 }]`.

**hotspot**, ketuk di gambar: `figure` wajib (biasanya `scene`), `"regions": [{ "label": "roots", "x": 50, "y": 89, "w": 25, "h": 19 }]` dengan x dan y pusat area dalam persen lebar dan tinggi gambar, `"answers": [3]` indeks area yang benar (1 sampai 3). Label area unik dan tidak ditampilkan; dipakai pembaca layar. Pusat dua area berjarak minimal 14 persen.

**label**, beri label diagram: `figure` wajib, `"labels": ["flower", "leaf"]` label yang benar untuk `"spots": [{ "x": 50, "y": 25 }, ...]` (titik bernomor, jarak minimal 18 persen), `"extraLabels"` label pengecoh. Jumlah labels sama dengan jumlah spots.

**table**, lengkapi tabel: `head`, `rows` (sel yang diisi anak ditulis `""`), `blanks: [{ "row": 1, "col": 1, "answers": ["2"] }]`. Angka dibandingkan sebagai angka (`8` sama dengan `8.0`).

**grid**, teka-teki kotak: `"puzzle": "magic"` (3x3, angka di `filled` dipakai sekali dan semua garis berjumlah sama), `"sudoku"` (4x4, kotak 2x2) atau `"latin"` (3x3 atau 4x4). `given` memakai 0 untuk sel kosong, `filled` adalah penyelesaiannya. Teka-teki harus punya tepat satu penyelesaian (diperiksa pemecah di `packages/content/src/grid.ts`).

**photo**, jawaban foto: `rubric` seperti `write`. Anak memotret jawaban di kertas dengan kamera atau galeri; tutor menilai dengan saran AI.

Soal baru jenis layar saja (semua kecuali `mcq`, `multi`, `numeric`, `text`, `order`, `match`, `sort`, `numberline`, `clock`, `fraction`) tidak ikut Paper cetak dan simulasi lomba.

### Kalibrasi tingkat

| Tingkat | Arti |
|---|---|
| 1 | Ingatan atau satu langkah, jauh di bawah batas grade |
| 2 | Satu langkah standar grade |
| 3 | Soal khas grade, dua langkah atau perlu membaca teliti |
| 4 | Lebih sulit dari rata-rata kelas, banyak langkah atau pengecoh kuat |
| 5 | Tantangan atau gaya olimpiade |

Setiap skill: sebaran tingkat 1 sampai 4, dengan beberapa tingkat 5 untuk anak yang cepat.

## 4. Aturan isi

- Ejaan en-GB: colour, favourite, metre, litre, centimetre, grey, practise (kata kerja), practice (kata benda), mum, autumn, rubbish, pavement, holiday.
- Asli. Jangan menyalin soal, bacaan, atau gambar dari buku Cambridge, kertas ujian lama, atau situs lain. Tulis bacaan baru.
- Nama tokoh beragam (Indonesia dan internasional). Jangan memakai nama learner asli (Syakira) atau nama keluarga.
- Konteks Indonesia boleh dan disarankan (Rupiah, pasar, hujan, mangga, sekolah), tetap netral agama dan bebas merek.
- Aman untuk anak: tanpa kekerasan, horor, diet, penampilan tubuh, atau hal yang membuat anak merasa bersalah.
- Panjang instruksi per jenjang: kelas 1 sampai 2 paling banyak 12 kata per kalimat instruksi, kelas 3 sampai 4 paling banyak 16, kelas 5 sampai 6 paling banyak 20. Bacaan boleh lebih panjang.
- Gaya GTX: tanpa em dash dan en dash (pakai koma, titik dua, titik, atau kurung), tanpa kata terlarang (`leverage`, `seamless`, `robust`, `delve`, `unlock`, `empower`, `crucial`, `pivotal`, `holistic`, `utilise`).
- Science harus benar secara ilmiah dan memakai kosakata Cambridge Primary (living things, habitat, material, property, force, push, pull, magnetic, conductor, insulator, evaporation, condensation). Hindari miskonsepsi (misalnya "tumbuhan mengambil makanan dari tanah").
- Figur wajib punya `alt` yang menyebut informasi yang dibutuhkan untuk menjawab.
- Jawaban yang diketik (text, numeric) harus tidak ambigu. Kalau ada beberapa jawaban yang benar, masukkan semuanya.

## 5. Figur

Figur adalah data, dirender sebagai SVG. Daftar lengkap tipe dan ikon ada di `packages/figures/src/spec.ts` (`ICON_NAMES`). Contoh:

```json
{ "kind": "array", "rows": 4, "cols": 5, "icon": "apple", "alt": "4 rows of 5 apples." }
{ "kind": "groups", "groups": [3, 3, 3], "icon": "cookie", "container": "plate", "alt": "3 plates with 3 cookies on each." }
{ "kind": "objects", "items": [{ "icon": "apple", "count": 4 }, { "icon": "pear", "count": 2 }], "alt": "4 apples and 2 pears." }
{ "kind": "numberline", "min": 0, "max": 20, "step": 2, "labels": "all", "jumps": [{ "from": 4, "to": 10 }], "alt": "A number line from 0 to 20 with a jump from 4 to 10." }
{ "kind": "clock", "h": 3, "m": 30, "alt": "A clock showing half past 3." }
{ "kind": "shape", "shape": "rectangle", "sideLabels": ["6 cm", "3 cm"], "alt": "A rectangle 6 cm long and 3 cm wide." }
{ "kind": "shapes", "items": [{ "shape": "triangle" }, { "shape": "cube" }], "alt": "A triangle and a cube." }
{ "kind": "grid", "rows": 3, "cols": 4, "shaded": [[0,0],[0,1]], "alt": "A 3 by 4 grid with 2 squares shaded." }
{ "kind": "fraction", "shape": "circle", "parts": 4, "shaded": 1, "alt": "A circle cut into 4 equal parts with 1 part shaded." }
{ "kind": "bars", "categories": ["Mon", "Tue"], "values": [4, 7], "step": 1, "yLabel": "Books", "alt": "Bar chart: Monday 4 books, Tuesday 7 books." }
{ "kind": "pictogram", "rows": [{ "label": "Red", "count": 3 }], "icon": "star", "key": 2, "alt": "Pictogram: red has 3 stars, each star means 2 children." }
{ "kind": "tally", "rows": [{ "label": "Cats", "count": 7 }], "alt": "Tally chart: cats 7." }
{ "kind": "table", "head": ["Animal", "Legs"], "rows": [["Spider", "8"]], "alt": "Table of animals and legs." }
{ "kind": "basetens", "hundreds": 1, "tens": 3, "ones": 4, "alt": "1 hundred, 3 tens and 4 ones." }
{ "kind": "money", "items": [{ "value": 5000, "count": 2 }, { "value": 1000, "count": 3 }], "alt": "Two Rp5.000 notes and three Rp1.000 coins." }
{ "kind": "ruler", "lengthCm": 15, "objectCm": 9, "object": "pencil", "alt": "A pencil next to a ruler, from 0 to 9 cm." }
{ "kind": "thermometer", "min": -10, "max": 40, "value": 25, "step": 10, "alt": "A thermometer showing 25 degrees Celsius." }
{ "kind": "scale", "max": 1000, "value": 600, "step": 100, "unit": "g", "alt": "Scales showing 600 g." }
{ "kind": "jug", "capacity": 1000, "value": 400, "step": 100, "unit": "ml", "alt": "A jug with 400 ml of water." }
{ "kind": "sequence", "items": ["1", "3", "5", null], "style": "stones", "alt": "Stones numbered 1, 3, 5 and one blank stone." }
{ "kind": "pattern", "items": [{ "shape": "circle" }, { "shape": "square" }, { "shape": "circle" }, null], "alt": "Circle, square, circle, blank." }
{ "kind": "venn", "sets": ["Can fly", "Has legs"], "items": [{ "text": "bird", "region": "both" }], "alt": "Venn diagram ..." }
{ "kind": "carroll", "cols": ["Even", "Not even"], "rows": ["Less than 10", "Not less than 10"], "cells": [["4"], ["7"], ["12"], ["15"]], "alt": "Carroll diagram ..." }
{ "kind": "coordinates", "size": 6, "points": [{ "x": 2, "y": 3, "label": "A" }], "alt": "Point A at (2, 3)." }
{ "kind": "angle", "degrees": 90, "alt": "A right angle." }
{ "kind": "icons", "items": [{ "icon": "egg", "label": "egg" }, { "icon": "tadpole", "label": "tadpole" }, { "icon": "frog", "label": "frog" }], "arrows": "cycle", "alt": "Life cycle of a frog." }
{ "kind": "circuit", "parts": ["battery", "bulb-lit", "switch-closed"], "alt": "A circuit with a battery, a lit bulb and a closed switch." }
{ "kind": "balance", "left": ["3", "4"], "right": ["?"], "tilt": "level", "alt": "A balance with 3 and 4 on the left and a missing number on the right." }
{ "kind": "scene", "width": 320, "height": 260, "shapes": [{ "t": "rect", "x": 0, "y": 190, "w": 320, "h": 70, "tone": "warn" }, { "t": "line", "x1": 160, "y1": 190, "x2": 160, "y2": 90, "tone": "science", "width": 6 }, { "t": "icon", "icon": "sun", "x": 262, "y": 8, "size": 48 }], "alt": "A plant growing in soil with a sun in the corner." }
```

`scene` menggambar diagram dari bentuk dasar (`rect`, `circle`, `ellipse`, `line`, `poly`, `icon`, `text`) di kotak `width` x `height` dengan koordinat piksel dan warna dari `tone`; dipakai untuk soal ketuk di gambar dan beri label, karena persen area ketuk dihitung dari kotak ini.

Opsi mcq boleh berupa figur: `{ "figure": { "kind": "shape", "shape": "hexagon", "alt": "A hexagon." } }`.

## 6. Bacaan

```json
{
  "id": "e2.p.lost-kite",
  "title": "The lost kite",
  "kind": "story",
  "text": "Paragraf pertama.\n\nParagraf kedua."
}
```

Panjang: Grade 1 40 sampai 90 kata, Grade 2 80 sampai 160, Grade 3 150 sampai 250, Grade 4 200 sampai 320, Grade 5 250 sampai 400, Grade 6 300 sampai 480. Satu bacaan dipakai oleh 4 sampai 6 soal pemahaman (`"passage": "e2.p.lost-kite"`), di skill pemahaman (strand `Ri`, `Rs`, atau `Ra`).

## 7. Pelajaran

Satu file per skill di `content/lessons/<subject>/g<grade>/<slug>.json`:

```json
{
  "skill": "m2.arrays",
  "title": "Rows and columns",
  "steps": [
    { "say": "An array is things in rows. Every row has the same number.", "figure": { "kind": "array", "rows": 3, "cols": 4, "icon": "muffin", "alt": "3 rows of 4 muffins." } },
    { "say": "Count one row first. This row has 4.", "show": "4" },
    { "say": "Now skip count in 4s: 4, 8, 12.", "show": "4 + 4 + 4 = 12" },
    { "say": "3 rows of 4 make 12. We write 3 × 4 = 12.", "show": "3 × 4 = 12" }
  ],
  "check": [
    { "id": "m2.arrays.901", "skill": "m2.arrays", "type": "numeric", "difficulty": 2, "prompt": "2 rows of 5 stars. How many stars?", "figure": { "kind": "array", "rows": 2, "cols": 5, "icon": "star", "alt": "2 rows of 5 stars." }, "answer": 10, "hints": ["Count the stars in one row.", "Count in 5s, one row at a time.", "The first row makes 5. Add the next row."], "explanation": "2 rows of 5 make 10." }
  ]
}
```

3 sampai 8 langkah. Setiap `say` paling banyak 2 kalimat pendek karena dibacakan dan tampil sebagai caption. Satu sampai tiga soal cek bertipe mcq, numeric, atau text.

## 8. Generator Math

Generator ditulis di `packages/content/src/math/g<grade>.ts` dan mengembalikan isi soal tanpa `id`, `skill`, dan `difficulty`. Contoh lengkap: generator `m2.arrays` di `g2.ts`. Aturan:

- Hanya memakai `ctx.rng` (deterministik). Jangan `Math.random()` atau tanggal.
- Mendukung tingkat yang masuk akal di `levels`. Tingkat yang lebih tinggi memakai angka lebih besar, langkah lebih banyak, atau soal cerita.
- Variasi tipe: campur numeric, mcq, text, numberline, clock, fraction, order sesuai skill. Pilihan ganda memakai `mcqFrom` supaya posisi jawaban acak dan pengecoh punya alasan.
- Jawaban dihitung dari angka yang dibangkitkan, tidak diketik.
- Semua hint dan penjelasan memakai angka soal itu.
- `pnpm content:check` menjalankan 25 seed per tingkat dan menolak hasil yang tidak valid atau tidak deterministik.
