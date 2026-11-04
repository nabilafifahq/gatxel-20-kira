import { permanentRedirect } from 'next/navigation'

/** Alamat yang mudah diingat untuk halaman Bantuan. */
export default function BantuanPage(): never {
  permanentRedirect('/feedback')
}
