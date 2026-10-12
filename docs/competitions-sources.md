# Sumber katalog lomba

| Field | Isi |
|---|---|
| Dokumen | Sumber katalog lomba Kira |
| Berkas data | `content/competitions/catalog.json` |
| Versi | 1.0, 12 Oktober 2026 |
| Pemilik | Nabila |
| Standar | GTX-ENG-001 v1.7 |

Lomba diberi status terverifikasi kalau format yang tertulis di katalog cocok dengan sumber resmi 2025 atau 2026 yang benar-benar dibuka, atau dengan paket resmi ESMO milik keluarga. Field `sources` di katalog hanya berisi URL resmi yang dibuka. Berita, blog, dan jurnal tercatat di tabel ini sebagai pendukung.

Preset simulator punya status sendiri, karena skor kesiapan hanya memakai preset terverifikasi (ADR 0005).

Label di kolom sumber: **Resmi** berarti halaman penyelenggara yang dibuka. **Dibuka** berarti halaman lain yang dibuka. **Pencarian** berarti hanya terlihat di hasil pencarian, halamannya tidak dibuka.

## Lomba

| Lomba | Status verifikasi | Tanggal dicek | Sumber | Yang perlu dicek tutor di juknis |
|---|---|---|---|---|
| IKMC (`ikmc`) | Lomba belum. Preset `ikmc-pre-ecolier-2027` terverifikasi dari data tutor | 12 Oktober 2026 | Resmi: https://www.aksf.org/countries.xhtml (KPM penyelenggara Indonesia), https://www.aksf.org/documents/KSF-Internal-Regulations-English.pdf (5 pilihan jawaban). Dibuka: https://ejournal.uika-bogor.ac.id/index.php/jpg/article/download/22644/8037/106579 (jurnal Januari 2026: level per kelas, Kamis ketiga Maret). Gagal dibuka: https://kpm.read1institute.org | Jumlah soal dan durasi Pre Ecolier 2027, pengurangan untuk jawaban salah, poin awal, bahasa soal, tanggal lomba 2027 |
| IKLC (`iklc`) | Belum | 12 Oktober 2026 | Pencarian: https://journalarta.com/news/2026/10/06/siswi-smp-muhammadiyah-31-jakarta-raih-emas-iklc-dan-perak-icfo/ (berita 2026), https://iklc.kangaroo.org.pk/history/4 (penyelenggara Pakistan) | Penyelenggara di Indonesia, level per kelas, jumlah soal, durasi, poin, pengurangan, jumlah pilihan jawaban, jadwal |
| IKSC (`iksc`) | Belum, sumber resmi masih 2023 | 12 Oktober 2026 | Resmi: https://suryainstitute.org/result-of-the-international-kangarooscience-contest-iksc-2023-indonesia/ | Penyelenggara 2026 atau 2027, jumlah soal, durasi, poin, pengurangan, bahasa soal, tanggal lomba |
| SASMO (`sasmo`) | Lomba terverifikasi. Preset `sasmo-2027` belum karena durasi | 12 Oktober 2026 | Resmi: https://simcc.org/contest/sasmo/ | Durasi tes, jumlah pilihan jawaban di Bagian A, bahasa soal, mitra dan tanggal lomba di Indonesia. Kelas 1 tidak punya divisi |
| SEAMO (`seamo`) | Terverifikasi untuk format paper | 12 Oktober 2026 | Resmi: https://seamo-official.org/page/guidelines | Paper untuk kelas 1-2, pengurangan untuk jawaban salah, bahasa soal, jadwal dan mitra di Indonesia, beda SEAMO dan SEAMO X |
| HKIMO (`hkimo`) | Belum | 12 Oktober 2026 | Pencarian, pihak ketiga: https://www.competitivekids.org/blog/hkimo-heat-2026, https://www.pw.live/olympiad/exams/hkimo | Situs resmi, mitra Indonesia, babak, jenjang kelas, jumlah soal, durasi, poin, jadwal |
| TIMO (`timo`) | Belum | 12 Oktober 2026 | Pencarian: https://form.jotform.com/261442122882453 (formulir Heat Round 2025-2026), https://anglosingapore.ac.th/64/wp-content/uploads/2025/08/Thailand-International-Mathematical-Olympiad-TIMO.pdf (brosur sekolah) | Situs resmi, mitra Indonesia, babak, jenjang kelas, jumlah soal, durasi, poin, jadwal |
| IMSO (`imso`) | Belum | 12 Oktober 2026 | Dibuka, menyatakan diri tidak resmi: https://sites.google.com/view/imso-hq. Belum dibuka: https://imso-official.org | Komponen tes Matematika dan IPA, jumlah soal, durasi, batas kelas, cara seleksi tim Indonesia |
| Cambridge Primary Checkpoint (`cambridge-checkpoint`) | Belum, preset hanya latihan | 12 Oktober 2026 | Resmi, isi utama tidak terbaca: https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-primary/assessment/cambridge-primary-checkpoint/ | Jumlah paper per mapel, durasi, nilai, jadwal ujian di sekolah |
| ESMO (`esmo`) | Terverifikasi dari paket resmi milik keluarga | 12 Oktober 2026, paket dipetakan 11 Oktober 2026 | 60 PDF paket latihan resmi ESMO milik keluarga, tanpa URL. Pencarian web tidak menemukan situs ESMO | Nama lengkap, penyelenggara, situs, jadwal, level untuk kelas 3 sampai 6, ada atau tidaknya Science |
| OSN SD (`osn-sd`) | Belum | 12 Oktober 2026 | Dibuka, berita yang meringkas pedoman: https://tirto.id/link-unduh-pedoman-osn-sd-2026-tahapan-dan-syarat-hqx6. Gagal diunduh: https://drive.google.com/file/d/1R5gZK2DLZwdbBevNMZOJ8RcQA2R3iyt3/view (Pedoman OSN SD 2026) | Jumlah soal, durasi, bentuk soal, dan penilaian benar, salah, kosong untuk Matematika dan IPA |
| KMNR (`kmnr`) | Belum | 12 Oktober 2026 | Pencarian, berita: https://pwmu.co/399577/01/21/murid-sd-muhammadiyah-kota-blitar-ikuti-babak-penyisihan-kmnr-20, https://news.republika.co.id/berita/sclnis423/final-kmnr19-dan-ogm9-akan-diikuti-ribuan-peserta-dari-seluruh-indonesia. Gagal dibuka: https://kpm.read1institute.org | Level per kelas, jumlah soal, durasi, poin benar, pengurangan salah, jumlah pilihan jawaban, jadwal KMNR berikutnya |
| KSNR (`ksnr`) | Belum | 12 Oktober 2026 | Pencarian, berita: https://pwmu.co/316439/09/15/empat-siswa-sdmm-borong-medali-di-ksnr-v, https://pwmu.co/380725/09/29/antusiasme-peserta-didik-mimsagum-lolos-semifinal-ksnr-ke-16, https://pwmu.co/315964/09/12/wakili-berlian-school-siswa-ini-maju-final-ksnr-di-bogor | Penyelenggara, situs resmi, level per kelas, jumlah soal, durasi, penilaian, jadwal |

## Preset simulator

| Preset | Status | Dasar aturan |
|---|---|---|
| `ikmc-pre-ecolier-2027` | Terverifikasi | Data tutor: 24 soal, 75 menit, soal 1-8 bernilai 3, 9-16 bernilai 4, 17-24 bernilai 5, tanpa pengurangan. Lima pilihan jawaban dari Internal Regulations KSF 2021. Aturan pengurangan Indonesia belum dicek di juknis KPM |
| `esmo-math-2026` | Terverifikasi | Paket resmi milik keluarga: 40 soal, 50 menit, 1 poin per soal, skala 100, lulus 70, 4 pilihan |
| `esmo-english-2026` | Terverifikasi | Paket resmi milik keluarga: 40 soal, 40 menit, 1 poin per soal, skala 100, lulus 70, 4 pilihan |
| `esmo-practice-math-2026` | Terverifikasi | Paket resmi milik keluarga: 10 soal, 13 menit, skala 100 |
| `esmo-practice-english-2026` | Terverifikasi | Paket resmi milik keluarga: 10 soal, 10 menit, skala 100 |
| `sasmo-2027` | Belum | Skor dari simcc.org: soal 1-15 pilihan ganda +2 atau -1, soal 16-25 non-rutin +4, mulai 15 poin, maksimal 85. Durasi 90 menit belum dicek. Hanya kelas 2 karena SASMO mulai dari Grade 2 |
| `kmnr-2026` | Belum | Aturan sementara Kira: 30 soal, 60 menit, 1 poin per soal |
| `cambridge-checkpoint-math` | Belum | Latihan Kira: 30 soal, 45 menit, soal 1-20 bernilai 1, soal 21-30 bernilai 2 |
| `cambridge-checkpoint-english` | Belum | Latihan Kira: 30 soal, 50 menit, membaca dan tata bahasa, 1 poin per soal |
| `cambridge-checkpoint-science` | Belum | Latihan Kira: 30 soal, 45 menit, soal 1-20 bernilai 1, soal 21-30 bernilai 2 |
| `iklc-2027` | Belum | Aturan sementara meniru pembagian poin IKMC Pre-Ecolier |
| `iksc-2027` | Belum | Aturan sementara meniru pembagian poin IKMC Pre-Ecolier |

## Catatan riset

Situs KPM (`kpm.read1institute.org`) gagal dibuka lewat WebFetch dan ditolak proxy egress (403) lewat curl. `drive.google.com` juga ditolak, jadi Pedoman OSN SD 2026 tidak bisa diunduh. Juknis IKMC, KMNR, dan KSNR serta pedoman OSN perlu dibaca tutor langsung dari penyelenggara.

Katalog memakai id `osn-sd`, sedangkan daftar id lomba di `docs/content-authoring.md` masih menulis `osn`. Skill yang menandai OSN perlu memakai id yang sama dengan katalog.

Tidak ada lomba SD Indonesia tambahan di katalog. Kuota pencarian habis sebelum ada kandidat yang bisa dicek dari sumber resmi.

Setelah juknis dibaca, perbarui format dan aturan di katalog, tambahkan URL juknis ke `sources`, ubah `verified` menjadi `true`, lalu jalankan `pnpm content:check --scope=competitions`.
