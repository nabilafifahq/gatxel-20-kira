# Panduan membangun layar Kira

Untuk siapa pun yang membangun komponen dan layar di `apps/web`. Desain acuan ada di Claude Design (proyek Kira, 136 papan). Salinan HTML papan untuk dibaca ada di folder papan (lihat bagian 2). Kontrak data ada di `apps/web/src/lib/dto.ts`.

## 1. Pembagian kerja

- Layar (screen) di `apps/web/src/screens/<area>/<Nama>Screen.tsx` menerima satu DTO dan action lewat props, persis seperti tipe di `dto.ts`. Layar tidak mengambil data sendiri, tidak mengimpor apa pun dari `src/server`, dan tidak memanggil `fetch`.
- Komponen yang dipakai ulang di `apps/web/src/components/<ui|learner|widgets|console|family|print>/`.
- Halaman (`src/app/.../page.tsx`), Server Action, DAL, dan auth dibangun terpisah dan memasok DTO ke layar.
- Pratinjau: setiap layar punya fixture di `apps/web/src/dev/fixtures/` (data contoh realistis, beri komentar `// __GTX_SEED__`) dan halaman pratinjau di `apps/web/src/app/(dev)/dev/...`. Action di pratinjau adalah fungsi palsu yang mengembalikan `{ ok: true, data }` setelah jeda pendek, atau error dengan `reference: 'DEV-0001'` untuk menguji state error.

## 2. Papan desain

Folder papan: `/tmp/claude-0/-home-claude/b5252bcb-70a8-54a4-ae89-960ce3f6ef61/scratchpad/artifact-files/ebf00259-dec1-44a8-9d3b-2c01a15e370e/project/` (beberapa papan token ada di `.../scratchpad/servercheck/project/`). Setiap papan `.dc.html` berisi markup dengan gaya inline dan skrip `renderVals()` berisi data contoh dan state. Baca papan untuk tata letak, ukuran, warna, teks, label aksesibilitas, dan state. Papan tidak bisa dirender di luar Claude Design (support.js tidak ada), jadi bandingkan dengan membaca gaya inline-nya.

| Layar | Papan |
|---|---|
| Today (L02) | TodayA (arah terpilih), TodayAHP, TodayAHariPertama, TodayASatuSelesai, TodayASemuaSelesai, TodayAIstirahat, TodayABatasWaktu (state memakai TodayA dengan props) |
| Masuk anak (L01), pilih learner (L18) | MasukAnak, MasukAnakSalah, MasukAnakTerkunci, PilihLearner, PilihLearnerBatas |
| Pembuka quest (L03) | PembukaQuest, PembukaQuestBelum |
| Runner dan umpan balik (L04, L05) | Runner, RunnerHP, RunnerDiketik, RunnerCorrect, RunnerNotYet, RunnerOffline, RunnerGambar, RunnerUrutkan, RunnerJodohkan |
| Tes berwaktu (L06) | RunnerMingguan, RunnerMingguanSatuMenit, RunnerMingguanHabis, RunnerMingguanKumpul, RunnerTes |
| Hasil dan pembahasan (L07, L08) | Hasil, HasilPenuh, HasilRendah, Pembahasan, PembahasanDiputar, PembahasanReduced |
| Selesai hari ini (L14) | SelesaiHariIni, SelesaiBatasWaktu |
| Peta dan Me (L09, L10) | PetaBelajar, Me, MeBaru |
| Buku Koreksi, Pelajaran, Simulator (L11 sampai L13) | BukuKoreksi, BukuKoreksiHP, BukuKoreksiKosong, BukuKoreksiSesi, Pelajaran, PelajaranCek, SimulatorPilih, SimulatorInstruksi, SimulatorBelumVerifikasi, SimulatorRunner, SimulatorRunnerSasmo |
| ESMO (L15 sampai L17, T12) | PaketEsmo, PaketEsmoBaru, RunnerEsmoSimulasi, RunnerEsmoTerms, RunnerEsmoSatuMenit, RunnerEsmoHabis, RunnerEsmoKumpul, HasilEsmo, HasilEsmoBawah70, ImporPaket |
| Widget Fase 3 | RunnerBicara, RunnerBicaraIzin, RunnerBicaraRekam, RunnerBicaraDengar, RunnerMenggambar, RunnerMenggambarTerkirim, RunnerMenulis |
| Konsol tutor | TutorHariIni, TutorHariIniHP, TutorHariIniSebagian, TutorHariIniError, DetailLearner, Perencana, PenyusunPaper, KotakHasil, KotakHasilHP, KotakHasilSelesai, KotakHasilFase3, KotakHasilSaranAi, InputLjk, BankSoal, BankSoalKosong, KalenderLomba, Laporan, Pengaturan, PengaturanCabut, StudioAi, StudioAiBatas, LearnerGrade, LearnerGradeTambah, KoneksiClaude, KoneksiClaudeBelum |
| Orang tua | RingkasanMinggu, RingkasanMingguPertama, PrivasiKeluarga, PrivasiKeluargaDitarik, PrivasiKeluargaFase3, EmailLaporan |
| Publik | MasukDewasa, MasukDewasaTerkunci, HalamanError, HalamanError500, HalamanErrorOffline, Privasi, Ketentuan |
| Cetak | PaperA4Hal1, PaperA4Hal2, PaperA4Kunci, LjkA4 |
| Komponen | AnswerTile, BadgeTile, Button, DataTable, EmptyState, FeedbackSheet, FigureFrame, HintStack, LjkGrid, MasteryHeatmap, NumericKeypad, ProgressSegments, QuestStop, ReadAloudButton, SolutionPlayer, StreakChain, SubjectChip, Timer, Toast, WeekPlannerGrid, Main (warna), Tipe, Jenjang, BentukGerak |

Desain menyebut Syakira sebagai contoh. Di kode, nama selalu dari DTO.

## 3. Gaya

- Token Tailwind dari `apps/web/src/app/globals.css`: warna `bg-bg bg-surface text-fg text-fg-muted border-border border-divider bg-math bg-math-50 text-math border-math` (juga `english`, `science`, `success`, `warn`, `warn-50`, `star`, `danger`, `danger-50`, `review`, `white`); teks `text-display text-h1 text-h2 text-h3 text-body-lg text-body text-small`; font `font-body font-reading font-display`; radius `rounded-card rounded-control rounded-pill`; easing `ease-kira`. Teks soal memakai kelas `text-question` (ukuran mengikuti `data-jenjang`).
- Warna utilitas bawaan Tailwind (red-500 dan sejenisnya) sudah dimatikan. Jangan menulis hex di TSX. Nilai arbitrer hanya untuk ukuran tata letak (`grid-cols-[48px_1fr_auto]`, `max-w-[1180px]`).
- Warna mapel per komponen: pakai peta kelas statis, misalnya `{ math: 'text-math', english: 'text-english', science: 'text-science' }`, karena Tailwind hanya membangkitkan kelas yang tertulis utuh.
- Tanpa bayangan. Elevasi dengan border: kartu 1px `border-divider`, ubin jawaban 2px `border-border`, ubin terpilih 3px warna mapel.
- Gerak hanya transform dan opacity, 150ms atau 240ms dengan `ease-kira`. Hormati `prefers-reduced-motion`.
- Ikon UI digambar sendiri di `apps/web/src/components/ui/icons.tsx` (path SVG dari papan). Ikon objek, avatar hewan, dan figur soal dari `@kira/figures` (`Icon`, `Avatar`, `Figure`).

## 4. Aksesibilitas dan perilaku

- Target sentuh 44px di layar learner, ubin jawaban dan tombol utama 56px, keypad 64px. Konsol minimal 24px, tombol utama 44px.
- Semua kontrol bisa dipakai dengan keyboard. Fokus terlihat (sudah diatur global). Dialog memakai `<dialog>` dengan `showModal()`, fokus kembali ke pemicu saat ditutup.
- Status tidak pernah hanya lewat warna: selalu ikon dan teks (Correct, Not yet, Locked, Mastered).
- Umpan balik jawaban diumumkan lewat `role="status"` atau `aria-live="polite"`. Timer mengumumkan sisa 1 menit sekali.
- Widget seret tidak dipakai: semua widget memakai ketuk (ketuk kartu, lalu ketuk tempat) dan keyboard.
- Setiap wilayah data punya state loading, kosong, sebagian, error (dengan kode referensi), dan sukses sesuai papan.
- Paste tidak pernah diblokir. Input memakai `autocomplete` yang tepat dan ukuran huruf minimal 16px.

## 5. Teks

- Learner en-GB, singkat, hangat, kata kerja di depan: Check, Next, Show me how, Try again. Jawaban salah selalu "Not yet".
- Konsol dan orang tua Bahasa Indonesia tanpa kata ganti bila bisa, tombol kata kerja di depan: Simpan rencana, Kirim laporan.
- Tanpa em dash dan en dash. Tanpa kosakata terlarang GTX. Tanpa bingkai antitesis. Pesan error menyebut apa yang terjadi, apa yang harus dilakukan, dan kode referensi.

## 6. Memeriksa hasil

- Dev server berjalan di http://localhost:3000 (jangan dimatikan atau dijalankan ulang; ia memuat ulang otomatis).
- Screenshot: `node scripts/shot.mjs http://localhost:3000/dev/... /tmp/claude-0/-home-claude/b5252bcb-70a8-54a4-ae89-960ce3f6ef61/scratchpad/<nama>.png 1180 820` lalu buka PNG dengan Read untuk dilihat. Cek juga 390x844 (HP) dan 820x1180 (tablet portrait).
- Typecheck: `cd apps/web && npx tsc --noEmit -p tsconfig.json`.
- Teks: `node scripts/check-copy.mjs` (kalau sudah ada).
