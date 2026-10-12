import type { ReactElement } from 'react'
import type { IconName } from '../spec'
import { ANIMAL_GLYPHS } from './glyphs-animals'
import { BODY_GLYPHS } from './glyphs-body'
import { FOOD_GLYPHS } from './glyphs-food'
import { NATURE_GLYPHS } from './glyphs-nature'
import { PLACE_GLYPHS } from './glyphs-places'
import { SCIENCE_GLYPHS } from './glyphs-science'
import { THING_GLYPHS } from './glyphs-things'

/**
 * Semua ikon 48 x 48, digabung dari file per kelompok. Tipe Record<IconName, ...>
 * membuat typecheck gagal kalau satu nama di ICON_NAMES belum punya gambar.
 */
export const ICON_GLYPHS: Record<IconName, ReactElement> = {
  ...FOOD_GLYPHS,
  ...THING_GLYPHS,
  ...ANIMAL_GLYPHS,
  ...NATURE_GLYPHS,
  ...SCIENCE_GLYPHS,
  ...BODY_GLYPHS,
  ...PLACE_GLYPHS,
}
