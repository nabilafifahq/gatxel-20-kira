import { z } from 'zod'
import { Avatar, Icon } from '@kira/figures/icons'
import { AVATARS, ICON_NAMES, PIN_PICTURES } from '@kira/figures/spec'

export const dynamic = 'force-dynamic'

const total = ICON_NAMES.length

/**
 * `?dari=0&sampai=30` membatasi daftar ikon, `?nama=cat,dog` memilih ikon tertentu,
 * `?besar=1` menampilkan daftar itu saja di 96, 48, dan 24 px.
 */
const query = z.object({
  dari: z.coerce.number().int().min(0).max(total).catch(0),
  sampai: z.coerce.number().int().min(0).max(total).catch(total),
  nama: z.string().max(4000).optional().catch(undefined),
  besar: z.literal('1').optional().catch(undefined),
})

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/** Galeri ikon, gambar PIN, dan avatar dari @kira/figures. */
export default async function IconGallery({ searchParams }: Props) {
  const q = query.parse(await searchParams)
  const picked = q.nama?.split(',') ?? []
  const names = picked.length
    ? ICON_NAMES.filter((n) => picked.includes(n))
    : ICON_NAMES.slice(q.dari, Math.max(q.dari, q.sampai))
  const large = q.besar === '1'

  return (
    <main lang="id" className="mx-auto max-w-[1180px] px-4 py-8 sm:px-8">
      <h1 className="text-h1 font-bold">Ikon</h1>
      <p className="mt-2 text-body text-fg-muted">
        {total} ikon 48 x 48 dan {AVATARS.length} avatar 64 x 64. Setiap ikon tampil di 48 px dan 24 px dengan namanya.
      </p>

      {!large && (
        <>
          <section aria-labelledby="pin" className="mt-12">
            <h2 id="pin" className="text-h2 font-bold">Gambar PIN, 96 px</h2>
            <ul className="mt-4 flex flex-wrap gap-4">
              {PIN_PICTURES.map((n) => (
                <li key={n} className="flex flex-col items-center gap-2 rounded-card border border-divider bg-surface p-4">
                  <Icon name={n} size={96} title={n} />
                  <span className="text-small text-fg-muted">{n}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="avatar" className="mt-12">
            <h2 id="avatar" className="text-h2 font-bold">Avatar, 96 px</h2>
            <ul className="mt-4 flex flex-wrap gap-4">
              {AVATARS.map((n) => (
                <li key={n} className="flex flex-col items-center gap-2 rounded-card border border-divider bg-surface p-4">
                  <Avatar name={n} size={96} title={n} />
                  <span className="text-small text-fg-muted">{n}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <section aria-labelledby="semua" className="mt-12">
        <h2 id="semua" className="text-h2 font-bold">
          {picked.length ? `${names.length} ikon terpilih dari ${total}` : `Ikon ${q.dari + 1} sampai ${q.dari + names.length} dari ${total}`}
        </h2>
        <ul
          className={`mt-4 grid gap-4 ${large ? 'grid-cols-[repeat(auto-fill,minmax(208px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(120px,1fr))]'}`}
        >
          {names.map((n) => (
            <li key={n} className="flex flex-col items-center gap-2 rounded-card border border-divider bg-surface p-3">
              <div className="flex items-end gap-3">
                {large && <Icon name={n} size={96} />}
                <Icon name={n} size={48} title={n} />
                <Icon name={n} size={24} />
              </div>
              <span className="text-small text-fg-muted">{n}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
