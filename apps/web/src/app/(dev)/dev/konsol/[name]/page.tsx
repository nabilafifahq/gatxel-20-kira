import { notFound } from 'next/navigation'
import { findPreview } from '../registry'
import { ClientPreview } from './client-previews'
import { serverPreview } from './server-previews'

export const dynamic = 'force-dynamic'

/** Pratinjau satu layar: /dev/konsol/<name>?state=<varian>. */
export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { name } = await params
  const sp = await searchParams
  const entry = findPreview(name)
  if (!entry) notFound()
  const flat: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp)) flat[k] = Array.isArray(v) ? v[0] : v
  const state = flat.state ?? entry.states[0] ?? 'default'

  const server = await serverPreview(name, state)
  const lang = entry.area === 'print' ? 'en-GB' : state.endsWith('-en') ? 'en-GB' : 'id'
  const area = entry.area === 'print' ? 'print' : entry.area
  return (
    <div data-area={area} lang={lang}>
      {server ?? <ClientPreview name={name} state={state} params={flat} />}
    </div>
  )
}
