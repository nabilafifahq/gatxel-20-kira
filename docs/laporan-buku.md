# Laporan pemeriksaan buku Ruang Baca

Dikerjakan 4 sampai 5 November 2026 di cabang `pilot/baca2`. Kelas 3 sampai 6 ditulis ulang lebih panjang (12 buku). Kelas 1 dan 2 hanya diperiksa (6 buku).

## Hasil

| Kelas | Kata per bab | Soal | Kata per kalimat | Flesch-Kincaid (perkiraan) |
|---|---|---|---|---|
| 1 | 43 sampai 58 | 58 | 5,0 | 0,4 |
| 2 | 80 sampai 118 | 63 | 6,6 | 1,4 |
| 3 | 200 sampai 220 | 106 | 8,9 | 2,8 |
| 4 | 240 sampai 287 | 114 | 10,1 | 3,2 |
| 5 | 303 sampai 337 | 137 | 10,7 | 3,7 |
| 6 | 350 sampai 406 | 144 | 11,2 | 4,3 |

Repo tidak punya cek tingkat kelas selain `BOOK_RULES`, jadi angka Flesch-Kincaid berasal dari skrip sementara dan hanya perkiraan. Buku nonfiksi selalu lebih tinggi dari cerita di kelas yang sama (paling tinggi 6,4 di kelas 6).

## Hitungan pemeriksaan

- Soal diperiksa: 622 dari 18 buku. Setiap soal dijawab dari berkas tanpa kunci, lalu dibandingkan dengan skrip.
- Jawaban yang berbeda dari kunci: 0.
- Kunci diubah: 1 (`g1-seeds-grow` c3 q2, mengikuti perbaikan fakta padi).
- Soal lama berkunci bermasalah yang diganti saat penulisan ulang: 2 (`g5-spice-islands` c1 q3 menguji mitos, `g6-chidi-thirteenth-hour` c2 q6 menanyakan hal yang tidak ada di teks).
- Fakta diperbaiki: 11.
- Soal hampir kembar diganti: 3 (`g1-amina-little-hen` c1 q4, `g2-rina-night-market` c2 q7, `g5-spice-islands` c5 q3).
- Pilihan jawaban diperbaiki: 21 soal, sebagian besar kelas 1 dan 2 yang kuncinya jauh lebih panjang dari pengecoh.
- Kutipan di penjelasan yang dicocokkan otomatis ke teks: 140, semuanya cocok.

## Batas pemeriksaan ini

Pemeriksaan dilakukan oleh agen yang juga menulis buku kelas 3 sampai 6, karena batas agen paralel sedang penuh dan pemeriksa terpisah tidak bisa dijalankan. Untuk kelas 3 sampai 6, angka 0 di atas lemah sebagai bukti, sebab penulis sudah tahu kuncinya. Hanya kelas 1 dan 2 yang benar-benar dibaca tanpa tahu kunci. Sebaiknya ada pemeriksa kedua untuk kelas 3 sampai 6.

## Fakta yang diperbaiki

1. `g1-seeds-grow` c3: padi tidak membuka dua daun kecil sekaligus seperti kacang. Teks kini satu daun lalu satu lagi.
2. `g4-busy-heart` c1: jantung punya jeda sangat singkat di antara detak, jadi "never rests" diganti.
3. `g4-busy-heart` c2: bunyi lub-dub berasal dari katup yang menutup, sedangkan detak yang terasa di dada bukan bunyi katup.
4. `g5-spice-islands` sampul: "worth more than gold" tidak terverifikasi dan dihapus.
5. `g5-spice-islands` c1: rempah untuk menutupi rasa daging busuk adalah mitos yang diragukan sejarawan (Paul Freedman).
6. `g5-spice-islands` c2: Kepulauan Banda ada di Maluku, tepatnya jauh di selatan Ternate dan Tidore.
7. `g5-spice-islands` c2: Ternate dan Tidore adalah puncak gunung api yang masih aktif, jadi kata "old" dihapus.
8. `g5-spice-islands` c3: angin monsun berganti arah dalam setahun, tidak setiap tahun.
9. `g5-spice-islands` c4: yang belum pernah sampai sejauh itu adalah kapal Eropa.
10. `g5-kirana-mangrove-map` c3: pasang surut dua kali sehari tidak berlaku umum di pantai utara Jawa, jadi dihapus. Urutan jam air surut dan pasang juga dibetulkan.
11. `g6-power-to-your-home` c4: tegangan rumah ditulis "sekitar" 230 volt, sebab sumber memberi 220 sampai 240 volt.

Klaim dalam draf yang diganti sebelum selesai karena tidak bisa dipastikan: lama bertahan Courthope di Run, bukit dan sawah di Sidrap, dan muatan cengkih Victoria yang disebut menutup seluruh biaya pelayaran.

## Logika cerita yang dibetulkan

- `g3-laras-silent-gong`: dudukan gong kosong di ruang musik sekaligus ada di bengkel. Kini dudukan ikut hilang.
- `g4-rafi-long-boat`: Rafi tidak bisa tidur di pagi hari, dan pulang dari halaman rumahnya sendiri.
- `g4-ama-library-whisper`: anak berbohong kepada orang tua. Kini menginap sungguhan dengan pengawasan Mrs Boateng.
- `g5-hiro-moku-haiku`: Hiro di kelas pada malam hari. Kini sore sepulang sekolah.
- `g5-kirana-mangrove-map`: dua ratus langkah memakan tiga jam tanpa alasan. Lumpur kini memperlambat mereka, dan nama Bali Wayan kini dijelaskan.
- `g6-salsabila-sparkling-sea`: sekolah dibuka saat libur. Kini Bu Dewi tinggal di sebelah sekolah.

## Catatan untuk penggabungan

Teks berubah, jadi klip suara buku perlu dibuat: 1.218 klip baru dari total 2.101 klip unik. Id buku, bab, dan soal tetap, jadi kemajuan membaca yang tersimpan tetap sah.
