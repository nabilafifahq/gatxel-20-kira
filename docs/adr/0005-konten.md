# ADR 0005: Konten di repo, generator Math, dan soal privat org

Status: diterima, 12 Oktober 2026.

## Keputusan

- Peta skill Grade 1 sampai 6 per mapel mengikuti strand kurikulum Cambridge Primary (Mathematics 0096, English 0058, Science 0097). Kode skill adalah kode Kira sendiri, bukan kode resmi Cambridge.
- Soal Math dihasilkan generator deterministik per skill (seed dan tingkat kesulitan), jadi latihan tidak pernah habis dan kuncinya dihitung, bukan diketik.
- Soal English, Science, dan olimpiade Math ditulis tangan sebagai JSON, divalidasi Zod dan `content:check`.
- Paket resmi lomba (misalnya ESMO) tidak masuk repo. Paket milik keluarga diimpor dari konsol dan disimpan sebagai soal privat org.
- Preset lomba punya status terverifikasi atau belum. Skor kesiapan hanya memakai preset terverifikasi.
