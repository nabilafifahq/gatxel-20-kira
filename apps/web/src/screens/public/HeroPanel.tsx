import type { ReactElement } from 'react'
import { UiIcon } from '@/components/ui/icons'
import { KiraStar } from '@/components/ui/KiraStar'

/** Panel gradien merek. Teks putih, kontras dijaga apps/web/test/gradient-contrast.test.ts. Hanya fakta yang bisa dibuktikan. */
export const HERO_HEADLINE = "Kira, your child's trusted learning champion"
export const HERO_SUBLINE = 'Setiap hari si kecil belajar bersama teman yang selalu menyemangatinya.'

function Decor(): ReactElement {
  // Hiasan di sudut yang tidak dilewati teks. Warna dari token, tanpa gambar.
  return (
    <svg aria-hidden="true" focusable="false" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 600" preserveAspectRatio="xMaxYMax slice">
      <circle cx="372" cy="560" r="86" className="fill-lilac" opacity="0.28" />
      <circle cx="384" cy="430" r="26" className="fill-sky" opacity="0.32" />
      <path d="M322 58l6 15 15 6-15 6-6 15-6-15-15-6 15-6z" className="fill-yellow" opacity="0.9" />
      <path d="M372 142l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" className="fill-sky" opacity="0.9" />
      <path d="M268 522l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" className="fill-yellow" opacity="0.8" />
    </svg>
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
        <h1 id="hero-judul" lang="en-GB" className="m-0 max-w-[16ch] font-display text-h2 leading-tight font-semibold md:text-[40px] lg:text-[48px]">
          {HERO_HEADLINE}
        </h1>
      </div>
      <p className="relative m-0 max-w-[44ch] text-body font-semibold md:text-body-lg">{HERO_SUBLINE}</p>
      <ul className="relative m-0 flex list-none flex-col gap-2 p-0 text-body font-semibold max-md:hidden">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2.5">
            <UiIcon name="check-circle" size={22} className="mt-0.5 flex-none" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <p className="relative m-0 text-small font-bold md:text-body" aria-live="polite">
        {seats.full ? 'Kursi beta sudah penuh.' : `Beta terbatas. Tersisa ${seats.left} dari ${seats.total} kursi.`}
      </p>
    </section>
  )
}
