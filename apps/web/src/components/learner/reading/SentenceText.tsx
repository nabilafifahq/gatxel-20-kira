import type { ReactElement } from 'react'
import { TapWords } from '../TapWords'

/**
 * Teks satu kalimat buku. Satu-satunya tempat teks bacaan dirender, jadi Kamus Ketuk (TapWords) dipasang di sini.
 * Tanpa DictionaryProvider (saklar kamus mati) TapWords menampilkan teks biasa.
 */
export function SentenceText({ text }: { text: string }): ReactElement {
  return <TapWords text={text} />
}
