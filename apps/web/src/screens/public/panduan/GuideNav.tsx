'use client'

import { useEffect, useRef, useState } from 'react'
import { cx } from '@/components/ui/cx'

export type TocGroup = { title: string; items: { id: string; label: string }[] }

/**
 * Navigasi panduan: daftar isi lengket di desktop, menu lompat ringkas di HP.
 * Tanpa JavaScript keduanya tetap berfungsi sebagai tautan biasa; skrip hanya menandai bagian yang sedang dibaca.
 */
export function GuideNav({ groups }: { groups: TocGroup[] }) {
  const items = groups.flatMap((g) => g.items)
  const [active, setActive] = useState(items[0]?.id ?? '')
  const jump = useRef<HTMLDetailsElement>(null)
  const list = useRef<HTMLElement>(null)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const ids = groups.flatMap((g) => g.items.map((i) => i.id))
    const seen = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) seen.add(e.target.id)
          else seen.delete(e.target.id)
        }
        const first = ids.find((id) => seen.has(id))
        if (first) setActive(first)
      },
      { rootMargin: '-15% 0px -70% 0px' },
    )
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [groups])

  // Tautan yang aktif ikut terlihat bila daftar isi desktop lebih panjang dari layar.
  useEffect(() => {
    const box = list.current
    const link = box?.querySelector<HTMLElement>('[aria-current="location"]')
    if (!box || !link) return
    const top = link.offsetTop - box.offsetTop
    if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - 48) box.scrollTop = Math.max(0, top - 96)
  }, [active])

  const activeLabel = items.find((i) => i.id === active)?.label ?? ''

  return (
    <>
      <details ref={jump} className="group sticky top-0 z-20 -mx-4 bg-bg px-4 py-2 lg:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-control bg-lavender px-4 font-bold select-none [&::-webkit-details-marker]:hidden">
          <span className="shrink-0">Daftar isi</span>
          <span aria-hidden="true" className="min-w-0 flex-1 truncate font-normal">
            {activeLabel}
          </span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="shrink-0 transition-transform duration-150 group-open:rotate-180">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <nav aria-label="Lompat ke bagian" className="mt-2 max-h-[65svh] overflow-y-auto rounded-control bg-surface p-2 shadow-soft">
          {groups.map((g) => (
            <div key={g.title} className="flex flex-col py-1">
              <p className="m-0 px-3 pt-2 pb-1 text-small font-bold">{g.title}</p>
              {g.items.map((i) => (
                <a
                  key={i.id}
                  href={`#${i.id}`}
                  onClick={() => jump.current?.removeAttribute('open')}
                  aria-current={i.id === active ? 'location' : undefined}
                  className={cx('flex min-h-11 items-center rounded-md px-3 font-semibold no-underline', i.id === active && 'bg-lavender')}
                >
                  {i.label}
                </a>
              ))}
            </div>
          ))}
        </nav>
      </details>

      <nav ref={list} aria-label="Daftar isi" className="sticky top-6 hidden max-h-[calc(100svh-48px)] overflow-y-auto pr-2 pb-4 lg:block">
        <p className="m-0 mb-2 px-3 font-display text-h3 font-semibold">Daftar isi</p>
        {groups.map((g) => (
          <div key={g.title} className="flex flex-col pb-3">
            <p className="m-0 px-3 pt-2 pb-1 text-small font-bold">{g.title}</p>
            {g.items.map((i) => (
              <a
                key={i.id}
                href={`#${i.id}`}
                aria-current={i.id === active ? 'location' : undefined}
                className={cx('flex min-h-9 items-center rounded-md px-3 py-1 text-small font-semibold no-underline hover:bg-lavender', i.id === active && 'bg-lavender')}
              >
                {i.label}
              </a>
            ))}
          </div>
        ))}
      </nav>
    </>
  )
}
