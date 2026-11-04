# Pemindaian keamanan Kira

Semua pemindaian aktif hanya boleh diarahkan ke instance lokal dengan database sekali pakai. Jangan pernah ke `kira.gatxel.com` atau container produksi.

Isi folder ini:

| Berkas | Isi |
|---|---|
| `sqlmap.sh`, `sqlmap-hasil.txt` | Skrip dan ringkasan hasil sqlmap (Server Action masuk dan reset, `/api/sync`, `/api/tts/request`, `/api/media/{id}`, `/tts/{file}`, `/konsol/learner/{id}`, `/masuk?next=`, `/api/internal/*`) |
| `openapi-kira.json` | Daftar rute `/api` untuk ZAP API scan |
| `zap-baseline-*.html/json/md` | ZAP baseline (pasif) tanpa sesi, dengan sesi tutor, dan dengan sesi anak |
| `zap-api-*.html/json/md` | ZAP API scan berdasarkan `openapi-kira.json` |
| `sqlmap2.py`, `sqlmap-hasil2.txt`, `zap2-*.md` | Uji tembus internal 5 November 2026 pada stack lokal `kirasec` lewat proxy (lihat `docs/laporan-keamanan.md`) |
| `strix.md` | Perintah Strix (belum dijalankan, menunggu kunci LLM) |

## Menyiapkan instance lokal

Postgres 17 di port 54436, aplikasi di port 3136 (build produksi):

```bash
docker run -d --name pg-aman -p 127.0.0.1:54436:5432 -e POSTGRES_PASSWORD=aman-su \
  -e KIRA_OWNER_PASSWORD=aman-owner -e KIRA_APP_PASSWORD=aman-app -e KIRA_AUTH_PASSWORD=aman-auth \
  -e KIRA_WORKER_PASSWORD=aman-worker -v "$PWD/deploy/db/init:/docker-entrypoint-initdb.d:ro" postgres:17
# variabel DATABASE_URL_* dan KIRA_* seperti di strix.md, lalu:
pnpm db:migrate && KIRA_ALLOW_SEED=1 NODE_ENV=development pnpm db:seed
pnpm --filter @kira/web build && (cd apps/web && pnpm exec next start -p 3136)
```

## Token sesi untuk pemindai

Pemindai tidak bisa memakai layar masuk (Server Action dan PIN gambar), jadi buat sesi langsung di database lokal. Token acak disimpan di cookie, database hanya menyimpan hash SHA-256-nya:

```sql
-- token = string acak 43 karakter yang kamu buat sendiri; ganti <TOKEN>
insert into auth.session (id, user_id, org_id, kind, expires_at, user_agent)
select encode(sha256(convert_to('<TOKEN>','UTF8')),'hex'), id, org_id, 'adult', now()+interval '6 hours', 'scan'
from auth.user_account where email = 'tutor@contoh.test';
```

Cookie yang dikirim: `Cookie: __Host-kira.session=<TOKEN>`. Sesi anak juga butuh baris `auth.device` yang memuat id anak (lihat `e2e/tests/security-helpers.ts`, fungsi `learnerSession`). Hapus sesi pemindai setelah selesai: `delete from auth.session where user_agent = 'scan'`.

## ZAP

Dari host (Docker Desktop tidak selalu meneruskan `host.docker.internal`; pakai alamat LAN komputer, mis. `10.77.0.1`):

```bash
# baseline pasif tanpa sesi
docker run --rm -v "$PWD/docs/keamanan:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t http://10.77.0.1:3136 -m 3 -I -r zap-baseline-publik.html -J zap-baseline-publik.json -w zap-baseline-publik.md

# baseline dengan sesi (header Cookie ditambahkan ke semua permintaan)
docker run --rm -v "$PWD/docs/keamanan:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t http://10.77.0.1:3136/konsol -m 3 -I -r zap-baseline-tutor.html -J zap-baseline-tutor.json -w zap-baseline-tutor.md \
  -z "-config replacer.full_list(0).description=sesi -config replacer.full_list(0).enabled=true -config replacer.full_list(0).matchtype=REQ_HEADER -config replacer.full_list(0).matchstr=Cookie -config replacer.full_list(0).regex=false -config replacer.full_list(0).replacement=__Host-kira.session=<TOKEN>"

# API scan dengan OpenAPI
docker run --rm -v "$PWD/docs/keamanan:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable \
  zap-api-scan.py -t openapi-kira.json -f openapi -I -r zap-api-anak.html -J zap-api-anak.json -w zap-api-anak.md -z "<opsi replacer yang sama dengan token anak>"
```

Scan aktif (`zap-api-scan.py` tanpa `-S`) mengirim payload serangan ke rute tulis: hanya untuk database lokal sekali pakai.

## sqlmap

```bash
docker run --rm -v "$PWD/docs/keamanan:/out" -v "$PWD/docs/keamanan/sqlmap.sh:/run.sh:ro" \
  -e TARGET=http://10.77.0.1:3136 -e TUTOR_TOKEN=<TOKEN-TUTOR> -e LEARNER_TOKEN=<TOKEN-ANAK> python:3.12-slim sh /run.sh
```

## Membersihkan

```bash
docker rm -f pg-aman sqlmap-aman 2>/dev/null
# hentikan proses next start di port 3136
```
