/** Bagian bersama importer dataset: pembersihan teks dan penyaring kata yang tidak cocok untuk anak SD. */

/** Rapikan spasi dan tanda kutip lengkung. */
export function tidy(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Soal Kira tidak memakai em dash atau en dash; sumber luar sering memakainya. */
export function noDashes(s: string): string {
  return s.replace(new RegExp(`\\s*[${String.fromCharCode(0x2013, 0x2014)}]\\s*`, 'g'), ', ')
}

/** Teks yang tampil ke anak: rapi, tanpa tanda pisah panjang. */
export function clean(s: string): string {
  return noDashes(tidy(s))
}

const UNSAFE = new RegExp(
  `\\b(${[
    'kill(?:s|ed|ing|er)?', 'murder\\w*', 'dead', 'die[sd]?', 'dying', 'death\\w*', 'suicid\\w*', 'guns?', 'rifles?', 'bombs?', 'weapons?', 'shoot(?:s|ing|er)?', 'shot',
    'beer', 'wine', 'vodka', 'whisk(?:e)?y', 'alcohol\\w*', 'drunk', 'cigarettes?', 'smok(?:e|es|ed|ing)', 'drugs?', 'cocaine', 'marijuana', 'sex\\w*', 'naked', 'porn\\w*',
    'casino', 'gambl\\w*', 'lottery', 'blood\\w*', 'stab\\w*', 'war', 'wars', 'slave\\w*', 'rape\\w*', 'nazi\\w*', 'terror\\w*', 'torture\\w*', 'abuse\\w*',
    'damn', 'hell', 'crap', 'stupid', 'idiot',
  ].join('|')})\\b`,
  'i',
)

/** Sama sekali tidak cocok untuk anak SD. Penyaring sederhana: lebih baik membuang soal bagus daripada meloloskan yang tidak pantas. */
export function unsafeForKids(...texts: string[]): boolean {
  return texts.some((t) => UNSAFE.test(t))
}

/** Soal yang bergantung pada gambar atau grafik yang tidak ikut terambil. */
export function needsPicture(text: string): boolean {
  return /\b(diagram|picture|figure|graph|chart|table below|shown below|map below|image|photograph|illustration)\b/i.test(text)
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}
