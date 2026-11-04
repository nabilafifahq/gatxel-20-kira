import 'server-only'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { AccountMenu } from '@/components/ui/AccountMenu'
import { SIGN_IN_CLASS } from '@/components/ui/SiteHeader'
import { getActor, homeFor } from './auth/actor'

/**
 * Isi kanan header di halaman publik: menu akun untuk orang dewasa yang sudah masuk, tombol kembali belajar untuk anak,
 * dan undefined (tombol Masuk bawaan) untuk pengunjung.
 */
export async function siteAccount(): Promise<ReactNode | undefined> {
  const actor = await getActor().catch(() => null)
  if (!actor) return undefined
  const home = homeFor(actor.role)
  if (actor.role === 'learner') {
    return (
      <Link href={home} className={SIGN_IN_CLASS}>
        Kembali belajar
      </Link>
    )
  }
  return <AccountMenu name={actor.name} links={[{ href: home, label: actor.role === 'tutor' ? 'Buka konsol' : 'Buka dashboard' }]} />
}
