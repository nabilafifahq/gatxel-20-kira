'use client'

/**
 * Tombol cetak mengambang untuk tutor (tidak ikut tercetak). Teks Indonesia
 * karena dipakai orang dewasa; isi kertas tetap en-GB.
 */
export function PrintToolbar({ note }: { note?: string }) {
  return (
    <div lang="id" className="no-print fixed right-3 bottom-3 z-50 flex items-center gap-3 rounded-control border border-divider bg-surface px-3 py-2 max-[1000px]:static max-[1000px]:order-last max-[1000px]:self-center">
      {note ? <span className="text-small text-fg-muted max-sm:hidden">{note}</span> : null}
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-control border-0 bg-fg px-4 text-body font-bold text-white hover:bg-fg-muted"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 8.5V3.5h10v5" />
          <rect x="3.5" y="8.5" width="17" height="8" rx="2" />
          <path d="M7 14h10v6.5H7z" />
        </svg>
        Cetak halaman ini
      </button>
    </div>
  )
}
