# ADR 0006: APK tablet dengan Capacitor, dibangun di GitHub Actions

Status: diterima, 12 Oktober 2026.

## Keputusan

- `apps/android` berisi proyek Capacitor yang memuat alamat server Kira (URL Tailscale) sebagai `server.url`. Alamat diisi saat menjalankan workflow `android-apk` di GitHub Actions.
- Plugin native: text-to-speech (WebView Android tidak punya `speechSynthesis`), keep-awake selama quest, dan status bar. Izin mikrofon dan kamera diminta saat widget bicara atau foto dipakai, tidak saat aplikasi dibuka.
- APK ditandatangani dengan keystore dari GitHub Secrets. Tanpa secret, workflow membuat APK debug untuk uji coba.
- Tablet harus terpasang aplikasi Tailscale dan masuk ke tailnet yang sama.
