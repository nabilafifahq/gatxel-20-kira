# Rencana Pilot Publik Kira

Draf untuk disetujui. Disusun Rabu 4 November 2026 pukul 21.10 WIB, dari audit baca-saja terhadap kode dan server produksi (commit c03d474). Belum ada kode atau data yang diubah.

Target: Kamis 5 November pukul 06.00 WIB, tautan website dan APK dikirim ke 100 orang tua, kelas 1 sampai 6, dengan kapasitas yang sudah diuji sampai 1.000 pengguna.

Tambahan dari pemilik, 4 November malam (berlaku di atas isi lain dokumen ini):

- Dikerjakan sampai pukul 06.00. Server rumah tidak dipakai siapa pun selain Kira.
- Beta dibatasi 100 kursi. Kursi terhitung saat email terverifikasi, dan penghitungannya aman terhadap pendaftaran serentak.
- Setelah 100 kursi terisi, pendaftaran diganti halaman "Kursi beta sudah penuh" yang ramah dan menjual, dengan form berlangganan kabar. Pelanggan menerima email saat kursi dibuka lagi.
- Email sekali pakai ditolak sejak langkah pertama, di pendaftaran dan di form kabar: daftar domain terbuka yang rutin diperbarui, cek MX, dan alamat Gmail dengan titik atau plus dinormalkan supaya satu orang tidak mengambil banyak kursi.
- Website publik dengan halaman depan, plus dokumentasi untuk orang tua dan anak.
- Kesannya harus premium, dengan materi yang sangat baik.

## 1. Kesimpulan

Kira hari ini belum bisa dibuka untuk publik. Kira dibangun untuk satu keluarga: belum ada pendaftaran akun, email belum tersambung, dan identitas pengelola masih kosong. Semua itu bisa dikejar dalam 9 jam kalau keputusan dan akses di bagian 8 masuk malam ini.

Ada keputusan GO atau NO-GO pada pukul 05.30 dengan syarat terukur di bagian 7. Kalau syaratnya tidak terpenuhi, saya sarankan pengiriman ditunda, karena pilot ini memuat data anak.

## 2. Jawaban untuk pertanyaanmu (hasil audit)

| Pertanyaan | Jawaban jujur sekarang | Bukti |
|---|---|---|
| Materi sudah penuh kurikulum Cambridge? | Belum bisa dikonfirmasi | 395 skill punya pernyataan "I can", tapi tidak ada satu pun kode kerangka Cambridge. Belum pernah dipetakan ke kerangka resmi. |
| Soal sudah terverifikasi dan benar? | Belum terverifikasi secara independen | Struktur pilihan ganda lolos cek otomatis. Kunci dicek oleh agen yang sama dengan penulisnya. Belum ada pemeriksa kedua. |
| Ada soal kembar? | Hampir tidak ada di bank | Dari 4.930 soal tulis: 1 kembar persis di mapel dan kelas yang sama, 2 lintas kelas, 23 kelompok hanya beda angka (yang memang kamu bolehkan). |
| Soal bisa berulang saat dipakai? | Bisa | Pemilih soal hanya menurunkan peluang soal yang baru keluar, tidak melarangnya. |
| Kelas 1 sampai 6 sudah siap? | Kelas 4 sampai 6 masih tipis | Lihat tabel di bawah. Tambahan 2.180 soal bulan lalu hanya untuk kelas 1 sampai 3. |
| Kenapa suara berubah laki-laki dan perempuan? | Sudah ketemu sebabnya | Gaya `teacher` berisi 3 suara (perempuan, laki-laki, perempuan) yang digilir per klip. VoiceDesign juga merancang ulang suara untuk setiap potongan kalimat, jadi suara bisa bergeser di dalam satu klip. |
| Suara pecah? | Belum terbukti dari file | Sampel 400 dari 21.453 klip: tidak ada puncak di 0 dB, 1 klip di bawah 0,4 detik. Perlu cek lanjutan dengan transkripsi (bagian 4, W5). |
| Perlu pindah database? | Tidak | Database sudah Postgres 17 lokal di server rumah (18 MB), tanpa Supabase. TLS, RLS, 4 role, tanpa port ke host. Yang kurang: penyetelan, pooling, cadangan di luar PC. |

Jumlah soal tulis per kelas (Math ditambah generator tanpa batas di 164 skill):

| Kelas | English | Science | Math tulis |
|---|---|---|---|
| 1 | 501 | 433 | 123 |
| 2 | 623 | 582 | 472 |
| 3 | 459 | 483 | 167 |
| 4 | 198 | 156 | 45 |
| 5 | 169 | 130 | 45 |
| 6 | 169 | 130 | 45 |

Hasil ukur server:

| Ukuran | Hasil | Arti |
|---|---|---|
| Unggah internet rumah | sekitar 29 Mbps | Batas semua halaman dan audio yang tidak di-cache Cloudflare |
| Jaringan PC | Wi-Fi, kabel LAN tidak tersambung | Risiko putus dan latensi |
| Halaman `/masuk` di mesin ini | 489 req/detik, p99 164 ms (50 koneksi, satu proses) | Belum mewakili Today atau simpan jawaban |
| Lewat Cloudflare | sekitar 0,35 sampai 0,45 detik per permintaan | Setiap simpan jawaban punya jeda ini |
| Web | 1 proses Node, pool database 15 + 8, tanpa PgBouncer, tanpa Redis | Hambatan pertama saat beban naik |
| Audio `/tts` | Lewat Node dan bertanda `private` | Cloudflare tidak bisa men-cache, semuanya memakai unggahan rumah |

## 3. Penghalang peluncuran

| No | Temuan | Dampak |
|---|---|---|
| 1 | Tidak ada pendaftaran. `/setup` hanya untuk keluarga pertama. | Orang tua tidak bisa membuat akun sama sekali |
| 2 | `SMTP_URL` kosong | Verifikasi email dan lupa password tidak terkirim |
| 3 | `KIRA_LEGAL_*` kosong, dan Kebijakan Privasi menulis "dipakai oleh satu keluarga" | Persetujuan orang tua atas data anak tidak sah secara isi |
| 4 | Tutor wajib untuk menambah anak, mengatur sesi, dan menilai `write`, `speak`, `draw`, `photo` | Tanpa tutor, jawaban jenis itu menunggu selamanya |
| 5 | Halaman orang tua hanya ringkasan mingguan dan privasi | Kontrol dan laporan orang tua belum ada |
| 6 | Pembatas laju percaya `x-forwarded-for` pertama, yang bisa dipalsukan. Tidak ada captcha. Simpan jawaban, sinkron, unggahan, dan heartbeat tanpa batas. | Celah penyalahgunaan dan banjir permintaan |
| 7 | `http://kira.gatxel.com` masih terbuka tanpa https. `/api/internal` dan `/api/mcp` terjangkau dari internet (401, tetap perlu ditutup). | Password bisa terkirim tanpa enkripsi, permukaan serangan lebih luas |
| 8 | PR #7 pembaruan Next dan React belum di-merge sejak 1 November | Pembaruan framework tertinggal, padahal sekarang publik |
| 9 | AI memakai token Claude Max pribadi, dan sumber soal mingguan berjalan per keluarga | Tidak layak untuk layanan publik, biaya dan kuota naik per keluarga |
| 10 | Permintaan 18 Oktober (wajib atau opsional per sesi, ubah pelajaran hari yang sama, reset streak) belum selesai. Agennya berhenti, belum ada PR, streak Syakira belum direset. | Sesi tetap panjang |

## 4. Checklist kerja

Setiap kelompok dikerjakan satu agen di salinan repo sendiri. Pemeriksa akhirnya CI dan uji di bagian 7.

### W1. Akun publik
- [ ] Daftar orang tua dengan email dan password, satu akun membuat satu keluarga
- [ ] Verifikasi email, dan akun belum aktif sebelum terverifikasi
- [ ] Lupa password lewat email
- [ ] Kode undangan pilot, supaya jumlah pengguna bisa ditahan
- [ ] Cloudflare Turnstile di daftar, masuk, dan lupa password
- [ ] Alur awal: tambah anak, persetujuan, buka di perangkat ini, PIN gambar
- [ ] Batas anak per keluarga, ganti asumsi satu keluarga
- [ ] Uji isolasi: keluarga A tidak bisa membaca atau mengubah data keluarga B

### W2. Peran orang tua dan anak
- [ ] Dasbor orang tua: daftar anak, hasil per sesi, peta penguasaan, waktu belajar, streak
- [ ] Kontrol: wajib, opsional, atau mati per sesi; preset Penuh, Seimbang, Ringan; ubah pelajaran hari yang sama; batas layar; reset PIN; suara
- [ ] Lanjutkan pekerjaan 18 Oktober yang terhenti, lalu reset streak Syakira setelah cadangan
- [ ] Laporan mingguan di layar dan email
- [ ] Soal `write`, `speak`, `draw`, `photo`: tidak ikut nilai sesi wajib untuk keluarga tanpa tutor; orang tua bisa melihat dan memberi nilai
- [ ] Peran tutor dibiarkan apa adanya

### W3. Redesign Brand Kit v1.0
- [ ] Token warna, font, radius, dan bayangan dari kanvas desain (Grape, Lilac, krem; Baloo 2, Nunito, Fredoka), font disimpan di server sendiri
- [ ] Layar anak, orang tua, publik, dan email mengikuti kit
- [ ] Layar yang di kanvas masih token lama mengikuti peta konversi di catatan kanvas
- [ ] Axe dan kontras lolos, lebar HP tidak melebar

### W4. Bahasa Indonesia
- [ ] Lapisan terjemahan untuk layar anak dengan pilihan Indonesia atau English
- [ ] Semua teks antarmuka anak punya versi Indonesia yang ditinjau, memakai `docs/standards/gtx/references/copy-indonesian.md`, dan dicek kamus Hunspell id_ID
- [ ] Suara Indonesia sesuai keputusan D3

### W5. Audio
- [ ] Satu suara tetap per peran, tidak pernah berganti di tengah soal
- [ ] Coba Kokoro-82M (Apache-2.0) di GPU ini, karena perlu cepat: 21.453 klip dengan Qwen butuh lebih dari 18 jam
- [ ] Buat ulang semua klip
- [ ] Cek massal: durasi, puncak, nada dasar (mendeteksi suara yang melompat), dan transkripsi Whisper dibandingkan dengan teks
- [ ] Klip publik dan immutable supaya Cloudflare menyimpannya
- [ ] Target: suara mulai terdengar di bawah 1 detik di tablet

### W6. Konten
- [ ] Unduh kerangka resmi Cambridge Primary (Math 0096, English 0058, Science 0097), petakan setiap skill ke kode kerangka, tulis laporan celah
- [ ] Skill di luar kerangka ditandai sebagai pengayaan
- [ ] Pemeriksa kedua untuk kunci jawaban: dikerjakan ulang terpisah, yang berbeda diperbaiki atau disembunyikan
- [ ] Generator Math diuji massal terhadap pemeriksa jawabannya
- [ ] Pemilih soal: tidak mengulang soal sampai kumpulan habis, generator memakai angka baru
- [ ] Soal kelas 4 sampai 6 ditambah
- [ ] Soal lomba resmi tidak dibagikan ke keluarga lain; Paper memakai soal gaya lomba buatan Kira

### W7. Kapasitas
- [ ] Web beberapa replika di belakang proxy lokal, PgBouncer mode transaksi, penyetelan Postgres
- [ ] Redis atau Valkey untuk pembatas laju dan cache sesi
- [ ] Today di-cache per anak dan tanggal, heartbeat dikurangi, batas unggah diturunkan untuk anak
- [ ] Skenario k6: daftar, masuk, Today, jawab soal, kumpul, audio, arena, laporan orang tua
- [ ] Bertahap 100, 300, 500, 1.000 pengguna virtual, lalu uji lonjakan dan uji 30 menit
- [ ] Uji serentak: jawaban ganda, XP, peti harian, PIN, pendaftaran dengan email sama
- [ ] Uji lewat Cloudflare dari luar rumah memakai runner GitHub

### W8. Keamanan
- [ ] Merge PR #7 setelah CI hijau, lalu audit dependensi
- [ ] IP diambil dari `CF-Connecting-IP`, dan origin hanya menerima lewat tunnel
- [ ] Batas laju di semua endpoint tulis
- [ ] Tutup `/api/internal` dari publik, matikan MCP untuk pilot
- [ ] Always Use HTTPS, aturan WAF, aturan rate limit Cloudflare
- [ ] Uji SQL injection (sqlmap dan uji otomatis), IDOR lintas keluarga, XSS, CSRF, sesi, unggahan
- [ ] OWASP ZAP dan Strix terhadap salinan uji, bukan produksi
- [ ] Cadangan per jam selama pilot, dengan salinan di luar PC, dan uji pulihkan
- [ ] Log dan peringatan saat server turun
- [ ] Kebijakan Privasi dan Ketentuan untuk banyak keluarga

### W9. Panduan dan rilis
- [ ] Panduan orang tua berbentuk halaman HTML di `kira.gatxel.com/panduan`, dengan alur dan contoh pemakaian setiap fitur
- [ ] Salinan panduan sebagai artifact
- [ ] Halaman unduh APK untuk orang tua, dan APK baru
- [ ] Pesan WhatsApp siap kirim
- [ ] Kontak bantuan

## 5. Jadwal malam ini (WIB)

| Waktu | Kegiatan |
|---|---|
| Setelah disetujui | PR #7, salinan uji, W1 sampai W9 mulai paralel, W5 uji Kokoro |
| 00.30 | Fitur berhenti ditambah. Penggabungan dan CI. |
| 02.00 | Uji beban dan keamanan di salinan uji, perbaikan |
| 04.00 | Pasang ke produksi setelah cadangan |
| 04.30 | Kode dibekukan. Uji beban terakhir di luar jam pakai. |
| 05.00 | Kamu mencoba sendiri di HP dan tablet: daftar, verifikasi, lupa password, sesi anak, audio |
| 05.30 | GO atau NO-GO |
| 06.00 | Tautan dikirim |

## 6. Kalau waktu kurang

Yang dipotong lebih dulu, berurutan:
1. Terjemahan isi soal
2. Suara Indonesia
3. Tambahan soal kelas 4 sampai 6 di atas batas minimum
4. Layar sekunder yang belum selesai diredesign
5. Putaran Strix kedua

Yang tidak dipotong: akun dan email, isolasi keluarga, keamanan dasar, suara yang konsisten, uji beban, identitas pengelola.

## 7. Syarat GO pukul 05.30

- [ ] Daftar, verifikasi, masuk, dan lupa password lolos di email sungguhan
- [ ] Uji isolasi lintas keluarga 100 persen lolos, tanpa temuan kritis atau tinggi yang terbuka
- [ ] k6 1.000 pengguna virtual dengan jeda baca: p95 Today dan simpan jawaban di bawah 800 ms lewat Cloudflare, galat di bawah 0,5 persen
- [ ] Kalau 1.000 tidak tercapai: angka tertinggi yang lolos ditulis jujur, dan kode undangan dibatasi di angka itu
- [ ] Cek audio massal lolos, dan sampel didengar sendiri
- [ ] Cadangan dan uji pulihkan berhasil
- [ ] Identitas pengelola terisi, Kebijakan Privasi versi baru tampil
- [ ] Bagian tutor Syakira tetap jalan

## 8. Yang perlu darimu malam ini

| No | Keputusan atau akses | Usulan saya |
|---|---|---|
| D1 | Setujui rencana dan syarat GO | Setuju |
| D2 | Bahasa | Antarmuka anak bisa Indonesia atau English. Isi soal tetap English sesuai Cambridge, kecuali yang memang berbahasa Indonesia. |
| D3 | Suara Indonesia | Pilot: pakai suara bawaan perangkat untuk teks Indonesia. Model terbuka yang saya temukan bermasalah lisensi atau mutunya. Kalau mau lebih bagus, Google Cloud TTS `id-ID` perlu API key berbayar. |
| D4 | Suara English | Kokoro satu suara tetap untuk pilot, kalau hasil ujinya bagus. Qwen ekspresif menyusul setelah pilot dengan suara yang dikunci. |
| D5 | Sesi harian bawaan keluarga baru | Preset Seimbang: Latihan wajib, Tes dan Paper opsional |
| D6 | Soal lomba resmi | Tidak dibagikan ke keluarga lain karena hak cipta. Paper keluarga baru memakai soal gaya lomba buatan Kira. |
| D7 | AI | `AI_PROVIDER=none` selama pilot. Token Claude Max pribadi tidak dipakai melayani publik, dan tidak ada data anak yang keluar ke AI. |
| D8 | Klaim ke orang tua | "Mengacu pada kerangka Cambridge Primary" hanya setelah laporan W6, tanpa kata "resmi" atau "tersertifikasi" |
| A1 | Email | App Password Gmail (sekitar 500 email per hari, cukup untuk 100 orang), atau akun penyedia email dengan DNS gatxel.com |
| A2 | Identitas pengelola | Nama, alamat, email, dan nomor bantuan untuk `KIRA_LEGAL_*` |
| A3 | Cloudflare | API token terbatas untuk zona gatxel.com (Settings, WAF, Turnstile), atau kamu klik sendiri dari daftar yang saya kirim |
| A4 | Strix | API key penyedia LLM. Tanpa ini saya pakai sqlmap, OWASP ZAP, dan uji otomatis. |
| A5 | Perangkat | Colok kabel LAN ke PC, tunda Windows Update sampai pilot selesai, dan pastikan GPU tidak dipakai seat sebelah malam ini |
| A6 | Kuota | Sisa kuota mingguan Claude sekarang. Rencana ini memakai sekitar 9 agen Sonnet. |
| A7 | Pukul 05.00 | Kamu bangun untuk uji di perangkat sungguhan dan memutuskan GO |

## 9. Yang tidak bisa saya janjikan

- **Tidak bisa ditembus sama sekali.** Yang bisa saya janjikan: pengujian yang dijalankan, hasilnya, dan temuan yang terbuka.
- **DDoS.** Cloudflare menahan banjir umum dan alamat rumah tersembunyi lewat tunnel. Serangan besar di lapisan aplikasi tetap bisa memperlambat satu PC.
- **Satu PC di rumah.** Listrik, internet, Windows Update, atau akun yang keluar akan menjatuhkan semuanya. Unggah 29 Mbps juga batas keras. Kalau pilot membesar, server sewaan layak dipertimbangkan.
- **Semua soal pasti benar.** Pemeriksa kedua menurunkan risiko kesalahan, tapi belum menjamin nol. Tombol lapor soal tetap dipakai selama pilot.
- **Sertifikasi Cambridge.** Hanya Cambridge yang bisa memberi pengakuan itu.
- **Saran hukum.** Data anak di bawah UU PDP sebaiknya ditinjau orang yang berkompeten, walaupun pilot ini gratis.
