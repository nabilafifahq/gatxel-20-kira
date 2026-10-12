'use client'

import { createContext, useContext } from 'react'

/**
 * Kepadatan tampilan widget. `exam` dipakai runner tes dan simulasi (papan RunnerTes):
 * ubin pilihan ganda tinggi dengan jawaban besar di tengah. Default `comfortable`.
 */
export type WidgetDensity = 'comfortable' | 'exam'

export const WidgetDensityContext = createContext<WidgetDensity>('comfortable')

export function useWidgetDensity(): WidgetDensity {
  return useContext(WidgetDensityContext)
}
