import type { ReactElement } from 'react'
import type { QuestSubject } from '@/lib/dto'
import { cx } from '@/components/ui/cx'

/**
 * Ikon mapel 32 x 32 bergaris tinta (papan QuestStop dan SubjectChip):
 * Math empat kotak, English buku terbuka, Science daun, Bonus kado.
 * `tone="white"` mengisi bidang dengan putih, untuk ikon besar di atas latar tint.
 */
export function SubjectIcon({
  subject,
  size = 32,
  tone = 'tint',
  className,
  title,
}: {
  subject: QuestSubject
  size?: number
  tone?: 'tint' | 'white'
  className?: string
  title?: string
}): ReactElement {
  const sw = size >= 64 ? 1.5 : 2
  const a11y = title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const }
  const pale = tone === 'white' ? 'fill-white' : undefined
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cx('flex-none', className)} focusable="false" {...a11y}>
      {subject === 'math' ? (
        <g className="stroke-fg" strokeWidth={sw}>
          <rect x="5" y="5" width="10" height="10" rx="2" className="fill-math" />
          <rect x="17" y="5" width="10" height="10" rx="2" className={pale ?? 'fill-math-50'} />
          <rect x="5" y="17" width="10" height="10" rx="2" className={pale ?? 'fill-math-50'} />
          <rect x="17" y="17" width="10" height="10" rx="2" className="fill-math" />
        </g>
      ) : subject === 'english' ? (
        <g strokeWidth={sw} fill="none">
          <path
            d="M16 9c-3-2.2-6.5-3-11-2.5v18c4.5-.5 8 .3 11 2.5 3-2.2 6.5-3 11-2.5v-18c-4.5-.5-8 .3-11 2.5z"
            className={cx('stroke-fg', pale ?? 'fill-english-50')}
            strokeLinejoin="round"
          />
          <path d="M16 9v18" className="stroke-fg" />
          <path
            d="M8.5 12.5c1.8 0 3.3.3 4.5.9M8.5 16.5c1.8 0 3.3.3 4.5.9M19 13.4c1.2-.6 2.7-.9 4.5-.9M19 17.4c1.2-.6 2.7-.9 4.5-.9"
            className="stroke-english"
            strokeLinecap="round"
          />
        </g>
      ) : subject === 'science' ? (
        <g strokeWidth={sw} fill="none">
          <path d="M7 25C6 15 12 7 26 6c.5 13-6.5 20-19 19z" className={cx('stroke-fg', pale ?? 'fill-science-50')} strokeLinejoin="round" />
          <path d="M7 25c4-6 8-10 14-13" className="stroke-science" strokeLinecap="round" />
          <path d="M12.5 19.5l-.6-4.6M16.2 16.3l4 .1" className="stroke-science" strokeLinecap="round" />
        </g>
      ) : (
        <g strokeWidth={sw} className="stroke-fg">
          <rect x="5" y="13" width="22" height="14" rx="2" className="fill-star" />
          <rect x="4" y="9" width="24" height="5" rx="1.5" className="fill-white" />
          <path d="M16 9v18" fill="none" />
          <path d="M16 9c-2-4-7-5-7-2s4 2 7 2zM16 9c2-4 7-5 7-2s-4 2-7 2z" className="fill-white" strokeLinejoin="round" />
        </g>
      )}
    </svg>
  )
}
