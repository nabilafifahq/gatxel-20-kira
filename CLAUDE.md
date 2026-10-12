# Kira

Website belajar Math, English, dan Science untuk anak SD kelas 1 sampai 6 (Cambridge Primary), dengan konsol tutor dan halaman orang tua. Berjalan di server rumah (Windows 11, Docker Desktop) dan diakses lewat Tailscale. Standar: GTX-ENG-001 v1.7.

@DESIGN.md
@docs/standards/gtx/GTX-ENG-001.md
@docs/standards/gtx/agent-rules.md

## Perintah

| Perintah | Isi |
|---|---|
| `pnpm dev` | Next.js di http://localhost:3000 (butuh Postgres, lihat `docs/develop.md`) |
| `pnpm lint` | ESLint dan pemeriksa teks GTX (`scripts/check-copy.mjs`) |
| `pnpm typecheck` | TypeScript strict di semua paket |
| `pnpm test` | Vitest unit (core, content, figures, web) |
| `pnpm test:db` | Tes RLS dan otorisasi di Postgres sungguhan, butuh `DATABASE_URL_*` |
| `pnpm content:check` | Validasi semua soal, pelajaran, dan generator |
| `pnpm content:sync` | Tulis konten repo ke database (role kira_owner) |
| `pnpm db:migrate` | Jalankan migrasi (role kira_owner) |
| `pnpm e2e` | Playwright dan axe terhadap server lokal |

## Peta repo

- `apps/web`: Next.js App Router. `src/server/dal` satu-satunya tempat query database. `src/app/(learner)` layar anak (en-GB), `src/app/(console)` konsol tutor (id), `src/app/(family)` halaman orang tua (id), `src/app/cetak` halaman cetak A4.
- `apps/worker`: proses Node untuk job AI (Claude Code CLI atau endpoint OpenAI-compatible), PDF batch, email, laporan mingguan, backup, dan retensi.
- `apps/android`: cangkang Capacitor untuk APK tablet, dibangun di GitHub Actions.
- `packages/core`: mesin belajar murni (theta, pemilih soal, FSRS, gerbang, XP, level, streak, skor preset lomba, waktu Asia/Jakarta).
- `packages/db`: skema Drizzle, migrasi SQL, role, RLS, seed.
- `packages/content`: skema konten Zod, generator Math, pemeriksa, sinkron ke database.
- `packages/figures`: komponen SVG dari FigureSpec.
- `content/`: soal, pelajaran, skill, dan katalog lomba dalam JSON.

## Aturan tetap

1. Query database hanya di `apps/web/src/server/dal`. Komponen, Server Action, dan Route Handler hanya memanggil fungsi DAL.
2. Setiap Server Action dan Route Handler: `requireActor()`, lalu Zod `.strict()`, lalu `can()` untuk kepemilikan, lalu kembalikan DTO. Pemeriksaan di halaman tidak melindungi action.
3. Setiap transaksi data tenant lewat `withOrg(db, actor, fn)` yang menjalankan `set_config('app.org_id', ..., true)`. Role `kira_app` tidak bisa membaca tabel `auth`.
4. Kunci jawaban mode Tes, Simulasi, dan Kertas tidak pernah dikirim ke client sebelum attempt dikumpulkan. Skor selalu dihitung ulang di server.
5. Route group `(learner)` tidak memuat skrip pihak ketiga, iframe, font dari luar, atau tautan keluar.
6. Tidak ada rahasia dengan awalan `NEXT_PUBLIC_`. Modul yang memegang rahasia mengimpor `server-only`.
7. Semua teks UI lewat kamus di `apps/web/src/i18n`: learner en-GB, tutor dan orang tua id.
8. Warna, font, radius, jarak, dan easing hanya dari token DESIGN.md (`tokens.css`).
9. Tanggal belajar dihitung di Asia/Jakarta lewat `@kira/core/time`.
10. Data contoh ditandai `__GTX_SEED__` dan tidak pernah masuk ke database produksi.
11. Teks yang dibaca pengguna: tanpa em dash, tanpa kosakata terlarang GTX, tanpa bingkai antitesis.
12. AI hanya dipanggil dari worker. Prompt tidak memuat nama, email, atau data identitas anak. Hasil AI menjadi draf yang harus disetujui tutor sebelum dipakai.

## Konten soal

- Satu skill punya soal di `content/items/<subject>/g<grade>/<skill>.json`. Skema di `packages/content/src/schema.ts`.
- Math memakai generator deterministik di `packages/content/src/math`; soal olimpiade ditulis tangan di `content/items/math/olympiad`.
- Setelah menambah atau mengubah soal, jalankan `pnpm content:check` sampai bersih.
- Soal resmi lomba tidak disalin ke repo. Paket resmi milik keluarga diimpor lewat konsol (T12) dan tersimpan sebagai soal privat org.
