# Laporan keamanan pilot publik Kira

Tanggal: 4 sampai 5 November 2026. Cabang: `pilot/aman`. Pemeriksa: agen "aman" atas izin pemilik, hanya terhadap instance lokal (Postgres di port 54436, web di port 3136). Tidak ada pemindaian aktif ke `kira.gatxel.com` atau container produksi.

## Ringkasan

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
