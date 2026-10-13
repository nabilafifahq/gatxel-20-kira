'use client'

import type { ReactElement } from 'react'
import { ClockWidget } from './ClockWidget'
import { ClozeWidget } from './ClozeWidget'
import { DrawWidget } from './DrawWidget'
import { FractionWidget } from './FractionWidget'
import { GridWidget } from './GridWidget'
import { HotspotWidget } from './HotspotWidget'
import { LabelWidget } from './LabelWidget'
import { ListenWidget } from './ListenWidget'
import { MatchWidget } from './MatchWidget'
import { McqWidget, MultiWidget } from './McqWidget'
import { NumberLineWidget } from './NumberLineWidget'
import { NumericWidget } from './NumericWidget'
import { OrderWidget } from './OrderWidget'
import { PhotoWidget } from './PhotoWidget'
import { SortWidget } from './SortWidget'
import { SpeakWidget } from './SpeakWidget'
import { SpellWidget } from './SpellWidget'
import { StoryWidget } from './StoryWidget'
import { TableWidget } from './TableWidget'
import { TextWidget } from './TextWidget'
import { TilesWidget } from './TilesWidget'
import type { WidgetProps } from './types'
import { WriteWidget } from './WriteWidget'

/** Pilih widget sesuai ClientItem.type. Key berdasarkan ref supaya state widget tidak bocor antarsoal. */
export function Widget(props: WidgetProps): ReactElement {
  const k = props.item.ref
  switch (props.item.type) {
    case 'mcq':
      return <McqWidget key={k} {...props} />
    case 'multi':
      return <MultiWidget key={k} {...props} />
    case 'numeric':
      return <NumericWidget key={k} {...props} />
    case 'text':
      return <TextWidget key={k} {...props} />
    case 'order':
      return <OrderWidget key={k} {...props} />
    case 'match':
      return <MatchWidget key={k} {...props} />
    case 'sort':
      return <SortWidget key={k} {...props} />
    case 'numberline':
      return <NumberLineWidget key={k} {...props} />
    case 'clock':
      return <ClockWidget key={k} {...props} />
    case 'fraction':
      return <FractionWidget key={k} {...props} />
    case 'write':
      return <WriteWidget key={k} {...props} />
    case 'speak':
      return <SpeakWidget key={k} {...props} />
    case 'draw':
      return <DrawWidget key={k} {...props} />
    case 'photo':
      return <PhotoWidget key={k} {...props} />
    case 'story':
      return <StoryWidget key={k} {...props} />
    case 'listen':
      return <ListenWidget key={k} {...props} />
    case 'tiles':
      return <TilesWidget key={k} {...props} />
    case 'spell':
      return <SpellWidget key={k} {...props} />
    case 'cloze':
      return <ClozeWidget key={k} {...props} />
    case 'hotspot':
      return <HotspotWidget key={k} {...props} />
    case 'label':
      return <LabelWidget key={k} {...props} />
    case 'table':
      return <TableWidget key={k} {...props} />
    case 'grid':
      return <GridWidget key={k} {...props} />
  }
}
