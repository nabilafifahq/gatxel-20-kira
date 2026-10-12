# ADR 0002: Auth sendiri dan empat role database

Status: diterima, 12 Oktober 2026. Menggantikan Better Auth di dokumen arsitektur.

## Keputusan

- Sesi disimpan di tabel `auth.session`. Cookie `__Host-kira.session` berisi token acak 32 byte; database hanya menyimpan SHA-256 token. HttpOnly, Secure, SameSite=Lax, Path=/. Idle 1 jam, absolut 24 jam, ID diputar saat login dan saat hak berubah.
- Orang dewasa: email dan password (Argon2id m=19456, t=2, p=1, minimal 15 karakter, cek HaveIBeenPwned), passkey lewat SimpleWebAuthn. Gagal login memperlambat respons bertahap dan mengunci akun 15 menit setelah 100 kali gagal. Pesan untuk akun tidak ada dan password salah identik.
- Learner: tablet didaftarkan oleh orang dewasa (cookie `__Host-kira.device`, 90 hari). Learner memilih avatar lalu PIN 4 gambar dari 9. Lima PIN salah mengunci learner itu 15 menit.
- Role database: `kira_owner` (migrasi, pemilik skema), `kira_app` (aplikasi, kena RLS, tanpa akses skema `auth`), `kira_auth` (hanya skema `auth`), `kira_worker` (worker, kena RLS, memakai fungsi SECURITY DEFINER untuk mengambil job lintas org).
- Semua tabel tenant memakai `ENABLE` dan `FORCE ROW LEVEL SECURITY` dengan `app.org_id` yang diset per transaksi. Kebijakan tambahan membatasi learner ke datanya sendiri dan orang tua ke anak yang tertaut.

## Alasan

Better Auth butuh plugin PIN buatan sendiri dan satu koneksi database dengan hak luas. Dengan sesi sendiri, kode auth sekitar 600 baris, mudah diaudit, dan pemisahan role database bisa dijaga.
