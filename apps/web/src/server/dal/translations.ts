import 'server-only'
import { findContentDir } from '@kira/content/load'
import { loadTranslations, lookupTranslation, type TranslationMap } from '@kira/content/translations'
import { log } from '../log'

/**
 * Terjemahan penjelasan bahasa Indonesia, dimuat sekali per proses. Hanya teks yang persis sama dengan sumbernya yang punya
 * terjemahan, jadi teks generator dan teks Inggris yang baru berubah otomatis tetap berbahasa Inggris dan tombolnya tersembunyi.
 */
const g = globalThis as unknown as { __kiraTranslations?: TranslationMap }

function translations(): TranslationMap {
  if (g.__kiraTranslations) return g.__kiraTranslations
  const started = Date.now()
  const { map, problems } = loadTranslations(findContentDir())
  if (problems.length > 0) log.error('berkas terjemahan bermasalah, entrinya dilewati', { count: problems.length, first: problems.slice(0, 3) })
  log.info('terjemahan dimuat', { entries: map.size, ms: Date.now() - started })
  g.__kiraTranslations = map
  return map
}

export function idText(en: string | null | undefined): string | null {
  return lookupTranslation(translations(), en)
}

/** Langkah dengan terjemahan `sayId` bila ada. */
export function withSayId<T extends { say: string }>(step: T): T & { sayId?: string } {
  const sayId = idText(step.say)
  return sayId ? { ...step, sayId } : step
}
