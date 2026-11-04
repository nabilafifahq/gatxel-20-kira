# Uji beban Kira (k6)

Hanya untuk staging (project `kirastg`). Panduan lengkap: `docs/pasang-windows.md` bagian 16. Hasil: `docs/laporan-beban.md`.

| Berkas | Fungsi |
|---|---|
| `kira.js` | Skenario k6: signup, signin, pin, today, latihan, tes, paper, audio, qm, quiz, parent, mixed, spike. |
| `lib.js` | Cookie manual, pemanggil Server Action, parser. |
| `seed-load.mjs` | Membuat N keluarga uji dengan sesi dan perangkat yang tokennya diketahui (menolak jalan di luar staging). |
| `actions.mjs` | Menulis `out/actions.json` (nama Server Action ke ID) dari kontainer web yang sedang jalan. |
| `prep.mjs` | Klip suara palsu di folder data staging dan `out/clips.json`. |
| `run.mjs` | Menjalankan satu tahap dan menulis `out/<nama>/result.md` (p50, p95, p99, galat per endpoint, CPU, RAM, sambungan). |

Contoh: `node deploy/load/run.mjs --scenario mixed --stage 300`. `out/` tidak masuk git.

Satu VU adalah satu anak yang aktif (atau satu orang tua) dengan waktu berpikir 4 sampai 12 detik per soal. Skenario `signup` butuh kode pendaftaran publik (cabang akun) di image yang diuji.
