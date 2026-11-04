import type { ReactElement } from 'react'

/**
 * Teks satu kalimat buku. Satu-satunya tempat teks bacaan dirender, supaya pencarian kata (TapWords, agen kamus)
 * cukup dipasang di sini: ganti isi fungsi ini dengan <TapWords text={text} /> bila komponennya ada.
 */
export function SentenceText({ text }: { text: string }): ReactElement {
  return <>{text}</>
}
