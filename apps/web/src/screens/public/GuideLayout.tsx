import Link from 'next/link'
import type { ReactNode } from 'react'
import { PublicFrame } from './PublicFrame'

/** Kerangka halaman panduan publik: judul, pengantar, dan bagian bernomor. Teks biasa, tanpa gambar. */
export function GuideLayout({ title, intro, other, account, children }: { title: string; intro: string; other: { href: string; label: string }; account?: ReactNode; children: ReactNode }) {
  return (
    <PublicFrame center={false} brandHref="/" headerAction={account}>
      <article className="mx-auto flex w-full max-w-[720px] flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="m-0 text-h1 font-bold max-sm:text-h2">{title}</h1>
          <p className="m-0 text-body-lg text-fg-muted">{intro}</p>
          <Link href={other.href} className="inline-flex min-h-11 items-center self-start font-bold">
            {other.label}
          </Link>
        </header>
        {children}
      </article>
    </PublicFrame>
  )
}

export function GuideSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="m-0 text-h2 font-bold">
        {title}
      </h2>
      <div className="flex flex-col gap-3 text-body">{children}</div>
    </section>
  )
}
