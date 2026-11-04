/**
 * Muat Nunito dan Fredoka lebih awal supaya teks tidak bergeser saat huruf datang.
 * Berkas ada di public/fonts (self-host). Baloo 2 dimuat saat dibutuhkan angka.
 */
export function FontPreload() {
  return (
    <>
      <link rel="preload" href="/fonts/Nunito.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <link rel="preload" href="/fonts/Fredoka.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
    </>
  )
}
