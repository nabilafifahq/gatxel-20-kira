# ADR 0006: APK tablet berupa cangkang WebView Kotlin, dibangun di GitHub Actions

Status: diterima, 12 Oktober 2026. Menggantikan versi pertama ADR ini (Capacitor) yang dibuat pada hari yang sama.

## Konteks

- Kira berjalan di server rumah dan dibuka lewat HTTPS Tailscale (ADR 0001). Tablet butuh aplikasi yang membuka alamat itu dan menyediakan text-to-speech, karena WebView Android tidak punya suara Web Speech.
- Semua halaman Kira memakai CSP ber-nonce dengan `strict-dynamic` (`apps/web/src/proxy.ts`). Capacitor menyuntikkan skrip jembatan inline ke setiap halaman. Skrip itu tidak membawa nonce, jadi CSP memblokirnya dan plugin Capacitor tidak pernah tersedia di halaman. Melonggarkan CSP dengan `unsafe-inline` atau hash skrip Capacitor per versi melemahkan perlindungan XSS di area learner.

## Keputusan

- `apps/android` adalah proyek Gradle Kotlin biasa: satu `ComponentActivity` dengan `WebView`, tanpa Capacitor, Cordova, Firebase, analitik, iklan, atau SDK pihak ketiga. Dependensi hanya androidx core-ktx, activity-ktx, dan webkit.
- Jembatan `KiraNative` memakai `WebViewCompat.addWebMessageListener` dengan aturan origin yang sama persis dengan origin server. Objeknya disuntikkan oleh WebView sendiri, tanpa skrip inline, sehingga CSP tetap utuh. Pesan berupa string JSON dan divalidasi di kedua sisi. `addJavascriptInterface` tidak dipakai.
- Isi jembatan versi 1: `hello` dan `ready`, lalu text-to-speech (`speak`, `stop`) dengan `TextToSpeech` Android memakai suara en-GB atau id-ID.
- Alamat server berasal dari Gradle property `kiraUrl` saat build (boleh kosong) atau dari layar native Alamat server Kira saat aplikasi pertama dibuka. Hanya https dan host yang memuat titik.
- Hanya origin itu yang dimuat di WebView. URL lain dibuka di browser luar. Mikrofon dan kamera hanya diberikan ke origin itu, setelah izin Android diminta pada saat halaman membutuhkannya.
- APK dibangun oleh workflow `android-apk` di GitHub Actions. Dengan empat secret kunci rilis hasilnya APK rilis bertanda tangan yang bisa dijadikan GitHub Release. Tanpa secret hasilnya APK debug untuk uji coba.

## Konsekuensi

- Plugin keep-awake dan status bar dari rencana Capacitor tidak dibawa. Bar sistem ditangani edge-to-edge di activity. Layar tetap menyala selama quest belum ada.
- Setiap kemampuan native baru berarti jenis pesan baru di `NativeBridge.kt` dan `apps/web/src/lib/native.ts`, dengan validasi di kedua sisi dan catatan di `docs/android.md`.
- Pada Android System WebView yang belum mendukung `WEB_MESSAGE_LISTENER`, aplikasi tetap membuka Kira, tetapi baca suara tidak tersedia.
- Tablet harus terpasang Tailscale dan masuk ke tailnet yang sama. Digantikan [ADR 0008](0008-akses-cloudflare-tunnel.md): Kira dibuka lewat https://kira.gatxel.com tanpa aplikasi tambahan.
- APK debug dari CI ditandatangani kunci acak per run, jadi versi baru tidak bisa dipasang menimpa versi lama. Pemakaian harian memakai APK rilis dengan kunci tetap (`docs/android.md` bagian 3).
