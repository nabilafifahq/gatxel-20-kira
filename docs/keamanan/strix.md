# Strix terhadap instance lokal Kira

Strix adalah agen uji penetrasi berbasis LLM (open source, https://github.com/usestrix/strix). Ia butuh kunci API LLM yang belum diberikan pemilik, jadi **belum dijalankan**. Dokumen ini berisi perintah persisnya.

Aturan yang tidak boleh dilanggar:

1. Target hanya instance lokal di komputer pemilik (`http://host.docker.internal:3136` atau `http://127.0.0.1:3136`) dengan database Postgres sekali pakai. **Jangan** pernah mengarahkan Strix ke `kira.gatxel.com`, ke container produksi `kira-*-1`, atau ke alamat lain.
2. Isi tes berasal dari data contoh (`seed.ts`), bukan data keluarga sungguhan.
3. Kunci LLM disimpan di variabel lingkungan sesi terminal, bukan di berkas dan bukan di git.
4. Strix mengirim isi respons aplikasi ke penyedia LLM. Karena datanya hanya data contoh, tidak ada data anak yang keluar.

## 1. Siapkan instance lokal

Dari folder repo (cabang `pilot/aman` atau main yang sudah digabung), Git Bash:

```bash
# Postgres sekali pakai di port 54436 (hapus setelah selesai)
docker run -d --name pg-strix -p 127.0.0.1:54436:5432 \
  -e POSTGRES_PASSWORD=strix-su -e KIRA_OWNER_PASSWORD=strix-owner -e KIRA_APP_PASSWORD=strix-app \
  -e KIRA_AUTH_PASSWORD=strix-auth -e KIRA_WORKER_PASSWORD=strix-worker \
  -v "$PWD/deploy/db/init:/docker-entrypoint-initdb.d:ro" postgres:17

export DATABASE_URL_OWNER=postgres://kira_owner:strix-owner@127.0.0.1:54436/kira
export DATABASE_URL_APP=postgres://kira_app:strix-app@127.0.0.1:54436/kira
export DATABASE_URL_AUTH=postgres://kira_auth:strix-auth@127.0.0.1:54436/kira
export DATABASE_URL_WORKER=postgres://kira_worker:strix-worker@127.0.0.1:54436/kira
pnpm db:migrate
KIRA_ALLOW_SEED=1 NODE_ENV=development pnpm db:seed

export KIRA_ORIGIN=http://localhost:3136 KIRA_SECRET=$(openssl rand -hex 24) KIRA_SETUP_TOKEN=strix-setup-token-1 \
  KIRA_INTERNAL_TOKEN=$(openssl rand -hex 24) KIRA_DATA_DIR="$PWD/.kira-local/strix-data" \
  KIRA_CONTENT_DIR="$PWD/content" AI_PROVIDER=none KIRA_HIBP=off PORT=3136
mkdir -p "$KIRA_DATA_DIR"
pnpm --filter @kira/web build
cd apps/web && pnpm exec next start -p 3136      # terminal terpisah
```

Akun contoh (dari seed): tutor `tutor@contoh.test` / `kira-tutor-contoh-2026`, orang tua `mama@contoh.test` / `kira-mama-contoh-2026`. Anak (Aisha, Raka) masuk dari tablet dengan PIN gambar; untuk Strix lebih mudah memberi cookie sesi anak lewat `docs/keamanan/README.md` (bagian token sesi).

## 2. Pasang Strix

Strix butuh Docker dan Python 3.12 atau lebih baru.

```bash
pipx install strix-agent
strix --help        # periksa nama opsi pada versi yang terpasang; tulis ulang bila berbeda
```

## 3. Jalankan (setelah pemilik memberi kunci)

```bash
export STRIX_LLM="anthropic/claude-sonnet-4-5"     # atau model lain yang kunci pemilik izinkan
export LLM_API_KEY="<kunci dari pemilik, jangan commit>"

strix --target http://host.docker.internal:3136 \
  --instruction "Ini instance LOKAL aplikasi belajar anak (Next.js 16, Postgres dengan RLS). Cakupan: hanya host ini. \
Uji: IDOR antar keluarga dan antar anak (attempt, hasil, media, laporan, persetujuan, undangan), eskalasi peran \
(anak ke orang tua ke tutor), CSRF pada Route Handler dan Server Action, XSS tersimpan lewat nama anak dan catatan, \
redirect terbuka (parameter next), traversal path (/api/media/[id], /tts/[file]), unggahan berbahaya (SVG, polyglot), \
kebocoran kunci jawaban pada tes berwaktu, brute force login, fiksasi sesi, SSRF, dan kebocoran rahasia di bundel klien. \
Akun: tutor tutor@contoh.test / kira-tutor-contoh-2026; orang tua mama@contoh.test / kira-mama-contoh-2026. \
Dilarang: DoS volumetrik, menghapus data massal, menyentuh host lain. Laporkan setiap temuan dengan bukti permintaan dan respons."
```

Hasil Strix disimpan di folder `strix_runs/` pada direktori kerja. Salin laporan akhirnya ke `docs/keamanan/strix-laporan-<tanggal>.md` setelah memeriksa bahwa isinya tidak memuat kunci atau data nyata.

## 4. Bersihkan

```bash
docker rm -f pg-strix
rm -rf .kira-local/strix-data strix_runs
unset LLM_API_KEY STRIX_LLM
```

Tutup proses `next start` di port 3136. Temuan tingkat tinggi atau kritis dilaporkan ke integrator segera, lalu diperbaiki di cabang terpisah dengan tes e2e di `e2e/tests/security-*.spec.ts`.
