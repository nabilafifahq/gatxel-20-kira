import { UiIcon } from '@/components/ui/icons'

/** Pilihan besar di layar masuk: anak masuk dengan kode keluarga, tanpa email atau password. Lebih ringkas di HP supaya form orang tua tetap di layar pertama. */
export function ChildEntryLink() {
  return (
    <a
      href="/masuk/anak"
      className="kira-press flex min-h-14 items-center gap-3 rounded-card border-2 border-border bg-lavender px-4 py-2 text-fg sm:min-h-18 sm:py-3 no-underline hover:border-fg"
    >
      <span aria-hidden="true" className="inline-flex size-9 flex-none items-center sm:size-12 justify-center rounded-pill bg-lilac">
        <UiIcon name="star" size={22} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-h3 font-bold">Masuk sebagai anak</span>
        <span className="text-small max-sm:hidden">Pakai kode keluarga dan PIN gambar.</span>
      </span>
      <UiIcon name="arrow-right" size={24} className="flex-none" />
    </a>
  )
}
