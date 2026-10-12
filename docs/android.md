# Aplikasi Android Kira

Aplikasi tablet Kira adalah cangkang WebView Kotlin di `apps/android`. Aplikasi membuka server Kira lewat Tailscale dan menambahkan hal yang tidak bisa dilakukan halaman web di WebView: suara text-to-speech, foto kamera untuk jawaban, izin mikrofon untuk widget bicara, dan layar yang menjelaskan apa yang harus diperiksa bila server tidak terjangkau. Alasan memakai WebView Kotlin ada di ADR 0006.

| Hal | Nilai |
|---|---|
| Application id | `com.gatxel.kira` |
| Android | minimal 8.0 (API 26), target API 36 |
| Versi | `versionCode` = nomor run workflow, `versionName` = `1.0.<versionCode>` |
| Build | Gradle 9.7.1, Android Gradle Plugin 9.4.1 (Kotlin bawaan AGP, KGP 2.2.10), JDK 21 |
| Dependensi | androidx core-ktx 1.18.0, activity-ktx 1.13.0, webkit 1.17.1 |

## 1. Pasang di tablet

1. Pasang Tailscale dari Play Store, masuk dengan akun tailnet keluarga, dan pastikan statusnya Connected.
2. Unduh APK dari halaman Releases repo (aset `kira-1.0.N.apk`) atau dari artefak `kira-apk` di run workflow `android-apk`. Artefak GitHub berupa zip, jadi ekstrak dulu untuk mendapatkan berkas `.apk`.
3. Buka berkas APK di tablet. Android meminta izin Instal aplikasi tidak dikenal untuk aplikasi yang membuka berkas (Files atau Chrome). Izinkan untuk aplikasi itu saja, lalu matikan lagi setelah selesai.
4. Buka Kira. Bila APK dibangun tanpa alamat, layar Alamat server Kira muncul. Isi alamat dari `tailscale serve` di server, misalnya `https://kira-server.nama-tailnet.ts.net`, lalu ketuk Simpan dan buka.
5. Daftarkan tablet seperti di browser: orang dewasa masuk, lalu learner memilih avatar dan PIN.

Pembaruan dipasang di atas aplikasi lama dan hanya berhasil bila kedua APK ditandatangani kunci yang sama (bagian 3). Cookie sesi dan pendaftaran tablet tetap ada selama aplikasi tidak dicopot. Saat pindah dari APK debug ke APK rilis pertama kali, copot dulu versi debug.

## 2. Membangun APK di GitHub Actions

Workflow `.github/workflows/android-apk.yml`:

- Jalankan manual dari tab Actions, workflow android-apk, Run workflow. Isi `kira_url` dengan alamat server. Centang `release` untuk membuat GitHub Release `apk-1.0.N` berisi APK dan SHA-256-nya; ini butuh secret kunci rilis.
- Push ke `main` atau cabang `ci/android-*` yang mengubah `apps/android/**` atau workflow ini membangun APK debug sebagai uji. Alamatnya dari variabel repo `KIRA_URL` (Settings, Secrets and variables, Actions, Variables), atau alamat contoh `https://kira.example.ts.net` bila variabel itu kosong.
- Hasilnya artefak `kira-apk` berisi `kira-1.0.N.apk`, disimpan 30 hari. Ringkasan run memuat ukuran dan SHA-256 APK.

Urutan langkah: Java 21 (Temurin), Android SDK platform 36 dan build-tools 36.0.0 (dipasang lewat `sdkmanager` bila belum ada di runner), Gradle 9.7.1 lewat `gradle/actions/setup-gradle` dengan penyedia cache `basic` dan pemeriksaan SHA-256 distribusi Gradle, build, lalu `apksigner verify --print-certs` dan `aapt2 dump badging`. Semua action dipatok ke commit SHA, dan job release satu-satunya yang mendapat `contents: write`.

## 3. Kunci rilis yang tetap

APK debug dari CI ditandatangani kunci debug baru setiap run. Android menolak memasang APK dengan kunci berbeda di atas aplikasi yang sudah ada, jadi setiap pembaruan debug butuh copot pasang dan pendaftaran tablet ulang. Untuk pemakaian harian, buat satu kunci rilis sekali saja.

Di Windows (PowerShell). `keytool` ada di JDK, jadi pasang dulu JDK 21 lalu buka PowerShell baru:

```powershell
winget install EclipseAdoptium.Temurin.21.JDK
cd $HOME\Documents
keytool -genkeypair -v -storetype PKCS12 -keystore kira-release.jks -alias kira `
  -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=Kira, O=Gatxel, C=ID"

gh secret set KIRA_KEYSTORE_BASE64 --repo nabilafifahq/gatxel-20-kira --body ([Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\kira-release.jks")))
gh secret set KIRA_KEYSTORE_PASSWORD --repo nabilafifahq/gatxel-20-kira
gh secret set KIRA_KEY_ALIAS --repo nabilafifahq/gatxel-20-kira --body kira
gh secret set KIRA_KEY_PASSWORD --repo nabilafifahq/gatxel-20-kira

gh workflow run android-apk --repo nabilafifahq/gatxel-20-kira `
  -f kira_url=https://kira-server.nama-tailnet.ts.net -f release=true
```

Di Linux atau macOS:

```sh
keytool -genkeypair -v -storetype PKCS12 -keystore kira-release.jks -alias kira \
  -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=Kira, O=Gatxel, C=ID"
base64 -w0 kira-release.jks > kira-release.jks.b64   # macOS: base64 -i kira-release.jks -o kira-release.jks.b64

gh secret set KIRA_KEYSTORE_BASE64 --repo nabilafifahq/gatxel-20-kira < kira-release.jks.b64
gh secret set KIRA_KEYSTORE_PASSWORD --repo nabilafifahq/gatxel-20-kira
gh secret set KIRA_KEY_ALIAS --repo nabilafifahq/gatxel-20-kira --body kira
gh secret set KIRA_KEY_PASSWORD --repo nabilafifahq/gatxel-20-kira

gh workflow run android-apk --repo nabilafifahq/gatxel-20-kira \
  -f kira_url=https://kira-server.nama-tailnet.ts.net -f release=true
rm kira-release.jks.b64
```

- `gh secret set` tanpa `--body` meminta nilai secara tersembunyi, jadi kata sandi tidak masuk riwayat shell.
- Secret hanya dibaca saat workflow dijalankan manual. Build dari push selalu APK debug.
- Keystore PKCS12 memakai satu kata sandi, jadi `KIRA_KEY_PASSWORD` diisi sama dengan `KIRA_KEYSTORE_PASSWORD`.
- `gh workflow run` butuh workflow sudah ada di cabang `main`.
- Simpan `kira-release.jks` dan kata sandinya di pengelola kata sandi, di luar repo. Bila kunci hilang, APK berikutnya tidak bisa dipasang menimpa versi lama. Berkas `*.jks` dan `*.keystore` diabaikan git.
- Sidik jari sertifikat ada di log langkah Verify APK (`apksigner verify --print-certs`). Catat sekali dan bandingkan di setiap rilis.

## 4. Membangun di komputer sendiri

Butuh JDK 21, Android SDK dengan platform 36 dan build-tools 36.0.0 (`ANDROID_HOME`, atau `sdk.dir` di `apps/android/local.properties`), dan Gradle 9.7.1. Repo tidak menyimpan Gradle wrapper, jadi pasang Gradle sendiri, misalnya `sdk install gradle 9.7.1` dengan SDKMAN.

```sh
cd apps/android
gradle assembleDebug -PkiraUrl=https://kira-server.nama-tailnet.ts.net
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Untuk APK rilis lokal, isi `KIRA_KEYSTORE_FILE` (path ke `.jks`), `KIRA_KEYSTORE_PASSWORD`, `KIRA_KEY_ALIAS`, dan `KIRA_KEY_PASSWORD` sebagai variabel lingkungan, lalu jalankan `gradle assembleRelease`. Keempatnya harus diisi bersama; build berhenti bila hanya sebagian yang ada.

Build debug menyalakan WebView debugging, jadi halaman bisa diperiksa dari `chrome://inspect` di komputer yang tersambung lewat USB. Build rilis tidak.

## 5. Perilaku aplikasi

- Halaman dari origin server dimuat di aplikasi. Tautan ke origin lain, `mailto:`, dan `tel:` dibuka di aplikasi luar. Skema lain diabaikan.
- Tombol back mundur di riwayat halaman, lalu keluar dari aplikasi.
- Bila halaman utama gagal dimuat (Tailscale mati, DNS, TLS, server mati, atau 502 sampai 504 dari `tailscale serve`), layar Kira tidak bisa dihubungi muncul dengan alamat, kode galat, Coba lagi, dan Ubah alamat server. Service worker Kira tetap berjalan di WebView, jadi quest yang sudah diunduh bisa dikerjakan offline.
- Mikrofon dan kamera diminta saat halaman memanggil `getUserMedia` dari origin server, tidak saat aplikasi dibuka. Permintaan dari origin lain selalu ditolak.
- Foto jawaban (`<input type="file" accept="image/*">`) menawarkan Ambil foto dengan kamera atau Pilih dari galeri atau berkas. Foto kamera disimpan sementara di cache aplikasi dan dihapus setelah 24 jam. Batal memilih selalu mengembalikan hasil kosong ke halaman.
- Unduhan dari origin server memakai DownloadManager dengan cookie sesi dan masuk ke folder Download (Android 8 dan 9: folder unduhan milik aplikasi). Unduhan `blob:` dan dari origin lain tidak didukung; aplikasi meminta membuka Kira lewat browser.
- Cookie sesi dan alamat server tidak ikut backup cloud atau pindah perangkat. Metrik WebView ke Google dimatikan. Safe Browsing aktif. Konten campuran http selalu diblokir dan cookie pihak ketiga dimatikan.
- User agent berakhiran `KiraAndroid/<versionName>`.

## 6. Jembatan KiraNative

Objek `window.KiraNative` hanya ada di aplikasi, hanya di frame utama dari origin server. Halaman memakainya lewat `apps/web/src/lib/native.ts`. `components/learner/speech.ts` memakai TTS Android bila jembatan menjawab siap, dan Web Speech bila tidak.

| Arah | Pesan | Keterangan |
|---|---|---|
| Halaman ke aplikasi | `{"type":"hello"}` | Dikirim sekali per halaman. |
| Aplikasi ke halaman | `{"type":"ready","tts":true,"app":"1.0.12"}` | `tts` false bila mesin TTS tidak ada atau gagal mulai. |
| Halaman ke aplikasi | `{"type":"speak","id":"s1","text":"...","lang":"en-GB","rate":0.9}` | `id` 1 sampai 64 karakter huruf, angka, `_`, atau `-`. `text` 1 sampai 2000 karakter. `lang` `en-GB` atau `id`. `rate` 0,5 sampai 1,5, bawaan 1. |
| Aplikasi ke halaman | `{"type":"speech-start","id":"s1","lang":"en-GB","fallback":false}` | `fallback` true bila suara bahasa itu tidak ada dan suara bawaan perangkat dipakai. |
| Aplikasi ke halaman | `{"type":"speech-end","id":"s1","interrupted":false}` | `interrupted` true bila dihentikan atau dipotong bacaan berikutnya. |
| Aplikasi ke halaman | `{"type":"speech-error","id":"s1","reason":"invalid"}` | `reason` berisi `invalid`, `unavailable`, atau `engine`. |
| Halaman ke aplikasi | `{"type":"stop"}` | Menghentikan bacaan yang berjalan. |
| Halaman ke aplikasi | `{"type":"keep-awake","on":true}` | Layar tetap menyala selama runner terbuka (`FLAG_KEEP_SCREEN_ON`). `on:false` atau pindah halaman mematikannya lagi. |

Pesan dengan jenis lain, lebih dari 16 KB, atau JSON bersarang lebih dari dua tingkat diabaikan. Isi pesan tidak pernah dijalankan sebagai kode. `nativeSpeak()` selesai saat `speech-end` atau `speech-error` datang, atau setelah batas waktu (10 detik menunggu `speech-start`, lalu perkiraan lama bacaan), jadi halaman tidak pernah menunggu tanpa akhir.

## 7. Uji di tablet

Build CI hanya membuktikan APK terbentuk dan tertanda tangan. Sebelum dipakai harian, periksa di tablet:

1. Pasang tanpa alamat bawaan: layar Alamat server Kira muncul, alamat `http://` dan host tanpa titik ditolak dengan pesan.
2. Matikan Tailscale lalu buka Kira: layar tidak bisa dihubungi muncul. Nyalakan lagi, ketuk Coba lagi.
3. Ketuk Read aloud pada soal English dan pada teks Indonesia.
4. Kirim foto jawaban dari kamera dan dari galeri, lalu batalkan satu kali.
5. Buka widget bicara: izin mikrofon diminta saat itu, tidak saat aplikasi dibuka.
6. Tekan back sampai keluar dari aplikasi.
