# Laporan terjemahan penjelasan ke bahasa Indonesia

Permintaan pemilik: setiap penjelasan di pelajaran dan pembahasan bisa dibaca dalam bahasa Indonesia, dengan suara Indonesia, karena tidak semua anak bisa belajar penuh dalam bahasa Inggris.

## Cara kerja

- Isi bahasa Inggris tidak berubah. Terjemahan ada di `content/translations/id/<mapel>/g<kelas>/<berkas>.json`, kuncinya hash dari teks Inggris yang persis. Teks Inggris yang berubah otomatis kembali ke bahasa Inggris dan tercatat usang di `pnpm content:check`.
- `content/translations/id/_shared.json`: kalimat tetap buatan kode untuk langkah pembahasan turunan.
- `content/translations/id/_generator.json`: pola teks generator, angka diganti `{0}`, `{1}`. Kata lain harus sama persis, jadi teks generator di luar pola tetap bahasa Inggris dan tombolnya tersembunyi.
- Terjemahan penjelasan soal hanya ikut bersama kunci (`reveal`), jadi mode berwaktu (Tes, paper, boss, penempatan) tidak menerimanya sebelum dikumpulkan.
- Tombol: `Terjemahkan` di tampilan Indonesia, `Bahasa Indonesia` di tampilan Inggris. Pilihan diingat per anak di perangkat itu. Setelan orang tua `Tampilkan penjelasan dalam bahasa Indonesia lebih dulu` mengubah bawaannya (migrasi 0033).
- Suara: teks Indonesia hanya klip peran `indonesian` dengan versi `id-piper1`. Penunjuknya `tts/served-id-version.txt`, terpisah dari `served-version.txt` bahasa Inggris. Tanpa penunjuk atau tanpa klip tombol suara tersembunyi. Tidak ada suara perangkat.

## Proses penerjemahan

Tiap batch diterjemahkan satu pembantu, lalu dibaca pembantu kedua yang membandingkan makna dengan sumber dan menjalankan Hunspell `id_ID`. Pemeriksa mesin menolak teks kosong dan tanda pisah panjang, dan menandai angka yang berubah, jumlah kalimat yang berbeda, dan kutipan yang hilang.

Penerjemah bekerja dengan alat di `packages/content/scripts/translations.ts`: `extract`, `extract-templates`, `validate`, `merge`, `report`. Hanya batch yang sudah dibaca pembaca kedua yang masuk ke repo.

## Hitungan

Lihat `pnpm content:check`, baris `Terjemahan id`, untuk angka terbaru.

| Tahap | Batch | Teks unik | Kata sumber | Perbaikan pembaca kedua |
|---|---|---|---|---|
| Pelajaran, semua kelas | 20 | 1.856 | 24.919 | 29 |

## Menyalakan suara

```powershell
robocopy C:\kw4\tts-id\tts C:\Kira\data\tts *.mp3 manifest-id-piper1.jsonl /XO /MT:8 /R:1 /W:1 /NFL /NDL
pnpm.cmd tts:promote-id -- --data-dir C:\Kira\data --report C:\kw4\tts-id\tts-id-report.csv
```

Perintah kedua hanya menulis `served-id-version.txt`. `served-version.txt` dan `manifest.jsonl` tidak disentuh. Klip tambahan cukup disalin lagi dengan perintah pertama.

## Yang belum tercakup

- Teks soal dan jawaban sengaja tetap bahasa Inggris. Hint tidak diterjemahkan.
- Quiz Arena, English Skills, Ruang Baca, dan kartu belajar punya teks sendiri di luar cakupan ini.
- Langkah pembahasan turunan dari penjelasan yang punya beberapa kalimat tidak punya klip suara per kalimat, jadi pemutarnya diam saat bahasa Indonesia aktif, sama seperti langkah turunan bahasa Inggris.
