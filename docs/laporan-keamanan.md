# Laporan keamanan pilot publik Kira

Tanggal: 4 sampai 5 November 2026. Cabang: `pilot/aman`. Pemeriksa: agen "aman" atas izin pemilik, hanya terhadap instance lokal (Postgres di port 54436, web di port 3136). Tidak ada pemindaian aktif ke `kira.gatxel.com` atau container produksi.

## Ringkasan

Uji tembus internal terbaru ada di bagian "Uji tembus internal, 5 November 2026" di akhir laporan ini. Beberapa risiko sisa di bagian 4 sudah berubah di sana.

- Tidak ada temuan **kritis**. Satu temuan **tinggi** ditemukan dan diperbaiki: alamat IP klien diambil dari `X-Forwarded-For` entri pertama, yang bisa dipalsukan penyerang sehingga semua batas laju per IP bisa dilewati.
- Perbaikan lain: HTTP biasa dialihkan ke HTTPS, `/api/internal/*` tidak terlihat dari internet, MCP mati secara bawaan, batas laju di semua rute tulis, kunci akun setelah 20 kegagalan (dulu 100), unggahan dibersihkan dari EXIF dan dibatasi per peran dan per hari, token atur ulang password diklaim secara atomik, cadangan per jam dengan salinan terenkripsi dan skrip uji pemulihan.
- Tersisa untuk pemilik: pengaturan Cloudflare (bagian 6), dua baris di `docker-compose.yml` (bagian 5), dan keputusan tentang beberapa risiko sisa (bagian 4).

## 1. Yang diuji

| Area | Cara | Hasil |
|---|---|---|
| Kontrol akses antar keluarga dan antar anak (media, attempt, hasil, pembahasan, halaman konsol, cetak) | `e2e/tests/security-access.spec.ts` dengan keluarga kedua ("org B") dan sesi langsung di database | Lulus |
| Naik peran (anak ke konsol dan halaman orang tua, orang tua ke unggah PDF dan API anak) | `security-access.spec.ts` | Lulus |
| Kebocoran kunci jawaban pada tes berwaktu (HTML, RSC, respons `/api/sync`) | `security-access.spec.ts` | Lulus |
| Mass assignment: kolom tambahan di `/api/sync` dan `/api/tts/request`; semua `z.object` di Server Action memakai `.strict()` | `security-access.spec.ts` | Lulus |
| CSRF: Origin situs lain dan `null` di semua Route Handler tulis, Server Action dari Origin lain, GET berefek samping dengan prefetch | `security-input.spec.ts` | Lulus (Next menjawab "Invalid Server Actions request") |
| Redirect terbuka (`next=` dengan `//`, `https://`, `/\`, `javascript:`) | `security-input.spec.ts`, `hardening.test.ts` | Lulus |
| XSS tersimpan lewat nama anak dan catatan di tampilan tutor, orang tua, anak; email | `security-input.spec.ts` (browser), `hardening.test.ts` (email) | Lulus, semua di-escape |
| Path traversal di `/api/media/[id]`, `/tts/[file]`, berkas statis | `security-input.spec.ts` | Lulus |
| Manipulasi metode HTTP, `X-HTTP-Method-Override`, TRACE, CORS lewat OPTIONS | `security-input.spec.ts` | Lulus |
| Body terlalu besar, jenis berkas palsu (SVG, HTML, GIF, EXE sebagai PNG), PNG terpotong, EXIF | `security-input.spec.ts`, `hardening.test.ts` | Lulus |
| Sesi: cookie `__Host-`, HttpOnly, Secure, SameSite, fiksasi, keluar, idle, kedaluwarsa, ganti dan atur ulang password | `security-input.spec.ts` | Lulus |
| Kunci akun dan pesan yang sama untuk email tidak terdaftar | `security-input.spec.ts` | Lulus |
| Rahasia di bundel klien | `security-input.spec.ts` dan job `build` di CI | Lulus |
| Struktur RLS: semua tabel `public` memakai ENABLE dan FORCE dengan kebijakan; `kira_app` dan `kira_worker` tanpa akses skema `auth`; tidak ada role aplikasi superuser atau bypass RLS; fungsi SECURITY DEFINER | `packages/db/test/rls-audit.test.ts` (baru), `rls.test.ts` (sudah ada), pemeriksaan `psql` manual | Lulus |
| Tinjauan SQL mentah: `sql.raw` dan `.unsafe` | `grep` seluruh repo | Hanya `packages/db/scripts/migrate.ts` (`tx.unsafe` pada berkas migrasi dari disk, bukan input pengguna). 58 `sql` bertag dengan interpolasi: semuanya lewat Drizzle sehingga nilai menjadi parameter; sisanya nama kolom |
| `pnpm audit` | `pnpm audit` | Lihat bagian 3 |
| sqlmap | `docs/keamanan/sqlmap.sh` | **Tidak ada injeksi SQL.** Level 3, risiko 2, sembilan target (lihat `docs/keamanan/sqlmap-hasil.txt`). Satu "boolean-based blind" pada Server Action masuk adalah positif palsu karena isi halaman tidak stabil; sqlmap sendiri menyimpulkan "tidak bisa disuntik" setelah verifikasi. Server Action reset, `/api/sync`, dan `/api/tts/request` dibatasi waktu 7 menit per target dan berhenti tanpa temuan sebelum semua teknik selesai (nilai ditolak validasi Zod/UUID sebelum menyentuh SQL). Putaran pertama untuk target berautentikasi mendapat 401 karena sesi pemindai dicabut ZAP yang mengunjungi `/bye`; diulang dengan sesi baru (bagian kedua berkas hasil) |
| OWASP ZAP baseline dan API scan | `docs/keamanan/README.md` | **0 FAIL.** Baseline publik 61 lulus, 7 peringatan; baseline sesi tutor 61 lulus, 7 peringatan; baseline sesi anak 62 lulus, 6 peringatan; API scan 119 lulus, 2 peringatan (`docs/keamanan/zap-*.md`). Peringatan yang tersisa: `style-src 'unsafe-inline'` (disengaja, atribut style React tidak bisa diberi nonce), tidak ada token anti-CSRF (perlindungan lewat Origin dan SameSite, diuji di e2e), COEP/CORP tidak diset (tidak dibutuhkan, tidak ada sumber lintas origin), Content-Type tak terduga pada 404/401 teks di API, "Non-Storable Content" (disengaja, `no-store`), pengalihan besar (halaman setup/masuk), dan "User Controllable HTML Element Attribute" pada sesi anak (informasi, nilai di-escape oleh React) |
| Strix | `docs/keamanan/strix.md` | **Belum dijalankan**: menunggu kunci API LLM dari pemilik |

Menjalankan suite keamanan: `E2E_BASE_URL=http://localhost:3136 pnpm e2e security-access security-input` terhadap build produksi (`E2E_PROD=1` mengaktifkan pemeriksaan pengalihan HTTPS). 41 tes lulus lokal. Tes unit baru: `apps/web/test/hardening.test.ts` (15 tes). Tes db baru: `packages/db/test/rls-audit.test.ts` (5 tes).

## 2. Temuan dan perbaikan

| # | Tingkat | Temuan | Status |
|---|---|---|---|
| 1 | Tinggi | `clientIp()` memakai entri pertama `X-Forwarded-For`, yang diisi klien. Satu orang bisa memutar nilainya dan melewati semua batas per IP (login, reset, setup). | **Diperbaiki.** `CF-Connecting-IP` dipakai bila ada (cloudflared mengisinya dan Cloudflare menghapus nilai dari klien); tanpa itu entri **terakhir** `X-Forwarded-For` (yang ditambahkan proxy terdekat); nilai yang bukan alamat IP diabaikan. `apps/web/src/lib/client-ip.ts`. |
| 2 | Sedang | `http://kira.gatxel.com` menyajikan halaman masuk lewat HTTP polos. | **Diperbaiki di aplikasi** (308 ke HTTPS di `src/proxy.ts`, hanya produksi dan host publik; `CF-Visitor` menang atas `X-Forwarded-Proto` supaya proxy di tengah tidak membuat loop). **Pemilik tetap perlu menyalakan Always Use HTTPS** (bagian 6). |
| 3 | Sedang | `/api/internal/weekly-report` bisa dijangkau dari internet bila token bocor. | **Diperbaiki.** Permintaan dengan header Cloudflare (`CF-Ray`, `CF-Connecting-IP`, dan sejenisnya) dijawab 404 sebelum token diperiksa. Worker memanggil lewat jaringan Docker tanpa header itu. |
| 4 | Sedang | `/api/mcp` menyala secara bawaan. | **Diperbaiki di kode** (`KIRA_MCP` bawaan `off`, 404 bila mati) dan `.env.example`. **`docker-compose.yml` baris 107 masih `${KIRA_MCP:-on}`**: ubah ke `off` (bagian 5). |
| 5 | Sedang | Rute tulis tanpa batas laju: simpan jawaban, kumpulkan, `/api/sync`, `/api/media`, `/api/tts/request`, peti, arena, undangan, persetujuan. | **Diperbaiki.** Batas per akun (kunci ember = id pengguna, bukan IP, supaya satu sekolah dengan satu IP tidak saling mengunci): semua Server Action 900 per menit untuk anak dan 300 untuk dewasa (di `requireActor`), simpan jawaban 600, kumpulkan 120, `/api/sync` 60, unggah 30 (anak) atau 60 (dewasa), `/api/tts/request` 60, peti 30, persetujuan 30, undangan 10, heartbeat 30, `/api/internal` 120. Respons 429 dengan `Retry-After` di Route Handler. Seorang anak yang menjawab tiap detik memakai kurang dari sepersepuluh batas. |
| 6 | Sedang | Kunci akun baru terjadi setelah 100 kegagalan; batas login 30 per menit per IP terlalu rendah untuk orang tua di satu sekolah. | **Diperbaiki.** Kunci 15 menit setelah **20** kegagalan per email (tetap per akun, bukan per IP, dan sama untuk email yang tidak terdaftar), jeda bertahap mulai kegagalan ke-3 (0,5 s sampai 5 s), batas IP dinaikkan ke 120 per menit. |
| 7 | Rendah | Unggahan: EXIF/GPS tersimpan; merek `ftyp` apa pun diterima sebagai audio (termasuk HEIC dan video); batas ukuran sama untuk anak dan dewasa; tanpa jatah harian; body dibaca utuh tanpa `Content-Length`. | **Diperbaiki.** JPEG/PNG/WebP dibersihkan (EXIF, XMP, ICC, komentar dibuang; berkas rusak ditolak, `apps/web/src/lib/image-clean.ts`), `ftyp` hanya merek audio, batas anak (audio 5 MB, foto 6 MB, gambar 3 MB, permintaan 12 MB), jatah 24 jam (anak 40 berkas atau 60 MB, dewasa 300 atau 800 MB), `Content-Length` wajib (411). SVG tidak pernah diterima (penyaring isi, bukan ekstensi). Nama berkas di disk selalu UUID. |
| 8 | Rendah | Token atur ulang bisa dipakai dua kali bila dua permintaan datang bersamaan; waktu jawaban "lupa password" berbeda antara email terdaftar dan tidak (±300 ms vs kerja DB). | **Diperbaiki.** Token diklaim dengan `UPDATE ... WHERE used_at IS NULL RETURNING` sebelum password diganti, token lain akun itu ikut hangus, dan jawaban selalu menunggu ±1 detik. |
| 9 | Tinggi (rantai pasok) | `zod` 4.6.5: advisory memori habis pada koleksi besar. | **Diperbaiki**: zod 4.6.7 di semua paket. Juga `nodemailer` 10.0.16 ke 10.3.1 (tiga advisory sedang pada parser alamat; berpengaruh ke email keluar). |
| 10 | Rendah | Pengoptimal gambar Next (`/_next/image`) aktif tanpa dipakai. | **Dimatikan** (`images.unoptimized`, `dangerouslyAllowSVG: false`); endpoint menjawab 404. |

### Paparan advisory Next (diperbaiki di 16.4.2)

Versi terpasang: `next 16.4.2`, yang sudah memuat perbaikan ketiganya. Paparan Kira sebelum pembaruan: (a) RCE lewat `use cache`: **tidak terpapar**, tidak ada `use cache`, `cacheComponents`, atau `cacheLife` di kode; (b) Image Optimization dengan SVG: **tidak terpapar**, tidak ada `next/image`, `remotePatterns` kosong, dan sekarang endpoint `/_next/image` dimatikan (404); (c) DoS lewat Server Actions: **terpapar secara teori** karena Next membaca body (sampai 61 MB, dibutuhkan impor PDF paket resmi oleh tutor) sebelum action memeriksa sesi. Sekarang sudah ditambal di Next; lapis tambahan di kita adalah batas laju per akun dan Zod `.strict()`. Cloudflare Free membatasi body 100 MB, yang tidak bisa dikecilkan tanpa paket Business.

### Yang sudah baik sebelum pemeriksaan (diverifikasi, bukan diubah)

- Cookie sesi `__Host-kira.session`: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, tanpa Domain. Sesi menyimpan hash SHA-256 token, bukan token. Rotasi saat masuk (`startSession` mencabut sesi lama), batas menganggur 1 jam dan mutlak 24 jam, ganti password mencabut sesi lain, atur ulang password mencabut semua sesi.
- Login: password salah dan akun tidak ada memberi pesan sama dan menjalankan hash yang sama (`burnVerify`).
- Header: CSP ber-nonce dengan `strict-dynamic`, `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`; HSTS 2 tahun dengan `includeSubDomains`; `X-Frame-Options: DENY`; `nosniff`; `Referrer-Policy`; `Permissions-Policy`; `Cache-Control: no-store, no-transform` untuk semua halaman dan API; `X-Powered-By` dihapus.
- Pemeriksaan `Origin` (`sameOrigin`) di semua Route Handler POST, Zod `.strict()` di input.
- Database: tidak ada port ke host (hanya web di `127.0.0.1`), `pg_hba.conf` hanya `hostssl` + `scram-sha-256` dan menolak koneksi tanpa TLS, empat role tanpa superuser dan tanpa bypass RLS (hanya `kira_owner`, yang tidak dipakai aplikasi), `audit_log` dan `consent_event` append-only untuk aplikasi.
- SECURITY DEFINER (`kira_org_count`, `kira_list_orgs`, `kira_claim_jobs`, `kira_delete_learner`, `kira_retention`): semuanya mengunci `search_path`; tidak bisa dijalankan PUBLIC. `kira_list_orgs`, `kira_claim_jobs`, `kira_delete_learner`, `kira_retention` hanya untuk `kira_worker`/`kira_owner`. `kira_org_count` mengembalikan satu angka dan dipakai halaman setup. `kira_delete_learner` memeriksa bahwa anak milik org yang disebut sebelum menghapus.

## 3. Ketergantungan

`pnpm audit` setelah pembaruan: 0 tinggi/kritis, 2 sedang, keduanya hanya alat pengembangan (tidak masuk image produksi): `esbuild <=0.24.2` lewat `drizzle-kit` dan `minimatch <11.0.1` lewat `eslint`. Dibiarkan; naikkan bersama `drizzle-kit` dan `eslint` setelah pilot. Pembaruan Dependabot lain tidak digabung di cabang ini (keputusan: tidak mengubah versi yang tidak perlu menjelang pilot; kecuali zod dan nodemailer di atas).

## 4. Risiko sisa, menurut tingkat

**Tinggi**: tidak ada.

**Sedang**

1. **Tabel skema `auth` tidak memakai RLS** (`user_account`, `session`, `device`, `reset_token`, `invite`, `learner_secret`, `passkey`, `login_attempt`, `mcp_token`, `webauthn_challenge`). Perlindungannya hak tabel: hanya role `kira_auth` yang bisa membuka skema itu, dan `kira_app` serta `kira_worker` tidak. Akibatnya bila proses web disusupi, penyerang memegang koneksi `kira_auth` ke seluruh identitas semua keluarga. RLS tidak membantu karena `kira_auth` memang harus melihat lintas org (login belum tahu org-nya). Mitigasi: kode yang memakai `authDb()` kecil dan terpusat di `server/auth/`; tidak ada SQL dinamis. Dipertahankan.
2. **Batas laju hidup di memori satu proses.** Bila kapasitas menjalankan beberapa replika web, tiap replika punya ember sendiri, jadi batas efektif dikali jumlah replika (kunci akun login tetap di database dan tidak terpengaruh). Perbaikannya ada di tugas kapasitas (Valkey); tanda tangan `throttleIp(action, perMinute, scope?)` sudah siap dipakai.
3. **Kunci akun bisa dipakai untuk mengunci orang lain**: 20 percobaan gagal per 15 menit terhadap email korban mengunci masuk 15 menit. Itu harga kunci per akun (GTX menolaknya per IP). Mitigasi: Turnstile di formulir masuk (bagian 6), batas Cloudflare, dan korban masih bisa memakai "Lupa password". Pantau kejadian `login.locked` di log.
4. **Permintaan atur ulang password bisa dipakai untuk membanjiri satu kotak masuk**: batas 20 per menit per IP, tanpa batas per email tujuan. Tambahkan batas per email (mis. 3 per jam) bila Turnstile belum terpasang.
5. **Body besar ke Server Action** (batas 61 MB oleh Next) sebelum sesi diperiksa. Tutup di Cloudflare bila paket mengizinkan; di Free plan hanya batas 100 MB.

**Rendah**

6. Log akses memuat awalan IP (/24) dan path (UUID acak, tanpa query, cookie, atau isi). Retensi mengikuti log Docker: tanpa `logging.options` di Compose, `json-file` tumbuh tanpa batas. Usul untuk kapasitas: `max-size: 10m`, `max-file: 5` (kira-kira beberapa hari). Log keamanan (`event: login.failed`, `login.locked`, `ratelimit`) tidak memuat email, password, atau nama anak.
7. HEIC/HEIF (foto iPad bawaan) ditolak sebagai foto jawaban. Android dan kamera browser mengirim JPEG; bila ada keluhan, tambahkan konversi di klien.
8. Pembersih gambar memeriksa struktur, tidak mendekode piksel. Tidak ada deteksi malware; berkas hanya disajikan kembali dengan `Content-Type` dari penyaring isi, `nosniff`, dan `Content-Disposition: inline` ke pemiliknya, orang tuanya, dan tutor.
9. `Retry-After` hanya ada di Route Handler. Server Action mengembalikan pesan "terlalu banyak percobaan" dalam bahasa Indonesia (atau Inggris untuk anak).
10. Strix belum dijalankan (menunggu kunci LLM).
11. Dua advisory sedang di alat pengembangan (bagian 3).

## 5. Perubahan yang diminta dari integrator (di luar wewenang cabang ini)

`docker-compose.yml` hanya diedit oleh kapasitas. Tambahkan:

```yaml
  web:
    environment:
      KIRA_MCP: ${KIRA_MCP:-off}          # baris 107, sebelumnya :-on
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "5" }    # retensi log akses beberapa hari
  backup:
    environment:
      BACKUP_HOURLY: ${BACKUP_HOURLY:-on}
      BACKUP_KEEP_HOURLY: ${BACKUP_KEEP_HOURLY:-48}
      BACKUP_KEEP_OFFSITE: ${BACKUP_KEEP_OFFSITE:-72}
      BACKUP_PASSPHRASE: ${BACKUP_PASSPHRASE:-}
    volumes:
      - ./deploy/backup/backup.sh:/backup.sh:ro
      - ./deploy/backup/restore-test.sh:/restore-test.sh:ro
      - ${KIRA_BACKUP_OFFSITE_DIR:-./backups-offsite}:/offsite
```

Dan di `.env`: `KIRA_MCP=off`, `KIRA_BACKUP_OFFSITE_DIR=<folder di disk atau layanan sinkron lain, mis. E:/KiraOffsite atau folder yang disinkronkan OneDrive>`, `BACKUP_PASSPHRASE=<48 karakter acak, simpan juga di pengelola password di luar komputer ini>`. Tanpa passphrase salinan lokasi kedua dilewati, dan itu dicatat di log layanan backup. Passphrase yang hilang berarti salinan terenkripsi tidak bisa dibuka.

Uji pemulihan (jalankan sekali sekarang dan setiap beberapa hari selama pilot):

```bash
docker compose exec backup /restore-test.sh                       # cadangan terbaru (per jam atau harian)
docker compose exec -e BACKUP_PASSPHRASE=... backup /restore-test.sh /offsite/kira-YYYYMMDD-HHMM.dump.enc
```

Skrip memulihkan ke server Postgres sementara di dalam container (tidak menyentuh database hidup), membandingkan jumlah baris semua tabel, memeriksa hak append-only dan RLS FORCE, lalu menghapus semuanya. Keluar dengan kode 0 dan baris "UJI PEMULIHAN LULUS". Sudah diuji lokal, termasuk jalur terenkripsi dan passphrase salah (gagal dengan "bad decrypt").

Cadangan per jam: RPO (data maksimum yang bisa hilang) menjadi 1 jam selama pilot, lalu 24 jam setelah `BACKUP_HOURLY=off`.

Variabel lingkungan baru: `BACKUP_HOURLY`, `BACKUP_KEEP_HOURLY`, `BACKUP_KEEP_OFFSITE`, `BACKUP_PASSPHRASE`, `KIRA_BACKUP_OFFSITE_DIR` (compose), `KIRA_ACCESS_LOG` (`off` mematikan log akses; bawaan menyala).

## 6. Daftar klik Cloudflare untuk pemilik

Dashboard Cloudflare, zona `gatxel.com`, hostname `kira.gatxel.com`. Nilai yang disebut sudah dihitung terhadap batas aplikasi (login 120 per menit per IP, akun 20 kegagalan).

**A. SSL/TLS**
1. SSL/TLS, Overview, mode enkripsi: **Full (strict)** (Tunnel tidak memakainya, tetapi aman bila nanti ada origin lain).
2. SSL/TLS, Edge Certificates: **Always Use HTTPS = On**; **Minimum TLS Version = 1.2**; **TLS 1.3 = On**; **Automatic HTTPS Rewrites = On**.
3. **HSTS di Cloudflare: biarkan Off.** Aplikasi sudah mengirim `Strict-Transport-Security: max-age=63072000; includeSubDomains`. Jangan menyalakan `preload` selama `gatxel.com` punya subdomain lain tanpa HTTPS.

**B. DNS dan Tunnel**
4. DNS: `kira` berstatus **Proxied** (awan oranye), CNAME ke `<id-tunnel>.cfargotunnel.com`. Pastikan tidak ada rekaman A/AAAA `kira` yang menunjuk ke IP rumah. Router rumah tanpa port forwarding.
5. Zero Trust, Networks, Tunnels, `gatxel-PC`: layanan `kira.gatxel.com` ke `http://127.0.0.1:3030`; tanpa aturan lain di hostname yang sama.

**C. WAF, aturan kustom (Security, WAF, Custom rules)** (maksimum 5 di Free plan)
6. Nama `Tutup rute internal`, Action **Block**, ekspresi:
   `starts_with(http.request.uri.path, "/api/internal") or starts_with(http.request.uri.path, "/api/mcp")`
   (aplikasi sudah menjawab 404, ini lapis kedua; worker memakai jaringan Docker dan tidak lewat Cloudflare).
7. Nama `Tantang bot di login`, Action **Managed Challenge**, ekspresi:
   `http.request.method eq "POST" and (http.request.uri.path eq "/masuk" or starts_with(http.request.uri.path, "/reset") or starts_with(http.request.uri.path, "/undangan"))` dan `not cf.client.bot`.
   Bila Turnstile (butir 12) sudah terpasang, aturan ini tidak perlu.
8. Opsional, setelah keluarga pertama terdaftar: Block `http.request.uri.path eq "/setup"` (halaman setup pertama sudah menolak bila ada org).

**D. WAF, aturan terkelola (Security, WAF, Managed rules)**
9. **Cloudflare Managed Ruleset = Enabled**, tindakan bawaan. Di paket **Pro ke atas**: **Cloudflare OWASP Core Ruleset = Enabled**, Paranoia Level **PL2**, ambang skor **Medium (40 ke atas)**, Action **Block**. Tambahkan pengecualian untuk OWASP (Skip) pada `http.request.uri.path eq "/api/media" and http.request.method eq "POST"` karena isi multipart berpotensi salah dikenali. Di Free plan hanya "Cloudflare Managed Free Ruleset" yang ada: nyalakan.

**E. Rate limiting (Security, WAF, Rate limiting rules)**
10. Free plan (1 aturan, periode 10 detik, karakteristik hanya IP): nama `POST autentikasi`, ekspresi
    `http.request.method eq "POST" and (http.request.uri.path eq "/masuk" or starts_with(http.request.uri.path, "/reset") or starts_with(http.request.uri.path, "/undangan"))`
    **30 permintaan per 10 detik per IP**, Action **Block**, durasi **10 detik**. Nilai ini jauh di atas satu keluarga dan di atas satu sekolah yang masuk bersamaan; batas aplikasi (120 per menit per IP, 20 gagal per akun) tetap berlaku di belakangnya.
    Paket Pro ke atas: tambahkan aturan kedua untuk `starts_with(http.request.uri.path, "/api/")`: **300 per 1 menit per IP**, Action **Managed Challenge**, durasi 1 menit.

**F. Bot dan Turnstile**
11. **Bot Fight Mode: Off untuk malam pertama.** Alasan: pada Free plan aturannya tidak bisa dikecualikan per path dan bisa menantang permintaan tanpa JavaScript (service worker offline, APK Android di WebView, Playwright). Nyalakan hanya bila log menunjukkan lalu lintas bot nyata (kejadian `ratelimit` atau `login.failed` berulang dari banyak awalan IP), lalu uji tablet sekali. Security Settings: Security Level **Medium**, **Browser Integrity Check = On**, Challenge Passage **30 menit**.
12. **Turnstile** (Turnstile, Add widget): Nama `Kira pilot`, Hostname `kira.gatxel.com`, Mode **Managed**, Pre-clearance **No**. Ambil **Site Key** (publik) dan **Secret Key**. Nama variabel yang diusulkan untuk integrasi sign-up oleh cabang akun: `KIRA_TURNSTILE_SITE_KEY` dan `KIRA_TURNSTILE_SECRET` di `.env` (secret jangan pernah di bundel klien). **Integrasi Turnstile belum ada di cabang ini**; domain verifikasi server adalah `https://challenges.cloudflare.com/turnstile/v0/siteverify`. CSP perlu `script-src` dan `frame-src` untuk `https://challenges.cloudflare.com` pada halaman publik saja, bukan halaman anak.

**G. Speed dan caching (supaya CSP dan privasi tidak rusak)**
13. Speed, Optimization: **Rocket Loader = Off**, **Auto Minify = semua Off**, **Email Address Obfuscation = Off**, **Mirage dan Polish = Off** (semuanya menyisipkan skrip atau mengubah isi; CSP anak melarang skrip luar). Aplikasi sudah mengirim `no-transform`.
14. Caching: Caching Level **Standard**; Cache Rule opsional: cache hanya `/_next/static/*`, `/fonts/*`, `/icons/*`, `/sounds/*` (Edge TTL 7 hari, hormati header asal); **semua lainnya Bypass cache**. Jangan menyimpan `/api/*`, `/tts/*` (milik sesi), atau halaman. Tentukan bersama kapasitas bila ada klip suara publik yang boleh di-cache.
15. **Always Online = Off**, **Hotlink Protection = Off**.

**H. Pemantauan**
16. Security, Events: aktifkan notifikasi email untuk "Security Events" ambang tinggi (Notifications, Add, "Advanced Security Events Alert"). Selama 48 jam pertama buka Security, Events setiap pagi dan cari lonjakan di `/masuk`.

## 7. Dibandingkan dengan Supabase (jujur)

| Hal | Supabase (bawaan) | Kira (server rumah) | Selisih |
|---|---|---|---|
| Akses data dari internet | PostgREST dan Realtime terbuka dengan `anon key`; semua tabel di skema `public` dapat dijangkau bila RLS lupa dinyalakan | Tidak ada API database. Hanya aplikasi web, database tidak punya port ke host | Kira lebih kecil permukaannya |
| RLS | Opsional per tabel (SQL baru tidak otomatis ON) | ENABLE dan FORCE di semua tabel data, diuji otomatis (`rls-audit.test.ts`) | Kira lebih ketat |
| Role dan hak | `anon`, `authenticated`, `service_role` (bypass RLS) | Empat role tanpa bypass, hak minimum, tidak ada hak bawaan (migrasi 0005) | Setara atau lebih ketat |
| TLS database | Tersedia, penegakan opsional | `hostssl` wajib, TLS 1.2+, `verify-full` di klien cadangan | Setara |
| Autentikasi | GoTrue (JWT, MFA, OAuth) | Sesi server dengan hash token, passkey, PIN gambar untuk anak, tanpa JWT | Berbeda; sesi server lebih mudah dicabut |
| WAF, DDoS | Cloudflare di depan API, batas laju dasar | Hanya Cloudflare gratis yang dikonfigurasi pemilik (bagian 6) | **Kira bergantung pada pengaturan Cloudflare** |
| Cadangan | Harian; PITR (pemulihan per detik) sebagai tambahan berbayar | Harian dan per jam (RPO 1 jam), salinan terenkripsi di lokasi kedua | **Tidak ada PITR**; kehilangan sampai 1 jam data |
| Ketersediaan | Replika dan failover terkelola | Satu komputer rumah (listrik, internet, Windows Update) | **Titik gagal tunggal**; ada rencana lain di tugas kapasitas |
| Audit database | Log Postgres dan Auth tersedia, `pgaudit` opsional | `audit_log` aplikasi append-only; tidak ada `pgaudit` | Kira tidak mencatat kueri; hanya kejadian aplikasi |
| Pemindaian kerentanan | Dikelola penyedia | Manual (`pnpm audit`, Dependabot); belum ada pemindaian image Docker | **Tambahkan** `docker scout cves` atau `trivy image kira-web:latest` sebelum pilot dibuka |
| Rotasi rahasia | Dashboard | Manual, di `.env` | Catat tanggal rotasi `KIRA_SECRET` dan password role |
| Pemisahan lingkungan | Branch database | Instance lokal sekali pakai untuk uji | Setara |

## 8. Berkas dan perintah

- Tes: `e2e/tests/security-access.spec.ts`, `security-input.spec.ts`, `security-helpers.ts`; `apps/web/test/hardening.test.ts`, `internal-weekly-report.test.ts`; `packages/db/test/rls-audit.test.ts`.
- Kode: `apps/web/src/lib/{client-ip,https-redirect,image-clean,access-log}.ts`, `apps/web/src/proxy.ts`, `server/auth/{ratelimit,actor,accounts}.ts`, `server/media.ts`, `app/api/*`.
- Cadangan: `deploy/backup/backup.sh`, `deploy/backup/restore-test.sh`.
- Pemindaian: `docs/keamanan/` (lihat `README.md` di sana).

## Uji tembus internal, 5 November 2026

**Ini uji internal, dan tidak independen.** Pengujinya agen Claude yang bekerja untuk pemilik, memakai kode yang sama dengan tim pembuatnya dan membaca kode sumbernya. Hasil ini tidak menggantikan audit pihak ketiga. Strix tidak dijalankan karena butuh kredit berbayar.

Cabang `pilot/aman2`, dari `pilot/gabung` commit `d244a7c`. Sebelum selesai, `pilot/gabung` terbaru (`19843a9`, 241 commit lebih baru) digabung ke cabang ini, lalu uji peran, uji lintas keluarga, uji ulang perbaikan, dan tes otomatis dijalankan lagi. sqlmap dan ZAP tidak diulang. Semua serangan hanya ke stack lokal Docker bernama `kirasec` di `127.0.0.1:3190`, dengan data fiksi. `kira.gatxel.com`, `C:\Kira\app`, dan container `kira-*-1` tidak disentuh.

### Ringkasan

| Tingkat | Jumlah | Status |
|---|---|---|
| Kritis | 0 | |
| Tinggi | 0 | |
| Sedang | 8 | Semua diperbaiki dan diuji ulang |
| Rendah | 15 | Diperbaiki dan diuji ulang, kecuali R2 (sebagian) dan R13 (dibiarkan) |
| Terbuka, perlu keputusan pemilik | 11 | Lihat bagian "Yang masih terbuka" |

Tidak ditemukan kebocoran data antar keluarga, naik peran, injeksi SQL, atau XSS tersimpan. Kesimpulan ini berlaku untuk jalur yang diuji di bawah, dan belum tentu berlaku untuk jalur yang tidak diuji.

### Cara kerja

Stack: proxy Caddy, 2 replika web, PgBouncer, Valkey, Postgres, worker, dan Mailpit, dibangun dari `docker-compose.yml` yang sama dengan produksi, dengan nama image sendiri dan rahasia acak baru. Seed: tiga keluarga fiksi, dua tutor, dan satu orang tua kedua di keluarga A yang hanya tertaut ke satu anak. Id Server Action diambil dari manifest build produksi: 134 action pada uji pertama, 141 setelah penggabungan.

Alat: skrip Node dengan permintaan sungguhan, sqlmap, OWASP ZAP, Playwright, `pnpm audit`, dan pindai image. Skrip uji disimpan di luar repo karena memuat token sesi uji.

### Yang diuji dan hasilnya

| Area | Cara | Hasil |
|---|---|---|
| Peran, semua Server Action | 138 dari 141 action dipanggil tanpa sesi, sebagai anak, orang tua, dan tutor. `registerDeviceAction` diuji lintas keluarga. `signOutAction` dan `signOutLearnerAction` hanya dibaca kodenya karena mencabut sesi pemanggil | Lulus. Anak ditolak di semua aksi orang tua dan tutor, termasuk saklar fitur dan batas layar |
| Peran, Route Handler dan halaman | 25 rute ditemukan otomatis. 15 dipanggil langsung tanpa sesi atau dengan peran salah, sisanya dibaca kodenya dan sebagian dicakup `security-access.spec.ts`. Halaman: 71 alamat dari 95 | Lulus |
| Lintas keluarga dan lintas saudara | 110 panggilan aksi dengan id keluarga lain atau saudara, 83 halaman dan rute baca, `/api/sync`, `/api/media`. Sebelum dan sesudah, checksum semua baris keluarga B dan anak saudara dibandingkan | Lulus. Nol baris berubah, nol nama keluarga lain di respons. Dua aksi tutor (`recordOfflineConsentAction`, `sendReportAction`) berhenti di validasi, jadi jalur datanya tidak tercapai |
| Balapan, 20 permintaan serentak | Bintang, beli barang, saldo negatif, beli ganda, ulang nonce, kartu, bos, peti, kumpul sesi, XP, kursi, kuis baca, ejaan, kartu belajar, lembar kerja, tambah anak, token atur ulang, undangan | Saldo bintang, kursi, peti, bos, dan token sudah aman. Kuis baca dan ejaan gagal (S4), diperbaiki. Kursi: tersisa 1, 20 serentak, tepat 1 berhasil dan total 100 |
| Nilai dari klien | Skor, harga, id barang, kolom tambahan, ulang permintaan lama | Kolom tambahan ditolak `.strict()`. Skor pelajaran dari klien: R2 |
| Kebocoran jawaban | HTML dan RSC pada Tes, Kertas, Simulasi, ESMO, Bos, Penempatan, Quick Maths berwaktu, Quiz Arena, Kuis Baca, Alat. Aksi pembahasan sebelum kumpul | Bos dan soal dengar gagal (S1, S2), diperbaiki. Yang lain bersih |
| Injeksi SQL | sqlmap level 2, risiko 1, teknik boolean dan waktu, 58 target, 75 detik per target, pada build sebelum perbaikan | Nol temuan. 11 target berhenti karena batas waktu, tanpa temuan. Nilai ditolak Zod sebelum sampai SQL. Hasil: `docs/keamanan/sqlmap-hasil2.txt` |
| ZAP | Baseline publik, orang tua, anak, dan API scan, pada build sebelum perbaikan | 0 FAIL. Peringatan sama dengan pass sebelumnya (`style-src 'unsafe-inline'`, COEP dan CORP) ditambah header kebijakan pada berkas statis. Hasil: `docs/keamanan/zap2-*.md` |
| XSS tersimpan | Nama anak, nama teman, medali, kata tersimpan, laporan soal, catatan, nama perangkat, parameter URL, pada 39 alamat anak, orang tua, tutor, cetak, dan 3 jenis email di Mailpit | Lulus, semua di-escape. Nama teman dan kata tersimpan ditolak validasi. Judul paper dan catatan nilai orang tua tidak tersimpan karena data uji, jadi tampilannya tidak diuji. Email laporan mingguan hanya dicakup tes unit lama |
| Injeksi PDF dan template | Sertifikat sungguhan dengan nama anak berisi operator PDF, tanda kurung, dan garis miring terbalik. Hari di luar 7, 30, 100, dan path | Lulus. Tanda kurung dan garis miring dibuang, nama tetap satu string teks di PDF. Berkas itu dibaca sebagai teks dan belum dibuka di pembaca PDF. `0x7` dan `7.0` dibaca sebagai 7 dan memberi sertifikat yang sama, tidak berbahaya |
| SSRF | Semua `fetch` di web dan worker | Tidak ada URL dari pengguna: hanya HaveIBeenPwned, Turnstile, dan alamat AI dari env |
| Path traversal | 46 path mentah lewat soket ke proxy: media, klip, buku, statis, `.env`, `.git`, `/api/internal` dengan variasi penulisan | Lulus |
| Redirect terbuka | 19 bentuk `next`, Host palsu | `next` gagal (S3), diperbaiki. Pengalihan HTTPS memakai `KIRA_ORIGIN` di produksi |
| Sesi | Fiksasi, keluar, kedaluwarsa, menganggur, cookie, persetujuan dicabut | Lulus. `__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax` |
| Token | Atur ulang dipakai ulang, kedaluwarsa, 20 serentak. Verifikasi dipakai ulang, undangan 20 serentak | Lulus |
| Brute force | 40 percobaan serentak | Gagal (S6), diperbaiki |
| Pemalsuan IP | `X-Forwarded-For`, `X-Real-IP`, `True-Client-IP`, `Forwarded`, `CF-Connecting-IP` | Hanya `CF-Connecting-IP` yang dipercaya. Lihat T9 |
| Turnstile | Kunci uji Cloudflare yang selalu gagal: token kosong dan palsu pada daftar, masuk, atur ulang, kirim ulang, daftar tunggu | Lulus, 8 dari 8 ditolak. Rahasia tidak ada di halaman |
| CSRF | Origin lain, `null`, mirip subdomain, pada Server Action dan rute | Lulus. Temuan terkait: R4 |
| Enumerasi akun | Pesan dan waktu pada masuk, atur ulang, kirim ulang, daftar, daftar tunggu | Pesan sama. Waktu daftar tunggu berbeda (R6), diperbaiki |
| Email sekali pakai | 34 bentuk: subdomain, plus, huruf besar, titik akhir, Unicode, komentar, alamat IP | Gagal pada 6 bentuk (R5), diperbaiki. Plus dan titik Gmail dihitung satu alamat |
| Header dan paparan | CSP, HSTS, framing, `/api/health`, source map, port, Valkey, PgBouncer | Lulus. Temuan terkait: T10 dan R13 |
| Rahasia di image | Semua layer `kirasec-web` (14.796 berkas), `kirasec-worker` (9.222), `kirasec-proxy` (751), dan riwayat build, dicari menurut pola dan nilai env uji, tanpa mencetak nilai. Folder `node_modules` dan paket sistem hanya dicek nama berkasnya | Nol. Satu cocokan di image worker adalah contoh `XXXX` di cache kompilasi CLI, bukan kunci |
| Ketergantungan | `pnpm audit --prod` dan semua. Trivy (kerentanan tinggi dan kritis yang sudah ada perbaikannya) pada tiga image | `pnpm audit --prod`: 0. Semua: 2 sedang, alat pengembangan. `npm audit` tidak bisa jalan karena repo memakai `pnpm-lock.yaml`. Trivy: lihat R15 dan T11 |
| Penolakan layanan | Body besar, JSON dalam, kueri 1 MB, header 200 KB, sambungan lambat, halaman mahal | Lihat S7, S8, R3 |

### Temuan dan status

| # | Tingkat | Temuan | Bukti | Status | Commit |
|---|---|---|---|---|---|
| S1 | Sedang | Teks dengar soal dengar dan eja (katanya sendiri) ada di payload Tes, Simulasi, Bos, dan Penempatan. Dilaporkan QA, dipastikan di `present.ts` | Kode | Diperbaiki: perangkat hanya menerima kunci klip, tidak jatuh ke suara perangkat. Soal tanpa klip diganti soal lain saat sesi disusun, sehingga jumlah soal tetap. Attempt lama menampilkan pesan dua bahasa. Penempatan melewati soal eja. Putar dan nilai diuji di browser sungguhan | `3a51444`, `388dedc` |
| S2 | Sedang | Tantangan bos memberi 10 bintang dan kartu, tetapi kunci, pembahasan, dan solusinya terkirim sebelum menjawab | 8 soal, 8 kunci di RSC | Diperbaiki: dinilai server | `5c8e37b` |
| S3 | Sedang | Redirect terbuka: `next=/<tab>/situs-lain` lolos dan browser membacanya sebagai `//situs-lain`. Baris baru membuat halaman masuk 500 | Terbukti | Diperbaiki | `1a8ac0d` |
| S4 | Sedang | Kuis baca dikumpulkan serentak memberi XP berkali-kali. Ejaan melewati batas harian | Kuis: 2 menjadi 40 XP. Ejaan: 600 dari batas 40 | Diperbaiki dengan kunci per anak. Bintang sudah aman sejak awal | `8475fcc` |
| S5 | Sedang | Saklar fitur hanya menutup halaman. Anak bisa mulai Quick Maths, Quiz Arena, ESMO, English Skills, dan latihan mapel yang dimatikan orang tua, sebagian cukup dengan mengetik alamat | Terbukti pada 6 jalur | Diperbaiki di aksi dan rute | `8475fcc` |
| S6 | Sedang | Kunci akun bisa dilewati: 40 percobaan serentak semuanya diperiksa, batasnya 20 | 40 dari 40 | Diperbaiki: paling banyak 20 sampai ke pemeriksaan password | `93124a7` |
| S7 | Sedang | Pengunjung tanpa sesi boleh mengirim sampai 62 MB ke `/konsol/impor`, dan Next membacanya sebelum sesi diperiksa | Dari konfigurasi proxy. Belum dibuktikan dengan beban | Diperbaiki: 62 MB hanya bila ada cookie sesi. Anonim 20 MB kini 413. Orang tua yang masuk masih bisa mengirim 62 MB | `b1a0ab7` |
| S8 | Sedang | Satu permintaan `/api/sync` membawa 120 transaksi, jadi batas 60 per menit setara 7.200 transaksi | Dari kode | Diperbaiki: anggaran 1.200 butir per menit | `b1a0ab7` |
| R1 | Rendah | Sesi yang dikumpulkan kosong memberi XP dan 3 bintang. Ulangan kosong memberi XP | Terbukti | Diperbaiki: tanpa XP dan bintang. Sesi tetap selesai, lihat T1 | `5c8e37b`, `a2a3e78` |
| R2 | Rendah | Skor cek pelajaran datang dari klien: XP untuk skill apa pun tanpa membuka pelajaran | 70 XP dari 7 skill | Sebagian: batas 100 XP per hari dan saklar mapel. Skornya tetap dari klien | `8475fcc` |
| R3 | Rendah | Rute dinamis tanpa batas laju: mulai sesi, sertifikat, `tts/today`, APK, berhenti kabar. Body chunked tidak dibatasi di rute | Mulai sesi menulis baris tiap kali | Diperbaiki | `8fa60c4` |
| R4 | Rendah | Proxy meneruskan `X-Forwarded-Host` dari klien, dan aplikasi memakainya untuk pemeriksaan Origin | Origin dan header palsu lolos pemeriksaan | Diperbaiki | `6876c67` |
| R5 | Rendah | Email sekali pakai lolos dengan `a@mailinator.com(x)`, titik lebar U+3002, spasi lebar nol, `%00`, `a%mailinator.com@gmail.com`, dan `a@[127.0.0.1]` | 6 bentuk | Diperbaiki | `86a5de5` |
| R6 | Rendah | Daftar tunggu menjawab sekitar 140 ms lebih cepat untuk email terdaftar | 57 ms lawan 195 ms | Diperbaiki: kini 677 ms lawan 713 ms | `b1a0ab7` |
| R7 | Rendah | Proxy menjawab 502 sesekali pada POST, karena Node menutup sambungan setelah 5 detik sementara Caddy memakainya sampai 30 detik | 4 dari 20 | Diperbaiki, 0 dari 60 | `6876c67` |
| R8 | Rendah | Pola baca lalu tulis pada batas lembar kerja dan XP kartu | Belum terbukti sebelum perbaikan: uji pertama memakai skill yang salah | Diperbaiki sebagai pencegahan | `8475fcc` |
| R9 | Rendah | Kuis baca dimulai serentak membuat 20 kuis terbuka | Terbukti | Diperbaiki | `8475fcc` |
| R10 | Rendah | Laporan soal tanpa batas sendiri | Kode | Diperbaiki, 20 per menit | `b1a0ab7` |
| R11 | Rendah | Pembahasan dan bantuan bos bisa diminta lewat aksi | Kode | Diperbaiki | `5c8e37b` |
| R12 | Rendah | Bos dimulai 20 kali serentak membuat 20 attempt. Hadiah tetap sekali | Terbukti | Dibatasi 60 per menit | `8fa60c4` |
| R13 | Rendah | Berkas statis dari Caddy tanpa `Permissions-Policy` dan header sejenis | ZAP | Dibiarkan: berkas statis, tanpa risiko praktis | |
| R14 | Rendah | Saat Valkey mati, cookie lama masih diterima 5 detik setelah keluar, karena Route Handler dan halaman memakai salinan cache memori yang berbeda. Dengan Valkey, cookie lama langsung ditolak. Permintaan yang sedang berjalan juga bisa mengisi cache lagi tepat setelah keluar (belum terbukti, ditutup sekaligus) | Tes e2e lama gagal, dan terulang dengan `fetch` biasa | Diperbaiki: cache memori dibagi, dan sesi yang baru dicabut tidak bisa masuk cache selama 30 detik. Tes lama tidak diubah | `587d99a`, `01a86d5` |
| R15 | Rendah | Trivy: kerentanan tinggi di npm bawaan image Node (`undici`, `brace-expansion`), kritis dan tinggi di `curl` dan `brotli` image Caddy. Tidak dipakai saat jalan | Trivy | Diperbaiki di image web dan proxy: paket-paket itu dibuang. Image worker masih memuat npm karena Claude CLI dipasang lewat npm, dan AI mati selama pilot | `08cd7ff` |

### Yang masih terbuka

Ini perlu keputusan pemilik, atau terlalu besar untuk malam ini.

| # | Hal | Dampak | Usul |
|---|---|---|---|
| T1 | Sesi kosong tetap selesai, jadi tetap menghitung streak, peti harian, dan sertifikat. Anak bisa menjaga streak tanpa menjawab | Rendah, tanpa XP dan bintang | Pemilik memutuskan: wajibkan minimal satu jawaban untuk streak. Ini aturan produk, jadi belum diubah |
| T2 | Latihan mengirim kunci ke perangkat, supaya umpan balik instan dan jalan offline. Anak yang membuka data jaringan bisa mendapat bonus sempurna, 2 bintang per sesi | Rendah | Diterima untuk pilot |
| T3 | Kunci klip adalah SHA-256 dari gaya dan teks. Orang yang punya daftar kata bisa mencocokkannya di luar Kira, dan suara klip memang jawabannya | Rendah, butuh skrip | Pakai id acak bila dianggap perlu |
| T4 | Spelling Bee mengirim kata ke perangkat. XP dibatasi 40 per hari | Rendah | Diterima |
| T5 | Batas layar hanya menahan mulai arena dan tampilan Today. `/run` dan `/practice` tetap jalan, dan menit dihitung dari detak perangkat | Sedang untuk janji ke orang tua | Pemilik memutuskan apakah batas ini wajib ditegakkan |
| T6 | Orang tua tidak bisa mencabut tablet yang hilang. Cabut perangkat hanya untuk tutor. Token tablet berlaku 90 hari, dan masih dijaga PIN anak yang terkunci setelah 5 kali salah | Sedang | Tambah layar cabut perangkat untuk orang tua |
| T7 | Bila `TTS_URL` diisi, pengguna yang masuk bisa meminta klip teks bebas, 60 per jam, dan klip tersaji publik di `/tts/<hash>.mp3` | Rendah | Batasi ke teks yang ada di bank soal |
| T8 | Jam Tes menerima `answeredAt` dari perangkat, dengan kelonggaran 10 menit untuk jawaban offline | Rendah | Diterima |
| T9 | `CF-Connecting-IP` dipercaya dari semua yang sampai ke proxy, jadi batas per IP bisa dilewati oleh program di komputer server. Dari internet tidak bisa, karena Cloudflare menimpa header itu dan port proxy hanya di `127.0.0.1` | Rendah | Diterima. Jangan pernah membuka port proxy ke jaringan |
| T10 | Batas email per alamat ada di memori tiap replika, jadi 5 per jam menjadi 20 dengan 4 replika. Bila Valkey lambat lebih dari 250 ms, batas laju memakai memori selama 5 detik (terlihat saat uji di PC yang sibuk). Jatah unggah harian dihitung tidak atomik, selisihnya paling banyak 30 berkas | Rendah | Pindahkan batas email ke Valkey setelah pilot |

| T11 | Biner Caddy 2.11.7 memuat Go 1.26.8, `x/net` 0.59, dan `go-jose` 4.1.5 dengan kerentanan tinggi menurut Trivy. Versi terbaru `caddy:2-alpine` saat diperiksa masih 2.11.7, jadi belum ada pembaruan. Dampaknya pada Caddy belum dianalisis. Paket sistem image web bersih | Belum diketahui | Naikkan digest Caddy begitu rilis baru ada, lalu pindai ulang |

Catatan untuk integrator: `kira-gerbang-pg` dan `kira-gerbang-mail` milik agen lain terbuka di `0.0.0.0` (port 54481 sampai 54483). Ini container uji dan bukan bagian compose produksi, tetapi sebaiknya dihapus.

### Batas laju yang berlaku sekarang

Ember token per menit. Disimpan di Valkey, dibagi semua replika. Tanpa Valkey, tiap replika menghitung sendiri.

| Rute atau aksi | Batas | Kunci |
|---|---|---|
| Semua Server Action bersesi | 900 anak, 300 dewasa | akun |
| `saveAnswer`, jawaban arena | 600 | akun |
| `submitAttempt` | 120 | akun |
| `/api/sync` | 60 permintaan dan 1.200 butir | akun |
| `/api/heartbeat` | 30 | akun |
| `/api/media` tulis | 30 anak, 60 dewasa | akun |
| `/api/media/[id]` baca | 600 | akun |
| `/api/tts/request` | 60, dan 60 klip baru per jam | akun |
| `/api/tts/today` | 120 | akun |
| `/tts/[file]` (klip publik tanpa sesi. Hanya permintaan yang meleset dibatasi) | 600 | IP |
| `/api/apk` | 10 | akun |
| Mulai sesi (`/practice`, `/english`, `/esmo`, `/review`, `/fix-it`, `/world/boss`) | 60 | akun |
| Sertifikat PDF | 20 | akun |
| Peti, persetujuan | 30 | akun |
| Laporan soal | 20 | akun |
| Undang anggota | 10 | akun |
| Masuk | 120 per IP, 20 gagal per email lalu kunci 15 menit | IP dan email |
| Atur ulang: minta, pakai | 20, 30 | IP |
| PIN | 240 per IP, 5 salah per anak lalu kunci 15 menit | IP dan anak |
| Daftar, kirim ulang, verifikasi | 6, 4, 10 | IP |
| Daftar tunggu: gabung, konfirmasi, berhenti | 5, 20, 20 | IP |
| Passkey, setup, terima undangan | 30, 10, 10 | IP |
| Email per alamat tujuan | 5 per jam per jenis | memori replika |
| Lembar kerja | 10 per hari per keluarga | keluarga |
| Body | 8 MB, 62 MB untuk `/konsol/impor` dan `/api/media` bila bersesi. Anak 12 MB per unggahan | proxy dan rute |
| Header | Caddy memutus sambungan yang lambat setelah 10 detik. Header terlalu besar dijawab 431 | proxy |

Halaman biasa dan `/api/health` tidak dibatasi aplikasi. Halaman biasa diserahkan ke aturan Cloudflare di bawah. Batas umum 60 per menit tidak dipasang di semua rute, karena `/api/media/[id]` dan klip bisa dipanggil puluhan kali dalam satu layar oleh anak biasa. Rute API yang membaca atau menulis data sudah punya batas sendiri di tabel ini.

### Daftar Cloudflare yang masih harus dikerjakan pemilik

Rincian ada di bagian 6. Ini urutan pendeknya. Belum ada satu pun yang bisa diuji dari sini.

1. **DNS dan Tunnel.** `kira` Proxied. Tunnel `gatxel-PC` menunjuk ke `http://127.0.0.1:3030` (proxy). Tanpa aturan lain di hostname itu, dan tanpa port forwarding di router.
2. **SSL/TLS.** Full (strict), Always Use HTTPS On, TLS minimum 1.2, TLS 1.3 On. HSTS di Cloudflare Off karena aplikasi sudah mengirimnya.
3. **Turnstile.** Buat widget `Kira pilot` untuk `kira.gatxel.com`, mode Managed. Isi `KIRA_TURNSTILE_SITE_KEY` dan `KIRA_TURNSTILE_SECRET` di `.env` produksi. **Turnstile hanya aktif bila keduanya terisi.** Setelah itu buka `/masuk`, pastikan widget muncul dan bisa masuk.
4. **Aturan WAF.** Block `/api/internal` dan `/api/mcp`. Bila Turnstile sudah aktif, aturan tantangan masuk tidak perlu.
5. **Managed Ruleset.** Free Ruleset On. Di paket Pro ke atas, OWASP dengan pengecualian `POST /api/media` dan `POST /api/feedback`.
6. **Rate limiting.** Satu aturan Free: `POST` ke `/masuk`, `/reset`, `/undangan`, `/daftar`, 30 per 10 detik per IP. Di paket Pro: `/api/` 300 per menit, dan halaman biasa 600 per menit.
7. **Speed dan cache.** Rocket Loader, Auto Minify, Email Obfuscation, Mirage, dan Polish Off. Cache hanya `/_next/static/*`, `/fonts/*`, `/icons/*`, `/sounds/*`, `/dict/*`, `/panduan-img/*`, dan `/tts/*.mp3`. Yang lain Bypass.
8. **Bot Fight Mode Off** untuk malam pertama. Always Online Off.
9. **Notifikasi.** Security Events ambang tinggi ke email. 48 jam pertama, periksa Security Events setiap pagi.
10. **Setelah semua menyala,** coba dari HP lewat data seluler: daftar, masuk, atur ulang password, tablet anak.

Tiga nilai `.env` produksi yang perlu dipastikan: `KIRA_VALKEY_PASSWORD` terisi sendiri dan tidak jatuh ke `KIRA_INTERNAL_TOKEN`, `KIRA_MCP=off`, dan `KIRA_HIBP=on`.

### Batas uji ini

- **Internal.** Penguji dan pembuat memakai model dan kode yang sama, jadi titik buta yang sama bisa terlewat di keduanya.
- **Bukan lewat Cloudflare.** Header, WAF, dan Tunnel sungguhan tidak diuji. Perilaku `CF-Connecting-IP` diuji dengan mengirim header itu langsung ke proxy.
- **`/feedback` diuji hidup sebagian,** setelah masuk ke `pilot/gabung`: anak ditolak, Origin lain ditolak, kolom tambahan, CRLF di subjek, kolom jebakan, lampiran palsu (SVG, HTML, PHP, PNG rusak), nama berkas jahat, 6 MB, 9 MB, tanpa `Content-Length`, dan 8 per menit per IP. Semua lulus. Yang belum: email ke tim dan lampirannya (stack uji tanpa alamat tim), dan Turnstile pada formulir ini. PDF dan MP4 lampiran tidak dibersihkan, jadi tim harus berhati-hati saat membukanya.
- **Trivy hanya melaporkan** tingkat tinggi dan kritis yang sudah punya perbaikan. Image worker perlu dibaca ulang hasilnya setelah digabung.
- **sqlmap dan ZAP dijalankan sebelum perbaikan.** Perbaikan tidak mengubah cara kueri dibuat, tetapi pindaian tidak diulang pada build akhir.
- **sqlmap dibatasi** level 2, risiko 1, 75 detik per target. Beban DoS dibuat sedang karena PC dipakai bersama, jadi batas kapasitas sungguhan tidak diukur di sini (lihat `docs/laporan-beban.md`).
- **Tidak diuji:** email sungguhan, passkey, APK Android dan WebView, halaman konsol tutor secara mendalam, antarmuka worker, cadangan dan pemulihan, serangan fisik pada komputer rumah.
- **Kode yang masuk lewat `pilot/gabung` setelah `d244a7c`** (suara, bahasa, verifikasi materi, perbaikan QA) hanya melewati uji ulang di atas, tanpa pembacaan kode seperti bagian lain.
- **Tes browser soal dengar** memakai berkas MP3 hening buatan, jadi yang terbukti adalah alur putar dan nilainya. Mutu suara tidak diuji.
- Hasil S7 dan S8 berasal dari membaca konfigurasi dan kode. Keduanya tidak dibuktikan dengan beban sungguhan sebelum diperbaiki.

### Hasil tes pada kode akhir

- `pnpm lint`: lulus. `pnpm typecheck`: lulus. `pnpm test`: 1.966 lulus, 3 gagal (tiga kegagalan jalur Windows yang sudah dikenal), 9 dilewati.
- Tes database (`--project db --project web-db`) di Postgres sekali pakai: 252 dari 252 lulus, termasuk 14 tes baru di `uji-tembus.db.test.ts`.
- E2E `security-input` dan `security-access` pada image akhir: 48 dari 48 lulus, termasuk browser sungguhan yang memutar klip soal dengar dan eja lalu dinilai 2 dari 2.
- E2E `security.spec`, `timed`, `placement`, dan `english` lulus satu commit sebelum akhir. `world.spec` gagal di pemeriksaan kontras warna (`color-contrast`) pada layar bos dan album, jadi langkah sesudahnya di tes itu tidak berjalan. Kontras itu berasal dari layar yang sudah ada dan tidak disentuh perbaikan ini, tetapi perlu dibetulkan sebelum tes itu bisa lulus.
- Layar bos tanpa kunci hanya diuji tampil di browser. Penilaian servernya diuji di tes database.
- Stack uji dihapus setelah selesai.

### Cara mengulang

`apps/web/test/uji-tembus.db.test.ts` (Postgres), `apps/web/test/hardening.test.ts`, `apps/web/test/email-policy.test.ts`, dan blok `uji tembus 5 November` di `e2e/tests/security-input.spec.ts`. sqlmap: `docs/keamanan/sqlmap2.py`.
