# ADR 0001: Hosting di server rumah dengan Docker Desktop dan Tailscale

Status: diterima, 12 Oktober 2026. Menggantikan rencana Vercel, Supabase, dan Fly.io di dokumen arsitektur. Bagian akses lewat Tailscale digantikan oleh [ADR 0008](0008-akses-cloudflare-tunnel.md) (Cloudflare Tunnel di kira.gatxel.com).

## Konteks

Nabila punya PC Windows 11 Pro (Ryzen 5, 64 GB RAM, RTX 5070 Ti, SSD 2 TB) yang menyala terus. Pengguna Kira hanya keluarga: satu tutor, beberapa orang tua, dan learner. Data anak sebaiknya tetap di rumah dan di Indonesia.

## Keputusan

- Tiga container di Docker Desktop (backend WSL2): `db` (PostgreSQL 17), `web` (Next.js standalone), `worker` (job AI, PDF, email, backup). Satu container `certs` sekali jalan membuat CA lokal dan sertifikat TLS untuk Postgres.
- Akses hanya lewat tailnet Tailscale. `tailscale serve` di Windows memberi HTTPS dengan sertifikat `*.ts.net` yang sah, sehingga passkey, mikrofon, kamera, dan service worker berfungsi. Port 3000 hanya terbuka ke 127.0.0.1.
- Berkas (audio, foto, PDF, backup) di folder Windows yang dipetakan ke `/data`.
- Backup harian `pg_dump` oleh worker, disimpan 14 harian dan 8 mingguan. Salinan ke disk lain atau cloud diatur pemilik.

## Konsekuensi

- Biaya bulanan nol selain listrik. Tidak ada Vercel firewall, jadi pembaruan keamanan Next.js harus dipasang manual (lihat panduan pasang).
- Server mati berarti Kira mati. Tablet tetap bisa menyelesaikan quest yang sudah diunduh (mode offline) lalu sinkron saat server hidup.
- Tailscale Funnel tidak dipakai. Konektor claude.ai tidak bisa menjangkau server; server MCP dipakai dari Claude Code atau Claude Desktop di perangkat yang ada di tailnet.
