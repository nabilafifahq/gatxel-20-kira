# DESIGN.md

Proyek: Kira. Versi 1.0 (Brand Kit v1.0), November 2026. Pemilik: Nabila.
Setiap warna, font, radius, jarak, bayangan, dan kurva easing di kode merujuk token di file ini. Token yang sama ada di `apps/web/src/app/globals.css` (blok `@theme`) dan `packages/figures/src/palette.ts`, dan diperiksa oleh `scripts/check-copy.mjs` (hex di luar daftar ini ditolak). Sumber visual: papan Brand Kit v1.0 di kanvas desain Kira.

Perubahan dari 0.2: palet enam warna (Kira Lilac, Soft Lavender, Butter Yellow, Sky Blue, Cloud White, Deep Grape), huruf Fredoka, Nunito, dan Baloo 2, kartu putih dengan satu bayangan lembut tanpa garis, radius 20, tombol primary Lilac. Larangan bayangan dan token garis lama dicabut. Aturan aksesibilitas, gerak, dan suara tidak berubah. Papan cetak (paper, kunci, LJK) tetap memakai gaya lama (bagian 4, tabel cetak).

## 1. What this is

**Product:** Website belajar harian Math, English, Science untuk anak SD kelas 1 sampai 6 (mengacu pada kerangka Cambridge Primary), dengan konsol tutor dan halaman orang tua. Berjalan di server rumah, diakses di https://kira.gatxel.com lewat Cloudflare Tunnel.
**Who uses it:** anak SD kelas 1 sampai 6 di tablet dan HP sepulang sekolah, 45 sampai 60 menit sehari. Orang tua di HP untuk laporan dan pengaturan. Tutor di laptop dan HP.
**The one action:** learner menyelesaikan Daily Quest hari ini tanpa dibantu.
**Language:** layar learner en-GB dan Indonesia (`<html lang>` mengikuti pilihan). Konsol tutor, halaman orang tua, dan halaman hukum id-ID. Soal ESMO Math boleh berbahasa Indonesia dengan tombol Terms.

## 2. The aesthetic

**Direction:** teman belajar kecil yang ajaib. Hangat, ceria, dan tetap tepercaya untuk orang tua. Latar Cloud White, kartu putih dengan bayangan lembut, panel Soft Lavender, garis kontrol Deep Grape 2px, bentuk membulat, ilustrasi datar bergaris Deep Grape 2,5px berujung bulat. Maskot Kira adalah bintang kuning yang ceria; ia muncul di momen penting (sapaan, jawaban benar, quest selesai, layar kosong).
**Kata kunci merek:** suka bermain, ceria, ramah, mudah didekati, penasaran, menyemangati, kreatif.
**One strong decision per screen:**
- Today: perhentian quest yang aktif dua kali lebih besar dari lainnya.
- Runner: teks soal besar dan tenang; elemen lain mengalah.
- Hasil: skor Baloo 2 64px dengan bintang.
- Konsol tutor: daftar Perlu perhatian di paling atas.
**Explicitly not this:** gradien di luar panel utama halaman depan (lihat bagian 4), glassmorphism, tema gelap, warna di luar palet, emoji sebagai ikon atau navigasi, easing memantul, titik berdenyut, ikon api untuk streak, hati atau nyawa, maskot burung hijau, konfeti di setiap jawaban benar, suara yang tidak bisa dimatikan, bayangan lebih dari satu jenis, kartu yang memakai bayangan dan garis sekaligus.

## 3. Type

| Token | Value | Used for |
|---|---|---|
| `--font-display` | Fredoka, Nunito, system-ui, sans-serif | Judul halaman, bagian, kartu, label penting |
| `--font-body` | Nunito, system-ui, sans-serif | Paragraf, navigasi, label form, tombol |
| `--font-reading` | Nunito, system-ui, sans-serif | Teks soal dan bacaan di layar learner |
| `--font-numbers` | Baloo 2, Nunito, system-ui, sans-serif | Skor, poin, XP, progres, timer, angka keypad |

Ketiganya berlisensi SIL OFL 1.1 dan di-host sendiri di `apps/web/public/fonts` (satu berkas variabel Latin per keluarga, lisensi `OFL-*.txt` di folder yang sama). Tanpa permintaan ke Google Fonts.

| Token | Size / line-height | Used for |
|---|---|---|
| `--text-display` | 64 / 68, Baloo 2 | Skor di halaman hasil |
| `--text-h1` | 32 / 40, Fredoka 600 | Judul layar |
| `--text-h2` | 24 / 32, Fredoka 600 | Judul bagian, judul quest aktif |
| `--text-question` | per jenjang, lihat 3a | Teks soal (Nunito) |
| `--text-body-lg` | 18 / 29 | Isi di layar learner |
| `--text-body` | 16 / 26 | Isi di konsol tutor |
| `--text-small` | 14 / 22 | Keterangan; tidak dipakai di layar learner |

Isi minimal 16px, teks soal 19 sampai 26px sesuai jenjang. Angka di tabel, timer, dan skor memakai `font-variant-numeric: tabular-nums`.

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
| Target sentuh | 56px | sama | sama |

## 4. Color

| Token | Value | Used for |
|---|---|---|
| `--color-lilac` | #B99AEF | Tombol primary, sorotan, status aktif, progres belajar, mapel English |
| `--color-lavender` | #E9DDFB | Permukaan kedua, panel, tombol secondary, pemisah |
| `--color-yellow` | #FFE69A | Hadiah, bintang, XP, pencapaian, tombol aksen, mapel Science |
| `--color-sky` | #9DD8F7 | Info, petunjuk, ilustrasi, mapel Math |
| `--color-cloud` (`--color-bg`) | #FFFCF5 | Latar utama aplikasi |
| `--color-surface` | #FFFFFF | Kartu dan input |
| `--color-grape` (`--color-fg`) | #6546A5 | Semua teks, judul, ikon, garis kontrol, cincin fokus |
| `--color-success` | #2E7D4F | Ikon dan garis jawaban benar; teks hijau hanya di atas putih |
| `--color-danger` | #B42318 | Hapus dan error di layar dewasa; bukan untuk jawaban anak |

Alias semantik (semuanya menunjuk ke enam warna di atas): `--fg`, `--fg-muted`, `--border`, `--accent`, `--warn` = Deep Grape; `--divider`, `--math-50`, `--english-50`, `--science-50`, `--mental-50`, `--warn-50` = Soft Lavender; `--knowledge-50` = Sky Blue (panel Quiz Arena, supaya berbeda dari panel Quick Maths yang Lavender); `--math`, `--knowledge`, `--review` = Sky Blue; `--english`, `--mental` = Kira Lilac; `--science`, `--star` = Butter Yellow; `--success-50`, `--danger-50` = putih.

Pasangan kontras (rasio dihitung dari nilai di atas):

| Pasangan | Rasio | Dipakai untuk |
|---|---|---|
| Grape di atas Cloud White | 6,89:1 | Semua teks |
| Grape di atas Soft Lavender | 5,45:1 | Semua teks |
| Grape di atas Butter Yellow | 5,73:1 | Semua teks |
| Grape di atas Sky Blue | 4,57:1 | Semua teks |
| Putih di atas Deep Grape | 7,06:1 | Semua teks |
| Grape di atas Kira Lilac | 3,00:1 | Teks 19px tebal atau 24px ke atas |
| Cloud White di atas Kira Lilac | 2,29:1 | Jangan untuk teks |
| Soft Lavender di atas Cloud White | 1,27:1 | Hanya pemisah, bukan batas kontrol |

Aturan warna: Kira Lilac adalah warna utama merek. Butter Yellow dan Sky Blue hanya aksen, tidak pernah untuk teks. Semua teks, ikon, dan garis kontrol memakai Deep Grape. Status selalu memakai warna, ikon, dan teks sekaligus. Mapel: Math Sky Blue, English Kira Lilac, Science Butter Yellow, selalu dengan ikon dan nama mapel. Not yet memakai ikon, garis putus, dan kalimat penyemangat, tanpa merah. Tanpa gradien di luar panel utama halaman depan, tanpa glassmorphism, tema gelap, atau warna di luar palet.

Gradien merek, permintaan pemilik November 2026, hanya untuk panel utama halaman depan dan layar masuk yang sama: `--gradient-brand` dari `--color-hero-start` #5A3BB0 lewat `--color-hero-mid` #7A4FD6 ke `--color-hero-end` #3D6FC2, kelas `bg-gradient-brand`. Teks di atasnya putih: rasio 7,82:1, 5,36:1, dan 4,94:1, dijaga `apps/web/test/gradient-contrast.test.ts`. Ini juga satu-satunya tempat teks putih di atas warna selain Deep Grape.

Tiga jalur XP: XP Belajar Butter Yellow, XP Hitung Cepat (Quick Maths) Kira Lilac, XP Pengetahuan (Quiz Arena) Sky Blue. Keduanya dibedakan oleh ikon (bolt dan globe), label, dan angka level, tidak pernah oleh warna saja. Kontras dan jarak warna dijaga oleh `packages/figures/test/arena-tokens.test.ts`.

Dark mode: tidak di v1. Setiap tema tambahan menggandakan uji kontras.

**Papan cetak (gaya lama, hanya di bawah `data-area="print"`, berkas `app/cetak/print-legacy.css`).** Kertas dan tinta tetap seperti sebelumnya supaya cetakan tidak berubah:

| Token cetak | Value |
|---|---|
| fg / bg | #14202E / #F5F8FC |
| fg-muted / border / divider | #4A5A6E / #7A8899 / #D3DCE6 |
| math / math-50 | #1F6FB2 / #E7F0F9 |
| english / english-50 | #B4442F / #FAECE8 |
| science (hijau) / science-50 | #2E7D4F / #E7F3EC |
| warn / warn-50 | #B54708 / #FDF1E7 |
| star / review / danger-50 | #F2B10E / #A3B1C2 / #FCEBEA |

## 5. Shape and space

| Token | Value |
|---|---|
| `--radius-sm` | 8px |
| `--radius-md` | 12px (input) |
| `--radius-control` | 16px (tombol, ubin jawaban) |
| `--radius-card` | 20px |
| `--radius-xl` | 24px (wadah besar, lembar umpan balik) |
| `--radius-pill` | 9999px, chip, pill nomor soal, lencana |
| `--shadow-soft` | 0 4px 16px rgba(101, 70, 165, 0.10) |
| `--space-base` | 4px |

Ritme: 8 di dalam baris, 16 antarblok, 24 di dalam kartu, 48 antarbagian layar.
Elevation: satu bayangan saja, `--shadow-soft`. Pilih bayangan atau garis, tidak keduanya. Kartu: putih, bayangan, tanpa garis. Panel: Soft Lavender, tanpa bayangan dan garis. Garis 1px Soft Lavender hanya untuk pemisah dan tabel. Tombol, input, dan ubin jawaban bergaris 2px Deep Grape; terpilih memakai isi Lilac, garis 3px, dan tanda centang.
Fokus: outline 3px Deep Grape berjarak 3px; input menambah lingkar Lilac. Elemen fokus tidak tertutup header lengket (`scroll-margin-top` sama dengan tinggi header).
Tombol: primary Lilac dengan teks Grape 20px tebal dan garis 2px Grape; secondary Lavender; accent Butter Yellow; ghost bergaris bawah; danger putih dengan garis dan teks merah (layar dewasa saja). Tinggi 56px di layar learner, 48px di konsol. State: hover naik 1px, pressed mengecil 3 persen (kelas `kira-press` dan aturan global, mati saat reduced motion), disabled Lavender dengan teks Grape 55 persen.

## 6. Motion

| Token | Value |
|---|---|
| `--ease` | cubic-bezier(0.25, 1, 0.5, 1) |
| `--duration-fast` | 150ms |
| `--duration-base` | 240ms |
| `--duration-celebrate` | 900ms, hanya saat quest selesai, bisa dilewati |

Hanya `transform` dan `opacity`. Dengan `prefers-reduced-motion: reduce` semua menjadi crossfade 120ms, dan SolutionPlayer menampilkan langkah satu per satu dengan tombol Next.

## 6a. Sound, celebration, and timer motion

**Sound.**
- Setiap bunyi di layar learner bisa dimatikan. Tombol Sound on dan Sound off ada di halaman Me, pilihannya disimpan per perangkat, dan semua bunyi (termasuk tik timer) lewat `playSfx` di `components/learner/sfx.ts`, yang selalu memeriksa pilihan itu. Tidak ada jalur lain untuk memutar bunyi.
- Berkas bunyi hanya dari `public/sounds` (semua CC0: Kenney dan OpenGameArt; lisensi tiap berkas dicatat di `LICENSE-sounds.txt`, tiap berkas di bawah 61 KB). Area learner tidak memuat aset dari luar.
- Efek pendek (di bawah 2,6 detik) dan tidak pernah menjadi satu-satunya penanda. Benar dan Not yet tetap ditandai ikon, warna, dan teks. Bunyi Not yet lembut, tidak menghukum.
- Setiap kejadian punya 2 sampai 4 varian yang dipilih acak, tidak pernah sama dua kali berturut-turut (`pickVariant`).
- Musik latar (opsional): tiga lagu tenang berulang, tombol Music di Me, bawaan MATI, volume rendah, dan turun otomatis (ducking) selama bacaan TTS. Musik berhenti saat tab tersembunyi.
- Pilihan tutor (`learner_profile.sound_enabled`, `music_enabled`, diatur di konsol Pengaturan) mengalahkan pilihan perangkat: bila mati, tombol di Me tidak berlaku dan tidak ada bunyi.

**Katalog bunyi** (nama untuk `playSfx(name, { level, stars })`):

| Nama | Varian | Kapan |
|---|---|---|
| `tap` | 4 | Ubin jawaban dan keypad semua widget (satu pembungkus `TapSound` di `Widget`), tombol lain di runner |
| `correct` | 3 | Jawaban benar |
| `notyet` | 3 | Jawaban Not yet |
| `combo` | 2 per tingkat | Benar beruntun: tingkat 1 (3 beruntun), 2 (5), 3 (7), nada naik tiap tingkat |
| `tick`, `timeup` | 2, 3 | Timer 10 detik terakhir, waktu habis |
| `count`, `go` | 2, 2 | Hitung mundur 3, 2, 1, Go sebelum sesi atau ronde berwaktu |
| `complete` | 3 pendek, 3 besar | Akhir sesi: jingle pendek untuk 1 sampai 2 bintang, jingle besar (`big`) untuk 3 bintang |
| `levelup` | 3 | Naik level |
| `badge` | 3 | Lencana baru |
| `chest` | 3 | Peti hadiah harian dibuka |
| `whoosh` | 3 | Pindah layar, sangat pelan (gain 0,22) |
| `flag` | 2 | Kartu bendera di Quiz Arena |
| `quiz` | 2 | Tiga benar beruntun di Quiz Arena |

**Celebration.**
- Confetti, bunyi sesi selesai, dan lompatan avatar hanya di akhir sesi (halaman hasil), sekali untuk tiap sesi, dan tidak pernah di setiap jawaban benar.
- Bintang 1 sampai 3 dari bagian soal yang benar: 90 persen ke atas 3 bintang, 60 persen ke atas 2 bintang, selain itu 1 bintang. Confetti hanya untuk 2 bintang ke atas.
- Confetti digambar di kanvas sendiri, sekitar 2,6 detik, tidak menangkap sentuhan, warnanya dari token. Bar XP terisi dengan `--duration-celebrate`.
- Reduced motion: tanpa confetti dan tanpa lompatan; bintang dan bar langsung tampil penuh.

**Timer motion.**
- Cincin menyusut halus dengan `stroke-dashoffset` linear. Ini satu-satunya pengecualian aturan transform dan opacity, karena gerak itu adalah data, bukan hiasan. Warna `success` di atas 50 persen, `warn` sampai 20 persen, `danger` di bawahnya.
- 10 detik terakhir: angka membesar 125 persen (transform), cincin menebal, dan ada tik tiap detik. Tanpa easing memantul; hanya `--ease`.
- Waktu habis: satu gerakan `kira-pop` 300ms dan satu bunyi, lalu jawaban dikirim otomatis. Server tetap penentu batas waktu.
- Reduced motion: hanya warna yang berubah. Cincin turun per detik tanpa transisi, angka dan cincin tidak membesar.

## 6b. Motion catalogue

Semua gerak hanya `transform` dan `opacity` (kecuali cincin timer di 6a), memakai `--ease-kira` tanpa pantulan, tidak menangkap fokus, dan tidak menjebak fokus (overlay bukan dialog modal, tombolnya bisa dijangkau Tab). Dengan `prefers-reduced-motion: reduce`: gerak berulang mati (maskot diam), sisanya langsung ke keadaan akhir atau hanya memudar. Definisi keyframe ada di `globals.css`.

| Gerak | Kelas atau komponen | Kapan |
|---|---|---|
| Benar: cahaya hijau (opacity) dan denyut kecil | `kira-correct`, `kira-pulse` | Ubin atau area jawaban setelah benar |
| Not yet: geseran mendatar lembut, tanpa memantul | `kira-nudge` | Setelah Not yet |
| Bintang kombo yang tumbuh | `ComboStars` | Benar beruntun, tingkat 1 sampai 3 |
| "+XP" naik ke arah bar | `XpFly` | Jawaban benar di runner |
| Bar XP terisi mulus | `kira-bar-fill` (skala X) | Today, Me, hasil |
| Momen naik level layar penuh, warna jalur | `LevelUpOverlay` | Naik level (belajar kuning, Quick Maths lilac, Quiz biru muda), hilang sendiri |
| Lencana: kartu berputar masuk dan kilau | `BadgeReveal` | Lencana baru di hasil |
| Angka hitung naik | `CountUp` | Skor dan XP di hasil |
| Garis jalur Today terisi, sesi aktif bercahaya | `kira-path-fill`, `kira-active-glow` | Today (cahaya muncul sekali, tidak berdenyut) |
| Rantai streak terbentuk berurutan | `StreakChain animate` | Hari ini selesai |
| Peralihan layar: memudar dan naik 8 px, 200 ms | `PageTransition` | Antar layar learner |
| Hitung mundur 3, 2, 1, Go | `CountdownOverlay` | Sprint, speed quiz, dan sesi berwaktu |
| Angka Flash Anzan masuk 140 ms | `kira-flash` | Flash Anzan |
| Kartu kuis berputar masuk | `kira-flip-in` | Soal dan kartu Quiz Arena |
| Peti hadiah: bergoyang, tutup terangkat, cahaya, kartu hadiah berputar | `DailyChest` | Today setelah semua sesi wajib selesai |
| Maskot hewan | `Mascot` | Idle (bernapas, berkedip) di header, cheer saat benar, think di soal berwaktu, encourage setelah Not yet, celebrate di hasil |

Confetti tetap hanya di akhir sesi (6a). Tidak ada titik berdenyut, ikon api, atau emoji.

**Peti hadiah harian.** Satu per learner per hari, hanya setelah semua sesi wajib hari itu selesai; dicek di server (`openChestTx`, UNIQUE learner + tanggal). Hadiah: stiker, latar avatar, atau aksesori dari tabel `@kira/core` `chest.ts`, hadiah baru didahulukan. Teks learner memakai "earned", tidak pernah "unlock".

## 7. Voice

**Tone:** hangat, singkat, spesifik. Tidak pernah menyindir atau membuat anak merasa bersalah.
**Person:** English untuk learner dengan you. Indonesia untuk tutor dan orang tua dengan kamu, sebisa mungkin tanpa kata ganti.
**Button style:** kata kerja di depan, sentence case: Check, Next, Show me how, Simpan rencana, Kirim laporan.

Instruksi learner mengikuti batas kata per jenjang. Jawaban yang salah ditulis Not yet. Pesan error menyebut apa yang terjadi, apa yang harus dilakukan, dan kode referensi.

## 8. Component library

Locked to: komponen sendiri di `apps/web/src/components`, dibangun dari elemen HTML asli (`button`, `dialog`, `input`) dengan Tailwind v4. Tanpa shadcn/ui dan tanpa pustaka komponen lain. Ikon digambar sendiri di `components/icons.tsx` dengan garis Deep Grape yang sama dengan desain. Maskot merek `KiraStar` (`components/ui/KiraStar.tsx`) adalah bintang kuning ber-wajah; avatar hewan anak tetap ada di header dan Me. Ikon mapel dan avatar hewan mengikuti gaya ilustrasi yang sama.

Interaksi seret di widget selalu punya alternatif ketuk: ketuk kartu, lalu ketuk tempatnya. Versi 1 memakai ketuk saja.

## 9. Page structures in use

- Today: header dengan avatar, sapaan, rantai bintang streak; bar progres sesi; jalur 9 sesi wajib dikelompokkan per mapel (Practice, Test, Paper) dengan sesi aktif besar dan sesi lain kecil; bagian Extra today untuk sesi opsional; lomba berikutnya di bawah.
- Navigasi learner: delapan tujuan (Today, Map, Review, Competitions, English Skills, Quick Maths, Quiz Arena, Me). Tablet: rel kiri memuat semuanya dan bisa digulir bila layar pendek. HP: bar bawah memuat Today, Map, Review (bila dipakai), dan Me, ditambah tombol More yang membuka lembar berisi sisanya. Lembar More memakai <dialog> asli, hanya ketuk, target minimal 56 px, dan tombolnya menyala bila layar yang terbuka ada di dalam lembar.
- Runner: bar atas (keluar, progres bersegmen, timer bila ada), area soal, area jawaban, bar bawah (hint, baca suara, Check). Tablet landscape: figur di kiri, jawaban di kanan.
- Hasil dan pembahasan: skor, lalu daftar soal; setiap soal membuka jawaban learner, kunci, penjelasan, dan SolutionPlayer.
- Konsol tutor: Perlu perhatian, status hari ini per mapel, tren mingguan.
- Halaman cetak: header paper, petunjuk, bagian soal, footer kode dan nomor halaman.
- Quick Maths (`/quick-maths`, nada `--mental`): misi harian, pilihan permainan, pengaturan, pelajaran strategi, statistik. Ronde: angka soal Baloo 2 besar, keypad 64px di kanan pada tablet, sempoa virtual yang hanya diketuk (tanpa seret).
- Quiz Arena (`/quiz-arena`, nada `--knowledge`): dua belas topik dengan bar kemajuan, halaman topik dengan tiga mode (Learn, Quiz, Speed quiz), ronde dengan pilihan jawaban yang selalu diacak. Gambar hanya dari berkas sendiri (bendera `public/flags`, ikon dan planet `@kira/figures`), tanpa emoji.
- Today dan Me menampilkan tiga bar XP (Belajar, Quick Maths, Quiz) dengan level masing-masing. Aksesori avatar didapat dari level jalur dan dipakai dari Me; teksnya selalu "Earn", bukan kata terlarang GTX.

## 10. Required states

Every interactive element ships: default, hover, focus (visible, 3:1), active, disabled, loading.
Every data region ships: loading, empty, partial, error, success.
Khusus runner: offline, sinkron tertunda, sisa waktu 1 menit, waktu habis.

Keadaan memuat memakai `Skeleton` (`components/ui/Skeleton.tsx`, blok Soft Lavender yang bernapas lewat opacity) lewat `loading.tsx` per kelompok rute, dengan ukuran yang sama dengan isi supaya tidak ada lompatan tata letak. Keadaan kosong di layar learner memakai `EmptyState` dengan maskot `KiraStar` (mata datar, mulut kecil); layar dewasa memakai kartu putih tanpa maskot.

## 6c. Sentuhan seperti iOS

Berlaku di komponen bersama, tidak per halaman. Tekan mengecil 3 persen lewat `--ease-kira`. Lembar bawah di HP: setiap `Dialog` (`kira-sheet`) menempel di bawah layar di bawah 640px dengan pegangan kecil, tepi aman, dan gerak naik; di layar lebar tetap di tengah. Kontrol segmen `SegmentedControl` (`components/ui`) dengan penanda yang bergeser, panah kiri dan kanan untuk keyboard. Tepi aman `pt-safe` dan `pb-safe`, viewport `cover`. Reduced motion: tanpa skala, tanpa geser, hanya memudar 120ms.

## 6d. Kerangka situs

`SiteHeader` (logo ke beranda, Panduan, Bantuan, Masuk atau menu akun) dan `SiteFooter` (Panduan, Bantuan, Privasi, Syarat, teks kredit pemilik, tautan kecil Partner with Gatxel) ada di `components/ui`, dipakai `PublicFrame`, `FamilyShell`, dan `LearnerFrame`. Footer mengikuti isi, tidak menempel di layar. Area learner memakai footer tanpa tautan keluar (aturan 5). Runner dan sesi berwaktu layar penuh tidak memakai footer.

## 11. Responsive floor

Tested with no horizontal scroll and no text overflow at: 320, 375, 414, 768, 820, 1180, 1280. Komponen memakai container query bila ukurannya bergantung pada wadah.

## 12. Accessibility floor

WCAG 2.2 AA. Body 4.5:1, large text and UI borders 3:1. Teks di atas Kira Lilac hanya 19px tebal ke atas. Target sentuh 56px di layar learner dan 48px di layar dewasa; ubin jawaban minimal 56px tinggi. Keyboard operable, focus never obscured by a sticky header, `autocomplete` set, paste never blocked. Setiap soal punya tombol baca suara, setiap widget seret punya alternatif ketuk, setiap video ber-caption.
