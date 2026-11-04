# Uji beban Kira (k6)

Hanya untuk staging (project `kirastg`). Panduan lengkap: `docs/pasang-windows.md` bagian 16. Hasil: `docs/laporan-beban.md`.

| Berkas | Fungsi |
|---|---|
| `kira.js` | Skenario k6: signup, signin, pin, today, latihan, tes, paper, audio, qm, quiz, parent, parentswitch, hub, cards, reading, dict, world, boss, placement, feedback, mixed, spike. Tahap tambahan: `stress` (anak tangga, berhenti sendiri bila galat lewat 1 persen) dan `burst` (ledakan pendaftaran). |
| `lib.js` | Cookie manual, pemanggil Server Action, parser. |
| `seed-load.mjs` | Membuat N keluarga uji dengan sesi dan perangkat yang tokennya diketahui (menolak jalan di luar staging). |
| `actions.mjs` | Menulis `out/actions.json` (nama Server Action ke ID) dari kontainer web yang sedang jalan. |
| `prep.mjs` | `--real <sumber> <data>`: klip sungguhan di folder data staging (sumber hanya dibaca) dan `out/clips.json`. Tanpa `--real`: klip palsu. Juga menulis `out/assets.json` (alamat kamus). |
| `run.mjs` | Menjalankan satu tahap dan menulis `out/<nama>/result.md` (p50, p95, p99, galat per endpoint, CPU kontainer dan PC, RAM, sambungan, rasio hit Valkey, Mbps keluar proxy, GPU dari `nvidia-smi`, permintaan ke penjaga TTS). |

Contoh: `node deploy/load/run.mjs --scenario mixed --stage 300`. `out/` tidak masuk git.

Satu VU adalah satu anak yang aktif (atau satu orang tua) dengan waktu berpikir 4 sampai 12 detik per soal. Skenario `signup` memakai alamat di domain yang punya MX, karena web memeriksa MX; staging mengirim semua surat ke Mailpit.

Penjaga TTS: di staging `TTS_URL` menunjuk kontainer kecil `kirastg-tts-sink` yang mencatat setiap permintaan dan menjawab 503, supaya panggilan suara langsung terlihat. Layanan `tts` sungguhan tidak dinyalakan.
