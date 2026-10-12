# ADR 0007: Kamus teks sendiri dan komponen tanpa pustaka

Status: diterima, 12 Oktober 2026. Menggantikan next-intl, React Aria Components, Phosphor, Recharts, dan Motion.

## Keputusan

- Learner selalu en-GB, tutor dan orang tua selalu id, jadi tidak perlu deteksi bahasa, kamus, atau segmen locale di URL. Teks ditulis langsung di komponen layar area masing-masing.
- Komponen memakai elemen HTML asli (`button`, `dialog`, `input`) yang sudah aksesibel, dengan ikon SVG yang digambar mengikuti desain. Grafik konsol digambar sebagai SVG sederhana dengan tabel alternatif.
- Gerak hanya CSS transition pada `transform` dan `opacity`.

## Alasan

Lebih sedikit dependensi berarti lebih sedikit rilis keamanan yang harus diikuti di server rumah, dan bundel learner lebih kecil untuk tablet.
