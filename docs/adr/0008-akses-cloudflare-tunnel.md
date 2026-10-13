# ADR 0008: Akses lewat Cloudflare Tunnel di kira.gatxel.com, bukan Tailscale

Status: diterima, 13 Oktober 2026. Menggantikan bagian akses di ADR 0001 (Tailscale) dan satu konsekuensi di ADR 0006 (tablet harus terpasang Tailscale).

## Konteks

- Server Kira sudah berjalan di PC rumah dan dibuka di https://kira.gatxel.com lewat Cloudflare Tunnel, memakai tunnel `gatxel-PC` yang sudah ada di PC itu. Tidak ada Tailscale di jalur itu.
- Tailscale menuntut setiap perangkat (tablet Syakira, HP Mama, laptop tutor) terpasang aplikasi dan masuk ke tailnet yang sama. Untuk keluarga yang tidak teknis, itu sumber utama layar "Kira tidak bisa dihubungi".
- Cloudflare Tunnel hanya membuat sambungan keluar dari PC, jadi router rumah tidak perlu membuka port masuk.

## Keputusan

- Cloudflare Tunnel meneruskan `kira.gatxel.com` ke `http://127.0.0.1:3030` (port yang diterbitkan layanan `web` di PC ini lewat `docker-compose.override.yml`; bawaan compose di repo adalah 3000). Port itu hanya terbuka ke `127.0.0.1`. Database dan worker tetap tanpa port di host.
- `KIRA_ORIGIN=https://kira.gatxel.com`. Passkey, tautan email, dan pemeriksaan origin Server Action memakai alamat itu. Cloudflare meneruskan header Host asli, jadi `sameOrigin` tidak berubah.
- Cloudflare tidak boleh menyimpan atau mengubah isi Kira. Semua respons halaman memakai `Cache-Control: no-store, no-transform, max-age=0`. Aset statis di `/_next/static`, `/icons`, `/fonts`, dan `/sounds` boleh disimpan karena tidak berisi data anak. Fitur Cloudflare yang menyisipkan skrip (Web Analytics otomatis, Rocket Loader) dimatikan, karena CSP melarang skrip luar.
- Jawaban 502 sampai 504 dan 520 sampai 530 dari Cloudflare berarti server rumah tidak terjangkau (misalnya 521 saat server mati, 530 saat tunnel putus). Service worker menampilkan halaman tersimpan atau halaman offline, dan aplikasi Android menampilkan layar "Kira tidak bisa dihubungi" dengan kodenya.
- Kebijakan Privasi (versi 2026-10-13) mencatat Cloudflare sebagai penerima menggantikan Tailscale, dan menyebut bahwa lalu lintas lewat pusat data Cloudflare, sebagian di luar Indonesia.

## Konsekuensi

- Kira sekarang bisa dijangkau dari internet publik. Perlindungan datang dari aplikasi: login dengan password dan passkey, perangkat terdaftar untuk tablet, PIN gambar dengan batas percobaan, CSP ber-nonce, HSTS, dan token bearer untuk server MCP. `KIRA_SETUP_TOKEN` hanya berlaku saat database masih kosong, jadi simpan sebagai rahasia sampai akun pertama dibuat.
- Cloudflare mengakhiri TLS, jadi isi lalu lintas terlihat di sana saat diteruskan. Itu sebabnya Kebijakan Privasi menyebutnya, dan sebabnya Kira meminta Cloudflare tidak menyimpan apa pun. Akun Cloudflare pemilik domain wajib memakai autentikasi dua langkah, karena siapa pun yang menguasainya bisa mengalihkan alamat.
- Kira bergantung pada Cloudflare dan pada layanan cloudflared di PC. Kalau salah satunya mati, Kira tidak terjangkau; tablet tetap bisa menyelesaikan quest yang sudah diunduh dan sinkron saat tersambung lagi.
- Server MCP (`/api/mcp`) kini bisa dijangkau dari luar, tetapi tetap hanya menerima token bearer milik tutor aktif. Aplikasi Claude di web dan HP tidak dipakai untuk ini; pakai Claude Code atau klien MCP lain yang bisa mengirim header Authorization.
- Tablet tidak perlu aplikasi tambahan selain APK Kira (atau browser). Layar native Alamat server Kira di APK diisi dengan `https://kira.gatxel.com`.
- Tailscale tidak dipakai lagi dan boleh dilepas dari semua perangkat.
