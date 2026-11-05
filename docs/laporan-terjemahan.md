# Laporan terjemahan penjelasan ke bahasa Indonesia

Permintaan pemilik: setiap penjelasan di pelajaran dan pembahasan bisa dibaca dalam bahasa Indonesia, dengan suara Indonesia, karena tidak semua anak bisa belajar penuh dalam bahasa Inggris.

## Cara kerja

- Isi bahasa Inggris tidak berubah. Terjemahan ada di `content/translations/id/<mapel>/g<kelas>/<berkas>.json`, kuncinya hash dari teks Inggris yang persis. Teks Inggris yang berubah otomatis kembali ke bahasa Inggris dan tercatat usang di `pnpm content:check`.
- `content/translations/id/_shared.json`: kalimat tetap buatan kode untuk langkah pembahasan turunan.
- `content/translations/id/_generator.json`: pola teks generator, angka diganti `{0}`, `{1}`. Kata lain harus sama persis, jadi teks generator di luar pola tetap bahasa Inggris dan tombolnya tersembunyi.
- Terjemahan penjelasan soal hanya ikut bersama kunci (`reveal`), jadi mode berwaktu (Tes, paper, boss, penempatan) tidak menerimanya sebelum dikumpulkan.
- Tombol: `Terjemahkan` di tampilan Indonesia, `Bahasa Indonesia` di tampilan Inggris. Pilihan diingat per anak di perangkat itu. Setelan orang tua `Tampilkan penjelasan dalam bahasa Indonesia lebih dulu` mengubah bawaannya (migrasi 0034).
- Suara per langkah. Terjemahan yang memuat kata Inggris di luar kurung tidak dibuatkan klip (`content/translations/id/_voice-held.json`, dibuat `translations.ts voice-held`), karena suara Indonesia membacanya dengan bunyi Indonesia. Tombol suara hanya tersembunyi pada langkah itu. Istilah Inggris di dalam kurung tetap tampil tetapi tidak dibacakan. Suara tidak pernah berganti di tengah bacaan.
- Suara: teks Indonesia hanya klip peran `indonesian` dengan versi `id-piper1`. Penunjuknya `tts/served-id-version.txt`, terpisah dari `served-version.txt` bahasa Inggris. Tanpa penunjuk atau tanpa klip tombol suara tersembunyi. Tidak ada suara perangkat.

## Proses penerjemahan

Tiap batch diterjemahkan satu pembantu, lalu dibaca pembantu kedua yang membandingkan makna dengan sumber dan menjalankan Hunspell `id_ID`. Pemeriksa mesin menolak teks kosong dan tanda pisah panjang, dan menandai angka yang berubah, jumlah kalimat yang berbeda, dan kutipan yang hilang.

Penerjemah bekerja dengan alat di `packages/content/scripts/translations.ts`: `extract`, `extract-templates`, `validate`, `merge`, `report`. Hanya batch yang sudah dibaca pembaca kedua yang masuk ke repo.

## Hitungan

Lihat `pnpm content:check`, baris `Terjemahan id`, untuk angka terbaru.

| Tahap | Batch | Teks unik | Kata sumber | Perbaikan pembaca kedua |
|---|---|---|---|---|
| Pelajaran, semua kelas | 20 | 1.856 | 24.919 | 29 |
| Penjelasan dan langkah, kelas 1 sampai 3 | 34 | 6.491 | 86.703 | 135 |
| Penjelasan dan langkah, kelas 4 sampai 6 | 33 | 5.387 | 88.942 | 66 |
| Alasan jawaban dan tip | 37 | 10.926 | 88.427 | 53 |
| Pola teks generator | 10 | 2.974 | 28.542 | 77 |

Teks tertulis: pelajaran 1.957, penjelasan 9.856, alasan jawaban 11.945, langkah bawaan 2.391, tip 7. Semuanya punya terjemahan dan tidak ada yang usang.

Teks generator: 2.974 pola yang dipakai mencakup 81,7% penjelasan generator pada sampel 40 benih per tingkat. Sisanya tetap bahasa Inggris dan tombolnya tersembunyi. Pola bisa ditambah dengan `extract-templates --share`.

Terjemahan yang ditahan dari suara, per teks unik: English 5.803 dari 9.440, Matematika 513 dari 7.304, Sains 402 dari 7.755. Per langkah pelajaran: English 247 dari 626, Matematika 49 dari 826, Sains 9 dari 505. Pelajaran yang semua langkahnya bersuara: English 25 dari 124, Matematika 149 dari 172, Sains 81 dari 90.

Klip: 17.791 di `C:\kw4\tts-id\tts`, 620 MB. Gerbang kekerasan suara dan clipping: 17.791 lulus, 0 gagal, laporan `C:\kw4\tts-id\tts-id-report.csv`. Whisper bahasa Indonesia pada 60 klip acak: kecocokan rata-rata 0,81. Nilai rendah sebagian besar karena Whisper menulis angka dengan cara lain. Belum ada manusia yang mendengarkan seluruh set; 10 contoh ada di `C:\kw4\samples\id`.

## Temuan pada teks Inggris sumber

Isi bahasa Inggris tidak diubah. Dua hal perlu dibaca penulis konten:

- Penjelasan soal `bubble`: "In bubble you pronounce both b letters", padahal `bubble` punya tiga huruf b.
- Langkah pembahasan Matematika kelas 6, soal rata-rata lima bilangan: "Not 4. You subtracted 20 from the mean.", padahal 12 - 20 bukan 4.

## Menyalakan suara

```powershell
robocopy C:\kw4\tts-id\tts C:\Kira\data\tts *.mp3 /XO /MT:8 /R:1 /W:1 /NFL /NDL
Copy-Item C:\kw4\tts-id\tahap2\manifest-id-piper1.jsonl C:\Kira\data\tts\manifest-id-piper1.jsonl -Force
pnpm.cmd tts:promote-id --data-dir C:\Kira\data --report C:\kw4\tts-id\tts-id-report.csv
```

Perintah terakhir hanya menulis `served-id-version.txt`. `served-version.txt` dan `manifest.jsonl` tidak disentuh. Klip tambahan cukup disalin lagi dengan perintah pertama. Daftar di `tahap2` dibekukan bersama laporan gerbangnya, jadi promosi tetap sah walaupun pembuatan klip masih berjalan.

## Yang belum tercakup

- Teks soal dan jawaban sengaja tetap bahasa Inggris. Hint tidak diterjemahkan.
- Quiz Arena, English Skills, Ruang Baca, dan kartu belajar punya teks sendiri di luar cakupan ini.
- Teks generator tidak punya klip suara, jadi soal generator tidak punya suara Indonesia.
- Langkah pembahasan turunan dari penjelasan yang punya beberapa kalimat tidak punya klip suara per kalimat, jadi pemutarnya diam saat bahasa Indonesia aktif, sama seperti langkah turunan bahasa Inggris.
