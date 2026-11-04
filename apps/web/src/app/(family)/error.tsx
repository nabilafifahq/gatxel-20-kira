'use client'

import { RouteError } from '@/components/runtime/RouteError'

export default function AreaError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} area="family" />
}
