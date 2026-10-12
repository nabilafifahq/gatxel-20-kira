'use client'

import type { ReactElement } from 'react'
import { ClockWidget } from './ClockWidget'
import { DrawWidget } from './DrawWidget'
import { FractionWidget } from './FractionWidget'
import { MatchWidget } from './MatchWidget'
import { McqWidget, MultiWidget } from './McqWidget'
import { NumberLineWidget } from './NumberLineWidget'
import { NumericWidget } from './NumericWidget'
import { OrderWidget } from './OrderWidget'
import { SortWidget } from './SortWidget'
import { SpeakWidget } from './SpeakWidget'
import { TextWidget } from './TextWidget'
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
  }
}
