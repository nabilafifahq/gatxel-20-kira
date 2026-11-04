# Kamus Ketuk

Kamus English ke Indonesia untuk layar learner (`<TapWords>`), kata pribadi (tabel `saved_word`, migrasi 0019), dan klip suara satu kata.

## Data

- Sumber kebenaran: `content/dictionary/en-id.json` (4.942 entri, 3.880 bentuk jadian). Validasi ada di `pnpm content:check`.
- Isi: kata dari seluruh soal, pelajaran, dan bacaan di `content/`, diubah ke bentuk dasar. Tiap entri: `i` (arti Indonesia, paling banyak 3), `e` (arti English sederhana), `p` (jenis kata), `g` (kelas terendah yang memuat kata itu). Nama orang, angka, dan salah ketik tidak dimasukkan.
- Bentuk dasar dan bentuk jadian (ran, mice, happier) memakai data Wiktionary lewat Wiktextract (kaikki.org), lisensi CC BY-SA 4.0. Atribusi ada di `meta.attribution` dan wajib ada (dicek `content:check`). Arti Indonesia dan arti English ditulis untuk anak SD, bukan disalin dari Wiktionary.
- Perbaikan tangan hasil pemeriksaan sampel: `scripts/dictionary/overrides.json`.

## Membangun ulang

1. `node scripts/dictionary/extract-vocab.mjs . vocab-raw.json`
2. Unduh dump Kaikki bahasa Inggris, lalu `node scripts/dictionary/kaikki-candidates.mjs kaikki.jsonl vocab-raw.json cand.json`
3. `node scripts/dictionary/lemmatise.mjs vocab-raw.json cand.json lemmas.json`
4. Tulis arti per kata (format TSV di `scripts/dictionary/glosses/`), lalu `node scripts/dictionary/assemble.mjs scripts/dictionary/lemmas.json scripts/dictionary/glosses content/dictionary/en-id.json`
5. `node scripts/dictionary/publish.mjs .` menyalin berkas ringkas ke `apps/web/public/dict/en-id.<hash>.json` dan menulis `dictionary-file.ts`.

## Aturan pemakaian

`<TapWords>` hanya di Latihan, Pelajaran, dan bacaan. Mati di Tes berwaktu, Paper, dan Simulasi, di skill kosakata dan ejaan (`NO_LOOKUP_SKILLS` di `packages/core/src/dictionary.ts`), dan di soal yang menanyakan arti kata. Saklar fitur `dictionary` per learner.
