# Laporan verifikasi materi Kira

Pemeriksaan kedua materi kelas 1 sampai 6, malam 4 ke 5 November 2026. Rincian tiap temuan ada di `docs/verifikasi-materi-rincian/`.

## Ringkasan untuk pemilik

Semua 386 pelajaran, 100 bacaan, dan 9.112 soal tertulis sudah dibaca penuh oleh pemeriksa yang berbeda dari penulisnya. Soal olimpiade dikerjakan dulu tanpa melihat kunci. Dari 949 soal itu (923 Math, 26 Science), semuanya sama dengan kunci. 49 teka-teki kisi terbukti punya tepat satu jawaban.

Yang banyak salah adalah teks di sekitar kunci: penjelasan, petunjuk, catatan pilihan salah, dan aturan yang terlalu mutlak. Materi tertulis sekarang jauh lebih aman, tetapi perbaikan kode di bawah harus masuk sebelum dibuka.

## Perlu tindakan sebelum dibuka

Perbaikan 1 sampai 5 ada di `usulan-perbaikan-kode.diff`, sudah diuji pada salinan, belum dipasang karena tugas ini tidak boleh mengubah kode.

1. Kunci salah di generator kelas 6 (`m6.multiply-divide-powers-of-ten`, tingkat 5): semua soal varian "× 1,000 ÷ 100" 10 kali terlalu besar, jadi anak yang benar dinilai salah.
2. `splitSentences` memotong kalimat di dalam angka. Kena sekitar 176 soal tertulis, ditambah soal generator yang memakai desimal atau rupiah.
3. Langkah "So the answer is: C. ..." memakai huruf asli, padahal pilihan diacak. Kena sekitar 4.621 soal. Isi jawabannya benar, hurufnya bisa berbeda dengan layar.
4. Sorotan di `SolutionPlayer` mengambil kecocokan pertama, jadi angka 3 bisa menyala di dalam 34. Kena sekitar 30 soal tertulis, ditambah soal generator.
5. Dua catatan generator yang keliru: "9.3 rounds to 9, not 9" dan "Position 1 would give 9, not 9".

Catatan integrator:
- Jangan jalankan ulang `packages/content/scripts/peraga-items.ts`, karena akan membatalkan perbaikan empat soal balok.
- Kunci klip suara memakai isi teks. Ratusan soal, pelajaran, dan bacaan berubah teksnya, jadi kalimat itu butuh klip baru.
- 34 soal olimpiade kelas 2 diturunkan `difficulty`, `points`, dan `expectedSeconds`-nya.

## Angka per mapel dan kelas

Angka temuan adalah catatan di rincian, dan satu catatan bisa mencakup beberapa soal.

| Mapel kelas | Pelajaran | Bacaan | Soal dibaca | Fakta | Langkah | Kunci | Dua jawaban | Dihapus |
|---|---|---|---|---|---|---|---|---|
| Math 1 | 22 | - | 218 | 3 | 2 | 0 | 0 | 0 |
| Math 2 | 26 | - | 561 | 9 | 48 | 0 | 8 | 0 |
| Math 3 | 30 | - | 330 | 1 | 10 | 0 | 1 | 0 |
| Math 4 | 31 | - | 330 | 4 | 9 | 0 | 5 | 0 |
| Math 5 | 31 | - | 289 | 3 | 11 | 0 | 0 | 0 |
| Math 6 | 32 | - | 318 | 11 | 11 | 0 | 5 | 0 |
| English 1 | 17 | 16 | 581 | 25 | 17 | 0 | 11 | 0 |
| English 2 | 20 | 18 | 738 | 26 | 14 | 0 | 6 | 0 |
| English 3 | 18 | 17 | 575 | 36 | 14 | 1 | 7 | 0 |
| English 4 | 23 | 17 | 656 | 33 | 23 | 0 | 6 | 0 |
| English 5 | 23 | 16 | 622 | 39 | 22 | 0 | 4 | 0 |
| English 6 | 23 | 16 | 646 | 48 | 20 | 0 | 4 | 0 |
| Science 1 | 12 | - | 503 | 23 | 13 | 0 | 1 | 0 |
| Science 2 | 14 | - | 644 | 34 | 17 | 0 | 3 | 0 |
| Science 3 | 13 | - | 541 | 21 | 11 | 1 | 1 | 0 |
| Science 4 | 17 | - | 535 | 28 | 6 | 0 | 2 | 0 |
| Science 5 | 18 | - | 537 | 37 | 6 | 0 | 2 | 0 |
| Science 6 | 16 | - | 488 | 20 | 7 | 0 | 1 | 0 |

Total seluruh catatan, termasuk yang di luar tabel: 404 fakta, 262 langkah, 2 kunci, 67 soal dua jawaban, 0 dihapus, 65 bahasa, 66 catatan kelas, 3 asal soal, 10 terbuka. 160 catatan ditandai serius.

Dua catatan kunci itu adalah `e3.er-est.803` ("hottest has two t letters" dikunci benar, kalimatnya diperbaiki) dan `s3.light-shadows.013` ("solid" dibuang dari jawaban yang diterima). Tidak ada id yang berubah dan tidak ada soal yang dihapus. Satu kartu sortir dan satu pasangan cocokkan dibuang karena ambigu.

## Kesalahan paling serius yang sudah dibetulkan

- Sains:
  - Kunci label menaruh penguin di gambar Arktik (`s2.habitats.020`).
  - Aturan getaran penggaris salah (`s4.pitch-and-volume.022`).
  - "Tanah memberi tumbuhan makanan" (`s2.rocks-soil.025`).
  - "Gelap di malam hari karena Matahari jauh" (`s2.light-dark.017`).
  - "Tarikan Matahari lebih lemah dari Bulan" (bacaan pasang surut kelas 3).
  - "Gesekan selalu melawan arah gerak" (`s5.friction-resistance.001`).
- Bahasa:
  - "Kata pendek bervokal satu menggandakan huruf terakhir", padahal jump tidak (`e2.past-tense-ed`).
  - "i before e except after c" tanpa batas (`e5.editing-proofreading`).
  - "until dark" disebut klausa (`e5.complex-sentences.018`).
  - Kalimat "The boy ran quickly home" punya dua adverb (`e5.adverbs-phrases.901`).
- Matematika:
  - Label alas dan sisi miring segitiga tertukar (`m6.area-triangles`).
  - Aturan 24 jam membuat 12:30 siang menjadi 24:30 (`m4.time-24-hour`, `m5.time-24-hour`).
  - Dua jawaban sah di `m2.oly-coding.027` dan `.046`.
  - "Hitung segitiga di gambar" dengan gambar polos (`m3.oly-geometry.008`); sepuluh gambar lain ikut dilengkapi.
  - Warna di kata tidak sama dengan warna di gambar (`m3.oly-patterns.001`, `.006`, `m1.oly-patterns.002`).
  - 9.67 disebut mean, padahal mean-nya 9 (`m6.averages.003`).
- Kejujuran:
  - Program 8 minggu menjanjikan "paper asli", sekarang "paper latihan bergaya lomba".
  - Nama satu anak dihapus dari catatan program.
  - Empat judul simulasi ditambah kata "practice".
  - Tidak ada soal yang mengaku berasal dari kertas lomba asli. Kemiripan dengan soal lomba klasik tidak bisa dibuktikan tanpa membandingkan dengan kertas aslinya.

## Yang dibaca penuh dan yang tidak

Dibaca penuh:
- Semua pelajaran, bacaan, dan soal tertulis.
- 3 program, 16 lomba, 12 preset, 84 aktivitas orang tua.
- Fakta Quiz Arena: negara, provinsi, hewan, tubuh, antariksa, dinosaurus, tokoh, tempat, alat musik. Tidak ada fakta salah. Dua kata kecil tercatat, tidak diubah karena berada di kode.

Hanya sebagian atau tidak dibaca:
- Teks generator hanya satu contoh per generator, sedangkan 157.200 contoh dihitung ulang dengan skrip.
- Banyak gambar Science dan English dinilai dari teks alternatifnya.
- Fakta lomba tidak bisa dicek tanpa internet. Berkasnya menandai yang belum pasti dengan `verified: false`.
- Kartu kata lain dan gambar bendera tidak dibaca ulang.
- Semua fakta dinilai dari pengetahuan pemeriksa, tanpa web.

## Hal terbuka

- Templat generator punya sekitar 60 pola bahasa keliru, seperti "1 ones", "A octagon", "Not Not even". Daftarnya di `generator-kata.txt`.
- 175 contoh jawaban menulis lebih pendek dari `minWords`.
- `m6.graphs-charts` butuh jenis gambar grafik garis, yang perlu perubahan aplikasi.
- 11 soal pilihan bergambar yang diacak masih menampilkan huruf saja sesudah tambalan.
- Quiz Arena: "toward" seharusnya "towards", dan Ha Long Bay punya sekitar 2.000 pulau, bukan "thousands".

## Catatan kelas

66 catatan, semuanya di rincian dan hampir semua dibiarkan di tempatnya. Pola utama:
- Pelajaran Flyers di kelas 5 dan 6 terlalu mudah.
- Sebagian soal English kelas 1 sampai 3 punya `difficulty` yang naik menurut urutan, bukan menurut kesulitan.
- Beberapa soal Math kelas 5 dan 6 serta Science kelas 6 di atas tahap Cambridge.
