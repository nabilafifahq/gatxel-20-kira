import type { ReactElement } from 'react'
import { UiIcon } from '@/components/ui/icons'
import { KiraStar } from '@/components/ui/KiraStar'

/** Panel gradien merek. Teks putih, kontras dijaga apps/web/test/gradient-contrast.test.ts. Hanya fakta yang bisa dibuktikan. */
export const HERO_HEADLINE = "Kira, your child's trusted learning champion"
export const HERO_SUBLINE = 'Setiap hari si kecil belajar bersama teman yang selalu menyemangatinya.'

/**
 * Hiasan. Lingkaran memakai warna paling gelap gradien, jadi teks putih di atasnya tetap lolos.
 * Kilau kuning dan biru hanya di sudut kanan, jauh dari teks.
 */
function Decor(): ReactElement {
  return (
    <>
      <span aria-hidden="true" className="pointer-events-none absolute -right-16 -bottom-24 size-64 rounded-pill bg-hero-start opacity-40 md:size-96" />
      <span aria-hidden="true" className="pointer-events-none absolute -top-12 right-1/3 size-40 rounded-pill bg-hero-start opacity-30 max-md:hidden" />
      <svg aria-hidden="true" focusable="false" viewBox="0 0 96 96" className="pointer-events-none absolute top-3 right-3 size-10 md:top-8 md:right-8 md:size-24">
        <path d="M60 8l6 17 17 6-17 6-6 17-6-17-17-6 17-6z" className="fill-yellow" />
        <path d="M26 56l4 11 11 4-11 4-4 11-4-11-11-4 11-4z" className="fill-sky" />
      </svg>
      <svg aria-hidden="true" focusable="false" viewBox="0 0 48 48" className="pointer-events-none absolute right-10 bottom-10 size-12 max-lg:hidden">
        <path d="M24 4l6 14 14 6-14 6-6 14-6-14-14-6 14-6z" className="fill-yellow" />
      </svg>
    </>
  )
}

export function HeroPanel({ seats, claim }: { seats: { total: number; left: number; full: boolean }; claim: string | null }): ReactElement {
  const points = [claim, 'Math, English, dan Science untuk kelas 1 sampai 6', 'Tanpa iklan, orang tua memegang kendali'].filter((p): p is string => Boolean(p))
  return (
    <section aria-labelledby="hero-judul" className="bg-gradient-brand relative isolate flex flex-col justify-center gap-3 overflow-hidden px-4 py-5 text-white md:gap-6 md:px-10 md:py-12 lg:px-16">
      <Decor />
      <div className="relative flex items-center gap-3 md:flex-col md:items-start md:gap-5">
        <KiraStar size={64} className="md:hidden" />
        <KiraStar size={120} className="max-md:hidden" />
        <h1 id="hero-judul" lang="en-GB" className="m-0 max-w-[16ch] font-display text-h2 leading-tight font-semibold max-md:pr-8 md:text-[40px] lg:text-[48px]">
          {HERO_HEADLINE}
        </h1>
      </div>
      <p className="relative m-0 max-w-[44ch] text-body font-semibold md:text-body-lg">{HERO_SUBLINE}</p>
      {/* HP: hanya kalimat kurikulum, supaya form tetap di layar pertama. */}
      <ul className="relative m-0 flex list-none flex-col gap-2 p-0 text-body font-semibold max-md:text-small">
        {points.map((p, i) => (
          <li key={p} className={i === 0 ? 'flex items-start gap-2.5' : 'flex items-start gap-2.5 max-md:hidden'}>
            <UiIcon name="check-circle" size={22} className="mt-0.5 flex-none max-md:size-5 max-md:mt-px" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <p className="relative m-0 text-small font-bold md:text-body">Gratis selama masa beta</p>
      <p className="relative m-0 text-small font-bold md:text-body" aria-live="polite">
        {seats.full ? 'Kursi beta sudah penuh.' : `Beta terbatas. Tersisa ${seats.left} dari ${seats.total} kursi.`}
      </p>
    </section>
  )
}
