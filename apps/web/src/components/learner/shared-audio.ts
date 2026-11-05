'use client'

/**
 * Satu elemen audio untuk semua klip Kira: bacaan soal, dengar, eja, langkah pembahasan, buku, kartu, kamus, dan pembawa acara.
 * iPhone dan iPad hanya mengizinkan play() di luar ketukan pada elemen yang sudah tersentuh ketukan, sedangkan klip baru siap
 * setelah fetch, sesudah ketukannya lewat. Satu elemen juga berarti dua klip tidak mungkin berbunyi bersamaan.
 */
let element: HTMLAudioElement | null = null

export function sharedAudio(): HTMLAudioElement {
  element ??= new Audio()
  return element
}

/**
 * Panggil langsung di dalam ketukan, sebelum await apa pun. load() tanpa sumber cukup untuk membuka elemen di WebKit.
 * Sumber lama dilepas dulu supaya tidak ada event error dari alamat blob yang sudah dicabut. Klip yang sedang berbunyi harus sudah dihentikan.
 */
export function unlockAudio(): void {
  const audio = sharedAudio()
  audio.removeAttribute('src')
  audio.load()
}

// Ketukan pertama di halaman membuka elemen, supaya layar yang mulai bicara sendiri sesudahnya (penguji, pembawa acara, langkah berikutnya) tetap berbunyi.
if (typeof window !== 'undefined') {
  const first = () => {
    window.removeEventListener('touchend', first, true)
    window.removeEventListener('click', first, true)
    if (sharedAudio().paused) unlockAudio()
  }
  window.addEventListener('touchend', first, true)
  window.addEventListener('click', first, true)
}
