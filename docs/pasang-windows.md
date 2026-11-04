# Memasang Kira di server rumah (Windows 11)

Panduan ini untuk PC server di rumah: Windows 11 Pro, Ryzen 5, RAM 64 GB, RTX 5070 Ti, SSD 2 TB. Kira berjalan di Docker Desktop, dan semua perangkat keluarga membukanya lewat Cloudflare Tunnel di alamat `https://kira.gatxel.com`. Tidak ada port yang dibuka di router: `cloudflared` di PC membuat sambungan keluar ke Cloudflare (ADR 0008).

Yang berjalan di Docker:

| Layanan | Isi |
|---|---|
| `db` | Postgres 17 dengan TLS. Hanya terhubung ke jaringan internal Docker, tanpa akses internet. |
| `certs` | Membuat sertifikat TLS lokal untuk database sekali di awal. |
| `migrate` | Menjalankan migrasi database setiap kali stack dinyalakan, lalu berhenti. Dipakai juga untuk perintah admin. |
| `proxy` | Caddy di `127.0.0.1:3030` (ubah lewat `KIRA_PROXY_PORT`). Cloudflare Tunnel meneruskan alamat https ke sini. Membagi beban ke replika web, menyajikan berkas statis dan klip suara langsung, menutup `/api/internal`. |
| `web` | Aplikasi Next.js, beberapa replika (`KIRA_WEB_REPLICAS`, bawaan 4), tanpa port ke host. |
| `pgbouncer` | Pooling sambungan database (mode transaksi) antara web dan Postgres. Hanya jaringan internal. |
| `valkey` | Pembatas laju dan cache sesi bersama semua replika. Hanya jaringan internal, password dari `.env`. Hanya cache: bila mati, Kira tetap jalan. |
| `worker` | Job AI (Claude Max lewat Claude Code, atau ai.gatxel.com), impor PDF, email, laporan mingguan, retensi data, penghapusan akun. |
| `backup` | `pg_dump` setiap hari pukul 02.00 WIB ke folder Windows, simpan 14 harian dan 8 mingguan. |

## 1. Siapkan Windows

1. Pastikan virtualisasi aktif (Task Manager, tab Performance, CPU, baris Virtualization: Enabled). Kalau Disabled, aktifkan SVM di BIOS.
2. Buka PowerShell sebagai Administrator, jalankan `wsl --install`, lalu restart.
3. Pasang [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) dengan backend WSL 2. Di Settings, General, centang Start Docker Desktop when you sign in.
4. Pasang [Git for Windows](https://git-scm.com/download/win) dan [GitHub CLI](https://cli.github.com/), lalu masuk: `gh auth login`.
5. Pasang Node.js LTS, dipakai sekali untuk membuat token Claude di bagian 5: `winget install OpenJS.NodeJS.LTS`. Tutup lalu buka lagi PowerShell supaya `node` dan `npm` dikenali.
6. Izinkan skrip lokal sekali (untuk `kira.ps1`, `npm`, dan `claude`): `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
7. Siapkan domain yang DNS-nya dikelola Cloudflare (di sini `gatxel.com`) dan pasang [cloudflared untuk Windows](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/): `winget install Cloudflare.cloudflared`. Kalau PC ini sudah punya tunnel (di server Kira namanya `gatxel-PC`), pakai tunnel itu.
8. Aktifkan autentikasi dua langkah di akun Cloudflare pemilik domain. Siapa pun yang menguasai akun itu bisa mengalihkan alamat Kira.
9. Atur daya supaya server tidak tidur: Settings, System, Power, Screen and sleep, set When plugged in, put my device to sleep ke Never. Atur Active hours di Windows Update supaya restart otomatis terjadi di luar jam belajar.
10. Disarankan: aktifkan BitLocker di drive data (Settings, Privacy and security, Device encryption atau BitLocker), karena folder data berisi rekaman dan foto jawaban anak.

Opsional, batasi memori WSL supaya Windows tetap lega. Buat `C:\Users\<nama>\.wslconfig`:

```ini
[wsl2]
memory=16GB
processors=6
```

Lalu jalankan `wsl --shutdown` dan buka Docker Desktop lagi.

## 2. Ambil kode dan buat folder data

```powershell
git clone https://github.com/nabilafifahq/gatxel-20-kira.git C:\Kira\app
New-Item -ItemType Directory -Force D:\Kira\data, D:\Kira\backups | Out-Null
cd C:\Kira\app
.\deploy\windows\kira.ps1 init
```

`init` membuat `.env` dari `.env.example` dan mengisi semua rahasia bertanda `GANTI` dengan nilai acak 48 karakter. Kalau drive D tidak ada, pakai folder lain dan ubah `KIRA_HOST_DATA` dan `KIRA_HOST_BACKUPS` di `.env`.

## 3. Alamat lewat Cloudflare Tunnel

Alamat Kira adalah `https://kira.gatxel.com`. Salin alamat itu (tanpa garis miring di akhir) ke `KIRA_ORIGIN` di `.env`. Alamat ini juga dipakai untuk passkey, tautan email, dan APK tablet, jadi jangan diganti setelah keluarga mulai memakai Kira.

Hubungkan nama itu ke proxy di PC. Port proxy bawaan compose adalah 3030 (`KIRA_PROXY_PORT` di `.env`). Web sendiri tidak punya port ke host.

**Lewat dasbor Cloudflare** (cara paling mudah): Zero Trust, Networks, Tunnels, pilih tunnel PC ini, tab Published application routes, Add. Hostname `kira.gatxel.com`, Service type HTTP, URL `127.0.0.1:3030`. Cloudflare membuat catatan DNS-nya sendiri.

**Lewat berkas konfigurasi** (tunnel baru):

```powershell
cloudflared tunnel login
cloudflared tunnel create kira
cloudflared tunnel route dns kira kira.gatxel.com
```

Lalu isi `C:\Users\<nama>\.cloudflared\config.yml`:

```yaml
tunnel: <ID tunnel>
credentials-file: C:\Users\<nama>\.cloudflared\<ID tunnel>.json
ingress:
  - hostname: kira.gatxel.com
    service: http://127.0.0.1:3030
  - service: http_status:404
```

Pasang sebagai layanan Windows supaya jalan sendiri setelah restart: `cloudflared service install`. Cek dengan `cloudflared tunnel info kira`, lalu buka `https://kira.gatxel.com/api/health`.

Pengaturan Cloudflare untuk domain ini:

- Matikan Web Analytics otomatis dan Rocket Loader. Keduanya menyisipkan skrip ke halaman, dan CSP Kira melarang skrip luar. Kira juga mengirim `Cache-Control: no-store, no-transform`, jadi Cloudflare tidak menyimpan atau mengubah halaman.
- Jangan memasang aturan cache untuk `/api` dan halaman Kira. Hanya `/_next/static`, `/icons`, `/fonts`, dan `/sounds` yang boleh disimpan.
- Kira terbuka untuk internet publik. Perlindungannya ada di aplikasi (password, passkey, perangkat terdaftar, PIN gambar dengan batas percobaan). Simpan `KIRA_SETUP_TOKEN` sebagai rahasia sampai akun pertama dibuat. Opsional: aturan rate limiting Cloudflare untuk halaman masuk.
- Saat server atau tunnel mati, Cloudflare menjawab 502 sampai 504 atau 520 sampai 530 (misalnya 521 saat server mati, 530 saat tunnel putus). Tablet menampilkan halaman offline dan jawaban tersimpan di perangkat.

## 4. Isi `.env`

Buka `C:\Kira\app\.env` di Notepad. `KIRA_SECRET`, `KIRA_INTERNAL_TOKEN`, `KIRA_SETUP_TOKEN`, dan lima password database sudah diisi acak oleh `kira.ps1 init`. Yang diisi sendiri:

- `KIRA_ORIGIN`: alamat dari bagian 3.
- `KIRA_LEGAL_NAME`, `KIRA_LEGAL_ADDRESS`, `KIRA_LEGAL_EMAIL`: identitas pengelola. Nilai ini muncul di halaman Kebijakan Privasi dan Ketentuan (`/privasi`, `/ketentuan`) yang wajib dibaca orang tua sebelum memberi persetujuan.
- `CLAUDE_CODE_OAUTH_TOKEN`: bagian 5.

Untuk mengganti satu rahasia nanti, buat nilai acak 48 karakter di PowerShell:

```powershell
$b = New-Object byte[] 24; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); -join ($b | ForEach-Object { $_.ToString('x2') })
```

Simpan salinan `.env` di pengelola kata sandi. Tanpa file ini, cadangan database tetap bisa dipulihkan, tetapi semua password database dan rahasia harus dibuat ulang.

## 5. AI lewat langganan Claude Max

Worker memakai Claude Code CLI dengan token langganan. Token dibuat di komputer mana pun yang sudah masuk ke akun Claude Max:

```powershell
npm install -g @anthropic-ai/claude-code   # atau ikuti https://docs.claude.com/en/docs/claude-code/setup
claude setup-token
```

Salin token yang tampil ke `CLAUDE_CODE_OAUTH_TOKEN` di `.env`. Token berlaku satu tahun; catat tanggalnya. Model diatur lewat `CLAUDE_MODEL_AUTHOR` (menulis soal) dan `CLAUDE_MODEL_FAST` (menilai dan tes koneksi).

Worker menjalankan Claude tanpa alat apa pun (tidak bisa membaca berkas atau variabel lingkungan) dan tidak pernah mengirim nama, email, atau data identitas anak. Semua hasil AI menjadi draf yang harus disetujui tutor di Studio AI. Saat batas pemakaian langganan habis, job menunggu sampai waktu reset lalu jalan sendiri.

Untuk memakai model lokal Gatxel di ai.gatxel.com atau DeepInfra, ubah `.env`:

```ini
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://ai.gatxel.com/v1
AI_API_KEY=<kunci API>
AI_MODEL=<nama model>
```

Untuk DeepInfra, `AI_BASE_URL=https://api.deepinfra.com/v1/openai` dan nama model diambil dari dasbor DeepInfra. Setelah mengubah `.env`, jalankan `docker compose up -d worker web`. Untuk mematikan semua fitur AI, isi `AI_PROVIDER=none`.

## 6. Nyalakan Kira

```powershell
cd C:\Kira\app
docker compose up -d --build
docker compose ps
```

Build pertama sekitar 5 sampai 10 menit. Setelah selesai, `docker compose ps -a` menampilkan `web`, `worker`, `db`, dan `backup` berstatus running atau healthy, sedangkan `certs` dan `migrate` berstatus exited (0). Tanpa `-a`, layanan yang sudah selesai tidak ditampilkan. Kalau ada yang gagal, lihat lognya: `docker compose logs --tail 100 web`.

Perintah singkat ada di `deploy\windows\kira.ps1`:

```powershell
.\deploy\windows\kira.ps1 status     # status layanan dan isi database
.\deploy\windows\kira.ps1 logs web   # log satu layanan
.\deploy\windows\kira.ps1 update     # git pull lalu build ulang
.\deploy\windows\kira.ps1 backup     # cadangan database sekarang
.\deploy\windows\kira.ps1 apk        # ambil APK terbaru dari GitHub ke folder data
.\deploy\windows\kira.ps1 admin reset-link alamat@email.com
```

Kalau PowerShell menolak skrip, jalankan langkah 6 di bagian 1.

## 7. Setup pertama

1. Dari laptop mana pun, buka `https://kira.gatxel.com/setup`.
2. Isi token setup (`KIRA_SETUP_TOKEN`), nama keluarga, nama tutor, email, dan password minimal 13 karakter dengan huruf kapital, angka, dan simbol. Halaman ini hanya bisa dipakai saat database masih kosong.
3. Konsol terbuka di halaman Learner. Tambahkan learner (nama panggilan, grade, avatar, PIN 4 gambar) dan isi email orang tua untuk mengirim undangan. Tanpa SMTP, tautan undangan tampil di layar dan di Laporan, kotak keluar.
4. Learner baru aktif setelah ada persetujuan orang tua: orang tua menerima undangan lalu menyetujui di halaman Privasi, atau tutor mencatat persetujuan tertulis di halaman Learner.
5. Pasang passkey di Pengaturan supaya tutor bisa masuk tanpa mengetik password.

## 8. Tablet anak

1. Pastikan tablet terhubung ke internet. Tidak perlu aplikasi tambahan.
2. Pakai aplikasi Kira (bagian 9) atau buka alamat Kira di Chrome lalu pilih Add to Home screen.
3. Di tablet, tutor masuk lalu buka `/perangkat` (atau Pengaturan, Daftarkan perangkat ini) dan pilih learner yang memakai tablet itu. Tutor otomatis keluar dari tablet.
4. Anak memilih avatarnya lalu mengetuk 4 gambar PIN.

Tablet menyimpan quest hari ini setelah layar Today terbuka, jadi quest tetap bisa dikerjakan saat internet rumah putus. Jawaban terkirim sendiri saat tablet online lagi.

## 9. Aplikasi Android (APK)

APK dibangun di GitHub Actions (workflow `android-apk`). Detail lengkap ada di `docs/android.md`.

1. Sekali saja, simpan alamat server sebagai variabel repo supaya setiap build memakai alamat yang benar: `gh variable set KIRA_URL --repo nabilafifahq/gatxel-20-kira --body https://<alamat>`.
2. Jalankan workflow: `gh workflow run android-apk --repo nabilafifahq/gatxel-20-kira -f kira_url=https://<alamat>`.
3. Setelah selesai, ambil APK ke server: `.\deploy\windows\kira.ps1 apk`. Berkas tersimpan di `<KIRA_HOST_DATA>\apk\kira.apk`.
4. Di tablet, tutor masuk ke Kira di browser, buka Pengaturan, bagian Aplikasi tablet Android, lalu unduh dan pasang APK.

Untuk pembaruan tanpa copot pasang, buat kunci rilis tetap (bagian 3 di `docs/android.md`).

## 10. Email (opsional)

Tanpa SMTP, Kira tetap jalan: undangan, laporan mingguan, dan konfirmasi hapus akun menunggu di kotak keluar (konsol, Laporan) dan tautannya bisa disalin manual. Untuk Gmail, buat App Password di akun Google (butuh verifikasi 2 langkah), lalu:

```ini
SMTP_URL=smtps://alamat%40gmail.com:APP_PASSWORD_TANPA_SPASI@smtp.gmail.com:465
SMTP_FROM="Kira <alamat@gmail.com>"
```

`@` di nama pengguna ditulis `%40`. Jalankan `docker compose up -d worker web`.

Laporan mingguan otomatis terkirim setiap Minggu pukul 19.00 WIB ke orang tua yang menyetujui laporan lewat email.

Pesan dari halaman Bantuan (`/feedback`) dikirim ke `KIRA_SUPPORT_EMAIL` (boleh beberapa, dipisah koma; kosong berarti `KIRA_LEGAL_EMAIL`). Alamat pertama juga menjadi `Reply-To` email keluar. Supaya pesan tidak masuk spam, domain di `SMTP_FROM` perlu SPF, DKIM, dan DMARC yang benar di DNS. Isi juga `KIRA_TURNSTILE_SITE_KEY` dan `KIRA_TURNSTILE_SECRET`, karena pengirim publik baru menerima balasan otomatis bila lolos Turnstile.

Untuk mengirim satu contoh setiap jenis email lewat SMTP produksi:

```powershell
.\deploy\windows\kira.ps1 admin email-samples alamat@contoh.com
```

Bila SMTP bermasalah, pesan Bantuan tetap tersimpan dan bisa dibaca dengan `.\deploy\windows\kira.ps1 admin support-tickets`.

### Menghapus satu keluarga atas permintaan orang tua

Selama pilot, orang tua meminta lewat halaman Bantuan (`/feedback`) atau WhatsApp. Jawab paling lambat 3 x 24 jam dan pastikan permintaan datang dari alamat email akun itu.

1. `.\deploy\windows\kira.ps1 admin family-delete <email>` hanya menampilkan jumlah data dan id keluarga, tanpa mengubah apa pun. Bentuk email Gmail dengan titik atau +tag sama-sama dikenali.
2. `.\deploy\windows\kira.ps1 admin family-delete <email> --confirm <id keluarga>` menjeda semua anak dan membuat permintaan hapus biasa. Data anak dihapus worker 7 hari kemudian, dan orang tua masih bisa membatalkannya dari halaman Privasi. Kabari orang tua tanggalnya.
3. Setelah tanggal itu, jalankan perintah yang sama sekali lagi. Akun orang tua dan sisa data keluarga terhapus, dan kursinya kosong. Harus selesai paling lambat 30 hari sejak permintaan, sesuai Kebijakan Privasi.

Catatan audit (12 bulan), pesan bantuan (12 bulan), email yang sudah terkirim (90 hari), dan cadangan (8 minggu) hilang sendiri saat lama simpannya habis. Keluarga bertutor tidak dilayani perintah ini.

## 11. Cadangan dan pemulihan

Layanan `backup` membuat cadangan database setiap hari pukul 02.00 WIB ke `KIRA_HOST_BACKUPS\daily`, menyalin cadangan hari Minggu ke `weekly`, dan menyimpan 14 harian dan 8 mingguan. Kalau server mati saat jadwal, cadangan dibuat saat layanan menyala lagi. Status terakhir tampil di konsol, Pengaturan, bagian Cadangan.

Cadangan database tidak berisi berkas di `KIRA_HOST_DATA` (rekaman, foto, PDF impor, APK). Salin folder `D:\Kira\data` dan `D:\Kira\backups` ke drive eksternal atau penyimpanan cloud setidaknya seminggu sekali, misalnya dengan File History atau robocopy:

```powershell
robocopy D:\Kira E:\CadanganKira /MIR /R:1 /W:1
```

Memulihkan database dari satu cadangan:

```powershell
cd C:\Kira\app
docker compose stop web worker
docker compose exec -e PGSSLMODE=verify-full -e PGSSLROOTCERT=/certs/ca.crt backup sh -c 'pg_restore --clean --if-exists --no-owner --single-transaction -d "$DATABASE_URL_OWNER" /backups/daily/kira-20261012-0200.dump'
docker compose start web worker
```

Ganti nama berkas dengan cadangan yang dipilih (`dir D:\Kira\backups\daily`). `--single-transaction` membuat pemulihan berhasil seluruhnya atau tidak mengubah apa pun. Setelah itu jalankan `.\deploy\windows\kira.ps1 status`: baris `privileges` harus berisi `sesuai migrasi`. Uji pemulihan sekali setelah pemasangan supaya langkahnya sudah dikenal sebelum dibutuhkan.

Cadangan dari versi yang lebih lama dari database sekarang tidak bisa dipulihkan dengan perintah di atas: `pg_restore` berhenti dengan `cannot drop constraint`, karena tabel baru masih merujuk tabel lama (tidak ada data yang berubah). Buat ulang database lebih dulu, lalu jalankan perintah di atas dan `kira.ps1 status`:

```powershell
docker compose stop web worker
docker compose exec db psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "DROP DATABASE kira WITH (FORCE)" -c "CREATE DATABASE kira OWNER kira_owner ENCODING 'UTF8' TEMPLATE template0" -c "REVOKE ALL ON DATABASE kira FROM PUBLIC" -c "GRANT CONNECT ON DATABASE kira TO kira_app, kira_auth, kira_worker"
docker compose exec db psql -v ON_ERROR_STOP=1 -U postgres -d kira -c "ALTER SCHEMA public OWNER TO kira_owner" -c "REVOKE ALL ON SCHEMA public FROM PUBLIC"
```

Setelah memulihkan cadangan lama, jalankan kode yang cocok dengan cadangan itu. Kode baru menjalankan migrasinya lagi lewat layanan `migrate`.

## 12. Pembaruan

```powershell
.\deploy\windows\kira.ps1 update
```

Perintah ini menarik kode terbaru, membangun ulang image, dan menjalankan migrasi database otomatis. Cadangan dibuat dulu kalau mau aman: `.\deploy\windows\kira.ps1 backup`.

Next.js merilis pembaruan keamanan setiap bulan. Repo memakai Dependabot dengan jeda 3 hari setelah rilis; gabungkan PR pembaruan setelah CI hijau, lalu jalankan `update` di server. Cek juga Docker Desktop, Windows Update, dan `cloudflared` (`cloudflared update`) setiap bulan.

## 13. Masalah yang sering muncul

| Gejala | Penyebab dan langkah |
|---|---|
| Tablet menampilkan "No internet right now" | Internet tablet putus, server mati, atau tunnel putus (Cloudflare menjawab 521 atau 530). Cek `docker compose ps` dan layanan `cloudflared` di server (`Get-Service cloudflared`). |
| Passkey gagal dibuat atau dipakai | `KIRA_ORIGIN` tidak sama dengan alamat di browser. Samakan, lalu `docker compose up -d --build web` (alamat juga masuk ke build). |
| Lupa password tutor dan email belum diatur | `.\deploy\windows\kira.ps1 admin reset-link alamat@email.com`, buka tautan yang tampil dalam 30 menit. |
| Akun terkunci setelah banyak percobaan | `.\deploy\windows\kira.ps1 admin unlock alamat@email.com`. |
| PIN anak terkunci | Konsol, Learner, Buka kunci, atau `admin pin-unlock <nama>`. |
| Studio AI menulis "AI belum diatur" | Isi provider di `.env`, lalu `docker compose up -d worker web`, lalu Koneksi Claude, Tes koneksi. |
| `web` tidak sehat setelah update | `docker compose logs --tail 100 migrate web`. Pesan konfigurasi menyebut nama variabel `.env` yang kurang. |
| `certs`, `db`, atau `backup` gagal dengan `syntax error` atau `$'\r'` | Clone lama berakhiran baris CRLF. Hapus `C:\Kira\app` (setelah menyalin `.env`), clone ulang, lalu kembalikan `.env`. Repo sekarang memaksa LF lewat `.gitattributes`. |
| Docker Desktop tidak menyala setelah restart | Buka Docker Desktop sekali, cek Start Docker Desktop when you sign in, dan pastikan akun Windows otomatis masuk atau Docker diatur sebagai layanan. |

## 14. Keamanan

- Akses lewat Cloudflare Tunnel. Hanya proxy yang terbuka, di `127.0.0.1` (port 3030), tidak ada port masuk di router, database tidak punya port di host, dan database tidak bisa mengakses internet. Lalu lintas lewat pusat data Cloudflare, sebagian di luar Indonesia; Kebijakan Privasi menyebut hal ini.
- Database dipakai lewat empat role dengan RLS (lihat ADR 0002). Koneksi ke database memakai TLS dengan verifikasi sertifikat lokal.
- Rahasia hanya ada di `.env`. Kalau `.env` pernah terkirim ke tempat lain, ganti semua nilainya. Password database hanya dipakai saat database pertama kali dibuat, jadi password role juga harus diganti di database:

  ```powershell
  docker compose exec db psql -U postgres -d kira -c "ALTER ROLE kira_app PASSWORD 'NILAI_BARU_DARI_.ENV'"
  ```

  Ulangi untuk `kira_owner`, `kira_auth`, `kira_worker`, dan `postgres`, lalu `docker compose up -d --build`. Token Claude yang bocor dicabut dengan membuat token baru (`claude setup-token`) dan mengganti password akun Claude.
- Perangkat yang hilang: konsol, Pengaturan, Perangkat, Cabut. Tablet itu langsung keluar.

## 15. Suara bahasa Inggris (TTS, opsional)

Kira bisa membacakan soal, pelajaran, dan bacaan bahasa Inggris dengan suara Kokoro-82M (Apache-2.0) yang berjalan di PC ini. Satu suara tetap per peran: perempuan Inggris Britania untuk soal, pelajaran, dan cerita; suara yang sama dengan kecepatan lain untuk pembawa acara kuis dan dikte; satu suara kedua hanya untuk dialog dua pembicara. Klip memuat versi suara di kuncinya, jadi klip dari suara lama tidak pernah disajikan. Tanpa layanan ini tombol baca suara memakai suara bawaan tablet, dan semuanya tetap jalan. Layanan `tts` tidak ikut `docker compose up` biasa: ia ada di profil `tts`, jadi PC tanpa GPU tidak membangun atau menjalankannya.

| Layanan | Isi |
|---|---|
| `tts` | Python 3.12 dengan `kokoro`, beberapa proses mesin sejajar (`TTS_WORKERS`, bawaan 3). Hanya di jaringan internal Docker tanpa internet, tanpa port ke host. Model dimuat saat ada permintaan pertama dan dibongkar setelah 10 menit tidak dipakai, jadi memori GPU kembali penuh. |
| `tts-fetch` | Sekali jalan: mengunduh bobot model (sekitar 400 MB, termasuk Whisper untuk pemeriksa mutu) ke volume `kira-tts-models`. Profil `tts-setup`. |
| `worker` | Job `tts.batch` membuat semua suara English yang belum ada (sekitar 21.000 klip, sekitar 8 klip per detik di RTX 5070 Ti), job `tts.clip` membuat suara untuk konten baru. Klip disimpan di `<KIRA_HOST_DATA>\tts\<sha256>.mp3`. |

Syarat: driver NVIDIA terbaru di Windows (Docker Desktop dengan WSL 2 sudah meneruskan GPU ke kontainer), ruang disk sekitar 15 GB untuk image dan bobot model. Cek GPU terlihat oleh Docker: `docker run --rm --gpus all nvidia/cuda:12.8.0-base-ubuntu22.04 nvidia-smi`.

### Memasang

1. Unduh bobot model sekali (butuh internet, beberapa menit):

   ```powershell
   docker compose --profile tts-setup run --rm tts-fetch
   ```

2. Aktifkan di `.env`. Dengan GPU NVIDIA:

   ```ini
   TTS_URL=http://tts:8000
   COMPOSE_PROFILES=tts
   COMPOSE_FILE=docker-compose.yml;docker-compose.tts-gpu.yml
   ```

   Tanpa GPU (jauh lebih lambat, sekitar 12 detik untuk satu kalimat pendek di CPU Ryzen 5) tinggalkan `COMPOSE_FILE` dan tambahkan `TTS_DEVICE=cpu`. Pemisah di `COMPOSE_FILE` pada Windows adalah titik koma. Perintah satu kali tanpa mengubah `.env`: `docker compose -f docker-compose.yml -f docker-compose.tts-gpu.yml --profile tts up -d --build`.

3. Nyalakan ulang dan cek:

   ```powershell
   .\deploy\windows\kira.ps1 start
   docker compose logs tts
   docker compose exec tts sh -c 'python selftest.py http://127.0.0.1:8000 "$KIRA_INTERNAL_TOKEN"'
   ```

   `selftest.py` mengirim satu kalimat pendek dan mencetak waktunya (percobaan pertama termasuk waktu memuat model).

4. Buat semua suara, sebaiknya malam hari saat GPU bebas:

   ```powershell
   .\deploy\windows\kira.ps1 admin tts-batch
   docker compose logs -f worker
   ```

   Worker juga menjadwalkan batch ini sendiri setiap hari pukul 01.30 WIB selama `TTS_URL` terisi, jadi konten baru ikut dibuat tanpa langkah tambahan. Batch aman dihentikan dan dilanjutkan: klip yang sudah ada dilewati. Untuk melihat berapa klip yang sudah jadi dan yang masih menunggu:

   ```powershell
   .deploywindowskira.ps1 admin tts-status
   ```

   Untuk mengambil soal baru dari sumber terbuka sekarang juga, tanpa menunggu Minggu dini hari (jatah AI mingguan `AI_WEEKLY_CONTENT_JOBS` tetap berlaku):

   ```powershell
   .deploywindowskira.ps1 admin sourcing-now
   ```

### Bila GPU dipakai program lain

Layanan memeriksa memori GPU yang kosong sebelum memuat model. Bila kurang dari `TTS_MIN_FREE_MIB` (bawaan 1500 MiB), model tidak dimuat dan tidak ada program lain yang terganggu. Batch lalu menunggu satu jam dan mencoba lagi (sampai 36 kali), klip permintaan learner dilewati, dan tablet memakai suara bawaannya. Cek pemakaian GPU dengan `nvidia-smi`. Isi `TTS_OOM_FALLBACK=cpu` bila klip permintaan boleh dibuat di CPU saat GPU penuh.

### Mematikan atau mengganti suara

Hapus `COMPOSE_PROFILES`, `COMPOSE_FILE`, dan `TTS_URL` dari `.env`, lalu `docker compose up -d`. Klip yang sudah ada tetap dipakai bila `TTS_URL` diisi lagi. Untuk membuat ulang semua suara (misalnya setelah mengubah `deploy/tts/styles.json`), hapus folder `tts` di folder data lalu jalankan `tts-batch` lagi. Suara dan kecepatan tiap peran ada di `deploy/tts/styles.json`; bila diubah, naikkan `voiceVersion` di sana dan `TTS_VOICE_VERSION` di `packages/core/src/tts.ts` supaya semua kunci klip baru.

### Membuat dan memeriksa ulang semua klip (tanpa worker)

Untuk regenerasi massal (misalnya setelah konten digabung), jalankan dari root repo dengan layanan `tts` yang terjangkau (alamat dan token internal Anda):

```
pnpm tts:generate -- --data-dir D:kira-data --url http://127.0.0.1:8000 --token <KIRA_INTERNAL_TOKEN> --concurrency 3
```

Perintah ini bisa dilanjutkan: klip yang sudah ada dilewati, jadi Ctrl+C lalu jalankan lagi hanya membuat sisanya. Ia juga menulis `ttsmanifest.jsonl` (kunci, peran, teks). Gerbang mutu `deploy/tts/check_clips.py` memeriksa durasi, puncak dan clipping, hening, nada F0 (lompatan suara), dan kecocokan Whisper dengan teks, menulis CSV, membuat ulang sekali klip yang gagal, dan menulis daftar yang masih gagal:

```
docker run --rm --gpus all --network host -v D:kira-data	ts:/data -v kira-tts-models:/models -e HF_HUB_OFFLINE=1 --entrypoint python kira-tts:latest check_clips.py --dir /data --report /data/report.csv --url http://127.0.0.1:8000 --token <KIRA_INTERNAL_TOKEN>
```

Ini juga bisa dilanjutkan (klip yang sudah diperiksa dan tidak berubah dilewati; `--force` memeriksa ulang semua).

### Mengganti suara (backend lain, misalnya suara AI Gatxel)

Layanan `tts` punya dua backend: `TTS_BACKEND=kokoro` (bawaan, di GPU lokal) dan `TTS_BACKEND=openai-compatible` (memanggil `POST <TTS_BASE_URL>/audio/speech`, format OpenAI, misalnya Open WebUI). Variabel untuk layanan `tts`:

| Variabel | Arti |
|---|---|
| `TTS_BACKEND` | `kokoro` atau `openai-compatible` |
| `TTS_BASE_URL` | mis. `http://host.docker.internal:3000/api/v1` (dari kontainer, `127.0.0.1` adalah kontainer itu sendiri, bukan PC) |
| `TTS_API_KEY` | token Bearer Open WebUI (jangan ditulis di berkas yang masuk git) |
| `TTS_MODEL` | nama model, bawaan `tts-1` |
| `TTS_VOICE` | nama suara utama |
| `TTS_VOICE_SECOND` | suara kedua untuk dialog dua pembicara (kosong: pakai suara utama) |
| `TTS_VOICE_VERSION` | opsional; bawaan `oa-<nama suara>`. Versi masuk ke kunci klip |
| `TTS_WORKERS` | banyak permintaan sejajar ke backend |

Hanya satu suara yang didengar anak pada satu waktu. Penunjuk `<data>/tts/served-version.txt` menentukan versi yang disajikan; selama set baru belum lengkap dan lulus gerbang, versi lama tetap disajikan, juga untuk klip baru sesuai permintaan (job `tts.clip` dilewati bila layanan memakai suara yang berbeda dari yang disajikan, dan tablet memakai suara perangkat sampai klipnya ada). Urutannya:

1. Uji kecepatan lebih dulu, tanpa mengubah apa pun. Langsung ke backend, 50 kalimat, dan perkiraan apakah 21.000 klip selesai sebelum pukul 06.00 WIB:

   ```
   docker run --rm --entrypoint python -v <repo>\deploy\tts:/app/tts:ro -w /app/tts kira-tts:latest speedtest.py --backend openai-compatible --base-url http://host.docker.internal:3000/api/v1 --api-key <KUNCI> --voice <NAMA> --concurrency 4
   ```

2. Jalankan layanan calon di port lain dengan variabel di atas (kontainer terpisah, mis. `-p 127.0.0.1:18770:8000`), lalu buat set penuh: `pnpm tts:generate -- --data-dir <data> --url http://127.0.0.1:18770 --token <KIRA_INTERNAL_TOKEN> --concurrency 4`. Versi diambil dari layanan itu sendiri (`/health`), jadi klipnya bernama lain dan tidak menimpa suara yang sedang disajikan.
3. Periksa dengan `check_clips.py` (lihat di atas; `--manifest` bawaan `manifest.jsonl` adalah set terakhir yang dibuat).
4. Pindahkan penunjuk bila lulus: `pnpm tts:promote -- --data-dir <data> --version <versi> --report <laporan.csv>`. Perintah ini menolak bila ada klip yang belum ada atau tingkat lulus di bawah 99%. Browser membaca versi baru dari `/api/tts/today` dan web dalam 5 detik; semua perangkat berpindah bersamaan.
5. Kembali ke Kokoro kapan saja: `pnpm tts:promote -- --data-dir <data> --version k1 --report <laporan Kokoro>` (klipnya tetap ada di disk).

### Suara pilot: Piper (en_US-lessac-medium) dan suara id dari server Gatxel

Suara standar pilot adalah suara `en` server suara Gatxel, yaitu model Piper publik **en_US-lessac-medium**. Layanan `tts` menjalankannya sendiri di CPU (`TTS_BACKEND=piper`, model dan parameter sama, jadi suaranya sama dan tidak ada ganti jenis kelamin), sehingga server Gatxel yang dipakai bersama tidak dibebani. Versi suara di kunci klip: `piper-lessac-medium`.

- **Bahasa menentukan suara, tidak pernah ditebak.** Peran `indonesian` (kamus, arti kata) dibuat lewat API Gatxel dengan suara `id` (id_ID-gatxel-medium). Semua peran Inggris (`teacher`, `quizhost`, `dictation`, `second`) memakai `en`. Teks Inggris tidak pernah dikirim ke `id` (hasilnya tak terbaca), dan sebaliknya.
- Variabel: `TTS_BACKEND=piper`, `TTS_WORKERS=8` (proses sejajar, satu utas ONNX tiap proses), `TTS_PIPER_MODEL` (opsional; bawaan dicari di volume `/models`). Untuk peran Indonesia: `TTS_BASE_URL=http://host.docker.internal:3000/api/v1`, `TTS_API_KEY`, `TTS_VOICE=en`, `TTS_VOICE_ID=id`, `TTS_MODEL=piper`, dan bila perlu `TTS_REQUEST_PAUSE=0.2` (detik, jeda antar permintaan supaya layanan bersama tidak jenuh).
- Unduh model: `docker compose --profile tts-setup run --rm tts-fetch python fetch_models.py piper`.
- Lisensi: data latih model Lessac dan Gatxel berlisensi riset. Pilot gratis dan tidak komersial; ganti model sebelum penggunaan komersial.

**Mengganti model nanti**: (1) pasang backend/suara baru lewat variabel di atas (atau tambahkan kelas sintesis di `deploy/tts/remote.py`); (2) set `TTS_VOICE_VERSION` baru (mis. `gatxel-2`); (3) `pnpm tts:generate` ke folder yang sama membuat hanya klip bernama baru, tanpa menyentuh yang disajikan; (4) `check_clips.py`; (5) `pnpm tts:promote`. Tidak ada perubahan kode web atau worker, dan versi lama tetap di disk untuk kembali.

**Regenerasi bertahap saat konten masuk**: kunci klip adalah sha256 dari versi suara, peran, dan teks. Konten baru atau berubah berarti kunci baru, dan `pnpm tts:generate` (atau job `tts.batch` malam) hanya membuat kunci yang belum ada; teks yang sama dilewati. Jalankan lagi setelah tiap gelombang konten, lalu `check_clips.py` (hanya klip baru yang diperiksa) dan `pnpm tts:promote` setelah set lengkap lulus. Selama itu anak tetap mendengar versi yang disajikan.

**Tanpa panggilan TTS langsung**: semua jalur anak (soal, pelajaran, kamus, kartu kilat, buku, cerita, album, bos, kuis) memutar berkas klip statis lewat `/tts/<kunci>.mp3`. Layanan `tts` dan server Gatxel tidak pernah dipanggil saat anak memakai aplikasi; klip yang belum ada hanya memicu job `tts.clip` di antrean worker dan, sampai jadi, suara perangkat.


### Masalah yang sering muncul

| Gejala | Penyebab dan jalan keluar |
|---|---|
| Job `tts.batch` selesai dengan "Layanan suara (tts) tidak terjangkau" | Profil `tts` belum aktif atau kontainer belum sehat. Cek `docker compose ps` dan `docker compose logs tts`. |
| Log `tts` berisi "belum diunduh" | Jalankan langkah 1 (`tts-fetch`). |
| Log `tts` berisi "GPU hanya punya ... MiB kosong" | Program lain memakai GPU. Tunggu atau hentikan program itu; batch lanjut sendiri. |
| `selftest.py` sangat lambat | Kontainer tidak melihat GPU. Pastikan `docker-compose.tts-gpu.yml` ikut di `COMPOSE_FILE` dan `docker compose exec tts python -c "import torch; print(torch.cuda.is_available())"` mencetak True. |

## 16. Kapasitas, staging, dan uji beban

Bagian ini menjelaskan susunan yang membuat Kira tetap cepat saat banyak keluarga aktif bersamaan, cara menjalankan salinan uji (staging) di PC yang sama, dan langkah pindah dari susunan lama ke susunan ini. Hasil uji ada di `docs/laporan-beban.md`.

### Susunan

```
Cloudflare Tunnel -> proxy (Caddy, 127.0.0.1:3030) -> web x N -> pgbouncer -> db (Postgres, TLS)
                                                        |-> valkey (pembatas laju, cache sesi dan Today)
worker -> web:3000 (jaringan internal, tanpa proxy);   worker, migrate, backup -> db langsung
```

- **Proxy** menyajikan langsung dari disk: `/_next/static` (cache setahun, immutable), `/sounds`, `/flags`, `/fonts`, `/icons`, `/maps` (cache 7 hari), dan `/tts/<sha256>.mp3` dari folder data yang dipasang read-only (cache setahun, immutable). Jadi Cloudflare menyimpan semuanya dan unggahan rumah (sekitar 29 Mbps) tidak terpakai untuk berkas statis. Klip yang belum ada diteruskan ke web. Batas isi permintaan: 8 MB di semua jalur, 62 MB hanya untuk `/konsol/impor` dan `/api/media` (jenis dan ukuran tetap diperiksa web). `/api/internal/*` dijawab 404 oleh proxy; worker memanggilnya langsung ke `web:3000`. IP klien dibaca dari `CF-Connecting-IP` dan diteruskan sebagai `X-Forwarded-For`.
- **Image proxy memuat salinan berkas statis dari image web.** Bangun keduanya bersama (`docker compose build web proxy`, atau `up -d --build`); jangan membangun web saja.
- **Cek sehat proxy** memakai `/api/health?scope=live`, tanpa database: pool yang penuh mengenai semua replika sekaligus dan tidak boleh menjadi "no upstreams". `/api/health` tanpa parameter (Docker, langkah periksa) tetap memeriksa database.
- **Satu transaksi, satu sambungan.** Di dalam `inOrg`, `withFamilyAdmin`, atau `tx` jangan memanggil yang membuka sambungan app baru (`isFeatureOn`, `inOrg`, `appDb`). Pakai `isFeatureOnTx(tx, ...)`. `server/tx-guard.ts` melempar di tes dan mencatat di produksi.
- **PgBouncer** mode transaksi, TLS terverifikasi ke Postgres, tanpa pernyataan prepared (`KIRA_DB_PREPARE=off` untuk web). `withOrg` aman karena memakai `set_config(..., true)` di dalam transaksi, dan kunci advisory yang dipakai bersifat transaksi (`pg_advisory_xact_lock`). Role tetap terpisah: web memakai `kira_app` dan `kira_auth` lewat PgBouncer; `kira_worker` dan `kira_owner` (migrate, backup) langsung ke db. Pool server: 30 untuk kira_app dan 15 untuk kira_auth (batas role di Postgres 40 dan 20).
- **Valkey** menyimpan ember token (pembatas laju IP, MCP, permintaan suara), cache sesi 15 detik, dan cache layar Today 30 detik. Tanpa Valkey, tiap replika memakai memori sendiri dan batasnya menjadi per replika; tidak ada data yang hilang karena semuanya cache.

### Variabel baru di .env

| Variabel | Bawaan | Arti |
|---|---|---|
| `KIRA_VALKEY_PASSWORD` | `KIRA_INTERNAL_TOKEN` | Password Valkey, hex acak (`kira.ps1 init` mengisinya). Bila kosong, memakai `KIRA_INTERNAL_TOKEN`. |
| `KIRA_PROXY_PORT` | 3030 | Port proxy di 127.0.0.1. |
| `KIRA_WEB_REPLICAS` | 4 | Jumlah replika web. |
| `KIRA_POOL_APP`, `KIRA_POOL_AUTH` | 12, 6 | Sambungan per replika ke PgBouncer. |
| `PGB_POOL_APP`, `PGB_POOL_AUTH` | 30, 15 | Sambungan PgBouncer ke Postgres per role. |
| `KIRA_WEB_HEAP_MB` | 1024 | Batas heap Node per replika. |
| `PG_MAX_CONNECTIONS`, `PG_SHARED_BUFFERS`, `PG_EFFECTIVE_CACHE_SIZE`, `PG_WORK_MEM` | 150, 1GB, 6GB, 16MB | Penyetelan Postgres. |
| `KIRA_WEB_IMAGE`, `KIRA_WORKER_IMAGE`, `KIRA_PROXY_IMAGE` | kira-web:latest, kira-worker:latest, kira-proxy:latest | Nama image; staging memakai nama lain supaya tidak menimpa produksi. |

Penyetelan Postgres lain ada di `docker-compose.yml` (WAL: `wal_compression`, `max_wal_size=4GB`, `checkpoint_timeout=15min`; `random_page_cost=1.1`; `idle_in_transaction_session_timeout=60s` untuk worker dan cadangan; web lewat PgBouncer diputus setelah 15 detik (`connect_query`); `log_min_duration_statement=500`; `pg_stat_statements` dimuat). Mengubah flag membuat `db` restart sekitar 10 detik. `synchronous_commit` tetap on: data anak tidak boleh hilang karena listrik padam.

### Staging (project kirastg)

Staging adalah salinan lengkap dengan volume, jaringan, nama image, dan port sendiri (web 3135, Mailpit 8135), jalan di PC yang sama. Salin `deploy/load/env.staging.example` ke `C:kw4stgenv.staging` (di luar repo). Isi berkas env staging dengan nilai acak baru (jangan memakai kata sandi produksi), `KIRA_ORIGIN=http://127.0.0.1:3135`, `KIRA_PROXY_PORT=3135`, `KIRA_HOST_DATA` dan `KIRA_HOST_BACKUPS` ke folder lain, `KIRA_WEB_IMAGE=kirastg-web:latest`, `KIRA_WORKER_IMAGE=kirastg-worker:latest`, `KIRA_PROXY_IMAGE=kirastg-proxy:latest`, `SMTP_URL=smtp://mailpit:1025`, `AI_PROVIDER=none`.

```powershell
$E = '--env-file','C:\kw4\stg\env.staging'
docker compose -p kirastg @E --profile loadtest up -d --build     # nyalakan (dengan Mailpit)
docker compose -p kirastg @E --profile loadtest down              # matikan, data tetap
docker compose -p kirastg @E --profile loadtest down -v           # matikan dan hapus data staging
```

`-p kirastg` mengalahkan `name: kira` di compose, jadi kontainer, volume, dan jaringan bernama kirastg-*. Jangan menjalankan perintah compose untuk staging tanpa `-p kirastg`. Seed uji beban menolak jalan kecuali `KIRA_ORIGIN` diawali `http://127.0.0.1`.

### Uji beban (k6)

Skenario ada di `deploy/load/` (lihat kepala `kira.js`). Alurnya:

```powershell
node deploy/load/actions.mjs                    # ID Server Action dari kontainer web yang sedang jalan (ulangi setiap build)
node deploy/load/prep.mjs --real C:\kw4\tts-piper\tts C:\kw4\stg\data all   # klip sungguhan (sumber hanya dibaca); tulis served-version.txt bila versinya bukan bawaan
docker compose -p kirastg @E --profile loadtest --profile loadrun run --rm -e FAMILIES=500 seed --reset --and-create
node deploy/load/run.mjs --scenario mixed --stage 300
```

`run.mjs` menjalankan k6 di jaringan staging, mencuplik CPU, RAM, sambungan Postgres dan PgBouncer tiap 5 detik, dan menulis `deploy/load/out/<nama>/result.md`. Skenario: `signup` (daftar, verifikasi lewat Mailpit, tambah anak), `signin`, `pin`, `today`, `latihan`, `tes`, `paper`, `audio`, `qm`, `quiz`, `parent`, `parentswitch`, `hub`, `cards`, `reading`, `dict`, `world`, `boss`, `placement`, `feedback`, `mixed`, `spike`. Tahap: `--stage 100|300|500|1000|soak` (`--soak-min 30`); `--stage stress --steps 1000,1500,2000 --step-seconds 75` naik per anak tangga dan berhenti sendiri bila galat satu anak tangga lewat 1 persen; `--scenario signup --stage burst --burst-n 150` memberi 150 pendaftaran dalam 2 menit untuk menguji batas kursi (`KIRA_BETA_SEATS`, paling banyak 100000); `spike` naik dari 0 ke 500 VU dalam 30 detik. Seed ulang sebelum tiap tahap supaya setiap anak mulai dari hari yang segar.

### Pindah dari susunan lama ke susunan ini (produksi)

Di PC server Kira ada `docker-compose.override.yml` lokal (tidak ada di git) yang menerbitkan web di 3030, dan `COMPOSE_FILE` di `.env` memuatnya bersama `docker-compose.tts-gpu.yml`; profil `tts` juga aktif. Langkah di bawah sudah dilatih pada salinan data produksi (5 November 2026): situs tidak tersedia sekitar 45 detik saat PC normal dan sampai 3 menit saat PC sibuk.

1. Hentikan autopull: `Disable-ScheduledTask -TaskName 'Kira autopull'`. Bila main bergerak dan CI hijau, autopull memasang kode baru dalam 10 menit dengan `.env` dan override lama.
2. Cadangan dulu: `.\deploy\windows\kira.ps1 backup`. Pastikan berkas hasilnya ada. Beri nama image lama supaya bisa kembali tanpa membangun: `docker tag kira-web:latest kira-web:lama`, `docker tag kira-worker:latest kira-worker:lama`.
3. Tambahkan ke `.env`: `KIRA_VALKEY_PASSWORD=<hex acak 48 karakter>`, `KIRA_PROXY_PORT=3030`, `KIRA_WEB_REPLICAS=4`. Untuk pilot: `AI_PROVIDER=none`, `KIRA_MCP=off`. Hapus `COMPOSE_PROFILES=tts`: anak memutar klip statis, layanan `tts` tidak dipanggil saat aplikasi dipakai, dan dengan profil itu setiap `--build` juga membangun image tts (pernah 50 menit lalu gagal, dan web ikut tertunda). Biarkan `TTS_URL` terisi: bila kosong, web berhenti memakai klip.
4. Edit `docker-compose.override.yml`: hapus bagian `web: ports: - "127.0.0.1:3030:3000"`. Bila dibiarkan, port 3030 bentrok antara web dan proxy dan `up` berhenti dengan error port setelah migrasi jalan; perbaiki override lalu ulangi `up`, situs kembali dalam sekitar 15 detik. Bila tidak ada isi lain, isi berkas dengan `services: {}`. Biarkan `COMPOSE_FILE`. Cloudflare Tunnel tidak perlu diubah (tetap `127.0.0.1:3030`).
5. Tarik kode lalu bangun selagi situs lama masih jalan: `git merge --ff-only origin/main`, `docker compose build web worker proxy`.
6. `docker compose stop web worker`, cadangan terakhir, lalu `docker compose up -d --no-build`. Compose menjalankan migrasi, merestart `db` (flag baru), membuat pgbouncer dan valkey, empat replika web, lalu proxy. Hentikan juga suara lama: `docker stop kira-tts-1`.
7. Periksa: `docker compose ps` (semua healthy), `curl http://127.0.0.1:3030/api/health` memberi `{"ok":true}`, `curl -i http://127.0.0.1:3030/api/internal/weekly-report` memberi 404, buka situs lewat Cloudflare dan masuk sebagai Syakira, jawab satu soal, putar satu suara. Worker: `docker compose logs --tail 20 worker`.

Jangan membuat ekstensi `pg_stat_statements` di database `kira`: cadangan lalu memuat `CREATE EXTENSION`, dan pemulihan sebagai `kira_owner` gagal seluruhnya. Bila butuh statistik, buat di database `postgres`: `docker compose exec db psql -U postgres -d postgres -c "create extension if not exists pg_stat_statements"`. Statistik semua database tetap terlihat dari sana.

Pemulihan ke susunan lama, data tetap: `docker compose stop worker`, `docker compose rm -sf proxy web pgbouncer valkey`, kembalikan override dan `.env`, `git checkout -B main <commit lama>`, kembalikan nama image lama, `docker compose up -d --no-build`. Migrasi hanya menambah tabel dan kolom, dan kode lama sudah diuji jalan di atas skema baru, jadi langkah ini tidak butuh cadangan. Pemulihan database hanya bila datanya sendiri rusak; itu membuang semua yang terjadi setelah cadangan, dan caranya ada di bagian 11.
