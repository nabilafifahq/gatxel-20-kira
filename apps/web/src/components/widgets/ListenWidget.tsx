'use client'

import type { ReactElement } from 'react'
import { ListenButton } from './ListenButton'
import { McqWidget } from './McqWidget'
import { speakableStyle } from './speakable-parts'
import type { WidgetProps } from './types'

/**
 * Dengar lalu jawab. Teks dengar (item.listenText) hanya dibacakan lewat tombol putar dan tidak pernah
 * ditampilkan. Pilihan jawabannya sama dengan pilihan ganda: gambar, kata, atau angka. Nilai { choice }.
 */
export function ListenWidget(props: WidgetProps): ReactElement {
  const { item, subject, disabled = false } = props
  return (
    <div className="flex w-full flex-col gap-4">
      <ListenButton text={item.listenText ?? ''} lang={item.lang} subject={subject} style={speakableStyle(item)} disabled={disabled && !props.feedback} />
      <McqWidget {...props} />
    </div>
  )
}
