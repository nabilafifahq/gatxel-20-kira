import type { ReactNode } from 'react'
import { PrintLjk } from '@/screens/print/PrintLjk'
import { PrintPaper } from '@/screens/print/PrintPaper'
import { printKey, printLjk, printPaper, printPaperNamed } from '@/dev/fixtures/print'
import { PrivacyNoticePage } from '@/screens/public/PrivacyNoticePage'
import { TermsPage } from '@/screens/public/TermsPage'
import { PRIVACY_NOTICE, TERMS } from '@/dev/fixtures/public'

/** Pratinjau layar server (halaman hukum, cetak, email). Mengembalikan null bila bukan layar server. */
export async function serverPreview(name: string, state: string): Promise<ReactNode | null> {
  switch (name) {
    case 'cetak-paper':
      return <PrintPaper data={state === 'kunci' ? printKey : state === 'kosong-nama' ? printPaperNamed : printPaper} />
    case 'cetak-ljk':
      return <PrintLjk data={await printLjk(state === 'lima-pilihan' ? 5 : 4)} />
    case 'kebijakan-privasi':
      return <PrivacyNoticePage data={PRIVACY_NOTICE} />
    case 'ketentuan':
      return <TermsPage data={TERMS} />
    default:
      return null
  }
}
