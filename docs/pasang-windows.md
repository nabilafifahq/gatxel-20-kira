# Memasang Kira di server rumah (Windows 11)

Panduan ini untuk PC server di rumah: Windows 11 Pro, Ryzen 5, RAM 64 GB, RTX 5070 Ti, SSD 2 TB. Kira berjalan di Docker Desktop, dan semua perangkat keluarga membukanya lewat Tailscale di alamat `https://<nama-pc>.<tailnet>.ts.net`. Tidak ada port yang dibuka ke internet.

Yang berjalan di Docker:

| Layanan | Isi |
|---|---|
| `db` | Postgres 17 dengan TLS. Hanya terhubung ke jaringan internal Docker, tanpa akses internet. |
| `certs` | Membuat sertifikat TLS lokal untuk database sekali di awal. |
| `migrate` | Menjalankan migrasi database setiap kali stack dinyalakan, lalu berhenti. Dipakai juga untuk perintah admin. |
| `web` | Aplikasi Next.js di `127.0.0.1:3000`. Tailscale meneruskan alamat https ke sini. |
| `worker` | Job AI (Claude Max lewat Claude Code, atau ai.gatxel.com), impor PDF, email, laporan mingguan, retensi data, penghapusan akun. |
| `backup` | `pg_dump` setiap hari pukul 02.00 WIB ke folder Windows, simpan 14 harian dan 8 mingguan. |

## 1. Siapkan Windows

1. Pastikan virtualisasi aktif (Task Manager, tab Performance, CPU, baris Virtualization: Enabled). Kalau Disabled, aktifkan SVM di BIOS.
2. Buka PowerShell sebagai Administrator, jalankan `wsl --install`, lalu restart.
3. Pasang [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) dengan backend WSL 2. Di Settings, General, centang Start Docker Desktop when you sign in.
4. Pasang [Git for Windows](https://git-scm.com/download/win) dan [GitHub CLI](https://cli.github.com/), lalu masuk: `gh auth login`.
5. Pasang Node.js LTS, dipakai sekali untuk membuat token Claude di bagian 5: `winget install OpenJS.NodeJS.LTS`. Tutup lalu buka lagi PowerShell supaya `node` dan `npm` dikenali.
6. Izinkan skrip lokal sekali (untuk `kira.ps1`, `npm`, dan `claude`): `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
7. Pasang [Tailscale untuk Windows](https://tailscale.com/download/windows) dan masuk dengan akun tailnet keluarga.
8. Di [konsol admin Tailscale](https://login.tailscale.com/admin/dns), aktifkan MagicDNS dan HTTPS Certificates.
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

## 3. Alamat Tailscale

```powershell
tailscale serve --bg 3000
tailscale serve status
```

Perintah kedua menampilkan alamat seperti `https://kira-server.tail1234.ts.net`. Salin alamat itu (tanpa garis miring di akhir) ke `KIRA_ORIGIN` di `.env`. Alamat ini juga dipakai untuk passkey, tautan email, dan APK tablet, jadi jangan diganti setelah keluarga mulai memakai Kira. Jangan pernah memakai `tailscale funnel` untuk Kira: funnel membuka server ke internet.

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

1. Dari laptop yang terhubung ke tailnet, buka `https://<alamat>/setup`.
2. Isi token setup (`KIRA_SETUP_TOKEN`), nama keluarga, nama tutor, email, dan password minimal 15 karakter. Halaman ini hanya bisa dipakai saat database masih kosong.
3. Konsol terbuka di halaman Learner. Tambahkan learner (nama panggilan, grade, avatar, PIN 4 gambar) dan isi email orang tua untuk mengirim undangan. Tanpa SMTP, tautan undangan tampil di layar dan di Laporan, kotak keluar.
4. Learner baru aktif setelah ada persetujuan orang tua: orang tua menerima undangan lalu menyetujui di halaman Privasi, atau tutor mencatat persetujuan tertulis di halaman Learner.
5. Pasang passkey di Pengaturan supaya tutor bisa masuk tanpa mengetik password.

## 8. Tablet anak

1. Pasang Tailscale di tablet dan masuk ke tailnet keluarga.
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

## 12. Pembaruan

```powershell
.\deploy\windows\kira.ps1 update
```

Perintah ini menarik kode terbaru, membangun ulang image, dan menjalankan migrasi database otomatis. Cadangan dibuat dulu kalau mau aman: `.\deploy\windows\kira.ps1 backup`.

Next.js merilis pembaruan keamanan setiap bulan. Repo memakai Dependabot dengan jeda 3 hari setelah rilis; gabungkan PR pembaruan setelah CI hijau, lalu jalankan `update` di server. Cek juga Docker Desktop, Windows Update, dan Tailscale setiap bulan.

## 13. Masalah yang sering muncul

| Gejala | Penyebab dan langkah |
|---|---|
| Tablet menampilkan "No internet right now" | Tailscale di tablet mati atau server mati. Nyalakan Tailscale, cek `docker compose ps` di server. |
| Passkey gagal dibuat atau dipakai | `KIRA_ORIGIN` tidak sama dengan alamat di browser. Samakan, lalu `docker compose up -d --build web` (alamat juga masuk ke build). |
| Lupa password tutor dan email belum diatur | `.\deploy\windows\kira.ps1 admin reset-link alamat@email.com`, buka tautan yang tampil dalam 30 menit. |
| Akun terkunci setelah banyak percobaan | `.\deploy\windows\kira.ps1 admin unlock alamat@email.com`. |
| PIN anak terkunci | Konsol, Learner, Buka kunci, atau `admin pin-unlock <nama>`. |
| Studio AI menulis "AI belum diatur" | Isi provider di `.env`, lalu `docker compose up -d worker web`, lalu Koneksi Claude, Tes koneksi. |
| `web` tidak sehat setelah update | `docker compose logs --tail 100 migrate web`. Pesan konfigurasi menyebut nama variabel `.env` yang kurang. |
| `certs`, `db`, atau `backup` gagal dengan `syntax error` atau `$'\r'` | Clone lama berakhiran baris CRLF. Hapus `C:\Kira\app` (setelah menyalin `.env`), clone ulang, lalu kembalikan `.env`. Repo sekarang memaksa LF lewat `.gitattributes`. |
| Docker Desktop tidak menyala setelah restart | Buka Docker Desktop sekali, cek Start Docker Desktop when you sign in, dan pastikan akun Windows otomatis masuk atau Docker diatur sebagai layanan. |

## 14. Keamanan

- Akses hanya lewat Tailscale. Port 3000 hanya terbuka di `127.0.0.1`, database tidak punya port di host, dan database tidak bisa mengakses internet.
- Database dipakai lewat empat role dengan RLS (lihat ADR 0002). Koneksi ke database memakai TLS dengan verifikasi sertifikat lokal.
- Rahasia hanya ada di `.env`. Kalau `.env` pernah terkirim ke tempat lain, ganti semua nilainya. Password database hanya dipakai saat database pertama kali dibuat, jadi password role juga harus diganti di database:

  ```powershell
  docker compose exec db psql -U postgres -d kira -c "ALTER ROLE kira_app PASSWORD 'NILAI_BARU_DARI_.ENV'"
  ```

  Ulangi untuk `kira_owner`, `kira_auth`, `kira_worker`, dan `postgres`, lalu `docker compose up -d --build`. Token Claude yang bocor dicabut dengan membuat token baru (`claude setup-token`) dan mengganti password akun Claude.
- Perangkat yang hilang: konsol, Pengaturan, Perangkat, Cabut. Tablet itu langsung keluar.
