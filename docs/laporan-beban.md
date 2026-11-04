# Laporan beban Kira

Dibuat Rabu 4 November 2026 malam, cabang `pilot/kapasitas`. Semua angka di sini dari staging (project `kirastg`) di PC server yang sama dengan produksi, pada kode cabang ini, dan **harus dibaca sebagai batas bawah**: pada jam yang sama agen lain sedang membangun image dan menjalankan tes di PC yang sama, dan generator beban (k6) ikut makan CPU di mesin yang sama. Uji akhir dijalankan integrator setelah semua cabang digabung dan PC tenang. Cara menjalankan ulang: `docs/pasang-windows.md` bagian 16.

## 1. Kesimpulan

| Pertanyaan | Jawaban jujur |
|---|---|
| Aman untuk 100 keluarga di pilot? | Ya, dengan jarak aman besar. Pada 300 anak aktif bersamaan (tiga kali target, dengan waktu berpikir anak) tidak ada galat, p95 177 ms dan p99 453 ms di dalam PC. |
| Aman untuk lonjakan? | Ya sampai yang diuji: dari 0 ke 500 anak dalam 30 detik tanpa galat, p99 564 ms. Today (yang membuat sesi hari itu untuk anak yang baru masuk) paling lambat: p99 1,2 detik. |
| Batas jujur | Sekitar 500 anak aktif bersamaan (93 permintaan per detik) masih sehat (p99 672 ms). Pada 1000 anak aktif bersamaan, PC ini bertahan tanpa galat tetapi lambat (p95 1,4 detik, p99 2,1 detik), dan pada percobaan dengan PC sedang dipakai agen lain mulai ada galat (0,08 persen) dan p99 11 detik. Penghambatnya CPU PC (web, Postgres, proxy, dan k6 bersama-sama melewati 12 thread), bukan memori, sambungan database, atau unggahan internet. |
| Waktu nyata untuk pengguna | Tambahkan 0,35 sampai 0,45 detik per permintaan lewat Cloudflare (diukur lebih dulu di `docs/rencana-pilot-publik.md`). Angka di bawah belum termasuk itu. |
| Unggahan rumah (sekitar 29 Mbps) | Bukan batas. Dengan kompresi di proxy dan berkas statis serta klip suara disajikan Cloudflare, 500 anak aktif memakai sekitar 9 Mbps dari proxy. |
| Gangguan | Valkey mati 25 detik, satu replika web dimatikan paksa 45 detik, dan PgBouncer di-restart selama beban 300 anak: 0,17 persen transaksi gagal, p99 naik ke 1,8 detik lalu pulih sendiri. |

## 2. Cara uji

- **Lingkungan:** Windows 11, 12 thread, 63 GB RAM, VM Docker Desktop 31 GB, NVMe. Staging: 1 proxy Caddy, 4 replika web, PgBouncer, Valkey, Postgres 17 dengan penyetelan di `docker-compose.yml`, worker dengan `AI_PROVIDER=none`. Database staging terpisah dari produksi.
- **Generator:** k6 dalam kontainer di jaringan staging, menembak proxy langsung (tanpa Cloudflare). Satu VU adalah satu anak aktif dengan waktu berpikir 4 sampai 12 detik per soal, atau satu orang tua. Data: 500 keluarga, 1000 anak, dibuat ulang sebelum tiap tahap supaya setiap anak mulai dari hari yang segar.
- **Alur:** campuran (`mixed`) yang meniru hari ramai: 50 persen sesi harian (buka Today, mulai sesi, jawab setiap soal dengan jeda, kumpul, lihat hasil, ambil klip suara), 12 persen ronde Quick Maths, 8 persen Quiz, 10 persen hanya Today, 10 persen dasbor orang tua, 5 persen masuk PIN, 5 persen masuk password. Server Action dipanggil sungguhan (simpan jawaban, kumpul, mulai ronde).
- **Tahap:** naik 60 detik, tahan 180 detik, turun 30 detik. Lonjakan: 0 ke 500 VU dalam 30 detik, tahan 120 detik.
- **Pengukuran:** p50, p95, p99 dan galat dari k6 per endpoint; CPU, RAM, dan sambungan dicuplik tiap 5 detik dari `docker stats`, `pg_stat_activity`, dan `SHOW POOLS`. CPU 100 persen berarti satu inti penuh.
- **Galat** dihitung dua cara: galat HTTP (respons gagal) dan transaksi bisnis (Server Action yang menjawab `ok:false`).

## 3. Hasil per tahap (4 replika web, kecuali dicatat)

| Uji | Permintaan/detik | p50 | p95 | p99 | Galat HTTP | Transaksi bisnis OK | CPU web | CPU db | RAM web | Sambungan PG puncak |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 anak | 19 | 48 ms | 172 ms | 401 ms | 0,00% | 100% | 114% | 47% | 1420 MiB | 21 |
| 300 anak | 56 | 42 ms | 177 ms | 453 ms | 0,00% | 100% | 175% | 68% | 1466 MiB | 31 |
| 500 anak | 93 | 72 ms | 343 ms | 672 ms | 0,00% | 100% | 356% | 163% | 1522 MiB | 45 |
| 1000 anak | 173 | 93 ms | 1406 ms | 2138 ms | 0,00% | 100% | 315% | 223% | 1645 MiB | 49 |
| Lonjakan 0 ke 500 dalam 30 detik | 92 | 54 ms | 284 ms | 564 ms | 0,00% | 100% | 300% | 222% | 1665 MiB | 50 |
| 1000 anak, 6 replika, PC sedang dipakai agen lain | 146 | 305 ms | 4129 ms | 11639 ms | 0,08% | 99,81% | 587% | 318% | 2460 MiB | 63 |
| 500 anak, prepared statements di PgBouncer dinyalakan | 92 | 70 ms | 295 ms | 733 ms | 0,00% | 100% | 308% | 190% | 1534 MiB | 43 |
| 300 anak dengan gangguan (bagian 6) | 54 | 96 ms | 749 ms | 1802 ms | 0,01% | 99,83% | 294% | 165% | 1462 MiB | 52 |

### Per endpoint pada 500 anak

(p50 / p95 / p99 dalam ms, 4 replika.)

| Endpoint | Jumlah | p50 | p95 | p99 | Galat HTTP |
|---|---:|---:|---:|---:|---:|
| Simpan jawaban (Server Action) | 9927 | 83 | 290 | 416 | 0,00% |
| Klip suara `/tts/<hash>.mp3` (dari disk oleh proxy) | 2150 | 25 | 162 | 529 | 0,00% |
| Today | 1276 | 337 | 1038 | 1570 | 0,00% |
| Halaman sesi `/run/<id>` | 1075 | 76 | 230 | 338 | 0,00% |
| Kumpul sesi (Server Action) | 911 | 228 | 621 | 919 | 0,00% |
| Dasbor orang tua | 180 | 102 | 378 | 454 | 0,00% |
| Masuk PIN | 110 | 164 | 417 | 549 | 0,00% |
| Masuk password | 98 | 144 | 526 | 691 | 0,00% |

Tabel lengkap per endpoint untuk setiap tahap ditulis `deploy/load/run.mjs` ke `deploy/load/out/<nama>/result.md` (tidak masuk git). Pada 1000 anak p95 naik rata hampir semua endpoint (1,2 sampai 1,7 detik) karena antrean CPU, bukan satu endpoint tertentu; klip suara dari disk tetap p95 57 ms.

## 4. Per skenario (100 anak, tahan 60 detik)

| Skenario | Permintaan/detik | p50 | p95 | p99 | Galat HTTP | Bisnis OK | CPU web | RAM web |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Today | 10,9 | 35 ms | 260 ms | 430 ms | 0,00% | 0,00% | 138% | 1329 MiB |
| Klip suara | 143,9 | 15 ms | 327 ms | 504 ms | 0,00% | 0,00% | 15% | 1328 MiB |
| Masuk PIN | 20,7 | 70 ms | 357 ms | 860 ms | 0,00% | 100,00% | 291% | 1373 MiB |
| Masuk password | 16,9 | 55 ms | 324 ms | 1101 ms | 0,00% | 100,00% | 163% | 1403 MiB |
| Dasbor orang tua | 4,4 | 32 ms | 83 ms | 149 ms | 0,00% | 0,00% | 59% | 1387 MiB |
| Ronde Quick Maths | 22,5 | 58 ms | 287 ms | 1000 ms | 0,00% | 100,00% | 150% | 1414 MiB |
| Ronde Quiz | 18,8 | 58 ms | 147 ms | 226 ms | 0,00% | 100,00% | 164% | 1415 MiB |
| Sesi Latihan penuh | 14,5 | 90 ms | 297 ms | 596 ms | 0,00% | 100,00% | 77% | 1383 MiB |
| Tes dengan batas waktu (Latihan dikerjakan dulu tanpa jeda) | 27,7 | 77 ms | 226 ms | 347 ms | 0,00% | 100,00% | 187% | 1444 MiB |
| Paper (Latihan dikerjakan dulu tanpa jeda) | 20,2 | 45 ms | 205 ms | 409 ms | 0,00% | 100,00% | 70% | 1443 MiB |

Endpoint utama per skenario (p50 / p95 / p99):

- **Today**: heartbeat 900x p50 16 / p95 67 / p99 102 ms; today 900x p50 61 / p95 348 / p99 480 ms
- **Klip suara**: audio_clip 21900x p50 15 / p95 327 / p99 504 ms
- **Masuk PIN**: pin 1605x p50 120 / p95 461 / p99 1531 ms; pin_page 1605x p50 37 / p95 125 / p99 322 ms
- **Masuk password**: login 1330x p50 115 / p95 463 / p99 1551 ms; login_page 1330x p50 21 / p95 93 / p99 300 ms
- **Dasbor orang tua**: parent_dashboard 600x p50 34 / p95 86 / p99 155 ms; parent_privacy 181x p50 27 / p95 78 / p99 115 ms
- **Ronde Quick Maths**: qm_answer 3354x p50 54 / p95 256 / p99 884 ms; qm_page 368x p50 67 / p95 426 / p99 1145 ms; qm_start 184x p50 80 / p95 480 / p99 2134 ms; qm_finish 136x p50 144 / p95 261 / p99 396 ms
- **Ronde Quiz**: quiz_answer 2372x p50 57 / p95 129 / p99 219 ms; quiz_page 492x p50 51 / p95 110 / p99 165 ms; quiz_start 246x p50 59 / p95 129 / p99 166 ms; quiz_finish 209x p50 129 / p95 232 / p99 286 ms
- **Sesi Latihan penuh**: save_answer 1426x p50 85 / p95 220 / p99 309 ms; audio_clip 324x p50 142 / p95 665 / p99 902 ms; today 162x p50 143 / p95 346 / p99 475 ms; run_page 162x p50 78 / p95 213 / p99 302 ms; heartbeat 162x p50 50 / p95 141 / p99 234 ms; quest_intro 162x p50 63 / p95 139 / p99 215 ms
- **Tes dengan batas waktu (Latihan dikerjakan dulu tanpa jeda)**: save_answer 1547x p50 63 / p95 148 / p99 187 ms; audio_clip 396x p50 81 / p95 347 / p99 523 ms; today 371x p50 137 / p95 274 / p99 326 ms; heartbeat 279x p50 38 / p95 116 / p99 168 ms; run_page 198x p50 80 / p95 173 / p99 218 ms; quest_intro 198x p50 60 / p95 117 / p99 143 ms
- **Paper (Latihan dikerjakan dulu tanpa jeda)**: save_answer 1815x p50 40 / p95 158 / p99 279 ms; audio_clip 476x p50 34 / p95 325 / p99 901 ms; today 238x p50 105 / p95 226 / p99 376 ms; run_page 238x p50 51 / p95 163 / p99 251 ms; quest_intro 238x p50 41 / p95 90 / p99 113 ms; heartbeat 238x p50 30 / p95 113 / p99 207 ms

Catatan: kolom Bisnis OK 0,00 persen pada skenario yang hanya membaca halaman (Today, klip suara, dasbor) berarti tidak ada Server Action yang dihitung, bukan kegagalan. Satu cuplikan `docker stats` pada skenario PIN menunjuk 1313 persen CPU web; itu meleset (cuplikan lain pada uji yang sama paling tinggi 291 persen), jadi tabel memakai 291 persen. Pada skenario Tes dan Paper, Latihan mapel itu dikerjakan lebih dulu tanpa jeda (Tes terkunci sebelum Latihan selesai); permintaan persiapan itu ikut dalam hitungan permintaan per detik tetapi ditandai `prep_` dan tidak ada di daftar endpoint.


## 5. Soak

SOAK_TEKS

## 6. Gangguan

Selama beban 300 anak: Valkey dimatikan 25 detik, replika web nomor 2 dimatikan paksa (`docker kill`) 45 detik, lalu PgBouncer di-restart (dua kali, karena tumpang tindih dengan pemulihan replika).

- Transaksi bisnis gagal: 18 dari 10.702 (0,17 persen). Galat HTTP 0,01 persen.
- p95 naik dari 177 ms ke 749 ms, p99 dari 453 ms ke 1802 ms, lalu kembali normal setelah gangguan.
- Valkey mati: web memakai cadangan di memori (batas laju per replika, sesi dibaca dari database), tidak ada galat yang terlihat anak.
- Replika mati: Caddy menandainya tidak sehat (cek aktif tiap 5 detik, pasif setelah 3 kegagalan) dan memindahkan permintaan; sebagian permintaan yang sedang berjalan di replika itu gagal.
- PgBouncer restart: sambungan dibuat ulang oleh pool postgres.js; permintaan yang sedang berjalan gagal, yang berikutnya berhasil.

## 7. Hambatan yang ditemukan dan perbaikan

| Temuan | Bukti | Perbaikan |
|---|---|---|
| HTML dikirim tanpa kompresi: aplikasi memberi `Cache-Control: no-transform` dan Caddy tidak mau memampatkan respons bertanda itu. Today 100,7 KB, Me 87 KB, Quick Maths 43 KB per tampilan lewat unggahan rumah. | `curl --compressed` memberi ukuran sama dengan mentah. | Proxy melepas `no-transform` sebelum `encode` lalu memasangnya lagi. Today jadi 12,1 KB, Me 11,5 KB, Quick Maths 7,8 KB; header ke Cloudflare tetap `no-store, no-transform`. |
| Kumpul sesi dua kali bersamaan memberi XP sesi **empat kali**. | Uji konkurensi: `quest:4:80` melawan `quest:1:20`. | Baris attempt dikunci `FOR UPDATE` di awal `submitAttempt`. |
| Jawaban paralel pada skill yang sama menghilangkan pembaruan penguasaan (theta, jumlah jawaban, kartu koreksi): 2 dari 8 tercatat. | Uji konkurensi: `n_answers` 2 melawan 8. | Kunci advisory per learner dan skill di `applyOutcome`. |
| Setiap permintaan mencari sesi di database; `lastSeenAt` ditulis tiap menit per sesi. | Pembacaan kode, `pg_stat_statements`. | Cache sesi 15 detik di Valkey (dicabut saat keluar, cabut sesi, ganti password, cabut perangkat); `lastSeenAt` ditulis berkelompok tiap 20 detik. |
| Heartbeat tiap menit membuka transaksi walau tidak ada yang berubah. | Pembacaan kode. | Klien kirim tiap 2 menit (kredit menit mengikuti selisih), detak ganda dalam 45 detik dijawab dari cache tanpa transaksi. |
| Konten dimuat pada permintaan pertama (sekitar 0,7 detik memblokir loop). | Log "konten dimuat". | Dimuat di `instrumentation.ts` saat proses mulai; `/api/health` baru lulus setelah itu. |
| Setiap layar learner membuka transaksi hanya untuk `ensureStarted` dan pilihan suara. | `pg_stat_statements`: 82 ribu `select learner_profile`. | `ensureStarted` sekali per learner per proses; pilihan suara disimpan 20 detik. |
| Today dihitung ulang tiap dibuka. | Today p50 194 sampai 668 ms, terberat. | Cache per learner dan tanggal (30 detik), sah selama versi learner dan org tidak berubah; versi naik setiap Server Action sukses. |
| Pembatas laju IP, MCP, dan permintaan suara hanya di memori satu proses, jadi menjadi per replika. | Pembacaan kode. | Ember token di Valkey (Lua atomik), cadangan di memori. |
| Sourcing mingguan berputar ke semua org. | `kira_list_orgs()` di worker. | Migrasi 0015: hanya org dengan `settings.weeklySourcing`; org yang ada saat migrasi ditandai, keluarga baru tidak. Tanpa AI (`AI_PROVIDER=none`) job dilewati dengan pesan. |

Percobaan yang **tidak** memberi hasil dan tidak dipakai:

- **Enam replika** di PC 12 thread: lebih buruk daripada empat pada 1000 anak (p95 4,1 detik melawan 1,4 detik), karena CPU PC sudah penuh oleh web, Postgres, proxy, dan k6 bersama-sama. Bawaan tetap 4 (`KIRA_WEB_REPLICAS`).
- **Prepared statements lewat PgBouncer** (`PGB_MAX_PREPARED` dan `KIRA_DB_PREPARE=on`): tidak lebih cepat (p99 733 ms melawan 672 ms, CPU PgBouncer naik). Tetap mati seperti rencana; keduanya bisa diubah lewat `.env` bila uji akhir menunjukkan lain.

Yang belum dikerjakan: profil CPU Node untuk mencari fungsi terberat di Today dan simpan jawaban (pada 500 anak: sekitar 38 ms CPU Node dan 17 ms CPU Postgres per permintaan, dihitung dari CPU puncak dibagi permintaan per detik rata-rata; sekitar 14 round trip SQL per simpan jawaban); itulah tempat berikutnya untuk mendorong batas 500 ke atas.

## 8. Uji konkurensi

`apps/web/test/concurrency.db.test.ts` (6 tes, Postgres sungguhan, transaksi paralel):

| Kasus | Hasil |
|---|---|
| Jawaban yang sama disimpan 6 kali bersamaan (satu `clientId`, lalu `clientId` berbeda) | Satu baris `response`, XP di `xp_event` sama dengan XP di baris jawaban. |
| 10 jawaban paralel pada skill yang sama | Sebelum perbaikan gagal (2 dari 8); sesudah, `n_answers` tepat. |
| Kumpul sesi 4 kali bersamaan | Sebelum perbaikan XP sesi 4 kali; sesudah, satu. Lencana unik per learner. |
| Peti harian dibuka 6 kali bersamaan | Tepat satu berhasil, satu baris `daily_chest`. |
| 24 percobaan PIN salah bersamaan | Paling banyak 5 pemeriksaan sebelum terkunci, PIN benar ditolak setelahnya. Sudah benar sejak awal (`UPDATE` atomik sebelum Argon2). |
| 8 pendaftaran bersamaan dengan satu email (huruf besar dan kecil) | Tepat satu akun (indeks unik `lower(email)`). Layanan pendaftaran (cabang akun) belum ada di cabang ini; tes ini mengunci aturan di database. Skenario k6 `signup` menguji alurnya setelah digabung. |

Tes lain: `apps/web/test/limiter.test.ts` (pembatas tanpa Valkey), `apps/web/test/kv.test.ts` (klien Valkey, jalan bila `KIRA_TEST_VALKEY_URL` diisi), `packages/db/test/sourcing-orgs.test.ts` (daftar org sourcing).

## 9. Tidak diuji atau belum

- **Pendaftaran dan verifikasi massal** (skenario `signup`, Mailpit): kodenya ada di cabang akun, belum di cabang ini. Skenario sudah ditulis menurut `signUpAction`, `verifySignupAction`, dan tautan `/daftar/konfirmasi/<token>`, tetapi belum pernah dijalankan.
- **Lewat Cloudflare:** semua uji di dalam PC. Latensi 0,35 sampai 0,45 detik per permintaan, cache tepi, dan batas Tunnel tidak ikut.
- **Suara Qwen di GPU** berjalan bersamaan dengan beban web: tidak ikut; di staging TTS mati dan klip suara berupa berkas palsu yang disajikan proxy.
- **Uji akhir** pada PC yang tenang setelah semua cabang digabung, termasuk 1000 anak dan soak 30 menit penuh.
