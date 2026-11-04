/** Bahasa tampilan anak. Soal dan pelajaran tetap berbahasa aslinya; hanya antarmuka yang mengikuti pilihan ini. */
export const UI_LANGS = ['id', 'en'] as const
export type UiLang = (typeof UI_LANGS)[number]

/** Bawaan untuk anak baru, dan untuk layar tanpa sesi bila perangkat belum dikenal. */
export const DEFAULT_UI_LANG: UiLang = 'id'

export function parseUiLang(value: unknown): UiLang {
  return value === 'en' ? 'en' : value === 'id' ? 'id' : DEFAULT_UI_LANG
}

/** Nilai `<html lang>` dan `Intl` untuk bahasa tampilan. */
export function htmlLang(lang: UiLang): 'id' | 'en-GB' {
  return lang === 'en' ? 'en-GB' : 'id'
}
