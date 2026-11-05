/**
 * Browser tertanam: aplikasi Android Kira (WebView) dan browser di dalam aplikasi lain. Google menolak OAuth di sana
 * (disallowed_useragent), jadi tombol Google disembunyikan dan rute mulai mengarahkan kembali dengan pesan ramah.
 * Aplikasi Android juga membuka alamat luar di browser sistem, yang tidak memegang cookie dari WebView.
 */
const EMBEDDED = /KiraAndroid\/|; wv\)|FBAN|FBAV|FB_IAB|Instagram|TikTok|MicroMessenger|\bLine\//

export function isEmbeddedBrowser(userAgent: string): boolean {
  return EMBEDDED.test(userAgent)
}
