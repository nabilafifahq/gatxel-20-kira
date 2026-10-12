import type { ReactElement } from 'react'
import { ICON_NAMES, type IconName } from '../spec'
import { DIVIDER, INK } from '../palette'

/** Sementara: lingkaran polos. Diganti dengan gambar ikon sebenarnya. */
const placeholder = (
  <circle cx="24" cy="24" r="18" fill={DIVIDER} stroke={INK} strokeWidth="2.5" />
)

export const ICON_GLYPHS: Record<IconName, ReactElement> = Object.fromEntries(
  ICON_NAMES.map((n) => [n, placeholder]),
) as Record<IconName, ReactElement>
