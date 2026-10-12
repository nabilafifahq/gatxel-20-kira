# Pengembangan Kira

Untuk mengubah kode di laptop. Untuk memasang di server rumah, lihat `docs/pasang-windows.md`.

## Prasyarat

- Node.js 24 (atau 22.12 ke atas) dan pnpm 10.28 (`corepack enable`).
- PostgreSQL 17 di PATH (`initdb`, `pg_ctl`, `psql`) untuk database lokal tanpa Docker.
- Chromium untuk tes e2e: `pnpm exec playwright install chromium`.

## Pertama kali

```sh
pnpm install
scripts/dev-db.sh start            # Postgres lokal di port 54329, data di .kira-local/pg
eval "$(scripts/dev-db.sh env | sed 's/^/export /')"
pnpm db:migrate
KIRA_ALLOW_SEED=1 pnpm db:seed     # org __GTX_SEED__, akun contoh di packages/db/scripts/seed.ts
```

Buat `apps/web/.env.local`:

```ini
KIRA_ORIGIN=http://localhost:3000
KIRA_RP_NAME=Kira
DATABASE_URL_APP=postgres://kira_app:devpass@localhost:54329/kira
DATABASE_URL_AUTH=postgres://kira_auth:devpass@localhost:54329/kira
KIRA_SECRET=dev-secret-minimal-32-karakter-xxxxxxxx
KIRA_SETUP_TOKEN=dev-setup-token
KIRA_DATA_DIR=.kira-local/data
KIRA_HIBP=off
```

Lalu `pnpm dev` dan buka http://localhost:3000.

Akun contoh: `tutor@contoh.test` / `kira-tutor-contoh-2026`, `mama@contoh.test` / `kira-mama-contoh-2026`. Learner Aisha (PIN sun moon star cat) dan Raka (PIN tree apple boat ball). Daftarkan browser sebagai tablet di `/perangkat`.

Pratinjau semua layar dengan data contoh ada di `/dev/ui`, `/dev/screens`, `/dev/konsol`, `/dev/figur`, dan `/dev/ikon`. Halaman ini memakai berkas `page.dev.tsx`, jadi tidak ikut build produksi.

## Worker

```sh
export DATABASE_URL_WORKER=postgres://kira_worker:devpass@localhost:54329/kira
export KIRA_DATA_DIR=$PWD/apps/web/.kira-local/data KIRA_INTERNAL_URL=http://localhost:3000
export KIRA_INTERNAL_TOKEN=dev-internal-token-minimal-32-karakter AI_PROVIDER=none
pnpm worker:dev
```

Isi `KIRA_INTERNAL_TOKEN` yang sama di `apps/web/.env.local` bila ingin menguji laporan mingguan otomatis.

## Pemeriksaan sebelum push

```sh
pnpm lint            # ESLint dan pemeriksa teks GTX (tanpa em dash, kosakata terlarang, hex di luar token)
pnpm typecheck
pnpm test            # unit: core, content, figures, web, worker
pnpm test:db         # RLS dan role di Postgres sungguhan
pnpm content:check   # semua soal, pelajaran, generator
pnpm e2e             # Playwright dan axe terhadap server di :3000, butuh DATABASE_URL_OWNER
```

Tes offline butuh build produksi. Jalankan server standalone yang sama dengan image Docker, karena `next start` menyembunyikan satu jenis bug: di standalone, `req.url` berisi `http://0.0.0.0:3000`, bukan alamat browser. Route Handler memakai `sameOrigin()` dan `seeOther()` dari `src/server/http.ts`, tidak pernah `req.url`.

```sh
cd apps/web && KIRA_ORIGIN=http://localhost:3100 pnpm build
cp -r .next/static .next/standalone/apps/web/.next/static && cp -r public .next/standalone/apps/web/public
cd .next/standalone/apps/web && KIRA_ORIGIN=http://localhost:3100 PORT=3100 HOSTNAME=0.0.0.0 AI_PROVIDER=none node server.js
# terminal lain, dari root repo:
E2E_PROD=1 E2E_BASE_URL=http://localhost:3100 pnpm e2e
```

Server standalone tidak membaca `apps/web/.env.local`; ekspor variabelnya dulu (`set -a; . apps/web/.env.local; set +a`). Tes e2e membuat ulang data contoh setiap kali jalan.

CI GitHub Actions menjalankan semua di atas, ditambah build image Docker, menyalakan seluruh stack Compose (database TLS, migrasi, web, worker, backup), dan tes e2e terhadap stack itu.

## Aturan

Baca `CLAUDE.md`. Ringkasnya: query database hanya di `apps/web/src/server/dal`; setiap Server Action memeriksa sesi dan peran sendiri lalu memvalidasi input dengan Zod `.strict()`; teks pengguna tanpa em dash; warna dan font hanya dari token `DESIGN.md`; AI hanya dari worker.

Menambah migrasi: buat `packages/db/migrations/NNNN_nama.sql` (pernyataan dipisah `--> statement-breakpoint`), ubah `packages/db/src/schema.ts`, jalankan `pnpm db:migrate`. Jangan mengubah migrasi yang sudah dijalankan.
