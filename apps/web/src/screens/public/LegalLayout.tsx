import type { ReactNode } from 'react'
import { ButtonLink } from '@/components/console/Button'
import { PUBLIC_ROUTES } from '@/components/console/routes'
import { PublicFrame } from './PublicFrame'

/**
 * Tata letak dokumen hukum (papan Privasi, Ketentuan): daftar isi di kiri (di atas
 * pada layar sempit), isi 18/29 selebar 760px. Kontras dan ukuran huruf sama dengan
 * halaman lain, karena klausul yang sulit dibaca batal menurut Pasal 18 ayat (2) UU 8/1999.
 */
export function LegalLayout({
  current,
  title,
  meta,
  toc,
  footerNote,
  children,
}: {
  current: 'privacy' | 'terms'
  title: string
  /** Baris versi dan bahasa yang berlaku di bawah judul. */
  meta: ReactNode
  toc: { id: string; label: string }[]
  footerNote: string
  children: ReactNode
}) {
  return (
    <PublicFrame
      current={current}
      center={false}
      footerNote={footerNote}
      headerAction={
        <ButtonLink href={PUBLIC_ROUTES.login} variant="secondary">
          Masuk
        </ButtonLink>
      }
    >
      {/* HP: judul, daftar isi, isi. Layar lebar: daftar isi di kolom kiri, judul dan isi di kanan. */}
      <div className="grid w-full items-start gap-8 lg:grid-cols-[minmax(0,320px)_minmax(0,760px)]">
        <header className="flex flex-col gap-2.5 lg:col-start-2 lg:row-start-1">
          <h1 id="dokumen-judul" className="m-0 text-h1 font-bold">
            {title}
          </h1>
          <p className="m-0 text-body text-fg-muted">{meta}</p>
        </header>
        <nav
          aria-label="Daftar isi"
          className="flex min-w-0 flex-col gap-1 rounded-card border border-divider bg-surface p-5 lg:sticky lg:top-6 lg:col-start-1 lg:row-span-2 lg:row-start-1"
        >
          <span className="pb-1.5 text-small font-bold text-fg-muted">Daftar isi</span>
          {toc.map((t) => (
            <a key={t.id} href={`#${t.id}`} className="py-1.5 text-body font-semibold">
              {t.label}
            </a>
          ))}
        </nav>
        <article aria-labelledby="dokumen-judul" className="flex min-w-0 flex-col gap-8 text-body-lg lg:col-start-2 lg:row-start-2">
          {children}
        </article>
      </div>
    </PublicFrame>
  )
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-judul`} className="flex scroll-mt-6 flex-col gap-3">
      <h2 id={`${id}-judul`} className="m-0 text-h2 font-bold">
        {title}
      </h2>
      {children}
    </section>
  )
}

/** Tabel dokumen hukum: wilayah gulir bisa dijangkau keyboard, judul tabel terbaca pembaca layar. */
export function LegalTable({ caption, children, minWidth }: { caption: string; children: ReactNode; minWidth: number }) {
  const id = `tabel-${caption.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div role="region" aria-labelledby={id} tabIndex={0} className="relative overflow-x-auto rounded-card border border-divider bg-surface">
      <table className="w-full border-collapse text-body" style={{ minWidth }}>
        <caption id={id} className="visually-hidden">
          {caption}
        </caption>
        {children}
      </table>
    </div>
  )
}

export const TH_COL = 'border-b border-divider px-3.5 py-3 text-left align-bottom font-bold'
export const TD = 'border-b border-divider px-3.5 py-3 align-top'
