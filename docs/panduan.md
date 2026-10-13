# Panduan memakai Kira

Kira punya tiga area: layar anak di tablet (bahasa Inggris), konsol tutor (laptop dan HP), dan halaman orang tua (HP). Semua dibuka dari alamat yang sama, https://kira.gatxel.com.

## Untuk anak (tablet)

1. **Masuk.** Pilih avatar sendiri, lalu ketuk 4 gambar PIN. Lima kali salah membuat PIN istirahat 15 menit; tutor bisa membukanya lebih cepat.
2. **Today.** Setiap hari ada 9 sesi wajib: untuk tiap mapel (Math, English, Science) ada Practice (10 soal mudah tanpa waktu), Test (8 soal sedang sampai sulit, 75 detik per soal, terbuka setelah Practice mapel itu selesai), dan Paper (soal bergaya lomba dengan waktu; hari biasa paper mini 8 soal dalam 15 menit, hari Sabtu satu mapel bergiliran mengerjakan paper penuh). Sesi yang sebaiknya dikerjakan sekarang tampil paling besar. Sesi opsional dari tutor ada di bagian Extra today dan tidak memengaruhi streak. Bintang streak bertambah setiap hari semua sesi wajib selesai; hari istirahat tidak memutus streak.
3. **Mengerjakan.** Satu soal per layar, tombol Check, lalu umpan balik. Jawaban yang salah ditulis Not yet dan boleh dicoba sekali lagi. Setiap soal punya 3 hint dan tombol Read aloud. Pelajaran singkat ditawarkan di pembuka Practice untuk skill baru.
4. **Test, Paper, dan simulasi lomba.** Hitung mundur berjalan sejak soal pertama dibuka, tanpa hint dan tanpa umpan balik sampai dikumpulkan. Saat waktu habis, jawaban dikumpulkan otomatis. Paper di tablet dinilai seperti lombanya (poin per soal dari preset). Setelah sesi Practice, Test, atau Paper selesai, tombol Try again mengulang seluruh sesi: Practice dan Test memakai soal baru dari skill yang sama, Paper memakai soal yang sama dengan urutan diacak. Percobaan pertama yang resmi untuk laporan dan streak, ulangan memberi seperempat XP, dan skor terbaik ikut ditampilkan.
5. **Review.** Buku koreksi berisi soal yang pernah salah, muncul lagi sesuai jadwal pengulangan.
6. **Map dan Me.** Peta skill per mapel dengan bintang, lencana, level, dan kalender streak. Tombol Switch learner di Me mengakhiri sesi supaya saudara bisa masuk.
7. **Internet putus.** Sesi Practice hari ini sudah tersimpan di tablet; Test dan Paper berwaktu butuh internet karena jam dimulai di server. Jawaban tersimpan di tablet dan terkirim saat online lagi.

Batas waktu layar diatur tutor (Pengaturan). Saat batas tercapai, Kira menutup sesi dengan ringkasan hari itu.

## Untuk tutor (konsol)

| Halaman | Kegunaan |
|---|---|
| Hari ini | Daftar Perlu perhatian (skill di bawah 70%, jawaban menunggu nilai, pendaftaran lomba yang segera tutup, persetujuan yang belum ada, laporan soal, draf AI), status sesi hari ini per mapel, tren akurasi 4 minggu, lomba berikutnya. |
| Rencana | Rencana mingguan per learner. Setiap hari punya template: Hari sekolah (9 sesi wajib), Sabtu paper penuh, atau Hari ringan (hanya satu Practice per mapel, streak tetap terjaga untuk hari sakit). Slot menggantikan sesi wajib dasar atau menambah sesi opsional (paling banyak 10 per hari: Latihan, Tes, Paper, Pelajaran, simulasi lomba, paket ESMO, Ulang kartu, Hitung Cepat, Kuis Pengetahuan, Tugas English, atau Membaca). Ada meteran waktu layar per hari, tombol Salin minggu lalu, hari istirahat, usulan otomatis, lalu Terbitkan. Sesi yang tidak diatur dipilih Kira sendiri. |
| Hasil | Menilai jawaban tulisan, rekaman suara, gambar, dan foto dengan rubrik. Saran nilai AI bisa diminta bila orang tua menyetujui draf AI. |
| Input LJK | Memasukkan jawaban paper yang dikerjakan di kertas, lalu skor dihitung otomatis. |
| Bank soal | Semua soal Kira, soal impor, draf AI yang disetujui, dan generator Math, dengan filter, statistik, dan laporan soal dari anak. |
| Penyusun paper | Susun paper dari bank soal atau otomatis per skill, cetak paper, kunci, dan LJK A4, lalu berikan sebagai Latihan, Tes berwaktu, atau Kertas. |
| Lomba | Kalender lomba nasional dan internasional (KMNR, ESMO, IKMC, SASMO, SEAMO, dan lainnya), status pendaftaran, dan preset simulasi. |
| Laporan | Ringkasan minggu per learner, kirim laporan ke orang tua, ekspor JSON, dan kotak keluar email. |
| Studio AI | Minta draf soal baru, variasi, hint, terjemahan, atau rubrik. Draf hanya dipakai setelah disetujui. |
| Impor | Unggah PDF paket resmi milik keluarga (misalnya latihan ESMO), periksa soal dan kunci yang terbaca, lalu setujui. |
| Learner | Tambah learner, ubah grade, reset dan buka kunci PIN, undang orang tua, catat persetujuan tertulis. |
| Pengaturan | Passkey, password, perangkat terdaftar, batas waktu layar dan hari istirahat, anggota keluarga, status email, cadangan, dan APK tablet. |
| Koneksi Claude | Status AI, tes koneksi, dan token MCP untuk Claude Code. |

Kebiasaan mingguan yang disarankan: Minggu sore buka Rencana dan terbitkan minggu depan, setiap hari cek Hari ini, dan nilai jawaban di Hasil dalam 1 sampai 2 hari supaya umpan balik masih segar untuk anak.

### Menghubungkan Claude Code ke Kira (MCP)

Di Koneksi Claude, buat token, lalu di komputer tutor:

```sh
claude mcp add --transport http kira https://kira.gatxel.com/api/mcp --header "Authorization: Bearer <token>"
```

Claude Code lalu bisa melihat daftar learner (tanpa nama, hanya label seperti Learner 1), kemajuan skill, mencari soal, dan membuat draf soal yang masuk ke Studio AI untuk ditinjau. Token bisa dicabut kapan saja.

## Untuk orang tua

- **Ringkasan.** Waktu belajar per hari, quest selesai, skill yang naik dan yang perlu diulang, catatan tutor, dan lomba berikutnya. Geser ke minggu sebelumnya dengan tombol minggu.
- **Privasi.** Setujui atau tarik persetujuan per tujuan: belajar (wajib untuk memakai Kira), laporan lewat email, rekaman suara, foto jawaban, dan draf AI. Setiap perubahan tercatat dengan versi Kebijakan Privasi.
- **Unduh data.** Salinan semua data anak dalam JSON.
- **Hapus akun anak.** Akun dijeda langsung dan dihapus permanen 7 hari kemudian. Selama 7 hari itu permintaan bisa dibatalkan.

Kebijakan Privasi dan Ketentuan ada di `/privasi` dan `/ketentuan`.
