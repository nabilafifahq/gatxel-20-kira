import type { ReactElement } from 'react'
import { cx } from './cx'

/**
 * Maskot merek Kira: bintang kuning yang ceria (Brand Kit v1.0). Muncul di momen penting:
 * sapaan, jawaban benar, quest selesai, dan layar kosong. Hiasan (aria-hidden). Gerak napas dan
 * kedip memakai kelas `kira-mascot` dan `kira-eyes` di globals.css; reduced motion mematikannya.
 * `calm` untuk momen Not yet dan layar kosong: mata datar, mulut kecil.
 */
export function KiraStar({
  size = 64,
  mood = 'happy',
  animate = true,
  className,
}: {
  size?: number
  mood?: 'happy' | 'calm'
  animate?: boolean
  className?: string
}): ReactElement {
  return (
    <span aria-hidden="true" className={cx(animate && 'kira-mascot', 'pointer-events-none inline-flex flex-none select-none', className)}>
      <svg width={size} height={size} viewBox="0 0 64 64" focusable="false">
        <path
          d="M29.3 11.6Q32.0 7.0 34.7 11.6L39.1 19.1Q41.1 22.5 45.0 23.3L53.4 25.2Q58.6 26.3 55.1 30.4L49.4 36.8Q46.7 39.8 47.1 43.7L47.9 52.3Q48.5 57.7 43.5 55.5L35.6 52.1Q32.0 50.5 28.4 52.1L20.5 55.5Q15.5 57.7 16.1 52.3L16.9 43.7Q17.3 39.8 14.6 36.8L8.9 30.4Q5.4 26.3 10.6 25.2L19.0 23.3Q22.9 22.5 24.9 19.1Z"
          className="fill-yellow stroke-fg"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <g className="kira-eyes">
          {mood === 'happy' ? (
            <path d="M22.5 34.5Q25 31 27.5 34.5M36.5 34.5Q39 31 41.5 34.5" fill="none" className="stroke-fg" strokeWidth="2.4" strokeLinecap="round" />
          ) : (
            <path d="M23 33.5h4M37 33.5h4" fill="none" className="stroke-fg" strokeWidth="2.4" strokeLinecap="round" />
          )}
        </g>
        {mood === 'happy' ? (
          <path d="M28.5 38.5Q32 43.5 35.5 38.5Z" className="fill-fg stroke-fg" strokeWidth="1.6" strokeLinejoin="round" />
        ) : (
          <path d="M29 40Q32 42 35 40" fill="none" className="stroke-fg" strokeWidth="2" strokeLinecap="round" />
        )}
        <ellipse cx="20.5" cy="39" rx="2.6" ry="1.8" className="fill-lilac" opacity="0.6" />
        <ellipse cx="43.5" cy="39" rx="2.6" ry="1.8" className="fill-lilac" opacity="0.6" />
      </svg>
    </span>
  )
}
