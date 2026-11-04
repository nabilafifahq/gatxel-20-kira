# Laporan pemetaan Kira ke kerangka Cambridge Primary

Disusun Rabu 4 November 2026 oleh agen cambridge. Pemetaan lengkapnya ada di `content/curriculum/cambridge-map.json` dan diperiksa setiap `pnpm content:check`: setiap skill harus punya entri, kode harus ada di kerangka, dan daftar celah harus sama dengan hasil hitung ulang.

## 1. Jawaban singkat untuk pemilik

Apakah materi Kira mengikuti kurikulum Cambridge? Sebagian besar untuk Math dan Science, belum untuk English. Angkanya (sasaran belajar kerangka resmi yang punya paling sedikit satu skill Kira, penuh atau sebagian):

| Mapel | Sasaran kerangka | Tercakup penuh | Tercakup penuh atau sebagian |
|---|---|---|---|
| Math (0096) | 288 | 202 (70%) | 242 (84%) |
| Science, bagian isi (0097, tanpa Thinking and Working Scientifically dan Science in Context) | 185 | 135 (73%) | 162 (88%) |
| Science, seluruh kerangka | 311 | 135 | 186 (60%) |
| English (0058) | 580 | 240 (41%) | 303 (52%) |

Angka ini sudah termasuk 20 skill baru yang ditulis malam ini (bagian 6) dan 15 skill English kelas 4 sampai 6 dari agen konten (bagian 5). Sebelum itu, yang tercakup penuh atau sebagian: Math 78% (224 dari 288), Science isi 66% (122 dari 185) dan English 39% (228 dari 580).

Catatan penting soal cara membaca angka: ini pemetaan di tingkat skill, dari judul dan pernyataan "I can" setiap skill, bukan audit soal demi soal. "Penuh" berarti tujuan skill sesuai dengan sasaran. Itu belum membuktikan semua soal di skill itu menguji sasaran pada kedalaman dan usia yang sama dengan Cambridge.

## 2. Sumber kerangka

- Kerangka resmi Cambridge Primary Mathematics 0096 (versi 1.1), English 0058 (versi 2.1) dan Science 0097 (versi 1), semuanya terbitan September 2020 untuk pengajaran pertama September 2021.
- Unduhan kerangka di cambridgeinternational.org ada di balik login School Support Hub (`primary.cambridgeinternational.org` menampilkan halaman masuk). Halaman publik cambridgeinternational.org hanya menautkan ke Hub itu. Jadi dokumen resmi tidak bisa diunduh langsung tanpa akun sekolah.
- Yang dipakai adalah salinan PDF dokumen resmi yang dihosting pihak ketiga (situs sekolah dan penyimpan dokumen). Judul, nomor versi, tanggal terbit dan kode sasaran cocok dengan penjelasan resmi Cambridge. Isinya belum dibandingkan baris demi baris dengan salinan Hub. Kalau ada akun sekolah, satu kali pembandingan kode akan menutup celah ini.
- Salinan tersimpan di `C:\kw4\cambridge-sources\` (di luar repo). Repo hanya memuat kode sasaran dan catatan pendek buatan sendiri, tidak memuat teks kerangka.

## 3. Cara memetakan

- Tingkat cocok per skill: `direct` (tujuan skill sesuai sasaran), `partial` (skill menyentuh sebagian sasaran, misalnya hanya salah satu bagian atau kedalaman lebih rendah), `enrichment` (tidak ada sasaran kerangka).
- Skill Olimpiade, Cambridge Young Learners (Starters, Movers, Flyers) dan lomba dihitung `enrichment` dan tidak membawa kode. Jumlahnya 65 dari 415 skill: 44 Math, 18 English, 3 Science (cuaca dan musim, fotosintesis, mesin sederhana yang tidak ada di kerangka Primary 2020).
- Sasaran Math TWM (Thinking and Working Mathematically) tidak dihitung karena berlaku di semua tahap dan tidak punya kode per tahap.
- Science dipisah: bagian isi (Biologi, Kimia, Fisika, Bumi dan Antariksa) dan bagian TWS serta SIC. Kira baru punya skill TWS yang lemah (variabel, tabel, grafik, uji adil) dan nol skill SIC.
- English dipetakan ke untai membaca (Rw, Rv, Rg, Rs, Ri, Ra), menulis (Ww, Wv, Wg, Ws, Wc, Wp) dan berbicara dan menyimak (SLm, SLs, SLg, SLp, SLr).

## 4. Cakupan per mapel dan tahap

Kolom "penuh" dan "penuh atau sebagian" adalah jumlah sasaran. Untuk Science hanya bagian isi.

| Mapel | Tahap | Sasaran | Penuh | Penuh atau sebagian | Persen penuh atau sebagian |
|---|---|---|---|---|---|
| Math | 1 | 36 | 24 | 28 | 78% |
| Math | 2 | 48 | 29 | 36 | 75% |
| Math | 3 | 53 | 39 | 44 | 83% |
| Math | 4 | 46 | 34 | 43 | 93% |
| Math | 5 | 51 | 34 | 40 | 78% |
| Math | 6 | 54 | 42 | 51 | 94% |
| Science | 1 | 23 | 14 | 18 | 78% |
| Science | 2 | 26 | 17 | 22 | 85% |
| Science | 3 | 30 | 18 | 23 | 77% |
| Science | 4 | 38 | 33 | 36 | 95% |
| Science | 5 | 34 | 28 | 32 | 94% |
| Science | 6 | 34 | 25 | 31 | 91% |
| English | 1 | 90 | 21 | 40 | 44% |
| English | 2 | 99 | 31 | 48 | 48% |
| English | 3 | 102 | 21 | 31 | 30% |
| English | 4 | 104 | 66 | 71 | 68% |
| English | 5 | 93 | 43 | 47 | 51% |
| English | 6 | 92 | 58 | 66 | 72% |

Science TWS dan SIC: tahap 1 sampai 6 punya 12, 18, 21, 25, 25 dan 25 sasaran, dan hanya 2, 4, 5, 5, 3 dan 5 yang tersentuh.

## 5. Celah

Daftar lengkap kode ada di `gaps` pada `cambridge-map.json`, dengan catatan pendek di `gapNotes` untuk Math dan isi Science.

- Math (46 sasaran tanpa skill): tahap 1 ada 8 (misalnya mengenali jumlah tanpa menghitung, nol, memperkirakan), tahap 2 ada 12 (pembulatan ke puluhan, simetri putar, refleksi, percobaan peluang), tahap 3 ada 9, tahap 4 ada 3, tahap 5 ada 11, tahap 6 ada 3. Sisa terbesar: menyusun penyelidikan data (4Ss.01, 5Ss.01, 6Ss.01), percobaan peluang dan simulasi tahap 2 sampai 5, estimasi di tahap 1 sampai 3, dan refleksi bangun datar tahap 2 dan 3.
- Science isi (23 sasaran tanpa skill): sebagian besar di tahap 1 sampai 3: listrik dan magnet tahap 1, mengapung dan tenggelam, proses hidup tumbuhan dan hewan, campuran, pengukuran gaya dengan neraca pegas, Bumi sebagai sumber bahan. Tahap 6 menyisakan pubertas dan sistem reproduksi (6Bp.01, 6Bs.03), sengaja tidak ditulis malam ini: kerangka memuatnya, tetapi bahasa yang tepat untuk anak dan orang tua Indonesia perlu keputusan pemilik dulu.
- Science TWS dan SIC: hampir kosong. Ini celah terbesar kedua setelah English. Perlu skill tentang pertanyaan ilmiah, jenis penyelidikan, risiko dan keselamatan, model, dan ilmu dalam kehidupan sehari-hari.
- English (277 sasaran tanpa skill dari 580, setelah skill agen konten): terbesar di tahap 3 dan 2 (71 dan 51). Celah utama (yang tersisa kini terutama di tahap 1 sampai 3):
  - Membaca: beragam genre dan jenis teks nonfiksi (Ri.01 sampai Ri.05), makna tersurat dan tersirat dengan dasar bukti, membaca cepat dan memindai (Ri.13), sudut pandang (Ri.17), apresiasi dan pilihan buku (Ra).
  - Menulis: perencanaan dan penulisan kreatif (Wc), skrip drama, struktur teks dan paragraf (Ws), strategi ejaan (Ww.06 sampai Ww.10), kosakata (Wv), penyajian dan catatan (Wp).
  - Berbicara dan menyimak: hampir semua sasaran SLm, SLg, SLp dan SLr di luar materi Cambridge Young Learners. Soal ini membutuhkan penilai manusia.
- Agen konten (pilot/konten) menutup sebagian celah English kelas 4 sampai 6 dengan 15 skill baru (`e4.spelling-strategies`, `e4.speech-punctuation`, `e4.skim-scan`, `e4.genres-purpose`, `e4.story-craft`, `e5.apostrophes`, `e5.pronouns-nouns`, `e5.adverbs-phrases`, `e5.text-types`, `e5.skim-scan`, `e6.genres-text-types`, `e6.fact-opinion-voice-theme`, `e6.skim-scan`, `e6.spelling-strategies`, `e6.clauses-word-classes`). Semuanya sudah dipetakan dan angka di atas dihitung ulang setelah penggabungan. Celah English yang tersisa paling besar di tahap 3 (71) dan 2 (51).

## 6. Skill baru malam ini (20 skill, 431 soal)

Semua soal asli tulisan Kira, minimal 20 soal per skill dengan sebaran kesulitan 1 sampai 5, satu pelajaran singkat dengan 2 soal cek per skill, dan kunci diperiksa dua kali: dihitung kode untuk soal hitung, lalu dijawab ulang tanpa melihat kunci oleh pemeriksa kedua.

- Science tahap 4: `s4.particles`, `s4.energy`, `s4.solar-system`, `s4.medicines-germs`.
- Science tahap 5: `s5.adaptations`, `s5.flowers`, `s5.air-water-pollution`, `s5.magnets-strength`, `s5.gases-water`.
- Science tahap 6: `s6.rocks-soil`, `s6.germs-defences`, `s6.dissolving-boiling`.
- Math: `m3.complements-multiples`, `m3.unknown-patterns`, `m4.percent-intro`, `m4.time-units`, `m4.square-numbers`, `m5.order-divisibility`, `m6.rotational-symmetry`, `m6.probability-events`.

## 7. Skill di tahap yang tidak sesuai

Daftar dari pemetaan (hanya bila semua kode skill berada di tahap yang sama, di depan atau di belakang):

- Di depan kerangka: `m1.quarters` (seperempat ada di tahap 2), `m2.chance` dan `m2.carroll-venn` (tahap 3), `m4.decimals` (desimal ada di tahap 5), `s1.animal-groups` (tahap 2 dan 3), `s3.skeletons` (tahap 4), `s4.sound-vibrations` dan `s4.pitch-and-volume` (tahap 5), `s5.heart-lungs` (tahap 6), `e2.irregular-past` (tahap 3), `e5.relative-clauses` (tahap 6).
- Di belakang kerangka (bisa dianggap pengulangan): `m4.money-decimals`, `m5.place-value-millions` (angka besar tahap 4), `m5.round-whole-numbers`, `s3.healthy-living`, `s4.teeth` (tahap 2), `s5.vertebrates-invertebrates`, `s5.light-shadows` (isinya hampir sama dengan `s3.light-shadows`), `s6.digestion` (tahap 5), `s6.earth-structure` (tahap 4).

Tidak ada yang dipindah. Id skill memuat nomor kelas (misalnya `m4.decimals`), jadi memindahkan skill mengganti id dan memutus riwayat jawaban anak. Memindahkan tidak aman menjelang pilot. Cara aman setelah pilot: buat skill baru di kelas yang tepat, sembunyikan yang lama untuk anak baru, dan biarkan anak yang sudah punya riwayat tetap memakainya.

Makna "di depan" sama sekali tidak berarti salah: banyak keluarga Indonesia memang mengajarkan materi lebih awal. Yang perlu dihindari adalah mengatakan skill itu "kelas 4 Cambridge".

## 8. Kalimat yang boleh dan tidak boleh dipakai ke orang tua

Boleh, setelah laporan ini:

- "Materi Math dan Science Kira mengacu pada kerangka Cambridge Primary (edisi 2020)."
- "Setiap skill Kira dipetakan ke sasaran belajar kerangka Cambridge Primary. Peta dan celahnya terbuka untuk orang tua." (kalau peta dipublikasikan)
- "Kira melengkapi belajar di sekolah, bukan menggantikannya."
- Angka cakupan boleh disebut dengan keterangan: "Dari sasaran Math Cambridge Primary kelas 1 sampai 6, 84% punya latihan di Kira". Sebut bahwa English baru sebagian: "English Kira fokus pada kosakata, tata bahasa, ejaan dan pemahaman bacaan".

Tidak boleh:

- Kata "resmi", "tersertifikasi", "terakreditasi", "disetujui" atau "didukung" Cambridge, dan memakai logo Cambridge. Kira tidak punya hubungan resmi dengan Cambridge.
- "Mengikuti kurikulum Cambridge" tanpa keterangan, atau "mencakup seluruh kurikulum". English baru 52% dan TWS Science hampir kosong.
- Menyebut "kelas X Cambridge" untuk skill di daftar bagian 7.
- Mengiklankan jalur visa atau persiapan ujian Cambridge (Checkpoint, IGCSE). Kira belum dipetakan ke ujian itu.
- Soal Cambridge Young Learners, Olimpiade dan lomba adalah pengayaan Kira dan tidak dihitung sebagai cakupan kerangka.

## 9. Pekerjaan lain dari tugas yang sama

- Soal tidak berulang: pemilih soal sekarang memakai seluruh riwayat jawaban anak. Soal tertulis yang pernah dijawab tidak muncul lagi di Latihan, Tes, Paper atau ulang sampai bank soal skill habis, lalu yang paling lama dilihat dipakai lebih dulu. Kartu Buku Koreksi dan Fix-it tetap boleh mengulang. Soal generator Math memakai seed dari anak, tanggal dan sesi, dan satu sesi tidak pernah berisi dua instans angka yang sama.
- Soal kembar: skrip `scripts/audit-duplicates.mjs` dijalankan oleh `pnpm content:check`. Sembilan kelompok kembar diperbaiki, termasuk `e2.sentence-punctuation.018` dan `.026`.
- Generator Math: 164 generator, 786 kombinasi tingkat, 1.179.000 soal dibangkitkan, 125 ribu jawaban dihitung ulang dari teks soal, tanpa temuan. 24 kombinasi punya kurang dari 20 instans berbeda, dan itu ditangani penjaga sesi. Jalankan ulang dengan `pnpm content:generators`.
