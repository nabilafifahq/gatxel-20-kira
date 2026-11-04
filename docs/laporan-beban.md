# Laporan beban Kira

Uji akhir sebelum pembukaan pukul 06.00 WIB, Kamis 5 November 2026, dijalankan antara 03.17 dan 04.38 WIB di cabang `pilot/beban`. Semua angka dari staging (project `kirastg`, 4 replika web, seperti produksi) di PC server yang sama. Database dan keluarga di staging fiktif. Bagian "Uji sebelumnya" di akhir berasal dari 4 November malam.

## Ringkasan untuk pemilik

**Apa arti 100 kursi.** 100 keluarga, masing-masing paling banyak 5 anak. Yang membebani server adalah anak yang aktif pada saat yang sama, dan itu biasanya jauh lebih sedikit dari jumlah anak terdaftar. Pada 100 anak aktif bersamaan: tidak ada galat, Today p95 219 ms, simpan jawaban p95 62 ms (target 800 ms). Pada 500 anak aktif bersamaan: tidak ada galat, Today p95 242 ms, simpan jawaban p95 41 ms. Dari sisi server, 100 keluarga aman.

**Apa arti 1000.** Pada 1000 anak aktif bersamaan PC ini tetap melayani tanpa galat, tetapi lambat: Today p95 5,1 detik dan simpan jawaban p95 967 ms, keduanya lewat target. Jadi batas jujur PC ini: target terpenuhi pada 500, gagal pada 1000. Titik di antara keduanya tidak diukur. Unggahan rumah juga mulai habis di sini: puncak 52 Mbps melawan sekitar 29 Mbps bila klip suara tidak disimpan Cloudflare.

**Apakah RTX 5070 Ti sanggup?** Ya, karena kartu itu tidak dipakai saat anak belajar. Suara anak adalah berkas MP3 yang sudah direkam dan disajikan dari disk. Selama semua uji, pemakaian GPU rata-rata di bawah 1 persen (paling tinggi 9 persen, sekali, saat Chrome agen lain juga berjalan; penyebabnya tidak dipastikan) dan memori GPU tetap sekitar 2,8 GB. Yang menentukan batas adalah CPU 12 thread dan unggahan rumah. Satu syarat: `kira-tts-1` harus tetap mati (sudah ada di `CUTOVER.md`). Bila anak menekan tombol baca pada soal yang klipnya belum ada, sistem memang mencoba memanggil layanan suara (lihat bagian 3).

**Batas kursi.** 151 percobaan daftar dalam 2 menit dengan batas 100: tepat 100 kursi terisi. Tidak ada kursi ke-101.

**Dua masalah besar yang ditemukan dan sudah diperbaiki malam ini:**

1. **Situs bisa mati total.** Pada percobaan pertama 1000 anak, 70,93 persen permintaan gagal dan seluruh situs menjawab "no upstreams" selama uji berjalan. Penyebabnya: beberapa fungsi meminta sambungan database kedua sambil memegang yang pertama, sampai semua sambungan saling menunggu. Sekarang sudah diperbaiki, dan pada 1000 anak galatnya 0,00 persen.
2. **Setiap anak mengunduh seluruh suara hari itu saat pertama membuka aplikasi.** Di peramban sungguhan: 303 klip, 5,0 MB, tanpa menekan apa pun. Sekarang hanya klip soal yang tampil dan soal berikutnya: 12 klip, 120 KB di soal pertama. Konsekuensinya saat internet putus: soal yang klipnya sudah diambil tetap berbunyi, soal lain menulis pesan bahwa suara gagal dimuat dan tidak berbunyi, karena suara perangkat sudah dihapus untuk anak.

**Yang tidak diuji** (bagian 7): jalur lewat Cloudflare, unggahan dan Wi-Fi rumah yang sebenarnya, SMTP sungguhan, lonjakan 0 ke 500 dalam 30 detik, soak 15 menit, dan 300 anak pada kode akhir.

## 1. Hasil per tahap

Satu anak aktif adalah satu pengguna virtual k6 dengan waktu berpikir 4 sampai 12 detik per soal. Target: Today dan simpan jawaban di bawah 800 ms pada p95, galat di bawah 0,5 persen.

| Anak aktif | Kode | Galat HTTP | Today p95 | Simpan jawaban p95 | Target |
|---:|---|---:|---:|---:|---|
| 100 | Perbaikan sambungan dan pemeriksaan klip, semua klip diunduh di muka | 0,00% | 219 ms | 62 ms | Tercapai |
| 300 | Perbaikan sambungan, semua klip diunduh di muka, sebelum perbaikan pemeriksaan klip | 0,00% | 1874 ms | 531 ms | Today gagal |
| 500 | Perbaikan sambungan dan pemeriksaan klip, semua klip diunduh di muka | 0,00% | 3296 ms | 5191 ms | Gagal |
| **500** | **Kode akhir, klip per soal** | **0,00%** | **242 ms** | **41 ms** | **Tercapai** |
| 1000 | Sebelum perbaikan apa pun | 70,93% | 59967 ms | 59155 ms | Situs mati |
| **1000** | **Kode akhir, klip per soal** | **0,00%** | **5123 ms** | **967 ms** | **Gagal, tanpa galat** |

Baris tebal adalah keadaan yang akan dipasang. 100 anak tidak diulang pada kode akhir; beban klipnya saat diukur lebih berat daripada kode akhir. 300 anak juga tidak diulang karena waktunya habis, jadi angka 300 di atas lebih buruk dari yang akan dialami, tetapi tidak ada angka akhirnya.

Rincian lengkap (CPU puncak: 100 persen sama dengan satu inti; RAM total empat replika web):

| Uji | Permintaan per detik | p50 ms | p95 ms | p99 ms | Galat HTTP | Transaksi berhasil | Today p95 ms | Simpan jawaban p95 ms | CPU puncak web/db/proxy | RAM web MiB | Sambungan Postgres | Hit Valkey | Mbps keluar rata-rata/puncak |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 anak, semua klip di muka | 142 | 6 | 26 | 77 | 0,00% | 100,00% | 219 | 62 | 89/65/63% | 1842 | 48, antre 0 | 72% | 18/64 |
| 300 anak, semua klip di muka, sebelum perbaikan klip | 343 | 60 | 161 | 1260 | 0,00% | 100,00% | 1874 | 531 | 300/113/170% | 1894 | 42, antre 18 | 74% | 43/76 |
| 500 anak, semua klip di muka | 535 | 206 | 874 | 2300 | 0,00% | 100,00% | 3296 | 5191 | 286/128/323% | 1925 | 48, antre 16 | 70% | 69/111 |
| 1000 anak, sebelum perbaikan saling tunggu | 116 | 3009 | 3049 | 59967 | 70,93% | 1,42% | 59967 | 59155 | 269/73/152% | 1403 | 55, antre 18 | 7% | 5/92 |
| 500 anak | 130 | 12 | 54 | 165 | 0,00% | 100,00% | 242 | 41 | 225/148/34% | 1922 | 45, antre 0 | 74% | 14/24 |
| 1000 anak | 257 | 20 | 1159 | 3550 | 0,00% | 100,00% | 5123 | 967 | 353/243/74% | 2026 | 45, antre 18 | 73% | 29/52 |

Sambungan Postgres adalah total puncak; "antre" adalah klien yang menunggu di PgBouncer. Mbps adalah data keluar dari proxy tanpa overhead Tunnel, dengan kompresi gzip seperti Cloudflare ke origin.

### Per endpoint

(p50/p95/p99 dalam ms. Kolom 100 anak sebelum klip per soal, kolom 500 dan 1000 kode akhir.)

| Endpoint | 100 anak p50/p95/p99 | 500 anak p50/p95/p99 | 1000 anak p50/p95/p99 | Galat HTTP terburuk |
|---|---:|---:|---:|---:|
| Today | 70/219/554 | 70/242/408 | 232/5123/6362 | 0,00% |
| Simpan jawaban | 19/62/82 | 19/41/66 | 47/967/1904 | 0,00% |
| Kumpul sesi | 31/71/101 | 32/68/103 | 68/309/566 | 0,00% |
| Halaman sesi | 19/44/58 | 22/45/64 | 56/3647/5286 | 0,00% |
| Status suara | 47/238/382 | 4/7/11 | 7/22/44 | 0,00% |
| Klip suara | 6/16/35 | 8/16/23 | 13/38/111 | 0,00% |
| Berkas kamus | 18/30/36 | 19/35/45 | 36/88/112 | 0,00% |
| Practice hub | 23/60/103 | 23/46/59 | 64/4364/5418 | 0,00% |
| Mulai latihan bebas | 18/42/92 | 21/42/95 | 60/1456/1912 | 0,00% |
| Dek kartu | 19/65/71 | 20/41/62 | 62/2853/4275 | 0,00% |
| Selesai kartu | 32/108/135 | 33/57/110 | 127/2918/3611 | 0,00% |
| Bab Ruang Baca | 18/32/38 | 20/42/55 | 58/3121/4857 | 0,00% |
| Simpan tempat baca | 14/54/90 | 14/31/52 | 36/2270/3541 | 0,00% |
| Simpan kata kamus | 13/22/36 | 13/34/45 | 36/1674/3374 | 0,00% |
| Kira World (dompet) | 35/90/104 | 39/95/123 | 156/4722/5427 | 0,00% |
| Toko | 21/65/103 | 22/46/61 | 79/2933/5054 | 0,00% |
| Beli di toko | 32/104/146 | 31/67/101 | 140/5564/6675 | 0,00% |
| Album | 41/90/120 | 42/88/131 | 160/3121/4014 | 0,00% |
| Mulai bos | 35/41/45 | 37/70/90 | 110/3161/3869 | 0,00% |
| Giliran bos | 19/47/87 | 19/37/50 | 55/1412/1865 | 0,00% |
| Selesai bos | 30/56/61 | 32/66/73 | 83/394/755 | 0,00% |
| Tes penempatan | 28/41/44 | 29/59/69 | 86/3616/5161 | 0,00% |
| Jawab penempatan | 22/75/118 | 22/47/73 | 68/2108/3455 | 0,00% |
| Dasbor orang tua | 37/187/250 | 39/86/139 | 161/1823/2263 | 0,00% |
| Halaman anak | 58/116/127 | 59/114/212 | 278/1826/2192 | 0,00% |
| Ubah saklar orang tua | 80/200/267 | 91/192/227 | 361/3832/4425 | 0,00% |
| Kirim /feedback | 11/38/43 | 11/15/16 | 32/1500/1821 | 0,00% |
| Daftar | 966/986/990 | 958/1002/1004 | 984/3480/3740 | 0,00% |
| Verifikasi | 32/33/33 | 33/44/48 | 92/1811/2102 | 0,00% |
| Tambah anak | 55/68/69 | 57/88/103 | 241/3507/3943 | 0,00% |
| Masuk PIN | 42/58/58 | 32/51/62 | 87/1507/2022 | 0,00% |
| Masuk password | 35/55/59 | 36/44/46 | 129/1287/1994 | 0,00% |
| Jawab Quick Maths | 11/42/69 | 11/24/38 | 30/964/1777 | 0,00% |
| Jawab Quiz | 11/39/73 | 12/25/45 | 33/1301/1850 | 0,00% |
| Heartbeat | 8/24/44 | 8/16/29 | 13/1002/1838 | 0,00% |

Daftar selalu sekitar 1 detik karena `evenTime(900)` sengaja menyamakan waktu jawab. Semua fungsi baru masuk campuran `mixed` dan berjalan tanpa galat. Bobot per iterasi: sesi hari ini 38 persen, Quick Maths 8, Quiz 5, hanya Today 8, Practice hub 6, kartu 5, Ruang Baca dan kamus 6, tes penempatan 3, Kira World 7, bos 3, dasbor orang tua 3, orang tua mengubah saklar 3, /feedback 1, daftar dan verifikasi 1, PIN 2, password 1.

## 2. Titik patah

Dijalankan sebelum klip per soal, jadi semua klip masih lewat origin, dengan 1500 keluarga fiktif. Anak tangga 75 detik: 25 detik naik, 50 detik tahan.

| VU | p50 ms | p95 ms | p99 ms | Galat HTTP | Today p95 ms | Simpan jawaban p95 ms |
|---:|---:|---:|---:|---:|---:|---:|
| 1000 | 269 | 3786 | 17100 | 0,00% | 23335 | 7866 |
| 1500 | 627 | 4285 | 10277 | 0,00% | 16689 | 6060 |
| 2000 | 758 | 6789 | 17502 | 0,00% | 22334 | 8543 |
| 2500 | 963 | 8242 | 19319 | 0,00% | 25642 | 9756 |
| 3000 | 1188 | 10664 | 28247 | 0,00% | 38213 | 14555 |

Galat tidak pernah lewat 1 persen sampai 3000 VU, jadi titik patah menurut galat tidak tercapai. Angka ini terdengar lebih baik dari kenyataan: k6 menunggu jawaban sampai 60 detik, sehingga server yang kelebihan beban terlihat sebagai antrean, tidak sebagai galat. Anak sungguhan akan menyerah jauh sebelum itu. Batas yang berguna adalah waktu tunggu, dan itu sudah lewat pada 1000. Uji ini tidak diulang pada kode akhir.

Penyetelan lewat konfigurasi tidak dicoba malam ini karena waktu habis oleh dua perbaikan di atas, dan tampaknya tidak akan banyak menolong: pada 1000 anak CPU web 353 persen (empat replika hampir penuh), Postgres 243 persen, seluruh PC rata-rata 84 persen. Enam replika sudah dicoba 4 November dan lebih buruk. Mendorong 1000 ke target butuh CPU lebih banyak atau profil Today, yang paling berat.

## 3. Suara

- **Klip sungguhan:** 57.237 berkas (sekitar 1,6 GB, versi `piper-lessac-medium`) disalin dari `C:\kw4\tts-piper\tts` (sumber hanya dibaca) ke data staging, dengan `served-version.txt`. Salinan sudah dihapus. Klip p95 16 ms pada 500 anak dan 38 ms pada 1000 anak.
- **GPU:** dicuplik tiap 5 detik dengan `nvidia-smi` di semua uji. Rata-rata 0,1 sampai 0,4 persen. Puncak tertinggi 9 persen pada uji 100 anak; Chrome agen lain berjalan pada saat itu, tetapi penyebabnya tidak dipastikan. Memori 2,8 GB tetap, tanpa proses TTS. `kira-tts-1` diam.
- **Permintaan suara langsung:** `TTS_URL` di staging menunjuk penjaga kecil yang mencatat setiap permintaan. Semua uji k6: 0 permintaan. Tetapi k6 tidak pernah memanggil `/api/tts/request`. Di peramban sungguhan, menekan tombol baca pada soal yang klipnya belum ada (kemungkinan soal Matematika buatan generator) mengantrekan job `tts.clip`, dan worker memanggil `GET /health` ke layanan suara. Penjaga menjawab 503 dan job selesai dalam 26 ms. Jadi bila `kira-tts-1` menyala, tombol anak bisa sampai ke GPU. Bila mati, job dilewati.
- **Soal tanpa klip:** anak melihat "Suara soal ini belum siap. Lewati dulu dan lanjutkan." dan tidak ada bunyi. Berapa banyak soal buatan generator yang tidak punya klip belum dihitung.
- **Saat internet putus (peramban sungguhan):** soal berikutnya yang sudah dipramuat tetap berbunyi. Klip yang belum tersimpan memberi "Suaranya gagal dimuat. Periksa sambungan lalu coba lagi." Sesudah muat ulang saat offline tombolnya tetap ada dan pesannya sama. Belum dicoba di peramban: soal dengar sungguhan (memakai kode tombol yang sama), dan maju ke soal yang belum pernah dipramuat.

Byte sesi pertama di peramban sungguhan (Chromium tanpa layar, sampai soal pertama, dua anak berbeda pada seed berbeda; soal berikutnya tidak terukur karena skrip berhenti di soal pertama):

| | Sebelum | Sesudah |
|---|---:|---:|
| Klip suara | 303 klip, 5,0 MB | 12 klip, 120 KB |
| Aset statis (sekali per perangkat) | 1,2 MB | 1,2 MB |
| Kamus (sekali per perangkat) | 154 KB | 154 KB |
| Halaman dan API | 187 KB | 171 KB |
| Total | 6,5 MB | 1,6 MB |

Jumlah per soal sesudah perubahan (sekitar 6 klip) diambil dari angka ini dan dipakai skenario k6.

## 4. Batas kursi

`KIRA_BETA_SEATS=100`, 150 kedatangan dalam 120 detik, tabel kursi dikosongkan dulu. Tiap pendaftar: buka halaman, daftar, ambil tautan dari Mailpit, verifikasi, tambah anak pertama.

| Hasil | Jumlah |
|---|---:|
| Percobaan daftar | 151 |
| Ditolak saat daftar karena penuh, masuk daftar tunggu | 47 |
| Sempat menerima email, ditolak saat verifikasi karena penuh | 4 |
| Verifikasi berhasil | 100 |
| Baris `auth.beta_seat` di database | **100** |
| Menambah anak pertama | 100 |
| Galat HTTP | 0,00% |

Empat orang menerima tautan lalu mendapat jawaban penuh saat membukanya. Itu sesuai aturan kursi (kursi diambil saat verifikasi), dan orang tua perlu tahu kemungkinan ini. Verifikasi p95 36 ms. HaveIBeenPwned dan Turnstile mati di staging, dan surat masuk Mailpit.

## 5. Unggahan rumah

Dihitung dari byte terukur per anak per menit, rata-rata seluruh campuran. Klip di k6 memakai kunci acak (rata-rata 24,7 KB), sedangkan klip soal pertama di peramban sekitar 10 KB, jadi batas atas di bawah kemungkinan lebih tinggi dari kenyataan. Tanpa overhead Tunnel.

| | Per anak per menit | 100 anak aktif | 1000 anak aktif |
|---|---:|---:|---:|
| Halaman dan API (selalu lewat rumah) | 93 sampai 142 KB | 1,2 sampai 1,9 Mbps | 12 sampai 19 Mbps |
| Klip, bila Cloudflare belum menyimpan | 110 sampai 280 KB | 1,5 sampai 3,7 Mbps | 15 sampai 37 Mbps |
| **Total tanpa cache klip** | | **sekitar 3 sampai 6 Mbps** | **sekitar 27 sampai 56 Mbps** |
| **Total bila Cloudflare menyimpan klip** | | **sekitar 2 Mbps** | **sekitar 12 sampai 19 Mbps** |

Pembanding terukur dari proxy: 500 anak rata-rata 14 Mbps, puncak 24 Mbps; 1000 anak rata-rata 29 Mbps, puncak 52 Mbps. Sebelum klip per soal, 100 anak sudah mencapai puncak 64 Mbps.

**Apakah Cloudflare bisa menyimpan klip?** Dari sisi origin, bisa: `/tts/<kunci>.mp3` dijawab `Cache-Control: public, max-age=31536000, immutable`, tanpa `Set-Cookie`, dan `.mp3` termasuk ekstensi yang disimpan Cloudflare secara bawaan. Ini belum terbukti lewat Cloudflare sungguhan. Periksa setelah pindah: minta satu klip dua kali di `kira.gatxel.com` dan lihat `cf-cache-status: HIT`. Total semua klip sekitar 1,4 GB, jadi paling banyak sebesar itu yang pernah keluar lewat rumah. `/dict/*.json` juga bertanda immutable, tetapi `.json` tidak disimpan Cloudflare secara bawaan; 154 KB per perangkat sekali, dan tidak mendesak.

Untuk 100 keluarga, unggahan 29 Mbps cukup, dengan atau tanpa cache klip. Untuk 1000 anak aktif, cache klip menjadi syarat.

## 6. Perbaikan malam ini

| Commit | Masalah | Bukti | Perbaikan |
|---|---|---|---|
| `76497456` | Sambungan kedua diminta saat transaksi terbuka (Today pada setiap kunjungan, pembuatan sesi, tes penempatan, alat peraga, tambah anak). Semua sambungan saling menunggu sampai diputus 60 detik kemudian. | 34 sambungan `idle in transaction` selama 45 sampai 60 detik; 70,93% galat pada 1000 anak. | Dibaca lewat `tx` yang sama. Akun dan PIN anak dibuat sebelum transaksi. Penjaga `server/tx-guard.ts`: melempar di tes, mencatat di produksi. Tes database tidak pernah memicu lemparan ini. |
| `76497456` | Satu kali macet menjadi situs mati: cek sehat proxy menyentuh database, jadi semua replika keluar sekaligus. | "no upstreams" ribuan kali, padahal CPU web 0 persen. | Cek sehat proxy `/api/health?scope=live` tanpa database, dua kali gagal baru keluar, status 503 tidak dihitung. Transaksi web menganggur diputus setelah 15 detik; worker dan cadangan tetap 60 detik. Setelah perbaikan: 0 "no upstreams" di semua uji. |
| `32eddc05` | `/api/tts/today` memeriksa sekitar 283 berkas sambil memegang transaksi. | p50 6 detik pada 300 anak. | Di luar transaksi; kemudian dihapus bersama daftar klip pada baris berikut. |
| `d3dfe443`, `cf2a40e3` | Peramban mengunduh seluruh klip hari itu di muka. | 303 klip, 5,0 MB di peramban sungguhan. | Klip soal ini dan soal berikutnya saja. Status suara terakhir diingat untuk offline. Tombol suara menulis alasan bila klip gagal. Status suara kini p95 7 ms pada 500 anak. |

Sambungan kedua pada pool auth di dalam transaksi tetap ada (`learnerUiPrefs`, bahasa anak) dan hanya dicatat. Pool itu tidak bisa ikut saling menunggu, karena pemegang sambungan auth tidak pernah meminta sambungan app. Pemindaian kode berdasarkan nama fungsi, jadi yang terlewat akan muncul di log dengan pesan "sambungan kedua diminta saat transaksi terbuka". Selama uji akhir hanya baris auth yang muncul.

## 7. Batas uji ini

- **Satu PC.** k6, web, Postgres, dan proxy bersaing di 12 thread yang sama. Di produksi k6 tidak ada, jadi bagian CPU itu (28 sampai 141 persen satu inti) bebas.
- **Jalur dalam, tanpa Cloudflare.** Latensi Cloudflare (sebelumnya terukur 0,35 sampai 0,45 detik per permintaan), cache tepi, batas Tunnel, dan https tidak ikut.
- **Unggahan rumah (sekitar 29 Mbps) dan Wi-Fi tidak dilalui.** Bagian 5 adalah perhitungan.
- **Pengukuran pendek.** 500 dan 1000 pada kode akhir hanya 60 detik tahan, sudah termasuk pembuatan sesi pertama hari itu untuk semua anak, yang terberat. Uji 1000 akhir dimulai tepat sesudah tes database selesai dan saat PC lebih sibuk (CPU PC rata-rata 84 persen) dibanding uji 500 (57 persen), jadi perbandingan keduanya tidak sepenuhnya setara.
- **Tidak dijalankan karena waktu:** lonjakan 0 ke 500 dalam 30 detik, soak 15 menit, 300 anak pada kode akhir, dan uji batas pada kode akhir. Pendaftaran di uji kursi berjalan pada image sebelum klip per soal; kode kursinya tidak berubah.
- **Bukan pengguna sungguhan.** k6 tidak menjalankan JavaScript halaman. Byte statis dan klip diukur terpisah di peramban. Mailpit dan seed menulis data fiktif. HaveIBeenPwned mati dan email tidak keluar.

## 8. Keadaan PC saat uji

Bukan PC yang tenang. Tercatat tiap 30 detik: Steam memakai 85 sampai 100 persen satu inti sepanjang malam (bukan kerja Kira, tidak disentuh), `dllhost` sampai 100 persen, `chrome-headless-shell` agen lain sampai 150 persen, tumpukan `kiraqa` (11 kontainer) dan Postgres agen lain. Kontainer selain staging memuncak 28 sampai 355 persen satu inti. CPU seluruh PC rata-rata: 54 persen pada 100 anak, 91 persen pada 300, 57 persen pada 500 akhir, 84 persen pada 1000 akhir, 99 persen pada uji batas. Uji ini tidak menyentuh kontainer produksi. Kontainer produksi baru terlihat menyala sejak sekitar 04.36 (pindah ke susunan baru), jadi uji 500 akhir sebagian berjalan bersamaan dengan itu, dan angka 355 persen di atas ikut memuatnya. Stack staging dan volumenya dihapus pukul 04.38.

## 9. Mengulang

Lihat `docs/pasang-windows.md` bagian 16 dan `deploy/load/README.md`.

# Uji sebelumnya (4 November malam, cabang `pilot/kapasitas`)

Bagian di bawah berasal dari kode dan klip palsu waktu itu. Angka latensinya sudah digantikan bagian di atas. Temuan dan uji gangguannya tetap berlaku.

## Gangguan

Selama beban 300 anak: Valkey dimatikan 25 detik, replika web nomor 2 dimatikan paksa (`docker kill`) 45 detik, lalu PgBouncer di-restart (dua kali, karena tumpang tindih dengan pemulihan replika).

- Transaksi bisnis gagal: 18 dari 10.702 (0,17 persen). Galat HTTP 0,01 persen.
- p95 naik dari 177 ms ke 749 ms, p99 dari 453 ms ke 1802 ms, lalu kembali normal setelah gangguan.
- Valkey mati: web memakai cadangan di memori (batas laju per replika, sesi dibaca dari database), tidak ada galat yang terlihat anak.
- Replika mati: Caddy menandainya tidak sehat (cek aktif tiap 5 detik, pasif setelah 3 kegagalan) dan memindahkan permintaan; sebagian permintaan yang sedang berjalan di replika itu gagal.
- PgBouncer restart: sambungan dibuat ulang oleh pool postgres.js; permintaan yang sedang berjalan gagal, yang berikutnya berhasil.

## Hambatan yang ditemukan dan perbaikan

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

## Uji konkurensi

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
