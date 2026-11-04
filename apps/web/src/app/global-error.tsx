'use client'

import './globals.css'
import { RouteError } from '@/components/runtime/RouteError'

/** Galat di layout akar: menggantikan seluruh dokumen, jadi membawa html dan body sendiri. */
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body className="font-body text-fg bg-bg">
        <RouteError {...props} area="family" />
      </body>
    </html>
  )
}
