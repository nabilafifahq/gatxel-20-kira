# DESIGN.md

Proyek: Kira. Versi 0.2, 12 Oktober 2026. Pemilik: Nabila.
Setiap warna, font, radius, jarak, bayangan, dan kurva easing di kode merujuk token di file ini. Token yang sama ada di `apps/web/src/app/globals.css` (blok `@theme`) dan `packages/figures/src/palette.ts`, dan diperiksa oleh `scripts/check-copy.mjs` (hex di luar daftar ini ditolak).

Perubahan dari 0.1: skala jenjang kelas 1 sampai 6 (bagian 3a), token `--review`, fokus learner dan konsol dipisah, komponen dibangun dengan elemen HTML asli tanpa pustaka komponen.

## 1. What this is

**Product:** Website belajar harian Math, English, Science untuk anak SD kelas 1 sampai 6 (kurikulum Cambridge Primary), dengan konsol tutor dan halaman orang tua. Berjalan di server rumah, diakses lewat Tailscale.
**Who uses it:** Syakira (Grade 2) di tablet sepulang sekolah, 45 sampai 60 menit sehari. Nabila sebagai tutor di laptop dan HP. Mama di HP untuk laporan dan persetujuan. Sepupu lain bisa ditambahkan sebagai learner berikutnya.
**The one action:** learner menyelesaikan tiga Daily Quest hari ini tanpa dibantu.
**Language:** layar learner en-GB (`<html lang="en-GB">`). Konsol tutor, halaman orang tua, dan halaman hukum id-ID (`<html lang="id">`). Soal ESMO Math boleh berbahasa Indonesia dengan tombol Terms.

## 2. The aesthetic

**Direction:** buku latihan yang hidup. Permukaan putih seperti kertas di atas kanvas biru keabuan yang dingin, garis tinta tegas, pill nomor soal dan aksen mapel yang sama dengan kertas cetak. Ilustrasi datar bergaris tinta 2px. Area kerja Math boleh memakai pola kertas berpetak 8px.
**One strong decision per screen:**
- Today: perhentian quest yang aktif dua kali lebih besar dari dua lainnya.
- Runner: teks soal dengan font baca Andika; elemen lain tenang.
- Hasil: skor dalam Mohave 64px.
- Konsol tutor: daftar Perlu perhatian di paling atas, sebelum angka apa pun.
**Explicitly not this:** gradien ungu ke indigo, palet krem atau beige, strip warna di sisi kiri kartu, ikon di atas judul kartu, tiga kartu identik sejajar, baris metrik besar di hero, label kicker, emoji sebagai ikon atau navigasi, glassmorphism, easing memantul, titik berdenyut, ikon api untuk streak, hati atau nyawa, maskot burung hijau, konfeti di setiap jawaban benar, suara yang tidak bisa dimatikan.

## 3. Type

| Token | Value | Used for |
|---|---|---|
| `--font-body` | Plus Jakarta Sans, Segoe UI, system-ui, sans-serif | UI, tombol, konsol tutor |
| `--font-reading` | Andika, Verdana, sans-serif | Teks soal dan bacaan di layar learner |
| `--font-display` | Mohave, Arial Narrow, sans-serif | Skor, timer, angka streak, judul pendek |

Override: teks soal memakai Andika karena dirancang SIL untuk pembaca pemula (a dan g satu tingkat, I, l, dan 1 mudah dibedakan). Semua font berlisensi OFL dan di-host sendiri lewat `@fontsource`, tanpa permintaan ke Google Fonts.

| Token | Size / line-height | Used for |
|---|---|---|
| `--text-display` | 64 / 68, Mohave 600 | Skor di halaman hasil |
| `--text-h1` | 32 / 40, 700 | Judul layar |
| `--text-h2` | 24 / 32, 700 | Judul bagian, judul quest aktif |
| `--text-question` | per jenjang, lihat 3a | Teks soal (Andika) |
| `--text-body-lg` | 18 / 29 | Isi di layar learner |
| `--text-body` | 16 / 26 | Isi di konsol tutor |
| `--text-small` | 14 / 22 | Keterangan; tidak dipakai di layar learner |

Angka di tabel, timer, dan skor memakai `font-variant-numeric: tabular-nums`.

## 3a. Skala jenjang

Atribut `data-jenjang` di root layar learner, diturunkan dari grade learner. Warna, radius, gerak, dan suara sama di semua jenjang; yang berubah hanya ukuran dan kepadatan isi.

| Token atau aturan | Kelas 1-2 | Kelas 3-4 | Kelas 5-6 |
|---|---|---|---|
| Atribut | `data-jenjang="1-2"` | `data-jenjang="3-4"` | `data-jenjang="5-6"` |
| `--text-question` | clamp(22px, 1.1rem + 0.8vw, 26px) / 1.5 | clamp(20px, 1rem + 0.6vw, 24px) / 1.5 | clamp(18px, 0.95rem + 0.5vw, 22px) / 1.5 |
| `--measure-question` | 60ch | 66ch | 72ch |
| Kata per baris instruksi | paling banyak 12 | paling banyak 16 | paling banyak 20 |
| Figur | hampir di setiap soal | saat soal membutuhkan | diagram, tabel, grafik |
| Kotak kerja | tidak ada | opsional | ada di soal uraian |
| Target sentuh | 44px, ubin jawaban 56px | sama | sama |

## 4. Color

| Token | Value | Used for |
|---|---|---|
| `--bg` | #F5F8FC | Kanvas |
| `--surface` | #FFFFFF | Kartu, area soal |
| `--fg` | #14202E | Teks utama, 15:1 |
| `--fg-muted` | #4A5A6E | Teks sekunder, 6,6:1 |
| `--border` | #7A8899 | Batas kontrol dan ubin jawaban, 3,4:1 |
| `--divider` | #D3DCE6 | Garis pemisah dekoratif saja |
| `--math` | #1F6FB2 | Aksen Math, 5,0:1 |
| `--english` | #B4442F | Aksen English, 5,2:1 |
| `--science` | #2E7D4F | Aksen Science, 4,7:1 |
| `--math-50` | #E7F0F9 | Latar tipis Math |
| `--english-50` | #FAECE8 | Latar tipis English |
| `--science-50` | #E7F3EC | Latar tipis Science |
| `--mental` | #7A3EB0 | Aksen Quick Maths dan XP Hitung Cepat (ungu), 6,7:1 di atas putih, 5,7:1 di atas `--mental-50` |
| `--knowledge` | #27409E | Aksen Quiz Arena dan XP Pengetahuan (biru tua), 9,1:1 di atas putih, 7,7:1 di atas `--knowledge-50`; berbeda dari `--math` (selisih warna 30 pada CIELAB) |
| `--mental-50` | #F2EAF8 | Latar tipis Quick Maths |
| `--knowledge-50` | #E8ECF9 | Latar tipis Quiz Arena |
| `--accent` | var(--math) | Fokus dan tautan di konsol |
| `--success` | #2E7D4F | Correct, selalu dengan ikon centang dan teks |
| `--warn` | #B54708 | Not yet, selalu dengan ikon dan teks, 5,1:1 |
| `--warn-50` | #FDF1E7 | Latar tipis Not yet |
| `--star` | #F2B10E | Isi bintang dan rantai streak; tidak untuk teks |
| `--danger` | #B42318 | Aksi hapus dan error di konsol, 6,2:1 |
| `--danger-50` | #FCEBEA | Latar tipis error |
| `--review` | #A3B1C2 | Skill perlu review di peta panas, selalu dengan teks |

Tiga jalur XP punya warna bar sendiri: XP Belajar memakai `--star`, XP Hitung Cepat memakai `--mental`, XP Pengetahuan memakai `--knowledge`. Warna selalu ditemani label dan angka level, tidak pernah menjadi satu-satunya penanda. `--mental` dan `--knowledge` dipakai untuk teks, garis, dan isi tombol (teks putih di atasnya lolos 4,5:1); `--mental-50` dan `--knowledge-50` hanya latar. Kontras dan jarak warna dijaga oleh `packages/figures/test/arena-tokens.test.ts`.

Dark mode: tidak di v1. Setiap tema tambahan menggandakan uji kontras.

## 5. Shape and space

| Token | Value |
|---|---|
| `--radius-card` | 16px |
| `--radius-control` | 12px |
| `--radius-pill` | 9999px, hanya chip dan pill nomor soal |
| `--space-base` | 4px |

Ritme: 8 di dalam baris, 16 antarblok, 24 di dalam kartu, 48 antarbagian layar.
Elevation: border, tanpa bayangan (`--shadow-1: none`). Kartu 1px `--divider`, ubin jawaban 2px `--border`, ubin terpilih 3px warna mapel.
Fokus: layar learner outline 3px `--fg` jarak 2px; konsol outline 3px `--accent` jarak 2px. Elemen fokus tidak tertutup header lengket (`scroll-margin-top` sama dengan tinggi header).

## 6. Motion

| Token | Value |
|---|---|
| `--ease` | cubic-bezier(0.25, 1, 0.5, 1) |
| `--duration-fast` | 150ms |
| `--duration-base` | 240ms |
| `--duration-celebrate` | 900ms, hanya saat quest selesai, bisa dilewati |

Hanya `transform` dan `opacity`. Dengan `prefers-reduced-motion: reduce` semua menjadi crossfade 120ms, dan SolutionPlayer menampilkan langkah satu per satu dengan tombol Next.

## 7. Voice

**Tone:** hangat, singkat, spesifik. Tidak pernah menyindir atau membuat anak merasa bersalah.
**Person:** English untuk learner dengan you. Indonesia untuk tutor dan orang tua dengan kamu, sebisa mungkin tanpa kata ganti.
**Button style:** kata kerja di depan, sentence case: Check, Next, Show me how, Simpan rencana, Kirim laporan.

Instruksi learner mengikuti batas kata per jenjang. Jawaban yang salah ditulis Not yet. Pesan error menyebut apa yang terjadi, apa yang harus dilakukan, dan kode referensi.

## 8. Component library

Locked to: komponen sendiri di `apps/web/src/components`, dibangun dari elemen HTML asli (`button`, `dialog`, `input`) dengan Tailwind v4. Tanpa shadcn/ui dan tanpa pustaka komponen lain. Ikon digambar sendiri di `components/icons.tsx` dengan gaya garis 2px yang sama dengan desain. Ikon mapel dan avatar hewan mengikuti gaya ilustrasi yang sama.

Interaksi seret di widget selalu punya alternatif ketuk: ketuk kartu, lalu ketuk tempatnya. Versi 1 memakai ketuk saja.

## 9. Page structures in use

- Today: header dengan avatar, sapaan, rantai bintang streak; quest aktif besar, dua quest lain kecil; quest bonus; lomba berikutnya di bawah.
- Runner: bar atas (keluar, progres bersegmen, timer bila ada), area soal, area jawaban, bar bawah (hint, baca suara, Check). Tablet landscape: figur di kiri, jawaban di kanan.
- Hasil dan pembahasan: skor, lalu daftar soal; setiap soal membuka jawaban learner, kunci, penjelasan, dan SolutionPlayer.
- Konsol tutor: Perlu perhatian, status hari ini per mapel, tren mingguan.
- Halaman cetak: header paper, petunjuk, bagian soal, footer kode dan nomor halaman.

## 10. Required states

Every interactive element ships: default, hover, focus (visible, 3:1), active, disabled, loading.
Every data region ships: loading, empty, partial, error, success.
Khusus runner: offline, sinkron tertunda, sisa waktu 1 menit, waktu habis.

## 11. Responsive floor

Tested with no horizontal scroll and no text overflow at: 320, 375, 414, 768, 820, 1180, 1280. Komponen memakai container query bila ukurannya bergantung pada wadah.

## 12. Accessibility floor

WCAG 2.2 AA. Body 4.5:1, large text and UI borders 3:1. Target 44px di layar learner dan 24px di konsol; ubin jawaban minimal 56px tinggi. Keyboard operable, focus never obscured by a sticky header, `autocomplete` set, paste never blocked. Setiap soal punya tombol baca suara, setiap widget seret punya alternatif ketuk, setiap video ber-caption.
