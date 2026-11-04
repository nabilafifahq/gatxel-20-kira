import type { ReactNode } from 'react'
import { UiIcon, type UiIconName } from '@/components/ui/icons'
import { cx } from '@/components/ui/cx'

/** Lebar dan tinggi asli setiap tangkapan layar, supaya halaman tidak melompat saat gambar dimuat. */
export type ShotSpec = { src: string; alt: string; caption?: string; width: number; height: number }

/** Tangkapan layar produk: berkas webp kecil di /panduan-img, dimuat saat mendekati layar. */
export function Shot({ src, alt, caption, width, height, className }: ShotSpec & { className?: string }) {
  return (
    <figure className={cx('m-0 flex flex-col gap-2', className)}>
      <div className="overflow-hidden rounded-card bg-surface shadow-soft">
        <img src={`/panduan-img/${src}`} alt={alt} width={width} height={height} loading="lazy" decoding="async" className="block h-auto w-full" />
      </div>
      {caption ? <figcaption className="text-small">{caption}</figcaption> : null}
    </figure>
  )
}

export type Tone = 'lavender' | 'yellow' | 'sky'

export const TONE_BG: Record<Tone, string> = { lavender: 'bg-lavender', yellow: 'bg-yellow', sky: 'bg-sky' }

/** Kotak ikon di judul bagian. Warna hanya aksen; artinya selalu dibawa teks judul. */
export function IconTile({ icon, tone = 'lavender', size = 48, children }: { icon?: UiIconName; tone?: Tone; size?: number; children?: ReactNode }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size }} className={cx('inline-flex flex-none items-center justify-center rounded-control text-fg', TONE_BG[tone])}>
      {icon ? <UiIcon name={icon} size={Math.round(size * 0.55)} /> : children}
    </span>
  )
}

/** Langkah bernomor dengan angka bulat. */
export function Steps({ items, start = 1, chip = 'bg-lavender' }: { items: ReactNode[]; start?: number; chip?: 'bg-lavender' | 'bg-surface' }) {
  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden="true" className={cx('flex h-8 w-8 flex-none items-center justify-center rounded-pill font-numbers text-body font-bold tabular-nums', chip)}>
            {start + i}
          </span>
          <span className="min-w-0 flex-1 pt-0.5">{item}</span>
        </li>
      ))}
    </ol>
  )
}

export type Feature = {
  id: string
  title: string
  icon: ReactNode
  tone?: Tone
  what: ReactNode
  /** Tabel atau gambar kecil setelah penjelasan, bila kalimat saja kurang jelas. */
  extra?: ReactNode
  /** Contoh anak yang cocok memakai fitur ini. Nama fiktif. */
  suits: ReactNode
  steps: ReactNode[]
  control: ReactNode
  shot?: ShotSpec
}

/** Satu fitur di panduan orang tua: apa ini, cocok untuk siapa, alurnya, dan yang bisa diatur. */
export function FeatureCard({ f }: { f: Feature }) {
  return (
    <section id={f.id} aria-labelledby={`${f.id}-judul`} className="flex flex-col gap-4 rounded-card bg-surface p-6 shadow-soft max-sm:p-5">
      <div className="flex items-center gap-3">
        <IconTile tone={f.tone}>{f.icon}</IconTile>
        <h3 id={`${f.id}-judul`} className="m-0 text-h3 font-semibold">
          {f.title}
        </h3>
      </div>
      <div className={cx('grid gap-5', f.shot && 'md:grid-cols-[minmax(0,1fr)_220px]')}>
        <div className="flex min-w-0 flex-col gap-4">
          <p className="m-0">{f.what}</p>
          {f.extra}
          <div className="rounded-control bg-lavender p-4">
            <p className="m-0 font-bold">Cocok untuk</p>
            <p className="m-0">{f.suits}</p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="m-0 font-bold">Alurnya</p>
            <Steps items={f.steps} />
          </div>
          <div className="flex flex-col gap-1">
            <p className="m-0 font-bold">Yang bisa Ayah/Bunda atur</p>
            <p className="m-0">{f.control}</p>
          </div>
        </div>
        {f.shot ? <Shot {...f.shot} className="mx-auto w-full max-w-[240px] md:max-w-none" /> : null}
      </div>
    </section>
  )
}

/** Kepala satu kelompok fitur. */
export function GroupHeading({ id, title, intro }: { id: string; title: string; intro?: ReactNode }) {
  return (
    <div id={id} className="flex flex-col gap-2 pt-8 first:pt-0">
      <h2 className="m-0 text-h1 font-semibold max-sm:text-h2">{title}</h2>
      {intro ? <p className="m-0 max-w-[62ch] text-body-lg">{intro}</p> : null}
    </div>
  )
}

/** Tanya jawab yang bisa dibuka. Elemen asli, jadi jalan tanpa JavaScript dan dengan papan ketik. */
export function Faq({ id, q, children }: { id: string; q: string; children: ReactNode }) {
  return (
    <details id={id} className="group rounded-card bg-surface shadow-soft">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-card px-5 py-3 font-bold select-none [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">{q}</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="shrink-0 transition-transform duration-150 group-open:rotate-180">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="flex flex-col gap-3 px-5 pb-5">{children}</div>
    </details>
  )
}
