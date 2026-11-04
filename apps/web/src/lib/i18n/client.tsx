'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { dictFor, type Dict, type UiLang } from './index'

// Tanpa provider (pratinjau konsol, tes unit): bahasa Inggris, sama seperti teks lama.
const LangContext = createContext<UiLang>('en')

/** Dipasang sekali di layout akar learner, dari bahasa yang sudah dibaca sesi. */
export function I18nProvider({ lang, children }: { lang: UiLang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>
}

export function useLang(): UiLang {
  return useContext(LangContext)
}

/** Kamus bahasa tampilan anak untuk komponen klien. Komponen klien tetap dirender di server, jadi tidak ada kedipan. */
export function useT(): Dict {
  return dictFor(useLang())
}
