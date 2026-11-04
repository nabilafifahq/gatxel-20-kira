'use client'

import { RouteError } from '@/components/runtime/RouteError'

export default function LearnerError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} area="learner" />
}
