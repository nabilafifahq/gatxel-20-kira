import { en, id, type Dict } from './dict'
import type { UiLang } from './lang'

export { DEFAULT_UI_LANG, UI_LANGS, htmlLang, parseUiLang, type UiLang } from './lang'
export type { Dict }

const DICTS: Record<UiLang, Dict> = { en, id }

/** Kamus untuk satu bahasa. Isomorfik: boleh dipakai di server, klien, dan fungsi murni. */
export function dictFor(lang: UiLang): Dict {
  return DICTS[lang]
}

/** Kamus untuk aktor yang sudah terbaca (Server Action, DAL): tanpa query tambahan. */
export function tOf(actor: { uiLang?: UiLang }): Dict {
  return DICTS[actor.uiLang ?? 'en']
}
